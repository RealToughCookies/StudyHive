#pragma once

#include <string>
#include <vector>
#include <memory>
#include <nlohmann/json.hpp>

namespace studyhive {
namespace core {

struct GradingCriterion {
    std::string name;
    int max_points;
    std::vector<std::string> keywords;
    std::string description;
    float weight = 1.0f;
};

struct GradingResult {
    float total_score;
    float max_score;
    std::vector<CriterionResult> breakdown;
    std::string feedback;
    float processing_time_ms;
};

struct CriterionResult {
    std::string criterion_name;
    float awarded_points;
    float max_points;
    std::string reasoning;
    std::vector<std::string> found_keywords;
    std::vector<std::string> missing_keywords;
};

class GradingEngine {
public:
    GradingEngine();
    ~GradingEngine();

    // Initialize the grading engine
    bool initialize();

    // Grade a multiple choice answer
    GradingResult gradeMultipleChoice(const nlohmann::json& question,
                                    const std::string& student_answer);

    // Grade a short answer question
    GradingResult gradeShortAnswer(const nlohmann::json& question,
                                 const std::string& student_answer);

    // Grade a fill-in-the-blank answer
    GradingResult gradeFillInBlank(const nlohmann::json& question,
                                 const std::string& student_answer);

    // Add custom grading criterion
    void addCriterion(const GradingCriterion& criterion);

    // Get available grading criteria
    std::vector<GradingCriterion> getCriteria() const;

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

// Grading utilities
namespace grading {

// Fuzzy string matching for keyword detection
float calculateSimilarity(const std::string& text1, const std::string& text2);

// Extract keywords from text
std::vector<std::string> extractKeywords(const std::string& text);

// Check if keywords are present in text
std::vector<std::string> findKeywords(const std::string& text, 
                                     const std::vector<std::string>& keywords);

// Calculate score based on keyword presence
float calculateKeywordScore(const std::string& answer,
                           const std::vector<std::string>& keywords,
                           int max_points);

// Generate feedback based on grading results
std::string generateFeedback(const GradingResult& result,
                           const nlohmann::json& question);

// Validate grading result
bool validateGradingResult(const GradingResult& result);

} // namespace grading

// Rubric parsing utilities
namespace rubric {

// Parse rubric from question JSON
std::vector<GradingCriterion> parseRubric(const nlohmann::json& rubric_json);

// Convert rubric to grading criteria
GradingCriterion convertToCriterion(const nlohmann::json& criterion_json);

// Validate rubric format
bool validateRubric(const nlohmann::json& rubric_json);

} // namespace rubric

} // namespace core
} // namespace studyhive
