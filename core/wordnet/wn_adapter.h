#pragma once

#include <string>
#include <vector>
#include <memory>

namespace studyhive {
namespace core {

struct WordNetEntry {
    std::string word;
    std::string pos;  // part of speech: n, v, a, r
    std::string definition;
    std::vector<std::string> synonyms;
    std::vector<std::string> antonyms;
    std::vector<std::string> hypernyms;
    std::vector<std::string> hyponyms;
};

class WordNetAdapter {
public:
    WordNetAdapter();
    ~WordNetAdapter();

    // Initialize WordNet database
    bool initialize(const std::string& wordnet_path);

    // Get synonyms for a word
    std::vector<std::string> getSynonyms(const std::string& word, const std::string& pos = "");

    // Get antonyms for a word
    std::vector<std::string> getAntonyms(const std::string& word, const std::string& pos = "");

    // Get hypernyms (broader terms)
    std::vector<std::string> getHypernyms(const std::string& word, const std::string& pos = "");

    // Get hyponyms (narrower terms)
    std::vector<std::string> getHyponyms(const std::string& word, const std::string& pos = "");

    // Get full WordNet entry
    WordNetEntry getEntry(const std::string& word, const std::string& pos = "");

    // Check if word exists in WordNet
    bool wordExists(const std::string& word, const std::string& pos = "");

    // Get related words for distractor generation
    std::vector<std::string> getRelatedWords(const std::string& word, int max_count = 10);

    // Get words similar in meaning but different enough for distractors
    std::vector<std::string> getDistractorWords(const std::string& word, int max_count = 5);

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

// WordNet utilities for quiz generation
namespace wordnet_utils {

// Generate distractors for multiple choice questions
std::vector<std::string> generateMCQDistractors(const std::string& correct_answer,
                                               const std::vector<std::string>& available_words,
                                               int num_distractors = 3);

// Find words related to a concept
std::vector<std::string> findRelatedConcepts(const std::string& concept,
                                           const std::vector<std::string>& available_concepts);

// Check if two words are too similar (shouldn't be used as distractors)
bool areWordsTooSimilar(const std::string& word1, const std::string& word2);

// Get word frequency information (for better distractor selection)
int getWordFrequency(const std::string& word);

} // namespace wordnet_utils

} // namespace core
} // namespace studyhive
