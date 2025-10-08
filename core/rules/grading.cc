#include "grading.h"
#include <algorithm>
#include <regex>
#include <chrono>
#include <cmath>

namespace studyhive {
namespace core {

class GradingEngine::Impl {
public:
    Impl() {
        initialize();
    }

    bool initialize() {
        // Initialize default grading criteria
        initializeDefaultCriteria();
        return true;
    }

    GradingResult gradeMultipleChoice(const nlohmann::json& question,
                                    const std::string& student_answer) {
        auto start_time = std::chrono::high_resolution_clock::now();
        
        GradingResult result;
        result.max_score = 1.0f;
        
        // Get correct answer
        std::string correct_answer = question["correctAnswer"];
        
        // Simple exact match for multiple choice
        if (student_answer == correct_answer) {
            result.total_score = 1.0f;
            result.feedback = "Correct! " + question["explanation"].get<std::string>();
        } else {
            result.total_score = 0.0f;
            result.feedback = "Incorrect. The correct answer is: " + correct_answer + 
                            ". " + question["explanation"].get<std::string>();
        }
        
        // Add breakdown
        CriterionResult criterion_result;
        criterion_result.criterion_name = "Answer Selection";
        criterion_result.awarded_points = result.total_score;
        criterion_result.max_points = 1.0f;
        criterion_result.reasoning = (result.total_score > 0) ? 
            "Student selected the correct answer" : 
            "Student selected an incorrect answer";
        
        result.breakdown.push_back(criterion_result);
        
        auto end_time = std::chrono::high_resolution_clock::now();
        result.processing_time_ms = std::chrono::duration<float, std::milli>(end_time - start_time).count();
        
        return result;
    }

    GradingResult gradeShortAnswer(const nlohmann::json& question,
                                 const std::string& student_answer) {
        auto start_time = std::chrono::high_resolution_clock::now();
        
        GradingResult result;
        result.max_score = 0.0f;
        
        // Parse rubric
        auto rubric = rubric::parseRubric(question["rubric"]);
        
        float total_score = 0.0f;
        for (const auto& criterion : rubric) {
            CriterionResult criterion_result;
            criterion_result.criterion_name = criterion.name;
            criterion_result.max_points = criterion.max_points;
            
            // Calculate score based on keywords
            float score = grading::calculateKeywordScore(student_answer, criterion.keywords, criterion.max_points);
            criterion_result.awarded_points = score;
            total_score += score;
            result.max_score += criterion.max_points;
            
            // Find keywords
            auto found_keywords = grading::findKeywords(student_answer, criterion.keywords);
            criterion_result.found_keywords = found_keywords;
            
            // Missing keywords
            std::vector<std::string> missing_keywords;
            for (const auto& keyword : criterion.keywords) {
                if (std::find(found_keywords.begin(), found_keywords.end(), keyword) == found_keywords.end()) {
                    missing_keywords.push_back(keyword);
                }
            }
            criterion_result.missing_keywords = missing_keywords;
            
            // Generate reasoning
            criterion_result.reasoning = generateCriterionReasoning(criterion_result, criterion);
            
            result.breakdown.push_back(criterion_result);
        }
        
        result.total_score = total_score;
        result.feedback = grading::generateFeedback(result, question);
        
        auto end_time = std::chrono::high_resolution_clock::now();
        result.processing_time_ms = std::chrono::duration<float, std::milli>(end_time - start_time).count();
        
        return result;
    }

    GradingResult gradeFillInBlank(const nlohmann::json& question,
                                 const std::string& student_answer) {
        auto start_time = std::chrono::high_resolution_clock::now();
        
        GradingResult result;
        result.max_score = 1.0f;
        
        // Get correct answer
        std::string correct_answer = question["correctAnswer"];
        
        // Normalize answers for comparison
        std::string normalized_student = normalizeAnswer(student_answer);
        std::string normalized_correct = normalizeAnswer(correct_answer);
        
        // Calculate similarity
        float similarity = grading::calculateSimilarity(normalized_student, normalized_correct);
        
        // Award points based on similarity
        if (similarity > 0.9f) {
            result.total_score = 1.0f;
        } else if (similarity > 0.7f) {
            result.total_score = 0.8f;
        } else if (similarity > 0.5f) {
            result.total_score = 0.5f;
        } else {
            result.total_score = 0.0f;
        }
        
        // Add breakdown
        CriterionResult criterion_result;
        criterion_result.criterion_name = "Answer Accuracy";
        criterion_result.awarded_points = result.total_score;
        criterion_result.max_points = 1.0f;
        criterion_result.reasoning = "Similarity score: " + std::to_string(similarity);
        
        result.breakdown.push_back(criterion_result);
        
        // Generate feedback
        if (result.total_score >= 0.8f) {
            result.feedback = "Correct! " + question["explanation"].get<std::string>();
        } else if (result.total_score >= 0.5f) {
            result.feedback = "Partially correct. The correct answer is: " + correct_answer + 
                            ". " + question["explanation"].get<std::string>();
        } else {
            result.feedback = "Incorrect. The correct answer is: " + correct_answer + 
                            ". " + question["explanation"].get<std::string>();
        }
        
        auto end_time = std::chrono::high_resolution_clock::now();
        result.processing_time_ms = std::chrono::duration<float, std::milli>(end_time - start_time).count();
        
        return result;
    }

    void addCriterion(const GradingCriterion& criterion) {
        criteria_.push_back(criterion);
    }

    std::vector<GradingCriterion> getCriteria() const {
        return criteria_;
    }

private:
    std::vector<GradingCriterion> criteria_;

    void initializeDefaultCriteria() {
        // Add default grading criteria
        GradingCriterion understanding;
        understanding.name = "Understanding";
        understanding.max_points = 5;
        understanding.keywords = {"understand", "explain", "describe", "define"};
        understanding.description = "Tests basic understanding of the concept";
        criteria_.push_back(understanding);

        GradingCriterion analysis;
        analysis.name = "Analysis";
        analysis.max_points = 5;
        analysis.keywords = {"analyze", "compare", "contrast", "evaluate"};
        analysis.description = "Tests analytical thinking skills";
        criteria_.push_back(analysis);

        GradingCriterion application;
        application.name = "Application";
        application.max_points = 5;
        application.keywords = {"apply", "use", "implement", "demonstrate"};
        application.description = "Tests ability to apply knowledge";
        criteria_.push_back(application);
    }

    std::string normalizeAnswer(const std::string& answer) {
        std::string normalized = answer;
        
        // Convert to lowercase
        std::transform(normalized.begin(), normalized.end(), normalized.begin(), ::tolower);
        
        // Remove extra whitespace
        std::regex whitespace_pattern(R"(\s+)");
        normalized = std::regex_replace(normalized, whitespace_pattern, " ");
        
        // Trim
        normalized.erase(0, normalized.find_first_not_of(" \t\n\r"));
        normalized.erase(normalized.find_last_not_of(" \t\n\r") + 1);
        
        return normalized;
    }

    std::string generateCriterionReasoning(const CriterionResult& result, const GradingCriterion& criterion) {
        std::string reasoning = "Awarded " + std::to_string(result.awarded_points) + 
                              " out of " + std::to_string(result.max_points) + " points. ";
        
        if (!result.found_keywords.empty()) {
            reasoning += "Found keywords: ";
            for (size_t i = 0; i < result.found_keywords.size(); ++i) {
                if (i > 0) reasoning += ", ";
                reasoning += result.found_keywords[i];
            }
            reasoning += ". ";
        }
        
        if (!result.missing_keywords.empty()) {
            reasoning += "Missing keywords: ";
            for (size_t i = 0; i < result.missing_keywords.size(); ++i) {
                if (i > 0) reasoning += ", ";
                reasoning += result.missing_keywords[i];
            }
            reasoning += ". ";
        }
        
        return reasoning;
    }
};

// GradingEngine implementation
GradingEngine::GradingEngine() : impl_(std::make_unique<Impl>()) {}

GradingEngine::~GradingEngine() = default;

bool GradingEngine::initialize() {
    return impl_->initialize();
}

GradingResult GradingEngine::gradeMultipleChoice(const nlohmann::json& question,
                                                const std::string& student_answer) {
    return impl_->gradeMultipleChoice(question, student_answer);
}

GradingResult GradingEngine::gradeShortAnswer(const nlohmann::json& question,
                                            const std::string& student_answer) {
    return impl_->gradeShortAnswer(question, student_answer);
}

GradingResult GradingEngine::gradeFillInBlank(const nlohmann::json& question,
                                            const std::string& student_answer) {
    return impl_->gradeFillInBlank(question, student_answer);
}

void GradingEngine::addCriterion(const GradingCriterion& criterion) {
    impl_->addCriterion(criterion);
}

std::vector<GradingCriterion> GradingEngine::getCriteria() const {
    return impl_->getCriteria();
}

// Grading utilities
namespace grading {

float calculateSimilarity(const std::string& text1, const std::string& text2) {
    if (text1.empty() && text2.empty()) return 1.0f;
    if (text1.empty() || text2.empty()) return 0.0f;
    
    // Simple Levenshtein distance-based similarity
    size_t len1 = text1.length();
    size_t len2 = text2.length();
    
    if (len1 == 0) return len2 == 0 ? 1.0f : 0.0f;
    if (len2 == 0) return 0.0f;
    
    // Create matrix
    std::vector<std::vector<int>> matrix(len1 + 1, std::vector<int>(len2 + 1));
    
    // Initialize first row and column
    for (size_t i = 0; i <= len1; ++i) {
        matrix[i][0] = i;
    }
    for (size_t j = 0; j <= len2; ++j) {
        matrix[0][j] = j;
    }
    
    // Fill matrix
    for (size_t i = 1; i <= len1; ++i) {
        for (size_t j = 1; j <= len2; ++j) {
            int cost = (text1[i-1] == text2[j-1]) ? 0 : 1;
            matrix[i][j] = std::min({
                matrix[i-1][j] + 1,      // deletion
                matrix[i][j-1] + 1,      // insertion
                matrix[i-1][j-1] + cost  // substitution
            });
        }
    }
    
    int distance = matrix[len1][len2];
    int max_len = std::max(len1, len2);
    
    return 1.0f - (static_cast<float>(distance) / max_len);
}

std::vector<std::string> extractKeywords(const std::string& text) {
    std::vector<std::string> keywords;
    
    // Simple keyword extraction - split by whitespace and filter
    std::regex word_pattern(R"(\b[a-zA-Z]{3,}\b)");
    std::sregex_iterator iter(text.begin(), text.end(), word_pattern);
    std::sregex_iterator end;
    
    for (; iter != end; ++iter) {
        std::string word = iter->str();
        std::transform(word.begin(), word.end(), word.begin(), ::tolower);
        keywords.push_back(word);
    }
    
    return keywords;
}

std::vector<std::string> findKeywords(const std::string& text, 
                                    const std::vector<std::string>& keywords) {
    std::vector<std::string> found;
    std::string lower_text = text;
    std::transform(lower_text.begin(), lower_text.end(), lower_text.begin(), ::tolower);
    
    for (const auto& keyword : keywords) {
        std::string lower_keyword = keyword;
        std::transform(lower_keyword.begin(), lower_keyword.end(), lower_keyword.begin(), ::tolower);
        
        if (lower_text.find(lower_keyword) != std::string::npos) {
            found.push_back(keyword);
        }
    }
    
    return found;
}

float calculateKeywordScore(const std::string& answer,
                           const std::vector<std::string>& keywords,
                           int max_points) {
    if (keywords.empty()) return max_points;
    
    auto found_keywords = findKeywords(answer, keywords);
    float ratio = static_cast<float>(found_keywords.size()) / keywords.size();
    
    return ratio * max_points;
}

std::string generateFeedback(const GradingResult& result,
                           const nlohmann::json& question) {
    std::string feedback = "Score: " + std::to_string(result.total_score) + 
                          "/" + std::to_string(result.max_score) + " points. ";
    
    if (result.total_score >= result.max_score * 0.9f) {
        feedback += "Excellent work! ";
    } else if (result.total_score >= result.max_score * 0.7f) {
        feedback += "Good job! ";
    } else if (result.total_score >= result.max_score * 0.5f) {
        feedback += "You're on the right track. ";
    } else {
        feedback += "Keep studying and try again. ";
    }
    
    // Add specific feedback based on breakdown
    for (const auto& criterion : result.breakdown) {
        if (criterion.awarded_points < criterion.max_points) {
            feedback += "Consider improving your " + criterion.criterion_name + ". ";
        }
    }
    
    return feedback;
}

bool validateGradingResult(const GradingResult& result) {
    // Check if total score is within bounds
    if (result.total_score < 0 || result.total_score > result.max_score) {
        return false;
    }
    
    // Check if breakdown sums to total score
    float breakdown_sum = 0.0f;
    for (const auto& criterion : result.breakdown) {
        breakdown_sum += criterion.awarded_points;
    }
    
    // Allow small floating point differences
    if (std::abs(breakdown_sum - result.total_score) > 0.01f) {
        return false;
    }
    
    return true;
}

} // namespace grading

// Rubric parsing utilities
namespace rubric {

std::vector<GradingCriterion> parseRubric(const nlohmann::json& rubric_json) {
    std::vector<GradingCriterion> criteria;
    
    if (!rubric_json.is_array()) {
        return criteria;
    }
    
    for (const auto& criterion_json : rubric_json) {
        criteria.push_back(convertToCriterion(criterion_json));
    }
    
    return criteria;
}

GradingCriterion convertToCriterion(const nlohmann::json& criterion_json) {
    GradingCriterion criterion;
    
    criterion.name = criterion_json.value("criterion", "Unnamed Criterion");
    criterion.max_points = criterion_json.value("points", 5);
    criterion.description = criterion_json.value("description", "");
    
    if (criterion_json.contains("keywords") && criterion_json["keywords"].is_array()) {
        for (const auto& keyword : criterion_json["keywords"]) {
            criterion.keywords.push_back(keyword.get<std::string>());
        }
    }
    
    return criterion;
}

bool validateRubric(const nlohmann::json& rubric_json) {
    if (!rubric_json.is_array()) {
        return false;
    }
    
    for (const auto& criterion_json : rubric_json) {
        if (!criterion_json.contains("criterion") || 
            !criterion_json.contains("points") ||
            !criterion_json.contains("keywords")) {
            return false;
        }
        
        if (!criterion_json["keywords"].is_array()) {
            return false;
        }
    }
    
    return true;
}

} // namespace rubric

} // namespace core
} // namespace studyhive
