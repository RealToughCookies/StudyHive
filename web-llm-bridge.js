// Web LLM Bridge - Runs AI models directly in browser using WebGPU
// No API keys, no servers, completely free and private!

import * as webllm from "@mlc-ai/web-llm";

class WebLLMBridge {
  constructor() {
    this.engine = null;
    this.ready = false;
    this.currentModel = "Phi-3-mini-4k-instruct-q4f16_1-MLC";
    this.downloadProgress = 0;
  }

  async initialize(onProgress) {
    try {
      console.log("Initializing Web LLM...");

      const initProgressCallback = (progress) => {
        this.downloadProgress = progress.progress || 0;
        if (onProgress) {
          onProgress({
            text: progress.text || "Loading model...",
            progress: this.downloadProgress
          });
        }
        console.log(progress.text);
      };

      this.engine = await webllm.CreateMLCEngine(
        this.currentModel,
        { initProgressCallback }
      );

      this.ready = true;
      console.log("Web LLM initialized successfully!");
      return true;
    } catch (error) {
      console.error("Failed to initialize Web LLM:", error);
      this.ready = false;
      return false;
    }
  }

  async generateQuiz(topic, difficulty, numQuestions, notes) {
    if (!this.ready) {
      throw new Error("Web LLM not initialized");
    }

    const prompt = `Generate ${numQuestions} quiz questions about "${topic}" (${difficulty} difficulty) from these notes:

${notes.substring(0, 800)}

Respond with ONLY valid JSON (no markdown). Keep explanations SHORT (under 15 words):
{"topic":"${topic}","difficulty":"${difficulty}","questions":[{"id":"q1","type":"multiple_choice","prompt":"...","options":[{"value":"a","label":"..."},{"value":"b","label":"..."},{"value":"c","label":"..."},{"value":"d","label":"..."}],"correctAnswer":"a","explanation":"Short explanation"}],"metadata":{"source":"web-llm","generatedAt":"${new Date().toISOString()}"}}

Make ${numQuestions} questions. Keep it concise.`;

    try {
      const response = await this.engine.chat.completions.create({
        messages: [{
          role: "system",
          content: "Quiz generator. JSON only. Max 6 words per explanation. Ultra brief."
        }, {
          role: "user",
          content: prompt
        }],
        temperature: 0.6,
        max_tokens: 2048  // Model's actual output limit
      });

      const content = response.choices[0].message.content;
      console.log('🤖 Web LLM raw response length:', content.length);
      console.log('🤖 Finish reason:', response.choices[0].finish_reason);

      // Check if response was cut off
      if (response.choices[0].finish_reason === 'length') {
        console.error('❌ Response was truncated! Try generating fewer questions.');
        throw new Error('Response truncated - try generating fewer questions (max 3)');
      }

      // Extract JSON from response
      let jsonText = content.trim();

      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      console.log('🤖 Attempting to parse JSON (length: ' + jsonText.length + ')...');

      try {
        const parsed = JSON.parse(jsonText);
        console.log('✅ JSON parsed successfully!');
        return parsed;
      } catch (parseError) {
        console.error('❌ JSON parse failed. Raw JSON:', jsonText.substring(0, 500));
        throw new Error('AI generated invalid JSON. Try generating fewer questions.');
      }
    } catch (error) {
      console.error("❌ Quiz generation failed:", error);
      throw error;
    }
  }

  async gradeAnswer(question, studentAnswer) {
    if (!this.ready) {
      throw new Error("Web LLM not initialized");
    }

    let prompt = `Grade this student answer:

Question: ${question.prompt}
Student Answer: ${studentAnswer}
`;

    if (question.type === "multiple_choice") {
      const correctOption = question.options.find(opt => opt.value === question.correctAnswer);
      prompt += `\nCorrect Answer: ${correctOption?.label}`;
    } else if (question.sampleAnswer) {
      prompt += `\nSample Answer: ${question.sampleAnswer}`;
    }

    prompt += `\n\nRespond with ONLY valid JSON:
{
  "questionId": "${question.id}",
  "totalScore": 8.5,
  "maxScore": 10.0,
  "breakdown": [
    {
      "criterion": "Understanding",
      "awardedPoints": 4.0,
      "maxPoints": 5.0,
      "reasoning": "detailed explanation of score",
      "keywords": ["found", "keywords"]
    }
  ],
  "feedback": "Comprehensive feedback explaining what was correct, what was missing, and specific suggestions for improvement. Be encouraging but educational.",
  "metadata": {
    "source": "web-llm",
    "gradedAt": "${new Date().toISOString()}"
  }
}

Provide detailed, constructive feedback that helps the student learn.`;

    try {
      const response = await this.engine.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1024
      });

      const content = response.choices[0].message.content;

      let jsonText = content.trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      return JSON.parse(jsonText);
    } catch (error) {
      console.error("Grading failed:", error);
      throw error;
    }
  }

  async changeModel(modelId, onProgress) {
    this.currentModel = modelId;
    this.ready = false;

    if (this.engine) {
      await this.engine.unload();
    }

    return await this.initialize(onProgress);
  }

  getAvailableModels() {
    return [
      {
        id: "Phi-3-mini-4k-instruct-q4f16_1-MLC",
        name: "Phi-3 Mini (Recommended)",
        size: "2.4GB",
        speed: "Fast",
        quality: "Very Good"
      },
      {
        id: "Llama-3-8B-Instruct-q4f32_1-MLC",
        name: "Llama 3 8B",
        size: "4.9GB",
        speed: "Medium",
        quality: "Excellent"
      },
      {
        id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
        name: "Mistral 7B",
        size: "4.2GB",
        speed: "Medium",
        quality: "Excellent"
      },
      {
        id: "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC",
        name: "TinyLlama (Fastest)",
        size: "655MB",
        speed: "Very Fast",
        quality: "Good"
      }
    ];
  }

  isReady() {
    return this.ready;
  }

  getProgress() {
    return this.downloadProgress;
  }
}

// Make it available globally
window.WebLLMBridge = WebLLMBridge;

export default WebLLMBridge;
