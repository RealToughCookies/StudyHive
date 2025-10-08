#pragma once

#include <string>
#include <unordered_map>
#include <list>
#include <mutex>
#include <chrono>
#include <memory>

namespace studyhive {
namespace core {

struct CacheEntry {
    std::string key;
    std::string value;
    std::string source;  // "device-llm" or "rules"
    std::chrono::steady_clock::time_point created_at;
    std::chrono::steady_clock::time_point last_accessed;
    size_t size_bytes;
    
    CacheEntry(const std::string& k, const std::string& v, const std::string& s)
        : key(k), value(v), source(s), size_bytes(v.length()) {
        auto now = std::chrono::steady_clock::now();
        created_at = now;
        last_accessed = now;
    }
};

class KVStore {
public:
    KVStore(size_t max_size_bytes = 200 * 1024 * 1024); // 200MB default
    ~KVStore();

    // Basic operations
    bool put(const std::string& key, const std::string& value, const std::string& source = "");
    bool get(const std::string& key, std::string& value, std::string& source = "");
    bool remove(const std::string& key);
    bool exists(const std::string& key);
    
    // Cache-specific operations
    void clear();
    size_t size() const;
    size_t sizeBytes() const;
    size_t maxSizeBytes() const;
    void setMaxSizeBytes(size_t max_size);
    
    // Source tracking
    std::vector<std::string> getKeysBySource(const std::string& source);
    size_t getSizeBySource(const std::string& source);
    void clearBySource(const std::string& source);
    
    // Statistics
    struct CacheStats {
        size_t total_entries;
        size_t total_size_bytes;
        size_t llm_entries;
        size_t llm_size_bytes;
        size_t rules_entries;
        size_t rules_size_bytes;
        float hit_rate;
        size_t evictions;
    };
    
    CacheStats getStats() const;
    void resetStats();
    
    // Persistence
    bool saveToFile(const std::string& filename);
    bool loadFromFile(const std::string& filename);
    
    // Cleanup
    void cleanupExpiredEntries(std::chrono::hours max_age = std::chrono::hours(24));
    void cleanupOldEntries(size_t max_entries);

private:
    mutable std::mutex mutex_;
    size_t max_size_bytes_;
    size_t current_size_bytes_;
    
    // LRU implementation using doubly-linked list
    std::list<CacheEntry> lru_list_;
    std::unordered_map<std::string, std::list<CacheEntry>::iterator> key_map_;
    
    // Statistics
    mutable size_t hits_;
    mutable size_t misses_;
    mutable size_t evictions_;
    
    // Helper methods
    void evictLRU();
    void updateLRU(std::list<CacheEntry>::iterator it);
    void removeEntry(std::list<CacheEntry>::iterator it);
    std::string generateKey(const std::string& topic, const std::string& difficulty,
                          int num_items, int seed, const std::string& engine);
};

// Quiz-specific cache operations
namespace quiz_cache {

// Generate cache key for quiz
std::string generateQuizKey(const std::string& topic, const std::string& difficulty,
                          int num_questions, int seed, const std::string& engine);

// Generate cache key for grade
std::string generateGradeKey(const std::string& question_id, const std::string& student_answer,
                           const std::string& engine);

// Cache quiz result
bool cacheQuiz(KVStore& store, const std::string& topic, const std::string& difficulty,
              int num_questions, int seed, const std::string& engine,
              const std::string& quiz_json);

// Cache grade result
bool cacheGrade(KVStore& store, const std::string& question_id, const std::string& student_answer,
               const std::string& engine, const std::string& grade_json);

// Retrieve cached quiz
bool getCachedQuiz(KVStore& store, const std::string& topic, const std::string& difficulty,
                  int num_questions, int seed, const std::string& engine,
                  std::string& quiz_json, std::string& source);

// Retrieve cached grade
bool getCachedGrade(KVStore& store, const std::string& question_id, const std::string& student_answer,
                   const std::string& engine, std::string& grade_json, std::string& source);

} // namespace quiz_cache

// Cache management utilities
namespace cache_utils {

// Calculate hash for cache key
std::string calculateHash(const std::string& input);

// Validate cache entry
bool validateCacheEntry(const CacheEntry& entry);

// Serialize cache entry to JSON
std::string serializeEntry(const CacheEntry& entry);

// Deserialize cache entry from JSON
bool deserializeEntry(const std::string& json, CacheEntry& entry);

// Get cache file path
std::string getCacheFilePath(const std::string& base_path = "");

// Clean up old cache files
void cleanupOldCacheFiles(const std::string& cache_dir, std::chrono::days max_age);

} // namespace cache_utils

} // namespace core
} // namespace studyhive
