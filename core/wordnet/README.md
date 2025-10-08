# WordNet Integration

This directory contains the WordNet adapter for generating high-quality distractors in multiple choice questions.

## Overview

WordNet is a lexical database of English words that groups words into sets of cognitive synonyms (synsets), each expressing a distinct concept. It provides semantic relationships between words including:

- **Synonyms**: Words with similar meanings
- **Antonyms**: Words with opposite meanings  
- **Hypernyms**: Broader categories (e.g., "animal" is a hypernym of "dog")
- **Hyponyms**: Narrower categories (e.g., "dog" is a hyponym of "animal")

## Integration Status

Currently implemented as a mock adapter with sample data. Full WordNet integration requires:

1. **WordNet Database**: Download and integrate WordNet 3.0 database files
2. **Parsing Logic**: Implement parsers for WordNet's data format
3. **Caching**: Add caching layer for frequently accessed words
4. **License Compliance**: Ensure proper attribution and license compliance

## Usage

```cpp
#include "wn_adapter.h"

// Initialize WordNet adapter
WordNetAdapter adapter;
adapter.initialize("/path/to/wordnet");

// Get synonyms for distractor generation
auto synonyms = adapter.getSynonyms("happy");
// Returns: ["joyful", "cheerful", "content", "pleased"]

// Get related words for MCQ options
auto distractors = adapter.getDistractorWords("dog", 3);
// Returns: ["cat", "animal", "pet"]

// Check word relationships
auto hypernyms = adapter.getHypernyms("dog");
// Returns: ["animal", "mammal", "pet"]
```

## WordNet License

WordNet is released under a license that allows free use for research and commercial purposes. The license requires:

1. **Attribution**: Credit WordNet in documentation
2. **No Modification**: Do not modify WordNet data files
3. **Distribution**: Include license text with distribution

## Implementation Notes

### Current Mock Data
The mock implementation includes sample relationships for common words to demonstrate the API structure.

### Future Enhancements
1. **Full WordNet Integration**: Replace mock data with actual WordNet database
2. **Performance Optimization**: Add caching and indexing
3. **Part of Speech Filtering**: Filter results by grammatical category
4. **Semantic Similarity**: Implement semantic similarity scoring
5. **Custom Dictionaries**: Support domain-specific word relationships

### File Structure
- `wn_adapter.h`: Public interface for WordNet operations
- `wn_adapter.cc`: Implementation with mock data
- `README.md`: This documentation file

## Dependencies

- Standard C++ library
- Future: WordNet 3.0 database files
- Future: Custom parsing utilities

## Testing

Unit tests should verify:
- Synonym/antonym relationships
- Hypernym/hyponym hierarchies
- Distractor generation quality
- Performance with large datasets
- Error handling for invalid words

## Performance Considerations

- **Caching**: Frequently accessed words should be cached
- **Indexing**: Build indexes for fast lookups
- **Memory Management**: Efficient storage of word relationships
- **Concurrent Access**: Thread-safe operations for multi-threaded use

## Integration with Quiz Engine

The WordNet adapter is used by the rule-based question generator to:

1. **Generate Distractors**: Create plausible wrong answers for MCQ
2. **Semantic Filtering**: Ensure distractors are related but not too similar
3. **Quality Control**: Maintain question quality through semantic relationships
4. **Educational Value**: Create questions that test understanding, not just memorization
