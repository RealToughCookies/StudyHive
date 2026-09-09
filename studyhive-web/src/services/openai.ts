import OpenAI from 'openai'

// Each request owns its client so credentials cannot carry over between accounts.
function createClient(apiKey: string) {
  if (!apiKey.trim()) throw new Error('Please add your OpenAI API key in Settings.')
  return new OpenAI({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, fetch: globalThis.fetch })
}

interface FlashcardPair {
  front: string
  back: string
}

interface QuizQuestion {
  question: string
  options: string[]
  correct: number
}

export async function generateFlashcards(noteContent: string, apiKey: string): Promise<FlashcardPair[]> {
  const openaiClient = createClient(apiKey)

  const prompt = `Generate 8-10 flashcards from the following notes. Return ONLY a valid JSON array with "front" and "back" fields. Each flashcard should test key concepts.

Notes:
${noteContent}

Response format (ONLY JSON, no markdown):
[{"front": "Question or term", "back": "Answer or definition"}, ...]`

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful study assistant that creates educational flashcards. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Remove markdown code blocks if present
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim()

    const flashcards = JSON.parse(cleanedContent)

    if (!Array.isArray(flashcards) || flashcards.length === 0 || !flashcards.every(card =>
      card && typeof card.front === 'string' && card.front.trim() &&
      typeof card.back === 'string' && card.back.trim())) {
      throw new Error('Invalid response format')
    }

    return flashcards
  } catch (error) {
    console.error('OpenAI flashcard generation error:', error)
    throw new Error('Failed to generate flashcards. Please check your API key and try again.')
  }
}

export async function generateQuiz(noteContent: string, apiKey: string): Promise<QuizQuestion[]> {
  const openaiClient = createClient(apiKey)

  const prompt = `Generate a 7-10 question multiple choice quiz from the following notes. Return ONLY a valid JSON array.

Notes:
${noteContent}

Response format (ONLY JSON, no markdown):
[{
  "question": "Question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0
}, ...]

The "correct" field should be the index (0-3) of the correct option.`

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful study assistant that creates educational quizzes. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Remove markdown code blocks if present
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim()

    const quiz = JSON.parse(cleanedContent)

    if (!Array.isArray(quiz) || quiz.length === 0 || !quiz.every(question =>
      question && typeof question.question === 'string' && question.question.trim() &&
      Array.isArray(question.options) && question.options.length === 4 &&
      question.options.every((option: unknown) => typeof option === 'string' && option.trim()) &&
      Number.isInteger(question.correct) && question.correct >= 0 && question.correct < 4)) {
      throw new Error('Invalid response format')
    }

    return quiz
  } catch (error) {
    console.error('OpenAI quiz generation error:', error)
    throw new Error('Failed to generate quiz. Please check your API key and try again.')
  }
}

export async function generateStudyGuide(noteContent: string, apiKey: string): Promise<string> {
  const openaiClient = createClient(apiKey)

  const prompt = `Create a comprehensive study guide from the following notes. Include:
- Key concepts and definitions
- Important points to remember
- Summary of main ideas
- Suggested study tips for this material

Format in clean Markdown.

Notes:
${noteContent}`

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful study assistant that creates comprehensive study guides in Markdown format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    return content
  } catch (error) {
    console.error('OpenAI study guide generation error:', error)
    throw new Error('Failed to generate study guide. Please check your API key and try again.')
  }
}
