#pragma once

#include <string>
#include <vector>
#include <memory>
#include <nlohmann/json.hpp>

namespace studyhive {
namespace core {

struct QuestionTemplate {
    std::string id;
    std::string type;
    std::string prompt_template;
    std::vector<std::string> required_fields;
    int difficulty_weight;
};

struct ParsedContent {
    std::vector<std::string> concepts;
    std::vector<std::string> definitions;
    std::vector<std::string> formulas;
    std::vector<std::string> examples;
    std::vector<std::string> keywords;
};

class QuestionGenerator {
public:
    QuestionGenerator();
    ~QuestionGenerator();

    // Initialize the generator with templates and rules
    bool initialize();

    // Parse notes content into structured data
    ParsedContent parseContent(const std::string& notes);

    // Generate quiz questions based on parsed content
    std::vector<nlohmann::json> generateQuestions(const ParsedContent& content,
                                                 const std::string& difficulty,
                                                 int num_questions,
                                                 int seed = 42);

    // Get available question templates
    std::vector<QuestionTemplate> getTemplates() const;

    // Add custom question template
    void addTemplate(const QuestionTemplate& template);

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

// Question template definitions
namespace templates {

// Multiple choice question templates
QuestionTemplate createConceptMCQ();
QuestionTemplate createDefinitionMCQ();
QuestionTemplate createFormulaMCQ();
QuestionTemplate createExampleMCQ();

// Short answer question templates
QuestionTemplate createConceptExplanation();
QuestionTemplate createProcessDescription();
QuestionTemplate createComparisonQuestion();

// Fill-in-the-blank templates
QuestionTemplate createClozeQuestion();
QuestionTemplate createFormulaCompletion();

// Get all default templates
std::vector<QuestionTemplate> getAllTemplates();

} // namespace templates

// Content parsing utilities
namespace parsing {

// Extract concepts from text
std::vector<std::string> extractConcepts(const std::string& text);

// Extract definitions (sentences with "is", "are", "means", etc.)
std::vector<std::string> extractDefinitions(const std::string& text);

// Extract formulas (text with mathematical notation)
std::vector<std::string> extractFormulas(const std::string& text);

// Extract examples (sentences with "for example", "such as", etc.)
std::vector<std::string> extractExamples(const std::string& text);

// Extract keywords (important terms)
std::vector<std::string> extractKeywords(const std::string& text);

// Clean and normalize text
std::string cleanText(const std::string& text);

} // namespace parsing

// Question generation utilities
namespace generation {

// Generate multiple choice options with distractors
std::vector<nlohmann::json> generateMCOptions(const std::string& correct_answer,
                                             const std::vector<std::string>& distractors,
                                             int num_options = 4);

// Generate distractors using WordNet
std::vector<std::string> generateDistractors(const std::string& concept,
                                           const std::vector<std::string>& available_concepts,
                                           int num_distractors = 3);

// Apply template to content
nlohmann::json applyTemplate(const QuestionTemplate& template,
                           const ParsedContent& content,
                           const std::string& difficulty,
                           int seed);

// Validate generated question
bool validateQuestion(const nlohmann::json& question);

} // namespace generation

} // namespace core
} // namespace studyhive
