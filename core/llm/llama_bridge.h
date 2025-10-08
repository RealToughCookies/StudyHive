#pragma once

#include <string>
#include <vector>
#include <functional>
#include <memory>
#include <nlohmann/json.hpp>

namespace studyhive {
namespace core {

struct LLMConfig {
    std::string model_path;
    std::string grammar_path;
    int max_tokens = 2048;
    float temperature = 0.7f;
    int seed = 42;
    int n_threads = 4;
    int n_ctx = 2048;
    int n_batch = 512;
};

struct LLMResponse {
    std::string content;
    bool success;
    std::string error_message;
    int tokens_generated;
    float processing_time_ms;
};

class LLMBridge {
public:
    LLMBridge();
    ~LLMBridge();

    // Initialize the LLM with model and grammar
    bool initialize(const LLMConfig& config);

    // Generate quiz JSON using GBNF grammar
    LLMResponse generateQuiz(const std::string& prompt, const std::string& grammar_path);

    // Grade answer JSON using GBNF grammar
    LLMResponse gradeAnswer(const std::string& prompt, const std::string& grammar_path);

    // Check if the model is loaded and ready
    bool isReady() const;

    // Get model information
    struct ModelInfo {
        std::string name;
        std::string version;
        size_t parameters;
        size_t context_size;
        std::string file_size;
    };
    
    ModelInfo getModelInfo() const;

    // Set progress callback for long operations
    void setProgressCallback(std::function<void(float)> callback);

    // Cleanup resources
    void cleanup();

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

// Utility functions for prompt construction
namespace prompts {

// System prompt for quiz generation
std::string getQuizSystemPrompt();

// Few-shot examples for quiz generation
std::string getQuizFewShotPrompt();

// System prompt for grading
std::string getGradeSystemPrompt();

// Construct quiz generation prompt
std::string buildQuizPrompt(const std::string& topic, 
                           const std::string& difficulty,
                           int num_questions,
                           const std::string& notes_content);

// Construct grading prompt
std::string buildGradePrompt(const nlohmann::json& question,
                            const std::string& student_answer,
                            const nlohmann::json& rubric);

} // namespace prompts

// JSON validation utilities
namespace validation {

// Validate quiz JSON against schema
bool validateQuizJson(const std::string& json_str, std::string& error_msg);

// Validate grade JSON against schema
bool validateGradeJson(const std::string& json_str, std::string& error_msg);

// Parse and validate quiz JSON
nlohmann::json parseQuizJson(const std::string& json_str, std::string& error_msg);

// Parse and validate grade JSON
nlohmann::json parseGradeJson(const std::string& json_str, std::string& error_msg);

} // namespace validation

} // namespace core
} // namespace studyhive
