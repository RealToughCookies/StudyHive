#include "kv_store.h"
#include <fstream>
#include <sstream>
#include <algorithm>
#include <filesystem>
#include <nlohmann/json.hpp>

namespace studyhive {
namespace core {

KVStore::KVStore(size_t max_size_bytes) 
    : max_size_bytes_(max_size_bytes), current_size_bytes_(0), hits_(0), misses_(0), evictions_(0) {
}

KVStore::~KVStore() {
    std::lock_guard<std::mutex> lock(mutex_);
    clear();
}

bool KVStore::put(const std::string& key, const std::string& value, const std::string& source) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    // Check if key already exists
    auto it = key_map_.find(key);
    if (it != key_map_.end()) {
        // Update existing entry
        auto& entry = *it->second;
        current_size_bytes_ -= entry.size_bytes;
        entry.value = value;
        entry.source = source;
        entry.size_bytes = value.length();
        entry.last_accessed = std::chrono::steady_clock::now();
        current_size_bytes_ += entry.size_bytes;
        updateLRU(it->second);
        return true;
    }
    
    // Create new entry
    CacheEntry entry(key, value, source);
    
    // Check if we need to evict entries
    while (current_size_bytes_ + entry.size_bytes > max_size_bytes_ && !lru_list_.empty()) {
        evictLRU();
    }
    
    // Add new entry
    lru_list_.push_front(entry);
    key_map_[key] = lru_list_.begin();
    current_size_bytes_ += entry.size_bytes;
    
    return true;
}

bool KVStore::get(const std::string& key, std::string& value, std::string& source) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = key_map_.find(key);
    if (it != key_map_.end()) {
        // Found entry
        value = it->second->value;
        source = it->second->source;
        it->second->last_accessed = std::chrono::steady_clock::now();
        updateLRU(it->second);
        hits_++;
        return true;
    }
    
    misses_++;
    return false;
}

bool KVStore::remove(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = key_map_.find(key);
    if (it != key_map_.end()) {
        removeEntry(it->second);
        key_map_.erase(it);
        return true;
    }
    
    return false;
}

bool KVStore::exists(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    return key_map_.find(key) != key_map_.end();
}

void KVStore::clear() {
    std::lock_guard<std::mutex> lock(mutex_);
    lru_list_.clear();
    key_map_.clear();
    current_size_bytes_ = 0;
}

size_t KVStore::size() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return key_map_.size();
}

size_t KVStore::sizeBytes() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return current_size_bytes_;
}

size_t KVStore::maxSizeBytes() const {
    return max_size_bytes_;
}

void KVStore::setMaxSizeBytes(size_t max_size) {
    std::lock_guard<std::mutex> lock(mutex_);
    max_size_bytes_ = max_size;
    
    // Evict entries if necessary
    while (current_size_bytes_ > max_size_bytes_ && !lru_list_.empty()) {
        evictLRU();
    }
}

std::vector<std::string> KVStore::getKeysBySource(const std::string& source) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::string> keys;
    
    for (const auto& entry : lru_list_) {
        if (entry.source == source) {
            keys.push_back(entry.key);
        }
    }
    
    return keys;
}

size_t KVStore::getSizeBySource(const std::string& source) {
    std::lock_guard<std::mutex> lock(mutex_);
    size_t size = 0;
    
    for (const auto& entry : lru_list_) {
        if (entry.source == source) {
            size += entry.size_bytes;
        }
    }
    
    return size;
}

void KVStore::clearBySource(const std::string& source) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = lru_list_.begin();
    while (it != lru_list_.end()) {
        if (it->source == source) {
            current_size_bytes_ -= it->size_bytes;
            key_map_.erase(it->key);
            it = lru_list_.erase(it);
        } else {
            ++it;
        }
    }
}

KVStore::CacheStats KVStore::getStats() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    CacheStats stats;
    stats.total_entries = key_map_.size();
    stats.total_size_bytes = current_size_bytes_;
    stats.evictions = evictions_;
    
    // Calculate hit rate
    size_t total_requests = hits_ + misses_;
    stats.hit_rate = total_requests > 0 ? static_cast<float>(hits_) / total_requests : 0.0f;
    
    // Count entries by source
    for (const auto& entry : lru_list_) {
        if (entry.source == "device-llm") {
            stats.llm_entries++;
            stats.llm_size_bytes += entry.size_bytes;
        } else if (entry.source == "rules") {
            stats.rules_entries++;
            stats.rules_size_bytes += entry.size_bytes;
        }
    }
    
    return stats;
}

void KVStore::resetStats() {
    std::lock_guard<std::mutex> lock(mutex_);
    hits_ = 0;
    misses_ = 0;
    evictions_ = 0;
}

bool KVStore::saveToFile(const std::string& filename) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    try {
        nlohmann::json cache_data;
        cache_data["version"] = "1.0";
        cache_data["max_size_bytes"] = max_size_bytes_;
        cache_data["entries"] = nlohmann::json::array();
        
        for (const auto& entry : lru_list_) {
            nlohmann::json entry_json;
            entry_json["key"] = entry.key;
            entry_json["value"] = entry.value;
            entry_json["source"] = entry.source;
            entry_json["created_at"] = std::chrono::duration_cast<std::chrono::seconds>(
                entry.created_at.time_since_epoch()).count();
            entry_json["last_accessed"] = std::chrono::duration_cast<std::chrono::seconds>(
                entry.last_accessed.time_since_epoch()).count();
            entry_json["size_bytes"] = entry.size_bytes;
            
            cache_data["entries"].push_back(entry_json);
        }
        
        std::ofstream file(filename);
        if (!file.is_open()) {
            return false;
        }
        
        file << cache_data.dump(2);
        return true;
        
    } catch (const std::exception& e) {
        return false;
    }
}

bool KVStore::loadFromFile(const std::string& filename) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    try {
        if (!std::filesystem::exists(filename)) {
            return false;
        }
        
        std::ifstream file(filename);
        if (!file.is_open()) {
            return false;
        }
        
        nlohmann::json cache_data;
        file >> cache_data;
        
        // Clear existing entries
        clear();
        
        // Load max size
        if (cache_data.contains("max_size_bytes")) {
            max_size_bytes_ = cache_data["max_size_bytes"];
        }
        
        // Load entries
        if (cache_data.contains("entries") && cache_data["entries"].is_array()) {
            for (const auto& entry_json : cache_data["entries"]) {
                CacheEntry entry(
                    entry_json["key"],
                    entry_json["value"],
                    entry_json["source"]
                );
                
                // Restore timestamps
                if (entry_json.contains("created_at")) {
                    auto created_seconds = std::chrono::seconds(entry_json["created_at"]);
                    entry.created_at = std::chrono::steady_clock::time_point(created_seconds);
                }
                
                if (entry_json.contains("last_accessed")) {
                    auto accessed_seconds = std::chrono::seconds(entry_json["last_accessed"]);
                    entry.last_accessed = std::chrono::steady_clock::time_point(accessed_seconds);
                }
                
                // Add entry
                lru_list_.push_front(entry);
                key_map_[entry.key] = lru_list_.begin();
                current_size_bytes_ += entry.size_bytes;
            }
        }
        
        return true;
        
    } catch (const std::exception& e) {
        return false;
    }
}

void KVStore::cleanupExpiredEntries(std::chrono::hours max_age) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto now = std::chrono::steady_clock::now();
    auto it = lru_list_.begin();
    
    while (it != lru_list_.end()) {
        if (now - it->last_accessed > max_age) {
            current_size_bytes_ -= it->size_bytes;
            key_map_.erase(it->key);
            it = lru_list_.erase(it);
        } else {
            ++it;
        }
    }
}

void KVStore::cleanupOldEntries(size_t max_entries) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    while (key_map_.size() > max_entries && !lru_list_.empty()) {
        evictLRU();
    }
}

void KVStore::evictLRU() {
    if (lru_list_.empty()) return;
    
    auto lru_entry = lru_list_.back();
    current_size_bytes_ -= lru_entry.size_bytes;
    key_map_.erase(lru_entry.key);
    lru_list_.pop_back();
    evictions_++;
}

void KVStore::updateLRU(std::list<CacheEntry>::iterator it) {
    // Move to front of list (most recently used)
    lru_list_.splice(lru_list_.begin(), lru_list_, it);
}

void KVStore::removeEntry(std::list<CacheEntry>::iterator it) {
    current_size_bytes_ -= it->size_bytes;
    lru_list_.erase(it);
}

std::string KVStore::generateKey(const std::string& topic, const std::string& difficulty,
                                int num_items, int seed, const std::string& engine) {
    std::stringstream key_stream;
    key_stream << topic << ":" << difficulty << ":" << num_items << ":" << seed << ":" << engine;
    return cache_utils::calculateHash(key_stream.str());
}

// Quiz-specific cache operations
namespace quiz_cache {

std::string generateQuizKey(const std::string& topic, const std::string& difficulty,
                          int num_questions, int seed, const std::string& engine) {
    std::stringstream key_stream;
    key_stream << "quiz:" << topic << ":" << difficulty << ":" << num_questions << ":" << seed << ":" << engine;
    return cache_utils::calculateHash(key_stream.str());
}

std::string generateGradeKey(const std::string& question_id, const std::string& student_answer,
                           const std::string& engine) {
    std::stringstream key_stream;
    key_stream << "grade:" << question_id << ":" << student_answer << ":" << engine;
    return cache_utils::calculateHash(key_stream.str());
}

bool cacheQuiz(KVStore& store, const std::string& topic, const std::string& difficulty,
              int num_questions, int seed, const std::string& engine,
              const std::string& quiz_json) {
    std::string key = generateQuizKey(topic, difficulty, num_questions, seed, engine);
    return store.put(key, quiz_json, engine);
}

bool cacheGrade(KVStore& store, const std::string& question_id, const std::string& student_answer,
               const std::string& engine, const std::string& grade_json) {
    std::string key = generateGradeKey(question_id, student_answer, engine);
    return store.put(key, grade_json, engine);
}

bool getCachedQuiz(KVStore& store, const std::string& topic, const std::string& difficulty,
                  int num_questions, int seed, const std::string& engine,
                  std::string& quiz_json, std::string& source) {
    std::string key = generateQuizKey(topic, difficulty, num_questions, seed, engine);
    return store.get(key, quiz_json, source);
}

bool getCachedGrade(KVStore& store, const std::string& question_id, const std::string& student_answer,
                   const std::string& engine, std::string& grade_json, std::string& source) {
    std::string key = generateGradeKey(question_id, student_answer, engine);
    return store.get(key, grade_json, source);
}

} // namespace quiz_cache

// Cache management utilities
namespace cache_utils {

std::string calculateHash(const std::string& input) {
    // Simple hash function for demonstration
    // In production, use a proper hash function like SHA-256
    std::hash<std::string> hasher;
    size_t hash_value = hasher(input);
    
    std::stringstream ss;
    ss << std::hex << hash_value;
    return ss.str();
}

bool validateCacheEntry(const CacheEntry& entry) {
    return !entry.key.empty() && !entry.value.empty() && entry.size_bytes > 0;
}

std::string serializeEntry(const CacheEntry& entry) {
    nlohmann::json entry_json;
    entry_json["key"] = entry.key;
    entry_json["value"] = entry.value;
    entry_json["source"] = entry.source;
    entry_json["created_at"] = std::chrono::duration_cast<std::chrono::seconds>(
        entry.created_at.time_since_epoch()).count();
    entry_json["last_accessed"] = std::chrono::duration_cast<std::chrono::seconds>(
        entry.last_accessed.time_since_epoch()).count();
    entry_json["size_bytes"] = entry.size_bytes;
    
    return entry_json.dump();
}

bool deserializeEntry(const std::string& json, CacheEntry& entry) {
    try {
        nlohmann::json entry_json = nlohmann::json::parse(json);
        
        entry.key = entry_json["key"];
        entry.value = entry_json["value"];
        entry.source = entry_json["source"];
        entry.size_bytes = entry_json["size_bytes"];
        
        // Restore timestamps
        if (entry_json.contains("created_at")) {
            auto created_seconds = std::chrono::seconds(entry_json["created_at"]);
            entry.created_at = std::chrono::steady_clock::time_point(created_seconds);
        }
        
        if (entry_json.contains("last_accessed")) {
            auto accessed_seconds = std::chrono::seconds(entry_json["last_accessed"]);
            entry.last_accessed = std::chrono::steady_clock::time_point(accessed_seconds);
        }
        
        return validateCacheEntry(entry);
        
    } catch (const std::exception& e) {
        return false;
    }
}

std::string getCacheFilePath(const std::string& base_path) {
    if (base_path.empty()) {
        return "studyhive_cache.json";
    }
    
    std::filesystem::path cache_path(base_path);
    cache_path /= "studyhive_cache.json";
    return cache_path.string();
}

void cleanupOldCacheFiles(const std::string& cache_dir, std::chrono::days max_age) {
    try {
        if (!std::filesystem::exists(cache_dir)) {
            return;
        }
        
        auto now = std::filesystem::file_time_type::clock::now();
        auto max_age_duration = std::chrono::duration_cast<std::chrono::seconds>(max_age);
        
        for (const auto& entry : std::filesystem::directory_iterator(cache_dir)) {
            if (entry.is_regular_file() && entry.path().extension() == ".json") {
                auto file_time = entry.last_write_time();
                auto age = now - file_time;
                
                if (age > max_age_duration) {
                    std::filesystem::remove(entry.path());
                }
            }
        }
        
    } catch (const std::exception& e) {
        // Log error but don't throw
    }
}

} // namespace cache_utils

} // namespace core
} // namespace studyhive
