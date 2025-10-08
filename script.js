// StudyHive - Enhanced Quiz Engine Integration
// This file integrates the new dual-engine quiz system with the existing StudyHive app

// ============================================================================
// GLOBAL ERROR HANDLING
// ============================================================================
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  showErrorMessage('Something went wrong. Please try refreshing the page.');
  event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showErrorMessage('An unexpected error occurred. Please try again.');
  event.preventDefault();
});

function showErrorMessage(message, details = null) {
  // Remove existing error if present
  const existing = document.getElementById('global-error-message');
  if (existing) existing.remove();

  // Create error banner
  const errorBanner = document.createElement('div');
  errorBanner.id = 'global-error-message';
  errorBanner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: #dc2626;
    color: white;
    padding: 1rem;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideDown 0.3s ease;
  `;

  errorBanner.innerHTML = `
    <div style="max-width: 900px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap;">
      <span style="font-weight: 600;">⚠️ ${message}</span>
      ${details ? `<span style="font-size: 0.9rem; opacity: 0.9;">${details}</span>` : ''}
      <a href="https://github.com/RealToughCookies/StudyHive/issues" target="_blank" rel="noopener" style="color: white; text-decoration: underline; font-size: 0.9rem;">Report Issue</a>
      <button onclick="this.parentElement.parentElement.remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 0.25rem 0.75rem; border-radius: 4px; cursor: pointer; font-weight: 600;">✕</button>
    </div>
  `;

  document.body.prepend(errorBanner);

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (errorBanner.parentElement) {
      errorBanner.style.animation = 'slideUp 0.3s ease';
      setTimeout(() => errorBanner.remove(), 300);
    }
  }, 10000);
}

// Add slide animations
if (!document.getElementById('error-animations')) {
  const style = document.createElement('style');
  style.id = 'error-animations';
  style.textContent = `
    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    @keyframes slideUp {
      from { transform: translateY(0); }
      to { transform: translateY(-100%); }
    }
  `;
  document.head.appendChild(style);
}

// Quiz Engine Integration
class QuizEngineIntegration {
  constructor() {
    this.engineSelector = null;
    this.llmBridge = null;
    this.ruleEngine = null;
    this.wordnetAdapter = null;
    this.cache = null;
    this.connectivityMonitor = null;
    
    this.initializeEngines();
  }

  async initializeEngines() {
    try {
      // Initialize LLM bridge first
      this.llmBridge = new LLMBridge();

      // Initialize engine selector with LLM bridge reference
      this.engineSelector = new EngineSelector(this.llmBridge);
      
      // Initialize rule engine
      this.ruleEngine = new RuleEngine();
      
      // Initialize WordNet adapter
      this.wordnetAdapter = new WordNetAdapter();
      
      // Initialize cache
      this.cache = new KVStore();
      
      // Initialize connectivity monitor
      this.connectivityMonitor = new ConnectivityMonitor();
      
      console.log('Quiz engines initialized successfully');
    } catch (error) {
      console.error('Failed to initialize quiz engines:', error);
    }
  }

  async generateQuiz(topic, difficulty, numQuestions, notes) {
    try {
      // Choose appropriate engine
      const engine = this.engineSelector.chooseEngine();
      console.log('🎯 Engine selected:', engine);
      console.log('🤖 LLM ready?', this.llmBridge.isReady());
      console.log('📊 LLM status:', {
        useWebLLM: this.llmBridge.useWebLLM,
        useBrowserAI: this.llmBridge.useBrowserAI,
        useClaudeAPI: this.llmBridge.useClaudeAPI,
        ready: this.llmBridge.ready
      });

      let quizResult;

      // PRODUCTION: Always use Rules Engine for reliability
      // Web LLM is too small and generates truncated/invalid JSON
      console.log('📝 Generating quiz from your notes using intelligent Rules Engine...');
      quizResult = await this.generateWithRules(topic, difficulty, numQuestions, notes);

      // Cache the result
      this.cacheQuizResult(topic, difficulty, numQuestions, notes, quizResult, engine);

      return quizResult;
    } catch (error) {
      console.error('Quiz generation failed:', error);
      throw error;
    }
  }

  async generateWithLLM(topic, difficulty, numQuestions, notes) {
    const prompt = this.buildLLMPrompt(topic, difficulty, numQuestions, notes);
    const response = await this.llmBridge.generateQuiz(prompt, 'quiz.gbnf');

    if (response.success) {
      try {
        // Try to parse the JSON
        const quiz = JSON.parse(response.content);

        // Add metadata if missing
        if (!quiz.metadata) {
          quiz.metadata = {
            source: 'web-llm',
            generatedAt: new Date().toISOString()
          };
        }

        return quiz;
      } catch (parseError) {
        console.error('JSON parse error. Raw response:', response.content);

        // Try to fix common JSON issues
        let cleaned = response.content.trim();

        // Remove markdown code blocks if present
        cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // Try to find the JSON object
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        }

        try {
          const quiz = JSON.parse(cleaned);

          // Add metadata if missing
          if (!quiz.metadata) {
            quiz.metadata = {
              source: 'web-llm',
              generatedAt: new Date().toISOString()
            };
          }

          return quiz;
        } catch (secondError) {
          console.error('Could not parse even after cleaning. Content:', cleaned);
          throw new Error('LLM generation failed: ' + parseError.message + '. Raw content length: ' + response.content.length);
        }
      }
    } else {
      throw new Error('LLM generation failed: ' + response.error_message);
    }
  }

  async generateWithRules(topic, difficulty, numQuestions, notes) {
    const parsedContent = this.ruleEngine.parseContent(notes);
    const questions = this.ruleEngine.generateQuestions(parsedContent, difficulty, numQuestions);
    
    return {
      topic: topic,
      difficulty: difficulty,
      questions: questions,
      metadata: {
        source: 'rules',
        generatedAt: new Date().toISOString(),
        seed: 42
      }
    };
  }

  buildLLMPrompt(topic, difficulty, numQuestions, notes) {
    // Truncate notes to prevent token overflow
    const truncatedNotes = notes.length > 600 ? notes.substring(0, 600) + '...' : notes;

    return `Generate ${numQuestions} quiz questions ONLY from these notes:

${truncatedNotes}

Rules:
- Ask ONLY about information in the notes above
- Do NOT ask about topics not mentioned in the notes
- Keep explanations under 8 words
- Be extremely brief`;
  }

  cacheQuizResult(topic, difficulty, numQuestions, notes, result, engine) {
    const key = this.generateCacheKey(topic, difficulty, numQuestions, notes, engine);
    this.cache.put(key, JSON.stringify(result), engine);
  }

  generateCacheKey(topic, difficulty, numQuestions, notes, engine) {
    const content = `${topic}:${difficulty}:${numQuestions}:${notes}:${engine}`;
    return this.hashString(content);
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  async gradeAnswer(question, studentAnswer) {
    try {
      const engine = this.engineSelector.chooseEngine();
      
      let gradeResult;
      
      if (engine === 'LLM' && this.llmBridge.isReady()) {
        gradeResult = await this.gradeWithLLM(question, studentAnswer);
      } else {
        gradeResult = await this.gradeWithRules(question, studentAnswer);
      }
      
      return gradeResult;
    } catch (error) {
      console.error('Answer grading failed:', error);
      throw error;
    }
  }

  async gradeWithLLM(question, studentAnswer) {
    const prompt = this.buildGradingPrompt(question, studentAnswer);
    const response = await this.llmBridge.gradeAnswer(prompt, 'grade.gbnf');
    
    if (response.success) {
      return JSON.parse(response.content);
    } else {
      throw new Error('LLM grading failed: ' + response.error_message);
    }
  }

  async gradeWithRules(question, studentAnswer) {
    if (question.type === 'multiple_choice') {
      return this.ruleEngine.gradeMultipleChoice(question, studentAnswer);
    } else if (question.type === 'short_answer') {
      return this.ruleEngine.gradeShortAnswer(question, studentAnswer);
    } else if (question.type === 'fill_in_blank') {
      return this.ruleEngine.gradeFillInBlank(question, studentAnswer);
    }
    
    throw new Error('Unsupported question type: ' + question.type);
  }

  buildGradingPrompt(question, studentAnswer) {
    return `Grade the following student answer for this question:

Question: ${question.prompt}
Student Answer: ${studentAnswer}

${question.type === 'short_answer' && question.rubric ? 
  `Rubric: ${JSON.stringify(question.rubric)}` : 
  `Correct Answer: ${question.correctAnswer || question.sampleAnswer}`}

Provide detailed feedback and scoring based on the rubric.`;
  }

  getEngineStatus() {
    return this.engineSelector.getStatus();
  }

  updateConnectivityStatus(isOnline) {
    this.connectivityMonitor.setStatus(isOnline);
  }
}

// Mock implementations for demonstration
class EngineSelector {
  constructor(llmBridge) {
    this.llmBridge = llmBridge;
    this.connectivityStatus = 'unknown';
    this.forcedEngine = null;
  }

  chooseEngine() {
    if (this.forcedEngine) {
      return this.forcedEngine;
    }

    // Check if LLM is ready (Web LLM, Browser AI, or Claude API)
    if (this.llmBridge && this.llmBridge.isReady()) {
      return 'LLM';
    }

    // Fallback to rules engine
    return 'RULES';
  }

  getStatus() {
    const currentEngine = this.chooseEngine();
    const modelAvailable = this.llmBridge && this.llmBridge.isReady();
    return {
      current_engine: currentEngine,
      ai_boost_enabled: currentEngine === 'LLM',
      model_available: modelAvailable,
      connectivity: this.connectivityStatus,
      download_queued: false,
      download_progress: 0.0
    };
  }


  forceEngine(engine) {
    this.forcedEngine = engine;
  }

  resetToAutomatic() {
    this.forcedEngine = null;
  }
}

class LLMBridge {
  constructor() {
    this.ready = false;
    this.apiKey = null;
    this.useClaudeAPI = false;
    this.useWebLLM = false;
    this.webLLMBridge = null;
    this.initialize();
  }

  async initialize() {
    // Check if running in Tauri app
    this.isTauriApp = typeof window.__TAURI__ !== 'undefined';

    // Check which AI service to use
    const aiMode = localStorage.getItem('ai_mode') || 'none';

    if (this.isTauriApp) {
      // Use Ollama via Tauri backend
      this.useOllama = true;
      this.ready = await this.checkOllama();
      console.log('LLM Bridge: Ollama', this.ready ? 'available' : 'not available');
    } else if (aiMode === 'webllm') {
      // Use Web LLM (runs in browser with WebGPU)
      this.useWebLLM = true;

      // Check if model was previously downloaded
      const modelReady = localStorage.getItem('webllm_model_ready') === 'true';

      if (modelReady) {
        if (window.WebLLMBridge) {
          // Auto-initialize with saved model
          console.log('LLM Bridge: Web LLM mode - auto-initializing with cached model...');
          try {
            this.webLLMBridge = new window.WebLLMBridge();
            // Initialize with cached model (this is fast since model is already in cache)
            // Use await to make sure it completes before continuing
            const success = await this.webLLMBridge.initialize();
            this.ready = success;
            this.useWebLLM = success;
            if (success) {
              console.log('✅ LLM Bridge: Web LLM auto-initialized successfully!');
              console.log('🤖 Web LLM is READY and will be used for quiz generation');
            } else {
              console.log('⚠️ LLM Bridge: Web LLM auto-init returned false');
            }
          } catch (error) {
            console.error('❌ LLM Bridge: Web LLM auto-init error:', error);
            this.ready = false;
            this.useWebLLM = false;
          }
        } else {
          // WebLLMBridge not loaded yet, wait for it
          console.log('⏳ Web LLM mode - waiting for WebLLMBridge to load...');
          console.log('  - modelReady:', modelReady);
          console.log('  - WebLLMBridge available:', !!window.WebLLMBridge);

          // Retry after a delay
          setTimeout(async () => {
            if (window.WebLLMBridge && !this.ready) {
              console.log('🔄 WebLLMBridge now available, initializing...');
              try {
                this.webLLMBridge = new window.WebLLMBridge();
                const success = await this.webLLMBridge.initialize();
                this.ready = success;
                this.useWebLLM = success;
                if (success) {
                  console.log('✅ LLM Bridge: Web LLM delayed-init successful!');
                } else {
                  console.log('⚠️ LLM Bridge: Web LLM delayed-init returned false');
                }
              } catch (error) {
                console.error('❌ LLM Bridge: Web LLM delayed-init error:', error);
              }
            }
          }, 2000); // Wait 2 seconds for module to load
        }
      } else {
        // Don't initialize yet - wait for user to click "Download Model"
        console.log('LLM Bridge: Web LLM mode (not initialized - model not downloaded yet)');
        console.log('  - modelReady:', modelReady);
        console.log('  - WebLLMBridge available:', !!window.WebLLMBridge);
      }
    } else if (aiMode === 'browser') {
      // Use browser-based AI (Chrome/Edge built-in)
      this.useClaudeAPI = false;
      this.useBrowserAI = true;
      this.ready = await this.checkBrowserAI();
      console.log('LLM Bridge: Browser AI', this.ready ? 'available' : 'not available');
    } else if (aiMode === 'claude') {
      // Check if Claude API key is configured
      this.apiKey = localStorage.getItem('claude_api_key');
      if (this.apiKey && this.apiKey.startsWith('sk-ant-')) {
        this.useClaudeAPI = true;
        this.ready = true;
        console.log('LLM Bridge initialized with Claude API');
      } else {
        this.ready = false;
        console.log('LLM Bridge: No API key configured');
      }
    } else {
      this.ready = false;
      console.log('LLM Bridge: No AI configured (using rules engine)');
    }
  }

  async checkOllama() {
    if (!this.isTauriApp) return false;

    try {
      const status = await window.__TAURI__.invoke('check_ollama_status');
      return status === 'running';
    } catch (e) {
      console.error('Ollama check failed:', e);
      return false;
    }
  }

  async checkBrowserAI() {
    // Check for Chrome/Edge built-in AI
    if ('ai' in window && 'languageModel' in window.ai) {
      try {
        const capabilities = await window.ai.languageModel.capabilities();
        return capabilities.available === 'readily';
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  isReady() {
    return this.ready && (this.useClaudeAPI || this.useBrowserAI || this.useOllama || this.useWebLLM);
  }

  async initializeWebLLM(onProgress) {
    if (!window.WebLLMBridge) {
      throw new Error('Web LLM library not loaded');
    }

    this.webLLMBridge = new window.WebLLMBridge();
    this.ready = await this.webLLMBridge.initialize(onProgress);
    this.useWebLLM = this.ready;
    return this.ready;
  }

  async generateQuizWithWebLLM(prompt) {
    try {
      // Extract parameters from prompt
      const topicMatch = prompt.match(/quiz (?:about|on) ["']?([^"'\n]+)["']?/i);
      const difficultyMatch = prompt.match(/difficulty[:\s]+(\w+)/i);
      const numMatch = prompt.match(/(\d+)\s+questions?/i);
      const notesMatch = prompt.match(/based on (?:these )?notes?[:\s]+([\s\S]+)/i);

      const topic = topicMatch ? topicMatch[1].trim() : 'General Knowledge';
      const difficulty = difficultyMatch ? difficultyMatch[1].toLowerCase() : 'medium';
      const numQuestions = numMatch ? parseInt(numMatch[1]) : 5;
      const notes = notesMatch ? notesMatch[1].trim() : '';

      const quiz = await this.webLLMBridge.generateQuiz(topic, difficulty, numQuestions, notes);

      return {
        success: true,
        content: JSON.stringify(quiz),
        tokens_generated: 100,
        processing_time_ms: 0
      };
    } catch (error) {
      console.error('Web LLM quiz generation failed:', error);
      return {
        success: false,
        error_message: error.message
      };
    }
  }

  async gradeAnswerWithWebLLM(prompt) {
    try {
      // Extract question and answer from prompt
      const questionMatch = prompt.match(/Question[:\s]+([\s\S]+?)(?:Student Answer|Answer)[:\s]+/i);
      const answerMatch = prompt.match(/(?:Student )?Answer[:\s]+([\s\S]+?)(?:\n\n|$)/i);

      if (!questionMatch || !answerMatch) {
        throw new Error('Could not parse question and answer from prompt');
      }

      // Create a simplified question object for grading
      const question = {
        id: 'q1',
        prompt: questionMatch[1].trim(),
        type: 'short_answer'
      };

      const studentAnswer = answerMatch[1].trim();

      const grade = await this.webLLMBridge.gradeAnswer(question, studentAnswer);

      return {
        success: true,
        content: JSON.stringify(grade),
        tokens_generated: 100,
        processing_time_ms: 0
      };
    } catch (error) {
      console.error('Web LLM grading failed:', error);
      return {
        success: false,
        error_message: error.message
      };
    }
  }

  setAPIKey(apiKey) {
    this.apiKey = apiKey;
    localStorage.setItem('claude_api_key', apiKey);
    this.useClaudeAPI = true;
    this.ready = true;
    console.log('Claude API key configured');
  }

  async generateQuiz(prompt, grammarPath) {
    if (this.useWebLLM && this.ready && this.webLLMBridge) {
      return await this.generateQuizWithWebLLM(prompt);
    }

    if (this.useOllama && this.ready) {
      return await this.generateQuizWithOllama(prompt);
    }

    if (this.useBrowserAI && this.ready) {
      return await this.generateQuizWithBrowserAI(prompt);
    }

    if (!this.useClaudeAPI) {
      return { success: false, error_message: 'No AI service configured' };
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: `${prompt}

You must respond with valid JSON in this exact format:
{
  "topic": "topic name",
  "difficulty": "easy|medium|hard",
  "questions": [
    {
      "id": "unique_id",
      "type": "multiple_choice|short_answer",
      "prompt": "question text",
      "options": [{"value": "a", "label": "option text"}],  // only for multiple_choice
      "correctAnswer": "value",  // only for multiple_choice
      "sampleAnswer": "sample answer text",  // only for short_answer
      "rubric": [{"criterion": "name", "points": 10, "keywords": ["word1"]}],  // only for short_answer
      "explanation": "detailed explanation of the correct answer"
    }
  ],
  "metadata": {
    "source": "claude-api",
    "generatedAt": "${new Date().toISOString()}"
  }
}

Make the questions intelligent, contextual, and ensure all answers have detailed explanations.`
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.content[0].text;

      // Extract JSON from the response (may be wrapped in markdown code blocks)
      let jsonText = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      // Validate it's proper JSON
      const quiz = JSON.parse(jsonText);

      return {
        success: true,
        content: JSON.stringify(quiz),
        tokens_generated: data.usage.output_tokens,
        processing_time_ms: 0
      };
    } catch (error) {
      console.error('Claude API quiz generation failed:', error);
      return {
        success: false,
        error_message: error.message
      };
    }
  }

  async gradeAnswer(prompt, grammarPath) {
    if (this.useWebLLM && this.ready && this.webLLMBridge) {
      return await this.gradeAnswerWithWebLLM(prompt);
    }

    if (this.useBrowserAI && this.ready) {
      return await this.gradeAnswerWithBrowserAI(prompt);
    }

    if (!this.useClaudeAPI) {
      return { success: false, error_message: 'No AI service configured' };
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: `${prompt}

You must respond with valid JSON in this exact format:
{
  "questionId": "question_id",
  "totalScore": 8.5,
  "maxScore": 10.0,
  "breakdown": [
    {
      "criterion": "criterion name",
      "awardedPoints": 3.5,
      "maxPoints": 4.0,
      "reasoning": "detailed explanation of why this score was awarded",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "feedback": "Comprehensive, encouraging feedback explaining what was correct, what was missing, and how to improve. Be specific and educational.",
  "metadata": {
    "source": "claude-api",
    "gradedAt": "${new Date().toISOString()}"
  }
}

Provide detailed, constructive feedback that helps the student learn. Explain what they got right and what could be improved.`
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.content[0].text;

      // Extract JSON from the response
      let jsonText = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const grade = JSON.parse(jsonText);

      return {
        success: true,
        content: JSON.stringify(grade),
        tokens_generated: data.usage.output_tokens,
        processing_time_ms: 0
      };
    } catch (error) {
      console.error('Claude API grading failed:', error);
      return {
        success: false,
        error_message: error.message
      };
    }
  }

  async generateQuizWithOllama(prompt) {
    try {
      const model = localStorage.getItem('ollama_model') || 'llama3';

      const fullPrompt = `${prompt}

You must respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "topic": "topic name",
  "difficulty": "easy|medium|hard",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "prompt": "question text",
      "options": [{"value": "a", "label": "answer A"}, {"value": "b", "label": "answer B"}, {"value": "c", "label": "answer C"}, {"value": "d", "label": "answer D"}],
      "correctAnswer": "a",
      "explanation": "detailed explanation of why this is correct"
    }
  ],
  "metadata": {"source": "ollama", "generatedAt": "${new Date().toISOString()}"}
}

Make the questions intelligent and contextual. Provide detailed explanations for each answer.`;

      const response = await window.__TAURI__.invoke('generate_quiz_ollama', {
        request: {
          prompt: fullPrompt,
          model: model
        }
      });

      // Try to extract JSON from response
      let jsonText = response.trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const quiz = JSON.parse(jsonText);

      return {
        success: true,
        content: JSON.stringify(quiz),
        tokens_generated: 100,
        processing_time_ms: 0
      };
    } catch (error) {
      console.error('Ollama quiz generation failed:', error);
      return {
        success: false,
        error_message: error.message || String(error)
      };
    }
  }

  async generateQuizWithBrowserAI(prompt) {
    try {
      const session = await window.ai.languageModel.create({
        systemPrompt: 'You are a quiz generator. Always respond with valid JSON.'
      });

      const fullPrompt = `${prompt}

You must respond with ONLY valid JSON in this format (no markdown, no explanation):
{
  "topic": "topic name",
  "difficulty": "easy|medium|hard",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "prompt": "question text",
      "options": [{"value": "a", "label": "answer A"}, {"value": "b", "label": "answer B"}, {"value": "c", "label": "answer C"}, {"value": "d", "label": "answer D"}],
      "correctAnswer": "a",
      "explanation": "why this is correct"
    }
  ],
  "metadata": {"source": "browser-ai", "generatedAt": "${new Date().toISOString()}"}
}`;

      const response = await session.prompt(fullPrompt);

      // Try to extract JSON from response
      let jsonText = response.trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const quiz = JSON.parse(jsonText);

      return {
        success: true,
        content: JSON.stringify(quiz),
        tokens_generated: 100,
        processing_time_ms: 0
      };
    } catch (error) {
      console.error('Browser AI quiz generation failed:', error);
      return {
        success: false,
        error_message: error.message
      };
    }
  }

  async gradeAnswerWithBrowserAI(prompt) {
    try {
      const session = await window.ai.languageModel.create({
        systemPrompt: 'You are a helpful tutor who grades student answers and provides detailed feedback.'
      });

      const fullPrompt = `${prompt}

Respond with ONLY valid JSON (no markdown):
{
  "questionId": "q1",
  "totalScore": 8.5,
  "maxScore": 10.0,
  "breakdown": [
    {"criterion": "Understanding", "awardedPoints": 4.0, "maxPoints": 5.0, "reasoning": "explanation", "keywords": ["found", "keywords"]}
  ],
  "feedback": "Detailed feedback explaining what was right and wrong, with suggestions for improvement.",
  "metadata": {"source": "browser-ai", "gradedAt": "${new Date().toISOString()}"}
}`;

      const response = await session.prompt(fullPrompt);

      let jsonText = response.trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const grade = JSON.parse(jsonText);

      return {
        success: true,
        content: JSON.stringify(grade),
        tokens_generated: 50,
        processing_time_ms: 0
      };
    } catch (error) {
      console.error('Browser AI grading failed:', error);
      return {
        success: false,
        error_message: error.message
      };
    }
  }
}

class RuleEngine {
  constructor() {
    this.questionGenerator = new QuestionGenerator();
    this.gradingEngine = new GradingEngine();
  }

  parseContent(notes) {
    const parsed = {
      concepts: this.extractConcepts(notes),
      definitions: this.extractDefinitions(notes),
      formulas: this.extractFormulas(notes),
      examples: this.extractExamples(notes),
      keywords: this.extractKeywords(notes)
    };

    console.log('📝 Parsed content:', {
      concepts: parsed.concepts.length,
      definitions: parsed.definitions.length,
      keywords: parsed.keywords.length
    });

    // If we couldn't extract enough content, use the notes text directly
    if (parsed.concepts.length === 0 && parsed.definitions.length === 0) {
      console.warn('⚠️ Failed to extract structured content from notes. Using raw text.');
      // Extract simple sentences as definitions
      const sentences = notes.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
      parsed.definitions = sentences.slice(0, 5);
      // Extract simple words as concepts
      const words = notes.match(/\b[A-Za-z]{4,}\b/g) || [];
      parsed.concepts = [...new Set(words)].slice(0, 10);
    }

    return parsed;
  }

  generateQuestions(parsedContent, difficulty, numQuestions) {
      const questions = [];
    
    for (let i = 0; i < numQuestions; i++) {
      if (i % 2 === 0) {
        questions.push(this.generateMultipleChoice(parsedContent, difficulty, i));
      } else {
        questions.push(this.generateShortAnswer(parsedContent, difficulty, i));
      }
      }

      return questions;
    }

  generateMultipleChoice(content, difficulty, index) {
    const concepts = content.concepts.length > 0 ? content.concepts : ["the main concept"];
    const definitions = content.definitions.length > 0 ? content.definitions : [];
    const formulas = content.formulas.length > 0 ? content.formulas : [];
    const keywords = content.keywords.length > 0 ? content.keywords : [];

    // Pick different concepts for variety
    const concept = concepts[index % concepts.length] || concepts[0];
    const otherConcepts = concepts.filter(c => c !== concept);

    let prompt, correctAnswer, distractors, explanation;

    // Generate different question types based on available content
    if (definitions.length > index && definitions[index].toLowerCase().includes(concept.toLowerCase())) {
      // Definition-based question
      const def = definitions[index];
      prompt = `Which of the following best defines ${concept}?`;
      correctAnswer = def;

      // Generate plausible but incorrect definitions
      distractors = [
        def.replace(/\b(is|are|means|refers to)\b/i, 'might be').replace(/\.$/, ', but this is not quite accurate.'),
        `A process unrelated to ${concept}`,
        otherConcepts.length > 0 ? `The definition of ${otherConcepts[0]}` : `An incorrect interpretation of ${concept}`
      ];
      explanation = `The correct definition is: ${def}`;

    } else if (formulas.length > 0 && index % 3 === 1) {
      // Formula-based question
      const formula = formulas[0];
      prompt = `What does the equation "${formula}" represent?`;
      correctAnswer = `The relationship involving ${concept}`;
      distractors = [
        `An unrelated mathematical expression`,
        `The inverse of ${concept}`,
        otherConcepts.length > 0 ? `The formula for ${otherConcepts[0]}` : `An incorrect formula`
      ];
      explanation = `This equation shows how ${concept} relates to other elements.`;

    } else if (keywords.length >= 3) {
      // Relationship/process question
      const relatedKeywords = keywords.slice(0, 3);
      prompt = `What is the relationship between ${concept} and ${relatedKeywords[0]}?`;
      correctAnswer = `${concept} involves ${relatedKeywords[0]} as part of its core function`;
      distractors = [
        `${concept} and ${relatedKeywords[0]} are completely unrelated`,
        `${concept} prevents ${relatedKeywords[0]} from occurring`,
        `${relatedKeywords[0]} eliminates the need for ${concept}`
      ];
      explanation = `${concept} is closely connected to ${relatedKeywords[0]} in this context.`;

    } else {
      // Characteristics/properties question
      prompt = `Which statement about ${concept} is accurate?`;
      correctAnswer = definitions[0] || `${concept} is an essential component with specific characteristics`;
      distractors = [
        `${concept} is no longer considered relevant`,
        `${concept} works in opposition to the main principles`,
        otherConcepts.length > 0 ? `${concept} is identical to ${otherConcepts[0]}` : `${concept} has no practical application`
      ];
      explanation = `Understanding ${concept} is crucial for grasping the overall topic.`;
    }

    // Create options array with shuffling
    const options = [
      { value: "correct", label: correctAnswer },
      { value: "distractor1", label: distractors[0] },
      { value: "distractor2", label: distractors[1] },
      { value: "distractor3", label: distractors[2] }
    ];

    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return {
      id: `mcq_${index}`,
      type: "multiple_choice",
      prompt: prompt,
      options: options,
      correctAnswer: "correct",
      explanation: explanation
    };
  }

  generateShortAnswer(content, difficulty, index) {
    const concepts = content.concepts.length > 0 ? content.concepts : ["the main concept"];
    const concept = concepts[index % concepts.length] || concepts[0];
    const keywords = content.keywords.length > 0 ? content.keywords : [];
    const definitions = content.definitions.length > 0 ? content.definitions : [];
    const formulas = content.formulas.length > 0 ? content.formulas : [];

    let prompt, sampleAnswer, rubric;

    // Generate contextual short answer questions
    if (definitions.length > 0 && index < definitions.length) {
      // Ask them to explain a definition in their own words
      const def = definitions[index];
      prompt = `In your own words, explain ${concept} and its significance.`;
      sampleAnswer = `${def} This concept is significant because it helps us understand the fundamental principles and how they apply in practice.`;
      rubric = [
        {
          criterion: "Accurate Explanation",
          points: 5,
          keywords: [concept.toLowerCase(), ...keywords.slice(0, 3)]
        },
        {
          criterion: "Understanding of Significance",
          points: 3,
          keywords: ["significant", "important", "because", "helps", "understand"]
        },
        {
          criterion: "Own Words (not copying)",
          points: 2,
          keywords: ["essentially", "basically", "means", "refers"]
        }
      ];

    } else if (formulas.length > 0) {
      // Ask about the formula/equation
      const formula = formulas[0];
      prompt = `Explain what the equation "${formula}" means and how it relates to ${concept}.`;
      sampleAnswer = `The equation ${formula} represents the relationship between key components involving ${concept}. This helps us calculate and understand how different factors interact.`;
      rubric = [
        {
          criterion: "Equation Understanding",
          points: 4,
          keywords: [concept.toLowerCase(), "equation", "formula", "relationship"]
        },
        {
          criterion: "Component Explanation",
          points: 4,
          keywords: [...keywords.slice(0, 4), "component", "factor", "element"]
        },
        {
          criterion: "Practical Application",
          points: 2,
          keywords: ["calculate", "apply", "use", "determine"]
        }
      ];

    } else if (keywords.length >= 4) {
      // Ask about relationships between concepts
      const relatedKeywords = keywords.slice(0, 3);
      prompt = `Describe how ${concept} relates to ${relatedKeywords.join(', ')}. Explain the connections.`;
      sampleAnswer = `${concept} is closely connected to ${relatedKeywords.join(' and ')}. These elements work together as part of a larger process, where each component plays a specific role in achieving the overall function.`;
      rubric = [
        {
          criterion: "Understanding Relationships",
          points: 5,
          keywords: [concept.toLowerCase(), ...relatedKeywords, "relate", "connect", "relationship"]
        },
        {
          criterion: "Explanation of Connections",
          points: 3,
          keywords: ["because", "therefore", "which", "where", "how"]
        },
        {
          criterion: "Depth and Detail",
          points: 2,
          keywords: ["specific", "detail", "example", "process", "role"]
        }
      ];

    } else {
      // General explanation question
      prompt = `What is ${concept} and why is it important in this context?`;
      sampleAnswer = definitions[0] || `${concept} is a fundamental element that plays a crucial role. It's important because it helps explain core mechanisms and contributes to our overall understanding.`;
      rubric = [
        {
          criterion: "Definition/Explanation",
          points: 4,
          keywords: [concept.toLowerCase(), "definition", "what", ...keywords.slice(0, 2)]
        },
        {
          criterion: "Importance/Context",
          points: 4,
          keywords: ["important", "because", "role", "context", "significance"]
        },
        {
          criterion: "Clarity",
          points: 2,
          keywords: ["clear", "understand", "explain", "detail"]
        }
      ];
    }

    return {
      id: `saq_${index}`,
      type: "short_answer",
      prompt: prompt,
      sampleAnswer: sampleAnswer,
      rubric: rubric
    };
  }

  gradeMultipleChoice(question, studentAnswer) {
    const isCorrect = studentAnswer === question.correctAnswer;
      return {
      questionId: question.id,
      totalScore: isCorrect ? 1.0 : 0.0,
      maxScore: 1.0,
      breakdown: [
        {
          criterion: "Answer Selection",
          awardedPoints: isCorrect ? 1.0 : 0.0,
          maxPoints: 1.0,
          reasoning: isCorrect ? "Correct answer" : "Incorrect answer",
          keywords: []
        }
      ],
      feedback: isCorrect ? "Correct!" : "Incorrect. The correct answer is: " + question.correctAnswer,
      metadata: {
        source: "rules",
        gradedAt: new Date().toISOString(),
        processingTimeMs: 10.0
      }
    };
  }

  gradeShortAnswer(question, studentAnswer) {
    // Simple keyword-based grading
    const keywords = question.rubric[0].keywords;
        const foundKeywords = keywords.filter(keyword =>
      studentAnswer.toLowerCase().includes(keyword.toLowerCase())
        );

    const score = (foundKeywords.length / keywords.length) * question.rubric[0].points;

      return {
      questionId: question.id,
      totalScore: score,
      maxScore: question.rubric[0].points,
      breakdown: [
        {
          criterion: question.rubric[0].criterion,
          awardedPoints: score,
          maxPoints: question.rubric[0].points,
          reasoning: `Found ${foundKeywords.length} out of ${keywords.length} keywords`,
          keywords: foundKeywords
        }
      ],
      feedback: `Score: ${score}/${question.rubric[0].points}. Found keywords: ${foundKeywords.join(', ')}`,
      metadata: {
        source: "rules",
        gradedAt: new Date().toISOString(),
        processingTimeMs: 15.0
      }
    };
  }

  gradeFillInBlank(question, studentAnswer) {
    // Simple similarity check
    const similarity = this.calculateSimilarity(studentAnswer, question.correctAnswer);
    const score = similarity > 0.8 ? 1.0 : similarity > 0.5 ? 0.5 : 0.0;
    
    return {
      questionId: question.id,
      totalScore: score,
      maxScore: 1.0,
      breakdown: [
        {
          criterion: "Answer Accuracy",
          awardedPoints: score,
          maxPoints: 1.0,
          reasoning: `Similarity score: ${similarity}`,
          keywords: []
        }
      ],
      feedback: score > 0.5 ? "Correct!" : "Incorrect. The correct answer is: " + question.correctAnswer,
      metadata: {
        source: "rules",
        gradedAt: new Date().toISOString(),
        processingTimeMs: 5.0
      }
    };
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
    } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  extractConcepts(text) {
    // Extract capitalized words and important terms
    const concepts = new Set();

    // Find capitalized words (likely proper nouns or important terms)
    const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
    capitalizedWords.forEach(word => concepts.add(word));

    // Find words in parentheses (often definitions or key terms)
    const parentheticalTerms = text.match(/\(([^)]+)\)/g) || [];
    parentheticalTerms.forEach(term => {
      const cleaned = term.replace(/[()]/g, '').trim();
      if (cleaned.length > 2 && cleaned.split(' ').length <= 3) {
        concepts.add(cleaned);
      }
    });

    // Find important multi-word phrases (noun phrases)
    const nounPhrases = text.match(/\b(?:[A-Z][a-z]+\s+)?[a-z]+(?:tion|sis|ment|ance|ence|ity|ing)\b/g) || [];
    nounPhrases.forEach(phrase => {
      if (phrase.length > 5) concepts.add(phrase);
    });

    // Extract quoted terms
    const quotedTerms = text.match(/"([^"]+)"/g) || [];
    quotedTerms.forEach(term => {
      const cleaned = term.replace(/"/g, '').trim();
      if (cleaned.length > 2) concepts.add(cleaned);
    });

    return Array.from(concepts).slice(0, 10);
  }

  extractDefinitions(text) {
    const definitions = [];
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);

    // Look for sentences that contain definition patterns
    const definitionPatterns = [
      /(.+?)\s+is\s+(?:a|an|the)\s+(.+)/i,
      /(.+?)\s+are\s+(.+)/i,
      /(.+?)\s+refers to\s+(.+)/i,
      /(.+?)\s+means\s+(.+)/i,
      /(.+?)\s+can be defined as\s+(.+)/i,
      /(.+?):\s+(.+)/
    ];

    for (const sentence of sentences) {
      for (const pattern of definitionPatterns) {
        const match = sentence.match(pattern);
        if (match && match[0].length > 20) {
          definitions.push(sentence);
          break;
        }
      }
    }

    return definitions.slice(0, 5);
  }

  extractFormulas(text) {
    const formulas = [];

    // Match chemical equations
    const chemicalEqs = text.match(/\d*[A-Z][a-z]?\d*(?:\s*[+→-]\s*\d*[A-Z][a-z]?\d*)+/g) || [];
    formulas.push(...chemicalEqs);

    // Match mathematical formulas
    const mathFormulas = text.match(/[a-zA-Z]\s*=\s*[^.!?]+/g) || [];
    formulas.push(...mathFormulas);

    // Match equations with symbols
    const equations = text.match(/[\w\s]+[=≈≠<>≤≥]+[\w\s]+/g) || [];
    formulas.push(...equations);

    return [...new Set(formulas)].slice(0, 5);
  }

  extractExamples(text) {
    const examples = [];

    // Look for explicit example markers
    const examplePatterns = [
      /for example[^.!?]*[.!?]/gi,
      /such as[^.!?]*[.!?]/gi,
      /including[^.!?]*[.!?]/gi,
      /e\.g\.[^.!?]*[.!?]/gi,
      /for instance[^.!?]*[.!?]/gi
    ];

    for (const pattern of examplePatterns) {
      const matches = text.match(pattern) || [];
      examples.push(...matches);
    }

    return examples.slice(0, 5);
  }

  extractKeywords(text) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
      'these', 'those', 'it', 'its', 'they', 'them', 'their'
    ]);

    // Tokenize and clean
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4 && !stopWords.has(word));

    // Count frequency
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Sort by frequency and return top keywords
    const sortedKeywords = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);

    return sortedKeywords.slice(0, 15);
  }
}

class QuestionGenerator {
  constructor() {
    this.templates = this.loadTemplates();
  }

  loadTemplates() {
    return [
      {
        id: "concept_mcq",
        type: "multiple_choice",
        prompt_template: "What is {concept}?",
        difficulty_weight: 2
      },
      {
        id: "definition_mcq",
        type: "multiple_choice",
        prompt_template: "Which of the following best defines {concept}?",
        difficulty_weight: 3
      },
      {
        id: "concept_explanation",
        type: "short_answer",
        prompt_template: "Explain what {concept} is and how it works.",
        difficulty_weight: 4
      }
    ];
  }
}

class GradingEngine {
  constructor() {
    this.criteria = this.loadDefaultCriteria();
  }

  loadDefaultCriteria() {
    return [
      {
        name: "Understanding",
        max_points: 5,
        keywords: ["understand", "explain", "describe", "define"],
        description: "Tests basic understanding of the concept"
      },
      {
        name: "Analysis",
        max_points: 5,
        keywords: ["analyze", "compare", "contrast", "evaluate"],
        description: "Tests analytical thinking skills"
      }
    ];
  }
}

class WordNetAdapter {
  constructor() {
    this.initialized = false;
    this.initialize();
  }

  async initialize() {
    // Mock initialization
    this.initialized = true;
    console.log('WordNet Adapter initialized (mock)');
  }

  getSynonyms(word) {
    // Mock synonyms
    const mockSynonyms = {
      "happy": ["joyful", "cheerful", "content", "pleased"],
      "sad": ["unhappy", "depressed", "melancholy", "gloomy"],
      "big": ["large", "huge", "enormous", "massive"],
      "small": ["tiny", "little", "miniature", "compact"]
    };
    
    return mockSynonyms[word.toLowerCase()] || [];
  }

  getAntonyms(word) {
    // Mock antonyms
    const mockAntonyms = {
      "happy": ["sad", "unhappy", "depressed"],
      "sad": ["happy", "joyful", "cheerful"],
      "big": ["small", "tiny", "little"],
      "small": ["big", "large", "huge"]
    };
    
    return mockAntonyms[word.toLowerCase()] || [];
  }

  getDistractorWords(word, maxCount = 5) {
    const synonyms = this.getSynonyms(word);
    const antonyms = this.getAntonyms(word);
    
    const distractors = [...synonyms, ...antonyms];
    return distractors.slice(0, maxCount);
  }
}

class KVStore {
  constructor(maxSizeBytes = 200 * 1024 * 1024) {
    this.maxSizeBytes = maxSizeBytes;
    this.currentSizeBytes = 0;
    this.entries = new Map();
    this.lruList = [];
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  put(key, value, source = "") {
    const size = value.length;
    
    // Check if key exists
    if (this.entries.has(key)) {
      const entry = this.entries.get(key);
      this.currentSizeBytes -= entry.size;
      entry.value = value;
      entry.source = source;
      entry.size = size;
      entry.lastAccessed = Date.now();
      this.currentSizeBytes += size;
      this.updateLRU(key);
      return true;
    }
    
    // Check if we need to evict
    while (this.currentSizeBytes + size > this.maxSizeBytes && this.lruList.length > 0) {
      this.evictLRU();
    }
    
    // Add new entry
    const entry = {
      key: key,
      value: value,
      source: source,
      size: size,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };
    
    this.entries.set(key, entry);
    this.lruList.unshift(key);
    this.currentSizeBytes += size;
    
    return true;
  }

  get(key, source = "") {
    if (this.entries.has(key)) {
      const entry = this.entries.get(key);
      entry.lastAccessed = Date.now();
      this.updateLRU(key);
      this.hits++;
      return entry.value;
    }
    
    this.misses++;
    return null;
  }

  exists(key) {
    return this.entries.has(key);
  }

  remove(key) {
    if (this.entries.has(key)) {
      const entry = this.entries.get(key);
      this.currentSizeBytes -= entry.size;
      this.entries.delete(key);
      
      const index = this.lruList.indexOf(key);
      if (index > -1) {
        this.lruList.splice(index, 1);
      }
      
      return true;
    }
    
    return false;
  }

  clear() {
    this.entries.clear();
    this.lruList = [];
    this.currentSizeBytes = 0;
  }

  size() {
    return this.entries.size;
  }

  sizeBytes() {
    return this.currentSizeBytes;
  }

  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    
    let llmEntries = 0;
    let llmSize = 0;
    let rulesEntries = 0;
    let rulesSize = 0;
    
    for (const entry of this.entries.values()) {
      if (entry.source === "device-llm") {
        llmEntries++;
        llmSize += entry.size;
      } else if (entry.source === "rules") {
        rulesEntries++;
        rulesSize += entry.size;
      }
    }
    
          return {
      total_entries: this.entries.size,
      total_size_bytes: this.currentSizeBytes,
      llm_entries: llmEntries,
      llm_size_bytes: llmSize,
      rules_entries: rulesEntries,
      rules_size_bytes: rulesSize,
      hit_rate: hitRate,
      evictions: this.evictions
    };
  }

  updateLRU(key) {
    const index = this.lruList.indexOf(key);
    if (index > -1) {
      this.lruList.splice(index, 1);
    }
    this.lruList.unshift(key);
  }

  evictLRU() {
    if (this.lruList.length > 0) {
      const lruKey = this.lruList.pop();
      const entry = this.entries.get(lruKey);
      if (entry) {
        this.currentSizeBytes -= entry.size;
        this.entries.delete(lruKey);
        this.evictions++;
      }
    }
  }
}

class ConnectivityMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.onStatusChange(true);
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.onStatusChange(false);
    });
  }

  setStatus(isOnline) {
    this.isOnline = isOnline;
  }

  getStatus() {
    return this.isOnline;
  }

  onStatusChange(isOnline) {
    console.log('Connectivity status changed:', isOnline ? 'online' : 'offline');
    // Notify engine selector of status change
    if (window.quizEngineIntegration) {
      window.quizEngineIntegration.updateConnectivityStatus(isOnline);
    }
  }
}

// ============================================================================
// POMODORO TIMER
// ============================================================================

function initializeTimer() {
  const startPauseBtn = document.getElementById('start-pause');
  const resetBtn = document.getElementById('reset');
  const timerDisplay = document.getElementById('timer-display');

  if (!startPauseBtn || !resetBtn || !timerDisplay) return; // Not on timer page

  let timer = null;
  let timeLeft = 25 * 60; // 25 minutes in seconds
  let isRunning = false;
  let currentMode = 'pomodoro';
  let sessionCount = parseInt(localStorage.getItem('pomodoroSessionCount') || '0');
  let endTime = null; // Timestamp when timer should end

  const durations = {
    pomodoro: 25 * 60,
    'short-break': 5 * 60,
    'long-break': 15 * 60
  };

  // Load saved timer state
  function loadTimerState() {
    const savedState = localStorage.getItem('pomodoroTimerState');
    if (savedState) {
      const state = JSON.parse(savedState);
      currentMode = state.mode || 'pomodoro';
      sessionCount = state.sessionCount || 0;

      if (state.isRunning && state.endTime) {
        const now = Date.now();
        const remaining = Math.floor((state.endTime - now) / 1000);

        if (remaining > 0) {
          // Timer is still running
          timeLeft = remaining;
          endTime = state.endTime;
          isRunning = true;
          startTimer();
          return;
        } else {
          // Timer expired while tab was closed
          timeLeft = 0;
          handleTimerComplete();
          return;
        }
      } else if (state.timeLeft) {
        timeLeft = state.timeLeft;
      }
    }

    // Default state
    if (!timeLeft || timeLeft <= 0) {
      timeLeft = durations[currentMode];
    }
  }

  // Save timer state to localStorage
  function saveTimerState() {
    const state = {
      mode: currentMode,
      timeLeft: timeLeft,
      isRunning: isRunning,
      endTime: endTime,
      sessionCount: sessionCount
    };
    localStorage.setItem('pomodoroTimerState', JSON.stringify(state));
    localStorage.setItem('pomodoroSessionCount', sessionCount.toString());
  }

  function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Update page title with timer
    if (isRunning) {
      document.title = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} - StudyHive`;
    } else {
      document.title = 'StudyHive';
    }
  }

  function startTimer() {
    if (isRunning && timer) return; // Already running

    isRunning = true;
    startPauseBtn.textContent = 'Pause';

    // Set end time based on remaining time
    endTime = Date.now() + (timeLeft * 1000);
    saveTimerState();

    timer = setInterval(() => {
      // Calculate remaining time based on end timestamp
      const now = Date.now();
      const remaining = Math.floor((endTime - now) / 1000);

      if (remaining <= 0) {
        timeLeft = 0;
        updateDisplay();
        stopTimer();
        handleTimerComplete();
      } else {
        timeLeft = remaining;
        updateDisplay();
        saveTimerState();
      }
    }, 1000);
  }

  function stopTimer() {
    isRunning = false;
    endTime = null;
    startPauseBtn.textContent = 'Start';
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    saveTimerState();
  }

  function resetTimer() {
    stopTimer();
    timeLeft = durations[currentMode];
    updateDisplay();
    saveTimerState();
  }

  function handleTimerComplete() {
    // Save to history
    saveSession(currentMode);

    // Play sound or show notification
    playCompletionSound();

    // Auto-start next session if enabled
    const autoMode = document.getElementById('auto-mode');
    if (autoMode && autoMode.checked) {
      if (currentMode === 'pomodoro') {
        sessionCount++;
        const sessionsBeforeLongBreak = parseInt(document.getElementById('sessions-before-long-break')?.value || 4);
        if (sessionCount % sessionsBeforeLongBreak === 0) {
          switchMode('long-break');
        } else {
          switchMode('short-break');
        }
      } else {
        switchMode('pomodoro');
      }
      setTimeout(() => startTimer(), 1000);
    }
  }

  function switchMode(mode) {
    currentMode = mode;
    timeLeft = durations[mode];
    updateDisplay();
    saveTimerState();

    // Update active mode button
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.mode === mode || (mode === 'pomodoro' && !btn.dataset.mode)) {
        btn.classList.add('active');
      }
    });
  }

  function saveSession(mode) {
    const history = JSON.parse(localStorage.getItem('pomodoroHistory') || '[]');
    history.unshift({
      mode: mode,
      duration: durations[mode] / 60,
      completedAt: new Date().toISOString(),
      date: new Date().toLocaleDateString()
    });
    localStorage.setItem('pomodoroHistory', JSON.stringify(history));
  }

  function playCompletionSound() {
    // Simple notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('Time\'s up! ⏰', {
        body: currentMode === 'pomodoro' ? 'Great work! Time for a break.' : 'Break over! Ready to focus?',
        icon: 'StudyHiveLogo.png',
        tag: 'pomodoro-timer',
        requireInteraction: true
      });

      // Play a sound (simple beep using Web Audio API)
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (e) {
        console.log('Could not play sound:', e);
      }

      // Focus the window when notification is clicked
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } else if ('Notification' in window && Notification.permission === 'default') {
      // Request permission if not granted
      Notification.requestPermission();
    }
  }

  // Event listeners
  startPauseBtn.addEventListener('click', () => {
    if (isRunning) {
      stopTimer();
    } else {
      startTimer();
    }
  });

  resetBtn.addEventListener('click', resetTimer);

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode || 'pomodoro';
      stopTimer();
      switchMode(mode);
    });
  });

  // Settings form
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const focusDuration = parseInt(document.getElementById('focus-duration').value);
      const shortBreakDuration = parseInt(document.getElementById('short-break-duration').value);
      const longBreakDuration = parseInt(document.getElementById('long-break-duration').value);

      durations.pomodoro = focusDuration * 60;
      durations['short-break'] = shortBreakDuration * 60;
      durations['long-break'] = longBreakDuration * 60;

      resetTimer();
      alert('Settings updated!');
    });
  }

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Load saved timer state and resume if needed
  loadTimerState();

  // Initialize display
  updateDisplay();

  // Sync timer across tabs using storage events
  window.addEventListener('storage', (e) => {
    if (e.key === 'pomodoroTimerState') {
      loadTimerState();
      updateDisplay();
    }
  });
}

// Initialize the quiz engine integration
let quizEngineIntegration;

document.addEventListener('DOMContentLoaded', function() {
  // Initialize quiz engine integration
  quizEngineIntegration = new QuizEngineIntegration();
  window.quizEngineIntegration = quizEngineIntegration;

  // Add AI Boost badge to UI
  addAIBoostBadge();

  // Add engine settings to profile page
  addEngineSettings();

  // Initialize theme (load saved preference)
  initializeTheme();

  // Initialize theme toggle (only if toggle exists)
  initializeThemeToggle();

  // Initialize timer (if on home page)
  initializeTimer();

  // Initialize courses management (if on courses page)
  initializeCourses();

  // Initialize notes management (if on notes page)
  initializeNotes();

  // Initialize cheatsheets management (if on cheatsheets page)
  initializeCheatsheets();

  // Initialize quiz form selectors (if on quiz page)
  initializeQuizFormSelectors();

  // Initialize history page (if on history page)
  initializeHistory();

  // Initialize profile page stats & achievements
  initializeProfile();

  console.log('Enhanced quiz engine integration initialized');
});

function initializeProfile() {
  const isProfile = window.location.pathname.includes('profile.html');
  if (!isProfile) return;

  const nameEl = document.getElementById('user-name');
  const initialsEl = document.getElementById('user-initials');
  const joinDateEl = document.getElementById('join-date');
  const displayNameInput = document.getElementById('display-name');
  const dailyGoalInput = document.getElementById('daily-goal');
  const sessionGoalInput = document.getElementById('session-goal');
  const settingsForm = document.getElementById('profile-settings-form');
  const resetBtn = document.getElementById('reset-stats');

  // Load profile settings
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  if (profile.displayName && nameEl) nameEl.textContent = profile.displayName;
  if (profile.displayName && initialsEl) initialsEl.textContent = (profile.displayName || 'SH').split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase();
  if (displayNameInput) displayNameInput.value = profile.displayName || displayNameInput.value;
  if (dailyGoalInput) dailyGoalInput.value = (profile.dailyHoursGoal ?? parseFloat(dailyGoalInput.value || '2'));
  if (sessionGoalInput) sessionGoalInput.value = (profile.dailySessionGoal ?? parseInt(sessionGoalInput.value || '4'));
  if (joinDateEl) {
    const joined = profile.joinedAt || new Date().toISOString();
    if (!profile.joinedAt) {
      localStorage.setItem('profile', JSON.stringify({ ...profile, joinedAt: joined }));
    }
    const joinedDate = new Date(joined);
    joinDateEl.textContent = joinedDate.toLocaleDateString();
  }

  // Save profile settings
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const updated = {
        displayName: (document.getElementById('display-name')?.value || 'Study Hero').trim().slice(0,30),
        dailyHoursGoal: Math.max(0, parseFloat(document.getElementById('daily-goal')?.value || '2')),
        dailySessionGoal: Math.max(0, parseInt(document.getElementById('session-goal')?.value || '4')),
        joinedAt: (JSON.parse(localStorage.getItem('profile') || '{}').joinedAt) || new Date().toISOString()
      };
      localStorage.setItem('profile', JSON.stringify(updated));
      if (nameEl) nameEl.textContent = updated.displayName;
      if (initialsEl) initialsEl.textContent = updated.displayName.split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase();
      updateDailyGoalsProgress();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!confirm('Reset all statistics and achievements? This cannot be undone.')) return;
      localStorage.removeItem('pomodoroHistory');
      localStorage.removeItem('achievements');
      calculateAndRenderProfile();
      updateDailyGoalsProgress();
      showToast('Statistics reset', 'success');
    });
  }

  // Render initial
  calculateAndRenderProfile();
  updateDailyGoalsProgress();
}

function calculateAndRenderProfile() {
  const stats = calculateProfileStats();
  renderProfileStats(stats);
  checkAchievements(stats);
}

function calculateProfileStats() {
  const history = JSON.parse(localStorage.getItem('pomodoroHistory') || '[]');
  const totalSessions = history.filter(s => s.mode === 'pomodoro').length;
  const totalMinutes = history.reduce((sum, s) => sum + (s.mode === 'pomodoro' ? (s.duration || 0) : 0), 0);

  // Build set of focus days
  const daysSet = new Set();
  history.forEach(s => {
    if (s.mode === 'pomodoro' && s.completedAt) {
      const d = new Date(s.completedAt);
      const key = d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
      daysSet.add(key);
    }
  });
  const days = Array.from(daysSet).map(k => {
    const [y,m,d] = k.split('-').map(Number);
    return new Date(y, m-1, d).getTime();
  }).sort((a,b)=>a-b);

  const { currentStreak, bestStreak } = computeStreaks(days);

  return { totalSessions, totalMinutes, currentStreak, bestStreak };
}

function computeStreaks(dayTimestamps) {
  if (dayTimestamps.length === 0) return { currentStreak: 0, bestStreak: 0 };
  const oneDay = 24*60*60*1000;
  // Normalize today to local midnight
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let best = 1;
  let curr = 1;
  for (let i = 1; i < dayTimestamps.length; i++) {
    const prev = dayTimestamps[i-1];
    const currDay = dayTimestamps[i];
    const diff = currDay - prev;
    if (diff === oneDay) {
      curr += 1;
      if (curr > best) best = curr;
    } else if (diff > oneDay) {
      curr = 1;
    }
  }

  // Compute current streak ending at today or yesterday if no session yet today
  let currentStreak = 0;
  // Walk back from the last day
  let i = dayTimestamps.length - 1;
  let pointer = today;
  // If last study day is yesterday, start from yesterday
  while (i >= 0) {
    const day = dayTimestamps[i];
    if (day === pointer) {
      currentStreak += 1;
      pointer -= oneDay;
      i -= 1;
    } else if (day === pointer - oneDay) {
      // If no study today but yesterday had, include yesterday and continue
      pointer -= oneDay;
    } else if (day < pointer - oneDay) {
      break;
    } else {
      // day > pointer — move pointer back a day to try align
      pointer -= oneDay;
    }
  }

  return { currentStreak, bestStreak: best };
}

function renderProfileStats(stats) {
  const totalSessionsEl = document.getElementById('total-sessions');
  const totalTimeEl = document.getElementById('total-time');
  const currentStreakEl = document.getElementById('current-streak');
  const bestStreakEl = document.getElementById('best-streak');
  if (totalSessionsEl) totalSessionsEl.textContent = String(stats.totalSessions);
  if (totalTimeEl) {
    const hours = Math.floor(stats.totalMinutes / 60);
    const minutes = Math.round(stats.totalMinutes % 60);
    totalTimeEl.textContent = `${hours}h ${minutes}m`;
  }
  if (currentStreakEl) currentStreakEl.textContent = String(stats.currentStreak);
  if (bestStreakEl) bestStreakEl.textContent = String(stats.bestStreak);
}

function updateDailyGoalsProgress() {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const hoursGoal = profile.dailyHoursGoal ?? 2;
  const sessionsGoal = profile.dailySessionGoal ?? 4;

  const history = JSON.parse(localStorage.getItem('pomodoroHistory') || '[]');
  const today = new Date();
  const todayKey = today.toLocaleDateString();
  const todaySessions = history.filter(s => s.mode === 'pomodoro' && s.date === todayKey);
  const todayMinutes = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);

  const dailyProgressEl = document.getElementById('daily-progress');
  const dailyBar = document.getElementById('daily-progress-bar');
  const sessionProgressEl = document.getElementById('session-progress');
  const sessionBar = document.getElementById('session-progress-bar');

  const hoursDone = todayMinutes / 60;
  const timePct = Math.min(100, Math.round((hoursDone / (hoursGoal || 1)) * 100));
  if (dailyProgressEl) dailyProgressEl.textContent = `${hoursDone.toFixed(1)} / ${hoursGoal} hours`;
  if (dailyBar) dailyBar.style.width = `${timePct}%`;

  const sessionsDone = todaySessions.length;
  const sessionsPct = Math.min(100, Math.round((sessionsDone / (sessionsGoal || 1)) * 100));
  if (sessionProgressEl) sessionProgressEl.textContent = `${sessionsDone} / ${sessionsGoal} sessions`;
  if (sessionBar) sessionBar.style.width = `${sessionsPct}%`;
}

function checkAchievements(stats) {
  const key = 'achievements';
  const state = JSON.parse(localStorage.getItem(key) || '{}');

  const unlock = (id, title) => {
    if (state[id]) return; // already unlocked
    state[id] = { unlockedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(state));
    const el = document.querySelector(`.achievement[data-achievement="${id}"]`);
    if (el) el.classList.add('achievement--unlocked');
    showToast(`Achievement unlocked: ${title}`, 'success');
    launchConfetti();
  };

  // First Steps: 1 session
  if (stats.totalSessions >= 1) unlock('first-session', 'First Steps');
  // Week Warrior: 7 day streak
  if (stats.bestStreak >= 7 || stats.currentStreak >= 7) unlock('week-streak', 'Week Warrior');
  // Hour Master: 10 hours total
  if ((stats.totalMinutes/60) >= 10) unlock('hour-master', 'Hour Master');
  // Focus Champion: 50 sessions
  if (stats.totalSessions >= 50) unlock('focus-champion', 'Focus Champion');

  // Paint existing unlocked on load
  ['first-session','week-streak','hour-master','focus-champion'].forEach(id => {
    if (state[id]) {
      const el = document.querySelector(`.achievement[data-achievement="${id}"]`);
      if (el) el.classList.add('achievement--unlocked');
    }
  });
}

function showToast(message, type = 'info') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.position = 'fixed';
    toast.style.right = '16px';
    toast.style.bottom = '16px';
    toast.style.zIndex = '1000';
    toast.style.padding = '12px 16px';
    toast.style.borderRadius = '10px';
    toast.style.border = '1px solid var(--border)';
    toast.style.background = 'var(--bg-card)';
    toast.style.color = 'var(--text)';
    toast.style.boxShadow = 'var(--shadow)';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = 'block';
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.transition = 'opacity 0.5s ease';
    toast.style.opacity = '0';
    setTimeout(() => { toast.style.display = 'none'; toast.style.transition = ''; }, 600);
  }, 1800);
}

function launchConfetti() {
  // minimal celebratory confetti using canvas if available
  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const pieces = Array.from({length: 120}, () => ({
    x: Math.random()*canvas.width,
    y: -20 - Math.random()*canvas.height,
    r: 3 + Math.random()*4,
    c: ['#f6c24a','#06d6a0','#1b9aaa','#ef476f'][Math.floor(Math.random()*4)],
    v: 2 + Math.random()*3
  }));
  let frames = 0;
  const tick = () => {
    frames++;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p => {
      p.y += p.v;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    });
    if (frames < 120) requestAnimationFrame(tick);
  };
  tick();
}

function addAIBoostBadge() {
  // Add AI Boost badge to the header
  const header = document.querySelector('.app__header-top');
  if (header) {
    const badge = document.createElement('div');
    badge.id = 'ai-boost-badge';
    badge.className = 'ai-boost-badge ai-boost-badge--hidden';
    badge.innerHTML = '<span class="ai-boost-badge__icon">🚀</span><span class="ai-boost-badge__text">AI Boost</span>';
    header.appendChild(badge);
    
    // Update badge status
    updateAIBoostBadge();
  }
}

function updateAIBoostBadge() {
  const badge = document.getElementById('ai-boost-badge');
  if (badge && quizEngineIntegration) {
    const status = quizEngineIntegration.getEngineStatus();
    
    if (status.ai_boost_enabled) {
      badge.classList.remove('ai-boost-badge--hidden');
      badge.classList.add('ai-boost-badge--active');
    } else {
      badge.classList.add('ai-boost-badge--hidden');
      badge.classList.remove('ai-boost-badge--active');
    }
  }
}

function addEngineSettings() {
  // Add engine settings to the profile page
  const profileSection = document.querySelector('.profile');
  if (profileSection) {
    const engineSettings = document.createElement('div');
    engineSettings.className = 'profile__section';
    engineSettings.innerHTML = `
      <h3>Quiz Engine Settings</h3>
      <div class="profile__group">
        <label class="profile__toggle">
          <input type="checkbox" id="ai-boost-enabled" />
          <span>Enable AI Boost (On-Device LLM)</span>
        </label>
        <p class="profile__description">Use on-device LLM for enhanced quiz generation and grading</p>
      </div>
      <div class="profile__group">
        <label class="profile__toggle">
          <input type="checkbox" id="rules-only-mode" />
          <span>Rules-Only Mode</span>
        </label>
        <p class="profile__description">Force use of rule-based engine for minimal battery impact</p>
      </div>
      <div id="engine-status" class="profile__status"></div>
    `;
    
    profileSection.appendChild(engineSettings);
    
    // Add event listeners
    setupEngineSettingsListeners();
  }
}

function setupEngineSettingsListeners() {
  const aiBoostEnabled = document.getElementById('ai-boost-enabled');
  const rulesOnlyMode = document.getElementById('rules-only-mode');
  const engineStatus = document.getElementById('engine-status');
  
  if (aiBoostEnabled) {
    aiBoostEnabled.addEventListener('change', function() {
      if (this.checked) {
        quizEngineIntegration.engineSelector.forceEngine('LLM');
      } else {
        quizEngineIntegration.engineSelector.resetToAutomatic();
      }
      updateEngineStatus();
      updateAIBoostBadge();
    });
  }
  
  if (rulesOnlyMode) {
    rulesOnlyMode.addEventListener('change', function() {
      if (this.checked) {
        quizEngineIntegration.engineSelector.forceEngine('RULES');
      } else {
        quizEngineIntegration.engineSelector.resetToAutomatic();
      }
      updateEngineStatus();
      updateAIBoostBadge();
    });
  }
  
  
  // Initial status update
  updateEngineStatus();
}

function updateEngineStatus() {
  const engineStatus = document.getElementById('engine-status');
  if (engineStatus && quizEngineIntegration) {
    const status = quizEngineIntegration.getEngineStatus();
    
    let statusHtml = '<h4>Engine Status</h4>';
    statusHtml += `<p><strong>Current Engine:</strong> ${status.current_engine}</p>`;
    statusHtml += `<p><strong>AI Boost:</strong> ${status.ai_boost_enabled ? 'Enabled' : 'Disabled'}</p>`;
    statusHtml += `<p><strong>Model Available:</strong> ${status.model_available ? 'Yes' : 'No'}</p>`;
    statusHtml += `<p><strong>Connectivity:</strong> ${status.connectivity}</p>`;
    
    if (status.download_queued) {
      statusHtml += `<p><strong>Download Progress:</strong> ${Math.round(status.download_progress * 100)}%</p>`;
    }
    
    engineStatus.innerHTML = statusHtml;
  }
}


// Enhanced quiz generation function
async function generateEnhancedQuiz(topic, difficulty, numQuestions, notes) {
  if (!quizEngineIntegration) {
    throw new Error('Quiz engine integration not initialized');
  }
  
  try {
    const quiz = await quizEngineIntegration.generateQuiz(topic, difficulty, numQuestions, notes);
    
    // Update AI Boost badge
    updateAIBoostBadge();
    
    return quiz;
    } catch (error) {
    console.error('Enhanced quiz generation failed:', error);
    throw error;
  }
}

// Enhanced answer grading function
async function gradeEnhancedAnswer(question, studentAnswer) {
  if (!quizEngineIntegration) {
    throw new Error('Quiz engine integration not initialized');
  }

  try {
    const grade = await quizEngineIntegration.gradeAnswer(question, studentAnswer);
    return grade;
  } catch (error) {
    console.error('Enhanced answer grading failed:', error);
    console.error('Falling back to simple grading');

    // Fallback to simple grading
    if (question.type === 'multiple_choice') {
      const isCorrect = studentAnswer === question.correctAnswer;
      return {
        questionId: question.id,
        totalScore: isCorrect ? 10 : 0,
        maxScore: 10,
        breakdown: [{
          criterion: "Correctness",
          awardedPoints: isCorrect ? 10 : 0,
          maxPoints: 10,
          reasoning: isCorrect ? "Correct answer!" : "Incorrect answer."
        }],
        feedback: isCorrect ? "Correct! " + (question.explanation || "") : "Incorrect. The correct answer is: " + question.correctAnswer,
        metadata: {
          source: "fallback-grader",
          gradedAt: new Date().toISOString()
        }
      };
    } else {
      // Short answer - give partial credit
      return {
        questionId: question.id,
        totalScore: 5,
        maxScore: 10,
        breakdown: [{
          criterion: "Answer provided",
          awardedPoints: 5,
          maxPoints: 10,
          reasoning: "Partial credit for providing an answer"
        }],
        feedback: "Your answer has been recorded. Sample answer: " + (question.sampleAnswer || "N/A"),
        metadata: {
          source: "fallback-grader",
          gradedAt: new Date().toISOString()
        }
      };
    }
  }
}

// AI Settings Handler
function setupAISettings() {
  const aiForm = document.getElementById('ai-settings-form');
  const apiKeyInput = document.getElementById('claude-api-key');
  const testButton = document.getElementById('test-ai');
  const clearButton = document.getElementById('clear-api-key');
  const statusDiv = document.getElementById('ai-status');
  const browserAIToggle = document.getElementById('use-browser-ai');
  const browserAIStatus = document.getElementById('browser-ai-status');
  const browserAIUnavailable = document.getElementById('browser-ai-unavailable');

  if (!aiForm) return;

  // Load existing API key
  const existingKey = localStorage.getItem('claude_api_key');
  if (existingKey) {
    apiKeyInput.value = existingKey;
    statusDiv.style.display = 'block';
  }

  // Load browser AI setting
  const useBrowserAI = localStorage.getItem('use_local_llm') === 'true';
  if (browserAIToggle) {
    browserAIToggle.checked = useBrowserAI;
    updateBrowserAIStatus();
  }

  // Browser AI toggle handler
  if (browserAIToggle) {
    browserAIToggle.addEventListener('change', async () => {
      const enabled = browserAIToggle.checked;
      localStorage.setItem('use_local_llm', enabled.toString());

      if (enabled) {
        // Disable Claude API when browser AI is enabled
        localStorage.removeItem('claude_api_key');
        apiKeyInput.value = '';
        statusDiv.style.display = 'none';
      }

      // Reinitialize the bridge
      if (quizEngineIntegration && quizEngineIntegration.llmBridge) {
        await quizEngineIntegration.llmBridge.initialize();
      }

      updateBrowserAIStatus();
      updateAIBoostBadge();
    });
  }

  async function updateBrowserAIStatus() {
    if (!browserAIToggle.checked) {
      browserAIStatus.style.display = 'none';
      browserAIUnavailable.style.display = 'none';
      return;
    }

    // Check if browser AI is available
    if ('ai' in window && 'languageModel' in window.ai) {
      try {
        const capabilities = await window.ai.languageModel.capabilities();
        if (capabilities.available === 'readily') {
          browserAIStatus.style.display = 'block';
          browserAIUnavailable.style.display = 'none';
        } else {
          browserAIStatus.style.display = 'none';
          browserAIUnavailable.style.display = 'block';
        }
      } catch (e) {
        browserAIStatus.style.display = 'none';
        browserAIUnavailable.style.display = 'block';
      }
    } else {
      browserAIStatus.style.display = 'none';
      browserAIUnavailable.style.display = 'block';
    }
  }

  // Web LLM handlers
  const webllmToggle = document.getElementById('use-webllm');
  const webllmSettings = document.getElementById('webllm-settings');
  const webllmModelSelect = document.getElementById('webllm-model');
  const downloadModelButton = document.getElementById('download-webllm-model');
  const webllmProgress = document.getElementById('webllm-progress');
  const webllmProgressText = document.getElementById('webllm-progress-text');
  const webllmProgressBar = document.getElementById('webllm-progress-bar');
  const webllmReady = document.getElementById('webllm-ready');
  const webllmError = document.getElementById('webllm-error');
  const webllmErrorText = document.getElementById('webllm-error-text');
  const webllmDownloadSection = document.getElementById('webllm-download-section');

  if (webllmToggle) {
    // Load Web LLM setting
    const useWebLLM = localStorage.getItem('ai_mode') === 'webllm';
    webllmToggle.checked = useWebLLM;
    if (useWebLLM) {
      webllmSettings.style.display = 'block';
    }

    webllmToggle.addEventListener('change', async () => {
      const enabled = webllmToggle.checked;

      if (enabled) {
        localStorage.setItem('ai_mode', 'webllm');
        webllmSettings.style.display = 'block';

        // Disable other AI options
        if (browserAIToggle) {
          browserAIToggle.checked = false;
          localStorage.removeItem('use_local_llm');
        }
        localStorage.removeItem('claude_api_key');
        if (apiKeyInput) apiKeyInput.value = '';
        if (statusDiv) statusDiv.style.display = 'none';
      } else {
        localStorage.setItem('ai_mode', 'none');
        webllmSettings.style.display = 'none';
      }

      // Reinitialize the bridge
      if (quizEngineIntegration && quizEngineIntegration.llmBridge) {
        await quizEngineIntegration.llmBridge.initialize();
      }

      updateBrowserAIStatus();
      updateAIBoostBadge();
    });
  }

  if (downloadModelButton) {
    downloadModelButton.addEventListener('click', async () => {
      try {
        console.log('🚀 Download Model button clicked');
        console.log('📦 WebLLMBridge available?', !!window.WebLLMBridge);
        console.log('🎮 quizEngineIntegration?', !!quizEngineIntegration);

        // Hide download button, show progress
        webllmDownloadSection.style.display = 'none';
        webllmProgress.style.display = 'block';
        webllmReady.style.display = 'none';
        webllmError.style.display = 'none';

        // Check if WebLLMBridge is available
        if (!window.WebLLMBridge) {
          throw new Error('Web LLM library not loaded. Please refresh the page.');
        }

        // Initialize Web LLM with progress callback
        const onProgress = (progress) => {
          console.log('⏳ Download progress:', progress);
          webllmProgressText.textContent = progress.text;
          webllmProgressBar.style.width = `${(progress.progress || 0) * 100}%`;
        };

        if (!quizEngineIntegration || !quizEngineIntegration.llmBridge) {
          throw new Error('Quiz engine not initialized');
        }

        console.log('🎯 Starting Web LLM initialization...');
        const success = await quizEngineIntegration.llmBridge.initializeWebLLM(onProgress);
        console.log('✅ Web LLM initialization result:', success);
        console.log('🤖 LLM ready after init?', quizEngineIntegration.llmBridge.isReady());

        if (success) {
          // Save that model is downloaded and ready
          localStorage.setItem('webllm_model_ready', 'true');
          const selectedModel = webllmModelSelect ? webllmModelSelect.value : 'Phi-3-mini-4k-instruct-q4f16_1-MLC';
          localStorage.setItem('webllm_current_model', selectedModel);

          webllmProgress.style.display = 'none';
          webllmReady.style.display = 'block';
          updateAIBoostBadge();
          console.log('🎉 Web LLM is now ready and saved to localStorage!');
        } else {
          throw new Error('Model initialization failed');
        }
      } catch (error) {
        console.error('❌ Web LLM initialization error:', error);
        webllmProgress.style.display = 'none';
        webllmDownloadSection.style.display = 'block';
        webllmError.style.display = 'block';
        webllmErrorText.textContent = error.message || 'Unknown error occurred';
      }
    });
  }

  if (webllmModelSelect) {
    webllmModelSelect.addEventListener('change', async () => {
      const selectedModel = webllmModelSelect.value;
      localStorage.setItem('webllm_model', selectedModel);

      // Reset state when model changes
      webllmDownloadSection.style.display = 'block';
      webllmProgress.style.display = 'none';
      webllmReady.style.display = 'none';
      webllmError.style.display = 'none';

      // Update the bridge if it exists
      if (quizEngineIntegration && quizEngineIntegration.llmBridge && quizEngineIntegration.llmBridge.webLLMBridge) {
        quizEngineIntegration.llmBridge.ready = false;
        quizEngineIntegration.llmBridge.useWebLLM = false;
      }
    });

    // Load saved model preference
    const savedModel = localStorage.getItem('webllm_model');
    if (savedModel) {
      webllmModelSelect.value = savedModel;
    }
  }

  // Save API key
  aiForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey.startsWith('sk-ant-')) {
      alert('Invalid API key format. Claude API keys start with "sk-ant-"');
      return;
    }

    if (quizEngineIntegration && quizEngineIntegration.llmBridge) {
      quizEngineIntegration.llmBridge.setAPIKey(apiKey);
      statusDiv.style.display = 'block';
      alert('API key saved! AI quiz generation is now enabled.');
      updateAIBoostBadge();
    }
  });

  // Test AI connection
  testButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      alert('Please enter an API key first');
      return;
    }

    testButton.disabled = true;
    testButton.textContent = 'Testing...';

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 50,
          messages: [{
            role: 'user',
            content: 'Say "API connection successful!" in 5 words or less.'
          }]
        })
      });

      if (response.ok) {
        alert('✓ API connection successful! Claude AI is ready to generate quizzes.');
      } else {
        const error = await response.json();
        alert(`API test failed: ${error.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Connection error: ${error.message}`);
    } finally {
      testButton.disabled = false;
      testButton.textContent = 'Test AI';
    }
  });

  // Clear API key
  clearButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to remove your API key? AI quiz generation will be disabled.')) {
      localStorage.removeItem('claude_api_key');
      apiKeyInput.value = '';
      statusDiv.style.display = 'none';
      if (quizEngineIntegration && quizEngineIntegration.llmBridge) {
        quizEngineIntegration.llmBridge.useClaudeAPI = false;
        quizEngineIntegration.llmBridge.ready = false;
      }
      updateAIBoostBadge();
      alert('API key removed. Quiz generation will use the rules engine.');
    }
  });
}

// Initialize AI settings on profile page
if (window.location.pathname.includes('profile.html')) {
  document.addEventListener('DOMContentLoaded', setupAISettings);
}

// Theme functionality
function initializeTheme() {
  // Load saved theme preference and apply it
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
}

function initializeThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  
  if (!themeToggle) {
    return; // Theme toggle not found on this page
  }

  // Set toggle state based on current theme
  const currentTheme = localStorage.getItem('theme') || 'light';
  themeToggle.checked = currentTheme === 'dark';

  // Add event listener for theme toggle
  themeToggle.addEventListener('change', function() {
    const newTheme = this.checked ? 'dark' : 'light';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  });
}

function applyTheme(theme) {
  const html = document.documentElement;
  
  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else {
    html.removeAttribute('data-theme');
  }
  
  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#0a1624' : '#f7f3eb');
  }
}

// ============================================================================
// COURSES MANAGEMENT SYSTEM
// ============================================================================

class CoursesManager {
  constructor() {
    this.courses = this.loadCourses();
    this.editingId = null;
  }

  loadCourses() {
    const coursesData = localStorage.getItem('courses');
    return coursesData ? JSON.parse(coursesData) : [];
  }

  saveCourses() {
    localStorage.setItem('courses', JSON.stringify(this.courses));
  }

  generateId() {
    return 'course_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  addCourse(courseData) {
    const course = {
      id: this.generateId(),
      name: courseData.name,
      code: courseData.code || '',
      instructor: courseData.instructor || '',
      term: courseData.term || '',
      context: courseData.context || '',
      topics: courseData.topics || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.courses.unshift(course); // Add to beginning of array
    this.saveCourses();
    return course;
  }

  updateCourse(id, courseData) {
    const index = this.courses.findIndex(c => c.id === id);
    if (index === -1) return null;

    this.courses[index] = {
      ...this.courses[index],
      name: courseData.name,
      code: courseData.code || '',
      instructor: courseData.instructor || '',
      term: courseData.term || '',
      context: courseData.context || '',
      topics: courseData.topics || '',
      updatedAt: new Date().toISOString()
    };

    this.saveCourses();
    return this.courses[index];
  }

  deleteCourse(id) {
    const index = this.courses.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.courses.splice(index, 1);
    this.saveCourses();
    return true;
  }

  getCourse(id) {
    return this.courses.find(c => c.id === id);
  }

  getAllCourses() {
    return [...this.courses];
  }
}

// Initialize courses manager
let coursesManager = new CoursesManager();

function initializeCourses() {
  const courseForm = document.getElementById('course-form');
  if (!courseForm) return; // Not on courses page

  // Get form elements
  const courseId = document.getElementById('course-id');
  const courseName = document.getElementById('course-name');
  const courseCode = document.getElementById('course-code');
  const courseInstructor = document.getElementById('course-instructor');
  const courseTerm = document.getElementById('course-term');
  const courseContext = document.getElementById('course-context');
  const courseTopics = document.getElementById('course-topics');
  const courseFeedback = document.getElementById('course-feedback');
  const courseSaveBtn = document.getElementById('course-save');
  const courseCancelBtn = document.getElementById('course-cancel');
  const courseResetBtn = document.getElementById('course-reset');

  // Render courses on load
  renderCourseList();

  // Form submit handler
  courseForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const courseData = {
      name: courseName.value.trim(),
      code: courseCode.value.trim(),
      instructor: courseInstructor.value.trim(),
      term: courseTerm.value.trim(),
      context: courseContext.value.trim(),
      topics: courseTopics.value.trim()
    };

    if (!courseData.name) {
      showCourseFeedback('Please enter a course name', 'error');
      return;
    }

    try {
      if (courseId.value) {
        // Update existing course
        coursesManager.updateCourse(courseId.value, courseData);
        showCourseFeedback('Course updated successfully!', 'success');
        cancelCourseEdit();
      } else {
        // Add new course
        coursesManager.addCourse(courseData);
        showCourseFeedback('Course added successfully!', 'success');
        courseForm.reset();
      }

      renderCourseList();
    } catch (error) {
      console.error('Error saving course:', error);
      showCourseFeedback('Failed to save course. Please try again.', 'error');
    }
  });

  // Cancel edit button
  if (courseCancelBtn) {
    courseCancelBtn.addEventListener('click', () => {
      cancelCourseEdit();
    });
  }

  // Reset button
  if (courseResetBtn) {
    courseResetBtn.addEventListener('click', () => {
      courseForm.reset();
      cancelCourseEdit();
    });
  }

  function showCourseFeedback(message, type = 'success') {
    if (!courseFeedback) return;

    courseFeedback.textContent = message;
    courseFeedback.className = 'course-feedback course-feedback--' + type;
    courseFeedback.style.display = 'block';

    setTimeout(() => {
      courseFeedback.style.display = 'none';
    }, 3000);
  }

  function cancelCourseEdit() {
    courseId.value = '';
    courseForm.reset();
    courseSaveBtn.textContent = 'Save course';
    courseCancelBtn.hidden = true;
    coursesManager.editingId = null;
  }

  function renderCourseList() {
    const courseList = document.getElementById('course-list');
    if (!courseList) return;

    const courses = coursesManager.getAllCourses();

    if (courses.length === 0) {
      courseList.innerHTML = `
        <div class="empty-state">
          <p>No courses yet. Create your first course above!</p>
        </div>
      `;
      return;
    }

    courseList.innerHTML = courses.map(course => `
      <div class="course-card" data-course-id="${course.id}">
        <div class="course-card__header">
          <div class="course-card__title">
            <h3>${escapeHtml(course.name)}</h3>
            ${course.code ? `<span class="course-card__code">${escapeHtml(course.code)}</span>` : ''}
          </div>
          <div class="course-card__actions">
            <button class="icon-btn" onclick="editCourse('${course.id}')" title="Edit course">
              <span>✏️</span>
            </button>
            <button class="icon-btn icon-btn--danger" onclick="deleteCoursePrompt('${course.id}')" title="Delete course">
              <span>🗑️</span>
            </button>
          </div>
        </div>

        ${course.instructor || course.term ? `
          <div class="course-card__meta">
            ${course.instructor ? `<span>👤 ${escapeHtml(course.instructor)}</span>` : ''}
            ${course.term ? `<span>📅 ${escapeHtml(course.term)}</span>` : ''}
          </div>
        ` : ''}

        ${course.context ? `
          <div class="course-card__section">
            <strong>Context:</strong>
            <p>${escapeHtml(course.context)}</p>
          </div>
        ` : ''}

        ${course.topics ? `
          <div class="course-card__section">
            <strong>Topics:</strong>
            <div class="course-card__topics">
              ${course.topics.split('\n').filter(t => t.trim()).map(topic =>
                `<span class="topic-tag">${escapeHtml(topic.trim())}</span>`
              ).join('')}
            </div>
          </div>
        ` : ''}

        <div class="course-card__footer">
          <small>Created: ${new Date(course.createdAt).toLocaleDateString()}</small>
        </div>
      </div>
    `).join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Make functions globally accessible
  window.editCourse = (id) => {
    const course = coursesManager.getCourse(id);
    if (!course) return;

    courseId.value = course.id;
    courseName.value = course.name;
    courseCode.value = course.code;
    courseInstructor.value = course.instructor;
    courseTerm.value = course.term;
    courseContext.value = course.context;
    courseTopics.value = course.topics;

    courseSaveBtn.textContent = 'Update course';
    courseCancelBtn.hidden = false;
    coursesManager.editingId = id;

    // Scroll to form
    courseForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.deleteCoursePrompt = (id) => {
    const course = coursesManager.getCourse(id);
    if (!course) return;

    if (confirm(`Are you sure you want to delete "${course.name}"?\n\nThis action cannot be undone.`)) {
      coursesManager.deleteCourse(id);
      showCourseFeedback('Course deleted successfully', 'success');
      renderCourseList();
    }
  };
}

// Export courses manager for use by other modules
window.getCoursesManager = () => coursesManager;
window.getAllCourses = () => coursesManager ? coursesManager.getAllCourses() : [];

// ============================================================================
// NOTES MANAGEMENT SYSTEM
// ============================================================================

class NotesManager {
  constructor() {
    this.notes = this.loadNotes();
    this.editingId = null;
    this.currentFilter = 'all';
  }

  loadNotes() {
    const notesData = localStorage.getItem('notes');
    return notesData ? JSON.parse(notesData) : [];
  }

  saveNotes() {
    localStorage.setItem('notes', JSON.stringify(this.notes));
  }

  generateId() {
    return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  addNote(noteData) {
    const note = {
      id: this.generateId(),
      title: noteData.title,
      courseId: noteData.courseId || '',
      courseName: noteData.courseName || 'Uncategorized',
      content: noteData.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.notes.unshift(note);
    this.saveNotes();
    return note;
  }

  updateNote(id, noteData) {
    const index = this.notes.findIndex(n => n.id === id);
    if (index === -1) return null;

    this.notes[index] = {
      ...this.notes[index],
      title: noteData.title,
      courseId: noteData.courseId || '',
      courseName: noteData.courseName || 'Uncategorized',
      content: noteData.content,
      updatedAt: new Date().toISOString()
    };

    this.saveNotes();
    return this.notes[index];
  }

  deleteNote(id) {
    const index = this.notes.findIndex(n => n.id === id);
    if (index === -1) return false;

    this.notes.splice(index, 1);
    this.saveNotes();
    return true;
  }

  getNote(id) {
    return this.notes.find(n => n.id === id);
  }

  getAllNotes() {
    return [...this.notes];
  }

  getNotesByCourse(courseId) {
    if (courseId === 'all') return this.getAllNotes();
    return this.notes.filter(n => n.courseId === courseId);
  }

  searchNotes(query) {
    const lowerQuery = query.toLowerCase();
    return this.notes.filter(n =>
      n.title.toLowerCase().includes(lowerQuery) ||
      n.content.toLowerCase().includes(lowerQuery) ||
      n.courseName.toLowerCase().includes(lowerQuery)
    );
  }
}

let notesManager = new NotesManager();

function initializeNotes() {
  const noteForm = document.getElementById('note-form');
  const notesList = document.getElementById('note-list');
  const courseSelect = document.getElementById('note-course-select');
  const filterSelect = document.getElementById('filter-course');

  if (!noteForm || !notesList) return;

  // Populate course dropdowns
  function populateCourseDropdowns() {
    const courses = window.getAllCourses ? window.getAllCourses() : [];

    if (courseSelect) {
      courseSelect.innerHTML = '<option value="">Select a course (optional)</option>';
      courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = `${course.code ? course.code + ' - ' : ''}${course.name}`;
        option.dataset.courseName = course.name;
        courseSelect.appendChild(option);
      });
    }

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="all">All Courses</option>';
      courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = `${course.code ? course.code + ' - ' : ''}${course.name}`;
        filterSelect.appendChild(option);
      });
    }
  }

  // Render notes list
  function renderNotesList(notes = null) {
    const notesToRender = notes || notesManager.getAllNotes();

    if (notesToRender.length === 0) {
      notesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>No notes yet</h3>
          <p>Create your first note to get started</p>
        </div>
      `;
      return;
    }

    notesList.innerHTML = notesToRender.map(note => {
      const isLongNote = note.content.length > 300;
      const previewContent = isLongNote ? note.content.substring(0, 300) + '...' : note.content;
      const date = new Date(note.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      return `
        <div class="note-card" data-note-id="${note.id}">
          <div class="note-header">
            <h3 class="note-title">${escapeHtml(note.title)}</h3>
            <div class="note-actions">
              <button class="icon-btn" onclick="copyNoteContent('${note.id}')" title="Copy to clipboard">
                📋
              </button>
              <button class="icon-btn" onclick="useNoteForQuiz('${note.id}')" title="Use for AI quiz">
                🤖
              </button>
              <button class="icon-btn" onclick="editNotePrompt('${note.id}')" title="Edit">
                ✏️
              </button>
              <button class="icon-btn delete-btn" onclick="deleteNotePrompt('${note.id}')" title="Delete">
                🗑️
              </button>
            </div>
          </div>
          ${note.courseName && note.courseName !== 'Uncategorized' ? `
            <div class="note-meta">
              <span class="course-badge">${escapeHtml(note.courseName)}</span>
              <span class="note-date">${date}</span>
            </div>
          ` : `
            <div class="note-meta">
              <span class="note-date">${date}</span>
            </div>
          `}
          <div class="note-content ${isLongNote ? 'collapsible' : ''}" id="note-content-${note.id}">
            <div class="note-preview">${escapeHtml(previewContent)}</div>
            ${isLongNote ? `
              <div class="note-full" style="display: none;">${escapeHtml(note.content)}</div>
              <button class="expand-btn" onclick="toggleNoteContent('${note.id}')">
                Show more ▼
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Form submit handler
  noteForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('note-title').value.trim();
    const courseId = document.getElementById('note-course-select').value;
    const content = document.getElementById('note-content').value.trim();

    if (!title || !content) {
      showNoteFeedback('Please fill in all required fields', 'error');
      return;
    }

    const courseName = courseSelect && courseSelect.selectedOptions[0]?.dataset.courseName || 'Uncategorized';

    const noteData = { title, courseId, courseName, content };

    try {
      if (notesManager.editingId) {
        notesManager.updateNote(notesManager.editingId, noteData);
        showNoteFeedback('Note updated successfully', 'success');
        notesManager.editingId = null;
      } else {
        notesManager.addNote(noteData);
        showNoteFeedback('Note created successfully', 'success');
      }

      noteForm.reset();
      const saveBtn = document.getElementById('note-save');
      const cancelBtn = document.getElementById('note-cancel');
      if (saveBtn) saveBtn.textContent = 'Save note';
      if (cancelBtn) cancelBtn.hidden = true;
      renderNotesList();
    } catch (error) {
      showNoteFeedback('Failed to save note', 'error');
      console.error('Error saving note:', error);
    }
  });

  // Cancel edit handler
  const cancelBtn = document.getElementById('note-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      notesManager.editingId = null;
      noteForm.reset();
      const saveBtn = document.getElementById('note-save');
      if (saveBtn) saveBtn.textContent = 'Save note';
      cancelBtn.hidden = true;
    });
  }

  // Filter by course
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      const courseId = e.target.value;
      notesManager.currentFilter = courseId;
      const filteredNotes = notesManager.getNotesByCourse(courseId);
      renderNotesList(filteredNotes);
    });
  }

  // Show feedback message
  function showNoteFeedback(message, type = 'success') {
    const existing = document.querySelector('.note-feedback');
    if (existing) existing.remove();

    const feedback = document.createElement('div');
    feedback.className = `note-feedback ${type}`;
    feedback.textContent = message;
    noteForm.insertBefore(feedback, noteForm.firstChild);

    setTimeout(() => feedback.remove(), 3000);
  }

  // Global functions for note actions
  window.copyNoteContent = async (id) => {
    const note = notesManager.getNote(id);
    if (!note) return;

    try {
      await navigator.clipboard.writeText(note.content);
      showNoteFeedback('Note copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
      showNoteFeedback('Failed to copy note', 'error');
    }
  };

  window.useNoteForQuiz = (id) => {
    const note = notesManager.getNote(id);
    if (!note) return;

    sessionStorage.setItem('quizNoteContent', note.content);
    sessionStorage.setItem('quizNoteTitle', note.title);
    window.location.href = 'quizzes.html';
  };

  window.toggleNoteContent = (id) => {
    const contentDiv = document.getElementById(`note-content-${id}`);
    const preview = contentDiv.querySelector('.note-preview');
    const full = contentDiv.querySelector('.note-full');
    const btn = contentDiv.querySelector('.expand-btn');

    if (full.style.display === 'none') {
      preview.style.display = 'none';
      full.style.display = 'block';
      btn.textContent = 'Show less ▲';
    } else {
      preview.style.display = 'block';
      full.style.display = 'none';
      btn.textContent = 'Show more ▼';
    }
  };

  window.editNotePrompt = (id) => {
    const note = notesManager.getNote(id);
    if (!note) return;

    notesManager.editingId = id;

    document.getElementById('note-title').value = note.title;
    document.getElementById('note-course-select').value = note.courseId || '';
    document.getElementById('note-content').value = note.content;

    const saveBtn = document.getElementById('note-save');
    const cancelBtn = document.getElementById('note-cancel');
    if (saveBtn) saveBtn.textContent = 'Update Note';
    if (cancelBtn) cancelBtn.hidden = false;

    noteForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.deleteNotePrompt = (id) => {
    const note = notesManager.getNote(id);
    if (!note) return;

    if (confirm(`Are you sure you want to delete "${note.title}"?\n\nThis action cannot be undone.`)) {
      notesManager.deleteNote(id);
      showNoteFeedback('Note deleted successfully', 'success');
      const filteredNotes = notesManager.getNotesByCourse(notesManager.currentFilter);
      renderNotesList(filteredNotes);
    }
  };

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize
  populateCourseDropdowns();
  renderNotesList();
}

// Export notes manager for use by other modules
window.getNotesManager = () => notesManager;
window.getAllNotes = () => notesManager ? notesManager.getAllNotes() : [];

// ============================================================================
// CHEATSHEETS MANAGEMENT SYSTEM
// ============================================================================

class CheatsheetsManager {
  constructor() {
    this.cheatsheets = this.loadCheatsheets();
    this.editingId = null;
  }

  loadCheatsheets() {
    const data = localStorage.getItem('cheatsheets');
    return data ? JSON.parse(data) : [];
  }

  saveCheatsheets() {
    localStorage.setItem('cheatsheets', JSON.stringify(this.cheatsheets));
  }

  generateId() {
    return 'cheatsheet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  addCheatsheet(cheatsheetData) {
    const cheatsheet = {
      id: this.generateId(),
      title: cheatsheetData.title,
      courseId: cheatsheetData.courseId,
      courseName: cheatsheetData.courseName,
      content: cheatsheetData.content,
      includeContext: cheatsheetData.includeContext,
      includeTopics: cheatsheetData.includeTopics,
      includeNotes: cheatsheetData.includeNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.cheatsheets.unshift(cheatsheet);
    this.saveCheatsheets();
    return cheatsheet;
  }

  updateCheatsheet(id, cheatsheetData) {
    const index = this.cheatsheets.findIndex(c => c.id === id);
    if (index === -1) return null;

    this.cheatsheets[index] = {
      ...this.cheatsheets[index],
      title: cheatsheetData.title,
      courseId: cheatsheetData.courseId,
      courseName: cheatsheetData.courseName,
      content: cheatsheetData.content,
      includeContext: cheatsheetData.includeContext,
      includeTopics: cheatsheetData.includeTopics,
      includeNotes: cheatsheetData.includeNotes,
      updatedAt: new Date().toISOString()
    };

    this.saveCheatsheets();
    return this.cheatsheets[index];
  }

  deleteCheatsheet(id) {
    const index = this.cheatsheets.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.cheatsheets.splice(index, 1);
    this.saveCheatsheets();
    return true;
  }

  getCheatsheet(id) {
    return this.cheatsheets.find(c => c.id === id);
  }

  getAllCheatsheets() {
    return [...this.cheatsheets];
  }
}

let cheatsheetsManager = new CheatsheetsManager();

function initializeCheatsheets() {
  const form = document.getElementById('cheatsheet-form');
  const list = document.getElementById('cheatsheet-list');
  const courseSelect = document.getElementById('cheatsheet-course-select');

  if (!form || !list) return;

  // Populate course dropdown
  function populateCourseDropdown() {
    const courses = window.getAllCourses ? window.getAllCourses() : [];

    if (courseSelect) {
      courseSelect.innerHTML = '<option value="">Select course…</option>';
      courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = `${course.code ? course.code + ' - ' : ''}${course.name}`;
        option.dataset.courseName = course.name;
        courseSelect.appendChild(option);
      });
    }
  }

  // Generate cheatsheet content
  function generateCheatsheetContent(courseId, options) {
    const course = window.getCoursesManager ? window.getCoursesManager().getCourse(courseId) : null;
    if (!course) return '';

    const allNotes = window.getAllNotes ? window.getAllNotes() : [];
    const courseNotes = allNotes.filter(n => n.courseId === courseId);

    let content = '';

    // Course info header
    content += `# ${course.name}\n`;
    if (course.code) content += `**Course Code:** ${course.code}\n`;
    if (course.instructor) content += `**Instructor:** ${course.instructor}\n`;
    if (course.term) content += `**Term:** ${course.term}\n`;
    content += '\n---\n\n';

    // Course context
    if (options.includeContext && course.context) {
      content += '## Course Context\n\n';
      content += course.context + '\n\n';
    }

    // Course topics
    if (options.includeTopics && course.topics) {
      content += '## Key Topics\n\n';
      const topics = course.topics.split('\n').filter(t => t.trim());
      topics.forEach(topic => {
        content += `- ${topic.trim()}\n`;
      });
      content += '\n';
    }

    // Notes
    if (options.includeNotes && courseNotes.length > 0) {
      content += '## Notes\n\n';
      courseNotes.forEach(note => {
        content += `### ${note.title}\n\n`;
        content += note.content + '\n\n';
      });
    }

    return content.trim();
  }

  // Render cheatsheets list
  function renderCheatsheetsList() {
    const cheatsheets = cheatsheetsManager.getAllCheatsheets();

    if (cheatsheets.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <h3>No cheat sheets yet</h3>
          <p>Generate your first cheat sheet to get started</p>
        </div>
      `;
      return;
    }

    list.innerHTML = cheatsheets.map(sheet => {
      const date = new Date(sheet.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const previewLines = sheet.content.split('\n').slice(0, 5).join('\n');
      const preview = previewLines.length < sheet.content.length ? previewLines + '\n...' : previewLines;

      return `
        <div class="cheatsheet-card" data-sheet-id="${sheet.id}">
          <div class="cheatsheet-header">
            <h3 class="cheatsheet-title">${escapeHtml(sheet.title)}</h3>
            <div class="cheatsheet-actions">
              <button class="icon-btn" onclick="viewCheatsheet('${sheet.id}')" title="View full">
                👁️
              </button>
              <button class="icon-btn" onclick="printCheatsheet('${sheet.id}')" title="Print">
                🖨️
              </button>
              <button class="icon-btn" onclick="copyCheatsheet('${sheet.id}')" title="Copy">
                📋
              </button>
              <button class="icon-btn delete-btn" onclick="deleteCheatsheetPrompt('${sheet.id}')" title="Delete">
                🗑️
              </button>
            </div>
          </div>
          <div class="cheatsheet-meta">
            <span class="course-badge">${escapeHtml(sheet.courseName)}</span>
            <span class="note-date">${date}</span>
          </div>
          <div class="cheatsheet-preview">
            <pre>${escapeHtml(preview)}</pre>
          </div>
        </div>
      `;
    }).join('');
  }

  // Form submit handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('cheatsheet-title').value.trim();
    const courseId = document.getElementById('cheatsheet-course-select').value;
    const includeContext = document.getElementById('cheatsheet-include-context').checked;
    const includeTopics = document.getElementById('cheatsheet-include-topics').checked;
    const includeNotes = document.getElementById('cheatsheet-include-notes').checked;

    if (!title || !courseId) {
      showCheatsheetFeedback('Please fill in all required fields', 'error');
      return;
    }

    const courseName = courseSelect.selectedOptions[0]?.dataset.courseName || 'Unknown';
    const content = generateCheatsheetContent(courseId, { includeContext, includeTopics, includeNotes });

    if (!content) {
      showCheatsheetFeedback('No content available to generate cheat sheet', 'error');
      return;
    }

    const cheatsheetData = {
      title,
      courseId,
      courseName,
      content,
      includeContext,
      includeTopics,
      includeNotes
    };

    try {
      cheatsheetsManager.addCheatsheet(cheatsheetData);
      showCheatsheetFeedback('Cheat sheet generated successfully', 'success');
      form.reset();
      document.getElementById('cheatsheet-include-context').checked = true;
      document.getElementById('cheatsheet-include-topics').checked = true;
      document.getElementById('cheatsheet-include-notes').checked = true;
      renderCheatsheetsList();
    } catch (error) {
      showCheatsheetFeedback('Failed to generate cheat sheet', 'error');
      console.error('Error generating cheat sheet:', error);
    }
  });

  // Show feedback message
  function showCheatsheetFeedback(message, type = 'success') {
    const feedback = document.getElementById('cheatsheet-feedback');
    if (!feedback) return;

    feedback.textContent = message;
    feedback.className = `cheatsheet-feedback ${type}`;
    feedback.style.display = 'block';

    setTimeout(() => {
      feedback.style.display = 'none';
    }, 3000);
  }

  // Global functions
  window.viewCheatsheet = (id) => {
    const sheet = cheatsheetsManager.getCheatsheet(id);
    if (!sheet) return;

    const modal = document.createElement('div');
    modal.className = 'cheatsheet-modal';
    modal.innerHTML = `
      <div class="cheatsheet-modal-content">
        <div class="cheatsheet-modal-header">
          <h2>${escapeHtml(sheet.title)}</h2>
          <button class="modal-close" onclick="this.closest('.cheatsheet-modal').remove()">✕</button>
        </div>
        <div class="cheatsheet-modal-body">
          <pre>${escapeHtml(sheet.content)}</pre>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  };

  window.printCheatsheet = (id) => {
    const sheet = cheatsheetsManager.getCheatsheet(id);
    if (!sheet) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${sheet.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 2rem; line-height: 1.6; }
            h1 { color: #1b9aaa; margin-bottom: 0.5rem; }
            h2 { color: #0a1624; margin-top: 1.5rem; border-bottom: 2px solid #1b9aaa; padding-bottom: 0.5rem; }
            h3 { color: #0a1624; margin-top: 1rem; }
            pre { white-space: pre-wrap; font-family: inherit; }
            @media print {
              body { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <pre>${escapeHtml(sheet.content)}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  window.copyCheatsheet = async (id) => {
    const sheet = cheatsheetsManager.getCheatsheet(id);
    if (!sheet) return;

    try {
      await navigator.clipboard.writeText(sheet.content);
      showCheatsheetFeedback('Cheat sheet copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
      showCheatsheetFeedback('Failed to copy cheat sheet', 'error');
    }
  };

  window.deleteCheatsheetPrompt = (id) => {
    const sheet = cheatsheetsManager.getCheatsheet(id);
    if (!sheet) return;

    if (confirm(`Are you sure you want to delete "${sheet.title}"?\n\nThis action cannot be undone.`)) {
      cheatsheetsManager.deleteCheatsheet(id);
      showCheatsheetFeedback('Cheat sheet deleted successfully', 'success');
      renderCheatsheetsList();
    }
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize
  populateCourseDropdown();
  renderCheatsheetsList();
}

// Export cheatsheets manager for use by other modules
window.getCheatsheetsManager = () => cheatsheetsManager;
window.getAllCheatsheets = () => cheatsheetsManager ? cheatsheetsManager.getAllCheatsheets() : [];

// ============================================================================
// QUIZ FORM SELECTORS (Course & Note Integration)
// ============================================================================
function initializeQuizFormSelectors() {
  const courseSelect = document.getElementById('quiz-course');
  const noteSelect = document.getElementById('quiz-note');
  const topicInput = document.getElementById('quiz-topic');
  const notesTextarea = document.getElementById('quiz-notes');

  if (!courseSelect || !noteSelect) return; // Not on quiz page

  // Populate course dropdown
  function populateCourseDropdown() {
    const courses = coursesManager.getAllCourses();
    courseSelect.innerHTML = '<option value="">-- No Course Selected --</option>';

    courses.forEach(course => {
      const option = document.createElement('option');
      option.value = course.id;
      option.textContent = `${course.code ? course.code + ' - ' : ''}${course.name}`;
      courseSelect.appendChild(option);
    });
  }

  // Populate note dropdown based on selected course
  function populateNoteDropdown(courseId) {
    noteSelect.innerHTML = '<option value="">-- Select a note or paste below --</option>';

    let notes;
    if (courseId) {
      notes = notesManager.getNotesByCourse(courseId);
    } else {
      notes = notesManager.getAllNotes();
    }

    notes.forEach(note => {
      const option = document.createElement('option');
      option.value = note.id;
      option.textContent = note.title;
      option.dataset.content = note.content;
      option.dataset.courseId = note.courseId;
      option.dataset.courseName = note.courseName;
      noteSelect.appendChild(option);
    });
  }

  // Course selection handler
  courseSelect.addEventListener('change', (e) => {
    const selectedCourseId = e.target.value;
    populateNoteDropdown(selectedCourseId);

    // Auto-fill topic with course name if empty
    if (selectedCourseId && !topicInput.value) {
      const selectedOption = courseSelect.options[courseSelect.selectedIndex];
      topicInput.value = selectedOption.textContent;
    }
  });

  // Note selection handler
  noteSelect.addEventListener('change', (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];

    if (selectedOption.value) {
      // Auto-fill notes content
      notesTextarea.value = selectedOption.dataset.content || '';

      // Auto-fill topic with note title if empty or matches previous note
      if (!topicInput.value || topicInput.dataset.fromNote === 'true') {
        topicInput.value = selectedOption.textContent;
        topicInput.dataset.fromNote = 'true';
      }

      // Auto-select the course if note has one
      const notesCourseId = selectedOption.dataset.courseId;
      if (notesCourseId && courseSelect.value !== notesCourseId) {
        courseSelect.value = notesCourseId;
      }
    }
  });

  // Initialize dropdowns
  populateCourseDropdown();
  populateNoteDropdown('');
}

// ============================================================================
// HISTORY PAGE MANAGEMENT
// ============================================================================
function initializeHistory() {
  const pomodoroHistoryList = document.getElementById('pomodoro-history-list');
  const quizHistoryList = document.getElementById('quiz-history-list');
  const cheatsheetHistoryList = document.getElementById('cheatsheet-history-list');

  // Exit if not on history page
  if (!pomodoroHistoryList) return;

  let currentFilter = 'all';
  let currentTab = 'pomodoro';

  // ============================================================================
  // POMODORO HISTORY DISPLAY
  // ============================================================================
  function displayPomodoroHistory(filterDays = 'all') {
    const history = JSON.parse(localStorage.getItem('pomodoroHistory') || '[]');

    if (history.length === 0) {
      pomodoroHistoryList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⏱️</div>
          <h3>No Pomodoro sessions yet</h3>
          <p>Complete your first focus session to see it here!</p>
          <a href="index.html" class="primary" style="margin-top: 1rem; display: inline-block; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 8px;">Start a Session</a>
        </div>
      `;
      return;
    }

    // Filter by date
    let filteredHistory = history;
    if (filterDays !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();

      if (filterDays === 'today') {
        cutoffDate.setHours(0, 0, 0, 0);
      } else {
        cutoffDate.setDate(now.getDate() - parseInt(filterDays));
      }

      filteredHistory = history.filter(session => {
        const sessionDate = new Date(session.completedAt);
        return sessionDate >= cutoffDate;
      });
    }

    if (filteredHistory.length === 0) {
      pomodoroHistoryList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <h3>No sessions in this time period</h3>
          <p>Try selecting a different date range.</p>
        </div>
      `;
      return;
    }

    // Group sessions by date
    const groupedByDate = {};
    filteredHistory.forEach(session => {
      const date = new Date(session.completedAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(session);
    });

    // Calculate statistics
    const totalSessions = filteredHistory.length;
    const focusSessions = filteredHistory.filter(s => s.mode === 'pomodoro').length;
    const totalMinutes = filteredHistory.reduce((sum, s) => sum + s.duration, 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    // Render statistics
    let html = `
      <div class="history__stats">
        <div class="stat-card">
          <div class="stat-value">${totalSessions}</div>
          <div class="stat-label">Total Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${focusSessions}</div>
          <div class="stat-label">Focus Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${hours}h ${minutes}m</div>
          <div class="stat-label">Total Time</div>
        </div>
      </div>
    `;

    // Render grouped sessions
    Object.keys(groupedByDate).forEach(date => {
      const sessions = groupedByDate[date];
      const dateTotal = sessions.reduce((sum, s) => sum + s.duration, 0);

      html += `
        <div class="history__date-group">
          <div class="history__date-header">
            <h3>${date}</h3>
            <span class="history__date-total">${sessions.length} sessions · ${dateTotal} min</span>
          </div>
          <div class="history__sessions">
      `;

      sessions.forEach(session => {
        const time = new Date(session.completedAt).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        const modeLabel = {
          'pomodoro': 'Focus',
          'short-break': 'Short Break',
          'long-break': 'Long Break'
        }[session.mode] || session.mode;

        const modeIcon = {
          'pomodoro': '🎯',
          'short-break': '☕',
          'long-break': '🌴'
        }[session.mode] || '⏱️';

        const modeClass = session.mode.replace('-break', '');

        html += `
          <div class="session-card session-card--${modeClass}">
            <div class="session-icon">${modeIcon}</div>
            <div class="session-details">
              <div class="session-type">${modeLabel}</div>
              <div class="session-time">${time}</div>
            </div>
            <div class="session-duration">${session.duration} min</div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    pomodoroHistoryList.innerHTML = html;
  }

  // ============================================================================
  // TAB SWITCHING
  // ============================================================================
  function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.history__tab').forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('history__tab--active');
      } else {
        tab.classList.remove('history__tab--active');
      }
    });

    // Update panels
    document.querySelectorAll('.history__panel').forEach(panel => {
      panel.classList.remove('history__panel--active');
    });

    const activePanel = document.getElementById(`${tabName}-history`);
    if (activePanel) {
      activePanel.classList.add('history__panel--active');
    }

    // Load data for active tab
    if (tabName === 'pomodoro') {
      displayPomodoroHistory(currentFilter);
    } else if (tabName === 'quizzes') {
      displayQuizHistory();
    } else if (tabName === 'cheatsheets') {
      displayCheatsheetHistory();
    }
  }

  // ============================================================================
  // QUIZ HISTORY (Placeholder)
  // ============================================================================
  function displayQuizHistory() {
    if (!quizHistoryList) return;

    quizHistoryList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>Quiz history coming soon</h3>
        <p>Your completed quizzes will appear here.</p>
      </div>
    `;
  }

  // ============================================================================
  // CHEATSHEET HISTORY (Placeholder)
  // ============================================================================
  function displayCheatsheetHistory() {
    if (!cheatsheetHistoryList) return;

    const cheatsheets = cheatsheetsManager ? cheatsheetsManager.getAllCheatsheets() : [];

    if (cheatsheets.length === 0) {
      cheatsheetHistoryList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <h3>No cheat sheets yet</h3>
          <p>Create your first cheat sheet to see it here!</p>
          <a href="cheatsheets.html" class="primary" style="margin-top: 1rem; display: inline-block; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 8px;">Create Cheat Sheet</a>
        </div>
      `;
      return;
    }

    const html = cheatsheets.map(sheet => {
      const date = new Date(sheet.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      return `
        <li class="history-item">
          <div class="history-item__icon">📄</div>
          <div class="history-item__content">
            <h4>${sheet.title}</h4>
            <p class="history-item__meta">${sheet.courseName || 'General'} · ${date}</p>
          </div>
          <a href="cheatsheets.html" class="history-item__action">View</a>
        </li>
      `;
    }).join('');

    cheatsheetHistoryList.innerHTML = html;
  }

  // ============================================================================
  // DATE FILTER
  // ============================================================================
  const dateFilter = document.getElementById('date-filter');
  if (dateFilter) {
    dateFilter.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      if (currentTab === 'pomodoro') {
        displayPomodoroHistory(currentFilter);
      }
    });
  }

  // ============================================================================
  // TAB CLICK HANDLERS
  // ============================================================================
  document.querySelectorAll('.history__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // ============================================================================
  // INITIALIZE
  // ============================================================================
  displayPomodoroHistory(currentFilter);
}

// ============================================================================
// Export functions for use in other parts of the app
// ============================================================================
window.generateEnhancedQuiz = generateEnhancedQuiz;
window.gradeEnhancedAnswer = gradeEnhancedAnswer;
window.updateAIBoostBadge = updateAIBoostBadge;
window.updateEngineStatus = updateEngineStatus;
window.applyTheme = applyTheme;