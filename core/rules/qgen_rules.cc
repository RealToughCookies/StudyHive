#include "qgen_rules.h"
#include <random>
#include <sstream>
#include <algorithm>
#include <regex>

namespace studyhive {
namespace core {

class QuestionGenerator::Impl {
public:
    Impl() {
        initialize();
    }

    bool initialize() {
        // Load default templates
        templates_ = templates::getAllTemplates();
        return true;
    }

    ParsedContent parseContent(const std::string& notes) {
        ParsedContent content;
        
        content.concepts = parsing::extractConcepts(notes);
        content.definitions = parsing::extractDefinitions(notes);
        content.formulas = parsing::extractFormulas(notes);
        content.examples = parsing::extractExamples(notes);
        content.keywords = parsing::extractKeywords(notes);
        
        return content;
    }

    std::vector<nlohmann::json> generateQuestions(const ParsedContent& content,
                                                 const std::string& difficulty,
                                                 int num_questions,
                                                 int seed = 42) {
        std::vector<nlohmann::json> questions;
        
        if (content.concepts.empty()) {
            return questions;
        }

        std::mt19937 rng(seed);
        
        // Filter templates by difficulty
        std::vector<QuestionTemplate> suitable_templates;
        for (const auto& template : templates_) {
            if (isDifficultySuitable(template, difficulty)) {
                suitable_templates.push_back(template);
            }
        }

        if (suitable_templates.empty()) {
            return questions;
        }

        // Generate questions
        for (int i = 0; i < num_questions; ++i) {
            std::uniform_int_distribution<int> template_dist(0, suitable_templates.size() - 1);
            const auto& selected_template = suitable_templates[template_dist(rng)];
            
            try {
                auto question = generation::applyTemplate(selected_template, content, difficulty, seed + i);
                if (generation::validateQuestion(question)) {
                    questions.push_back(question);
                }
            } catch (const std::exception& e) {
                // Skip invalid questions
                continue;
            }
        }

        return questions;
    }

    std::vector<QuestionTemplate> getTemplates() const {
        return templates_;
    }

    void addTemplate(const QuestionTemplate& template) {
        templates_.push_back(template);
    }

private:
    std::vector<QuestionTemplate> templates_;

    bool isDifficultySuitable(const QuestionTemplate& template, const std::string& difficulty) {
        if (difficulty == "easy") {
            return template.difficulty_weight <= 2;
        } else if (difficulty == "medium") {
            return template.difficulty_weight >= 2 && template.difficulty_weight <= 4;
        } else if (difficulty == "hard") {
            return template.difficulty_weight >= 3;
        }
        return true;
    }
};

// QuestionGenerator implementation
QuestionGenerator::QuestionGenerator() : impl_(std::make_unique<Impl>()) {}

QuestionGenerator::~QuestionGenerator() = default;

bool QuestionGenerator::initialize() {
    return impl_->initialize();
}

ParsedContent QuestionGenerator::parseContent(const std::string& notes) {
    return impl_->parseContent(notes);
}

std::vector<nlohmann::json> QuestionGenerator::generateQuestions(const ParsedContent& content,
                                                               const std::string& difficulty,
                                                               int num_questions,
                                                               int seed) {
    return impl_->generateQuestions(content, difficulty, num_questions, seed);
}

std::vector<QuestionTemplate> QuestionGenerator::getTemplates() const {
    return impl_->getTemplates();
}

void QuestionGenerator::addTemplate(const QuestionTemplate& template) {
    impl_->addTemplate(template);
}

// Template definitions
namespace templates {

QuestionTemplate createConceptMCQ() {
    QuestionTemplate template;
    template.id = "concept_mcq";
    template.type = "multiple_choice";
    template.prompt_template = "What is {concept}?";
    template.required_fields = {"concept"};
    template.difficulty_weight = 2;
    return template;
}

QuestionTemplate createDefinitionMCQ() {
    QuestionTemplate template;
    template.id = "definition_mcq";
    template.type = "multiple_choice";
    template.prompt_template = "Which of the following best defines {concept}?";
    template.required_fields = {"concept"};
    template.difficulty_weight = 3;
    return template;
}

QuestionTemplate createFormulaMCQ() {
    QuestionTemplate template;
    template.id = "formula_mcq";
    template.type = "multiple_choice";
    template.prompt_template = "What is the formula for {concept}?";
    template.required_fields = {"concept"};
    template.difficulty_weight = 3;
    return template;
}

QuestionTemplate createExampleMCQ() {
    QuestionTemplate template;
    template.id = "example_mcq";
    template.type = "multiple_choice";
    template.prompt_template = "Which of the following is an example of {concept}?";
    template.required_fields = {"concept"};
    template.difficulty_weight = 2;
    return template;
}

QuestionTemplate createConceptExplanation() {
    QuestionTemplate template;
    template.id = "concept_explanation";
    template.type = "short_answer";
    template.prompt_template = "Explain what {concept} is and how it works.";
    template.required_fields = {"concept"};
    template.difficulty_weight = 4;
    return template;
}

QuestionTemplate createProcessDescription() {
    QuestionTemplate template;
    template.id = "process_description";
    template.type = "short_answer";
    template.prompt_template = "Describe the process of {concept} step by step.";
    template.required_fields = {"concept"};
    template.difficulty_weight = 4;
    return template;
}

QuestionTemplate createComparisonQuestion() {
    QuestionTemplate template;
    template.id = "comparison";
    template.type = "short_answer";
    template.prompt_template = "Compare and contrast {concept1} and {concept2}.";
    template.required_fields = {"concept1", "concept2"};
    template.difficulty_weight = 5;
    return template;
}

QuestionTemplate createClozeQuestion() {
    QuestionTemplate template;
    template.id = "cloze";
    template.type = "fill_in_blank";
    template.prompt_template = "Complete the following: {concept} is _____.";
    template.required_fields = {"concept"};
    template.difficulty_weight = 2;
    return template;
}

QuestionTemplate createFormulaCompletion() {
    QuestionTemplate template;
    template.id = "formula_completion";
    template.type = "fill_in_blank";
    template.prompt_template = "Complete the formula: {formula}";
    template.required_fields = {"formula"};
    template.difficulty_weight = 3;
    return template;
}

std::vector<QuestionTemplate> getAllTemplates() {
    return {
        createConceptMCQ(),
        createDefinitionMCQ(),
        createFormulaMCQ(),
        createExampleMCQ(),
        createConceptExplanation(),
        createProcessDescription(),
        createComparisonQuestion(),
        createClozeQuestion(),
        createFormulaCompletion()
    };
}

} // namespace templates

// Content parsing utilities
namespace parsing {

std::vector<std::string> extractConcepts(const std::string& text) {
    std::vector<std::string> concepts;
    
    // Simple extraction based on capitalization and common patterns
    std::regex concept_pattern(R"(\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b)");
    std::sregex_iterator iter(text.begin(), text.end(), concept_pattern);
    std::sregex_iterator end;
    
    for (; iter != end; ++iter) {
        std::string concept = iter->str();
        if (concept.length() > 2 && concept.length() < 50) {
            concepts.push_back(concept);
        }
    }
    
    // Remove duplicates
    std::sort(concepts.begin(), concepts.end());
    concepts.erase(std::unique(concepts.begin(), concepts.end()), concepts.end());
    
    return concepts;
}

std::vector<std::string> extractDefinitions(const std::string& text) {
    std::vector<std::string> definitions;
    
    // Look for sentences with definition indicators
    std::regex definition_pattern(R"([^.]*\b(is|are|means|refers to|can be defined as)\b[^.]*\.)", std::regex_constants::icase);
    std::sregex_iterator iter(text.begin(), text.end(), definition_pattern);
    std::sregex_iterator end;
    
    for (; iter != end; ++iter) {
        definitions.push_back(cleanText(iter->str()));
    }
    
    return definitions;
}

std::vector<std::string> extractFormulas(const std::string& text) {
    std::vector<std::string> formulas;
    
    // Look for mathematical expressions
    std::regex formula_pattern(R"([^.]*[=+\-*/^()0-9\s]+[^.]*\.)");
    std::sregex_iterator iter(text.begin(), text.end(), formula_pattern);
    std::sregex_iterator end;
    
    for (; iter != end; ++iter) {
        std::string formula = iter->str();
        if (formula.find('=') != std::string::npos) {
            formulas.push_back(cleanText(formula));
        }
    }
    
    return formulas;
}

std::vector<std::string> extractExamples(const std::string& text) {
    std::vector<std::string> examples;
    
    // Look for sentences with example indicators
    std::regex example_pattern(R"([^.]*\b(for example|such as|including|e\.g\.)\b[^.]*\.)", std::regex_constants::icase);
    std::sregex_iterator iter(text.begin(), text.end(), example_pattern);
    std::sregex_iterator end;
    
    for (; iter != end; ++iter) {
        examples.push_back(cleanText(iter->str()));
    }
    
    return examples;
}

std::vector<std::string> extractKeywords(const std::string& text) {
    std::vector<std::string> keywords;
    
    // Extract important terms (longer words, technical terms)
    std::regex keyword_pattern(R"(\b[a-zA-Z]{4,}\b)");
    std::sregex_iterator iter(text.begin(), text.end(), keyword_pattern);
    std::sregex_iterator end;
    
    for (; iter != end; ++iter) {
        std::string keyword = iter->str();
        if (keyword.length() >= 4 && keyword.length() <= 20) {
            keywords.push_back(keyword);
        }
    }
    
    // Remove duplicates and common words
    std::sort(keywords.begin(), keywords.end());
    keywords.erase(std::unique(keywords.begin(), keywords.end()), keywords.end());
    
    return keywords;
}

std::string cleanText(const std::string& text) {
    std::string cleaned = text;
    
    // Remove extra whitespace
    std::regex whitespace_pattern(R"(\s+)");
    cleaned = std::regex_replace(cleaned, whitespace_pattern, " ");
    
    // Trim leading/trailing whitespace
    cleaned.erase(0, cleaned.find_first_not_of(" \t\n\r"));
    cleaned.erase(cleaned.find_last_not_of(" \t\n\r") + 1);
    
    return cleaned;
}

} // namespace parsing

// Question generation utilities
namespace generation {

std::vector<nlohmann::json> generateMCOptions(const std::string& correct_answer,
                                            const std::vector<std::string>& distractors,
                                            int num_options) {
    std::vector<nlohmann::json> options;
    
    // Add correct answer
    nlohmann::json correct_option;
    correct_option["value"] = correct_answer;
    correct_option["label"] = correct_answer;
    options.push_back(correct_option);
    
    // Add distractors
    for (const auto& distractor : distractors) {
        if (options.size() >= static_cast<size_t>(num_options)) break;
        
        nlohmann::json option;
        option["value"] = distractor;
        option["label"] = distractor;
        options.push_back(option);
    }
    
    // Shuffle options
    std::random_device rd;
    std::mt19937 g(rd());
    std::shuffle(options.begin(), options.end(), g);
    
    return options;
}

std::vector<std::string> generateDistractors(const std::string& concept,
                                           const std::vector<std::string>& available_concepts,
                                           int num_distractors) {
    std::vector<std::string> distractors;
    
    // Simple distractor generation - use other concepts
    for (const auto& other_concept : available_concepts) {
        if (other_concept != concept && distractors.size() < static_cast<size_t>(num_distractors)) {
            distractors.push_back(other_concept);
        }
    }
    
    // TODO: Integrate with WordNet for better distractors
    // For now, use simple concept substitution
    
    return distractors;
}

nlohmann::json applyTemplate(const QuestionTemplate& template,
                           const ParsedContent& content,
                           const std::string& difficulty,
                           int seed) {
    nlohmann::json question;
    
    // Generate unique ID
    std::stringstream id_stream;
    id_stream << template.type << "_" << seed;
    question["id"] = id_stream.str();
    question["type"] = template.type;
    
    // Apply template to generate prompt
    std::string prompt = template.prompt_template;
    
    // Simple template substitution
    if (prompt.find("{concept}") != std::string::npos && !content.concepts.empty()) {
        std::mt19937 rng(seed);
        std::uniform_int_distribution<int> dist(0, content.concepts.size() - 1);
        std::string concept = content.concepts[dist(rng)];
        prompt = std::regex_replace(prompt, std::regex(R"(\{concept\})"), concept);
    }
    
    question["prompt"] = prompt;
    
    // Generate question-specific content based on type
    if (template.type == "multiple_choice") {
        // Generate options
        std::string correct_answer = "Correct Answer"; // TODO: Generate based on content
        auto distractors = generateDistractors(correct_answer, content.concepts, 3);
        auto options = generateMCOptions(correct_answer, distractors, 4);
        
        question["options"] = options;
        question["correctAnswer"] = correct_answer;
        question["explanation"] = "This is the correct answer because..."; // TODO: Generate explanation
        
    } else if (template.type == "short_answer") {
        question["sampleAnswer"] = "Sample answer based on the content..."; // TODO: Generate sample answer
        question["rubric"] = nlohmann::json::array();
        
        // Add basic rubric
        nlohmann::json criterion;
        criterion["criterion"] = "Understanding";
        criterion["points"] = 5;
        criterion["keywords"] = nlohmann::json::array({"understand", "explain", "describe"});
        question["rubric"].push_back(criterion);
        
    } else if (template.type == "fill_in_blank") {
        question["correctAnswer"] = "Correct Answer"; // TODO: Generate based on content
        question["explanation"] = "This is correct because..."; // TODO: Generate explanation
    }
    
    return question;
}

bool validateQuestion(const nlohmann::json& question) {
    // Basic validation
    if (!question.contains("id") || !question.contains("type") || !question.contains("prompt")) {
        return false;
    }
    
    std::string type = question["type"];
    
    if (type == "multiple_choice") {
        return question.contains("options") && question.contains("correctAnswer");
    } else if (type == "short_answer") {
        return question.contains("sampleAnswer") && question.contains("rubric");
    } else if (type == "fill_in_blank") {
        return question.contains("correctAnswer");
    }
    
    return false;
}

} // namespace generation

} // namespace core
} // namespace studyhive
