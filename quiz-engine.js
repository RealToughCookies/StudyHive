// Quiz Engine - Handles quiz creation, execution, and scoring
class QuizEngine {
  constructor() {
    this.currentQuiz = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.quizResults = null;
    this.quizHistory = this.loadQuizHistory();
    
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Quiz form submission
    const quizForm = document.getElementById('quiz-form');
    if (quizForm) {
      quizForm.addEventListener('submit', (e) => this.handleQuizGeneration(e));
    }

    // Clear form button
    const clearForm = document.getElementById('clear-form');
    if (clearForm) {
      clearForm.addEventListener('click', () => this.clearForm());
    }

    // Keyboard shortcuts for quiz navigation
    document.addEventListener('keydown', (e) => {
      // Only activate on quiz pages
      const quizDisplay = document.getElementById('quiz-display');
      if (!quizDisplay || quizDisplay.style.display === 'none') return;

      // Ignore if typing in input/textarea
      if (e.target.matches('input, textarea, [contenteditable]')) return;

      const previousBtn = document.getElementById('previous-question');
      const nextBtn = document.getElementById('next-question');
      const finishBtn = document.getElementById('finish-quiz');

      // Left Arrow: Previous question
      if (e.key === 'ArrowLeft' && previousBtn && !previousBtn.disabled) {
        e.preventDefault();
        this.previousQuestion();
        // Visual feedback
        previousBtn.style.transform = 'scale(0.95)';
        setTimeout(() => { previousBtn.style.transform = ''; }, 100);
      }

      // Right Arrow: Next question
      if (e.key === 'ArrowRight' && nextBtn && nextBtn.style.display !== 'none') {
        e.preventDefault();
        this.nextQuestion();
        // Visual feedback
        nextBtn.style.transform = 'scale(0.95)';
        setTimeout(() => { nextBtn.style.transform = ''; }, 100);
      }

      // Enter: Finish quiz (when on last question)
      if (e.key === 'Enter' && finishBtn && finishBtn.style.display !== 'none' && !finishBtn.disabled) {
        e.preventDefault();
        finishBtn.click();
      }
    });

    // Quiz navigation buttons
    const previousBtn = document.getElementById('previous-question');
    const nextBtn = document.getElementById('next-question');
    const finishBtn = document.getElementById('finish-quiz');

    if (previousBtn) {
      previousBtn.addEventListener('click', () => this.previousQuestion());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextQuestion());
    }
    if (finishBtn) {
      console.log('✅ Finish button found, attaching event listener');
      finishBtn.addEventListener('click', () => {
        console.log('🖱️ Finish button clicked!');

        // Prevent multiple clicks
        if (finishBtn.disabled) {
          console.log('⚠️ Button already clicked, ignoring');
          return;
        }

        // Disable button and show progress
        finishBtn.disabled = true;
        finishBtn.innerHTML = '<span class="loading-spinner"></span> Grading...';
        finishBtn.style.opacity = '0.6';
        finishBtn.style.cursor = 'not-allowed';

        this.finishQuiz();
      });
    } else {
      console.error('❌ Finish button NOT found in DOM');
    }

    // Results actions
    const retakeBtn = document.getElementById('retake-quiz');
    const newQuizBtn = document.getElementById('new-quiz');
    const viewAnswersBtn = document.getElementById('view-answers');

    if (retakeBtn) {
      retakeBtn.addEventListener('click', () => this.retakeQuiz());
    }
    if (newQuizBtn) {
      newQuizBtn.addEventListener('click', () => this.createNewQuiz());
    }
    if (viewAnswersBtn) {
      viewAnswersBtn.addEventListener('click', () => this.viewAnswers());
    }
  }

  async handleQuizGeneration(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const quizData = {
      topic: formData.get('topic'),
      difficulty: formData.get('difficulty'),
      numQuestions: parseInt(formData.get('numQuestions')),
      notes: formData.get('notes'),
      engine: formData.get('engine')
    };

    // Validate form data
    if (!this.validateQuizData(quizData)) {
      return;
    }

    // Show loading state
    this.setLoadingState(true);

    try {
      // Generate quiz using the enhanced quiz engine
      const quiz = await this.generateQuiz(quizData);
      
      if (quiz && quiz.questions && quiz.questions.length > 0) {
        this.currentQuiz = quiz;
        this.currentQuestionIndex = 0;
        this.userAnswers = {};

        // Quiz generated successfully - no need for fallback messages

        this.displayQuiz(quiz);
        this.showQuizDisplay();
      } else {
        throw new Error('No questions were generated');
      }
    } catch (error) {
      console.error('Quiz generation failed:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      this.showError(`Failed to generate quiz: ${error.message}`);
    } finally {
      this.setLoadingState(false);
    }
  }

  validateQuizData(data) {
    if (!data.topic || data.topic.trim().length < 2) {
      this.showError('Please enter a valid topic (at least 2 characters)');
      return false;
    }

    if (!data.notes || data.notes.trim().length < 10) {
      this.showError('Please enter notes content (at least 10 characters)');
      return false;
    }

    if (data.numQuestions < 1 || data.numQuestions > 20) {
      this.showError('Number of questions must be between 1 and 20');
      return false;
    }

    return true;
  }

  async generateQuiz(data) {
    // Use the enhanced quiz generation function from script.js
    if (window.generateEnhancedQuiz) {
      return await window.generateEnhancedQuiz(
        data.topic,
        data.difficulty,
        data.numQuestions,
        data.notes
      );
    } else {
      // Fallback to mock quiz generation
      return this.generateMockQuiz(data);
    }
  }

  generateMockQuiz(data) {
    const questions = [];
    
    // Parse the notes to extract concepts and create better questions
    const concepts = this.extractConceptsFromNotes(data.notes);
    const definitions = this.extractDefinitionsFromNotes(data.notes);
    const examples = this.extractExamplesFromNotes(data.notes);
    
    for (let i = 0; i < data.numQuestions; i++) {
      if (i % 2 === 0) {
        // Multiple choice question with real content
        const concept = concepts[i % concepts.length] || data.topic;
        const question = this.generateMultipleChoiceQuestion(concept, data.topic, data.difficulty, i);
        questions.push(question);
      } else {
        // Short answer question with real content
        const concept = concepts[i % concepts.length] || data.topic;
        const question = this.generateShortAnswerQuestion(concept, data.topic, data.difficulty, i);
        questions.push(question);
      }
    }

    return {
      topic: data.topic,
      difficulty: data.difficulty,
      questions: questions,
      metadata: {
        source: data.engine === 'llm' ? 'device-llm' : 'rules',
        generatedAt: new Date().toISOString(),
        seed: 42
      }
    };
  }

  extractConceptsFromNotes(notes) {
    // Extract key concepts from notes
    const words = notes.toLowerCase().split(/\s+/);
    const concepts = [];
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    
    // Find capitalized words and important terms
    const capitalizedWords = notes.match(/\b[A-Z][a-z]+\b/g) || [];
    const importantWords = words.filter(word => 
      word.length > 4 && 
      !stopWords.has(word) && 
      !concepts.includes(word)
    );
    
    // Combine and deduplicate
    const allConcepts = [...new Set([...capitalizedWords, ...importantWords])];
    return allConcepts.slice(0, 10); // Limit to 10 concepts
  }

  extractDefinitionsFromNotes(notes) {
    // Extract sentences that look like definitions
    const sentences = notes.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const definitions = [];
    
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (lower.includes(' is ') || lower.includes(' are ') || 
          lower.includes(' means ') || lower.includes(' refers to ') ||
          lower.includes(' can be defined as ')) {
        definitions.push(sentence.trim());
      }
    }
    
    return definitions.slice(0, 5);
  }

  extractExamplesFromNotes(notes) {
    // Extract sentences with examples
    const sentences = notes.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const examples = [];
    
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (lower.includes(' for example ') || lower.includes(' such as ') ||
          lower.includes(' including ') || lower.includes(' e.g. ')) {
        examples.push(sentence.trim());
      }
    }
    
    return examples.slice(0, 5);
  }

  generateMultipleChoiceQuestion(concept, topic, difficulty, index) {
    // Create more realistic multiple choice questions
    const questionTypes = [
      {
        prompt: `What is ${concept}?`,
        correctAnswer: `${concept} is a key concept in ${topic}`,
        distractors: [
          `${concept} is unrelated to ${topic}`,
          `${concept} is the opposite of ${topic}`,
          `${concept} is a type of ${topic}`
        ]
      },
      {
        prompt: `Which of the following best describes ${concept}?`,
        correctAnswer: `${concept} is essential for understanding ${topic}`,
        distractors: [
          `${concept} is optional in ${topic}`,
          `${concept} is outdated in ${topic}`,
          `${concept} is irrelevant to ${topic}`
        ]
      },
      {
        prompt: `How does ${concept} relate to ${topic}?`,
        correctAnswer: `${concept} is fundamental to ${topic}`,
        distractors: [
          `${concept} contradicts ${topic}`,
          `${concept} is separate from ${topic}`,
          `${concept} replaces ${topic}`
        ]
      }
    ];

    const questionType = questionTypes[index % questionTypes.length];
    
    // Create options
    const options = [
      { value: 'correct', label: questionType.correctAnswer },
      { value: 'distractor1', label: questionType.distractors[0] },
      { value: 'distractor2', label: questionType.distractors[1] },
      { value: 'distractor3', label: questionType.distractors[2] }
    ];

    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return {
      id: `mcq_${index}`,
      type: 'multiple_choice',
      prompt: questionType.prompt,
      options: options,
      correctAnswer: 'correct',
      explanation: `${concept} is an important concept in ${topic}. Understanding ${concept} helps you better grasp the overall topic.`
    };
  }

  generateShortAnswerQuestion(concept, topic, difficulty, index) {
    // Create more realistic short answer questions
    const questionTypes = [
      {
        prompt: `Explain what ${concept} is and how it relates to ${topic}.`,
        keywords: [concept.toLowerCase(), topic.toLowerCase(), 'explain', 'relate', 'understand'],
        points: 10
      },
      {
        prompt: `Describe the importance of ${concept} in ${topic}.`,
        keywords: [concept.toLowerCase(), topic.toLowerCase(), 'important', 'significance', 'role'],
        points: 8
      },
      {
        prompt: `How does ${concept} contribute to our understanding of ${topic}?`,
        keywords: [concept.toLowerCase(), topic.toLowerCase(), 'contribute', 'understanding', 'help'],
        points: 10
      }
    ];

    const questionType = questionTypes[index % questionTypes.length];
    
    return {
      id: `saq_${index}`,
      type: 'short_answer',
      prompt: questionType.prompt,
      sampleAnswer: `${concept} is a fundamental concept in ${topic}. It helps us understand the core principles and applications of ${topic}. By studying ${concept}, we can better grasp how ${topic} works and why it's important.`,
      rubric: [
        {
          criterion: 'Understanding of Concept',
          points: Math.floor(questionType.points * 0.4),
          keywords: [concept.toLowerCase(), 'concept', 'definition']
        },
        {
          criterion: 'Connection to Topic',
          points: Math.floor(questionType.points * 0.3),
          keywords: [topic.toLowerCase(), 'relate', 'connect', 'link']
        },
        {
          criterion: 'Explanation Quality',
          points: Math.floor(questionType.points * 0.3),
          keywords: ['explain', 'describe', 'detail', 'clear']
        }
      ]
    };
  }

  displayQuiz(quiz) {
    // Update quiz header
    document.getElementById('quiz-title').textContent = quiz.topic;
    document.getElementById('quiz-difficulty-display').textContent =
      quiz.difficulty ? quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1) : 'Medium';
    document.getElementById('quiz-engine-display').textContent = 'Smart Quiz Engine';
    document.getElementById('quiz-questions-count').textContent =
      `${quiz.questions.length} questions`;

    // Display first question
    this.displayQuestion(0);
    this.updateProgress();
  }

  displayQuestion(index) {
    if (!this.currentQuiz || index >= this.currentQuiz.questions.length) {
      return;
    }

    const question = this.currentQuiz.questions[index];
    const container = document.getElementById('quiz-questions-container');
    
    container.innerHTML = this.renderQuestion(question, index);
    
    // Restore user's answer if they've already answered this question
    if (this.userAnswers[index]) {
      this.restoreUserAnswer(index, question);
    }

    // Update navigation buttons
    this.updateNavigationButtons();
  }

  renderQuestion(question, index) {
    let html = `<div class="quiz-question" data-question-index="${index}">`;
    
    if (question.type === 'multiple_choice') {
      html += this.renderMultipleChoiceQuestion(question);
    } else if (question.type === 'short_answer') {
      html += this.renderShortAnswerQuestion(question);
    } else if (question.type === 'fill_in_blank') {
      html += this.renderFillInBlankQuestion(question);
    }
    
    html += '</div>';
    return html;
  }

  renderMultipleChoiceQuestion(question) {
    let html = `
      <div class="question-header">
        <h4 class="question-prompt">${question.prompt}</h4>
      </div>
      <div class="question-options">
    `;
    
    question.options.forEach((option, index) => {
      html += `
        <label class="option-label">
          <input type="radio" name="question-${question.id}" value="${option.value}" 
                 class="option-input">
          <span class="option-text">${option.label}</span>
        </label>
      `;
    });
    
    html += '</div>';
    return html;
  }

  renderShortAnswerQuestion(question) {
    return `
      <div class="question-header">
        <h4 class="question-prompt">${question.prompt}</h4>
      </div>
      <div class="question-input">
        <textarea class="answer-textarea" placeholder="Enter your answer here..." 
                  rows="4"></textarea>
      </div>
    `;
  }

  renderFillInBlankQuestion(question) {
    return `
      <div class="question-header">
        <h4 class="question-prompt">${question.prompt}</h4>
      </div>
      <div class="question-input">
        <input type="text" class="answer-input" placeholder="Enter your answer...">
      </div>
    `;
  }

  restoreUserAnswer(index, question) {
    const answer = this.userAnswers[index];
    
    if (question.type === 'multiple_choice') {
      const input = document.querySelector(`input[name="question-${question.id}"][value="${answer}"]`);
      if (input) {
        input.checked = true;
      }
    } else if (question.type === 'short_answer') {
      const textarea = document.querySelector('.answer-textarea');
      if (textarea) {
        textarea.value = answer;
      }
    } else if (question.type === 'fill_in_blank') {
      const input = document.querySelector('.answer-input');
      if (input) {
        input.value = answer;
      }
    }
  }

  saveUserAnswer(index) {
    if (!this.currentQuiz || index >= this.currentQuiz.questions.length) {
      return;
    }

    const question = this.currentQuiz.questions[index];
    let answer = '';

    if (question.type === 'multiple_choice') {
      const selected = document.querySelector(`input[name="question-${question.id}"]:checked`);
      if (selected) {
        answer = selected.value;
      }
    } else if (question.type === 'short_answer') {
      const textarea = document.querySelector('.answer-textarea');
      if (textarea) {
        answer = textarea.value.trim();
      }
    } else if (question.type === 'fill_in_blank') {
      const input = document.querySelector('.answer-input');
      if (input) {
        answer = input.value.trim();
      }
    }

    if (answer) {
      this.userAnswers[index] = answer;
    }
  }

  nextQuestion() {
    this.saveUserAnswer(this.currentQuestionIndex);
    
    if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
      this.currentQuestionIndex++;
      this.displayQuestion(this.currentQuestionIndex);
      this.updateProgress();
    }
  }

  previousQuestion() {
    this.saveUserAnswer(this.currentQuestionIndex);
    
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.displayQuestion(this.currentQuestionIndex);
      this.updateProgress();
    }
  }

  updateProgress() {
    const progress = ((this.currentQuestionIndex + 1) / this.currentQuiz.questions.length) * 100;
    document.getElementById('quiz-progress-fill').style.width = `${progress}%`;
    document.getElementById('quiz-progress-text').textContent = 
      `Question ${this.currentQuestionIndex + 1} of ${this.currentQuiz.questions.length}`;
  }

  updateNavigationButtons() {
    const previousBtn = document.getElementById('previous-question');
    const nextBtn = document.getElementById('next-question');
    const finishBtn = document.getElementById('finish-quiz');

    // Previous button
    previousBtn.disabled = this.currentQuestionIndex === 0;

    // Next/Finish button
    if (this.currentQuestionIndex === this.currentQuiz.questions.length - 1) {
      nextBtn.style.display = 'none';
      finishBtn.style.display = 'inline-block';
    } else {
      nextBtn.style.display = 'inline-block';
      finishBtn.style.display = 'none';
    }
  }

  async finishQuiz() {
    console.log('🏁 FINISH QUIZ CALLED');
    console.log('Current question index:', this.currentQuestionIndex);
    console.log('User answers:', this.userAnswers);

    try {
      console.log('💾 Saving final answer...');
      this.saveUserAnswer(this.currentQuestionIndex);

      console.log('⏳ Setting loading state...');
      // Show loading state
      this.setLoadingState(true, 'Grading quiz...');

      console.log('📝 Starting quiz grading...');
      // Grade the quiz
      this.quizResults = await this.gradeQuiz();
      console.log('✅ Quiz graded:', this.quizResults);

      console.log('💾 Saving to history...');
      // Save to history
      this.saveQuizToHistory();

      console.log('🎨 Displaying results...');
      // Display results
      this.displayResults();

      console.log('👁️ Showing quiz results...');
      this.showQuizResults();

      console.log('🎉 Finish quiz complete!');
    } catch (error) {
      console.error('❌ Quiz grading failed:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      this.showError(`Failed to grade quiz: ${error.message}`);
    } finally {
      console.log('🔚 Clearing loading state...');
      this.setLoadingState(false);
    }
  }

  async gradeQuiz() {
    const results = {
      quiz: this.currentQuiz,
      answers: this.userAnswers,
      scores: [],
      totalScore: 0,
      maxScore: 0
    };

    for (let i = 0; i < this.currentQuiz.questions.length; i++) {
      const question = this.currentQuiz.questions[i];
      const userAnswer = this.userAnswers[i] || '';

      let grade;
      if (window.gradeEnhancedAnswer) {
        grade = await window.gradeEnhancedAnswer(question, userAnswer);
      } else {
        grade = this.gradeMockAnswer(question, userAnswer);
      }

      results.scores.push(grade);
      results.totalScore += grade.totalScore;
      results.maxScore += grade.maxScore;
    }

    return results;
  }

  gradeMockAnswer(question, userAnswer) {
    if (question.type === 'multiple_choice') {
      const isCorrect = userAnswer === question.correctAnswer;
      return {
        questionId: question.id,
        totalScore: isCorrect ? 1.0 : 0.0,
        maxScore: 1.0,
        breakdown: [{
          criterion: 'Answer Selection',
          awardedPoints: isCorrect ? 1.0 : 0.0,
          maxPoints: 1.0,
          reasoning: isCorrect ? 'Correct answer selected' : 'Incorrect answer selected',
          keywords: []
        }],
        feedback: isCorrect ? 'Correct! Well done.' : `Incorrect. The correct answer was: ${question.correctAnswer}`,
        metadata: {
          source: 'rules',
          gradedAt: new Date().toISOString(),
          processingTimeMs: 10.0
        }
      };
    } else if (question.type === 'short_answer') {
      return this.gradeShortAnswerIntelligently(question, userAnswer);
    }

    return {
      questionId: question.id,
      totalScore: 0,
      maxScore: 1,
      breakdown: [],
      feedback: 'Unable to grade this question type',
      metadata: {
        source: 'rules',
        gradedAt: new Date().toISOString(),
        processingTimeMs: 5.0
      }
    };
  }

  gradeShortAnswerIntelligently(question, userAnswer) {
    const breakdown = [];
    let totalScore = 0;
    let maxScore = 0;

    // Grade each criterion in the rubric
    for (const criterion of question.rubric) {
      const criterionScore = this.gradeCriterion(criterion, userAnswer, question);
      breakdown.push(criterionScore);
      totalScore += criterionScore.awardedPoints;
      maxScore += criterionScore.maxPoints;
    }

    // Generate overall feedback
    const feedback = this.generateIntelligentFeedback(breakdown, userAnswer, question);

    return {
      questionId: question.id,
      totalScore: totalScore,
      maxScore: maxScore,
      breakdown: breakdown,
      feedback: feedback,
      metadata: {
        source: 'rules',
        gradedAt: new Date().toISOString(),
        processingTimeMs: 25.0
      }
    };
  }

  gradeCriterion(criterion, userAnswer, question) {
    const answer = userAnswer.toLowerCase();
    const keywords = criterion.keywords;
    
    // Check for keyword matches
    const foundKeywords = keywords.filter(keyword => 
      answer.includes(keyword.toLowerCase())
    );

    // Calculate base score from keyword matches
    let keywordScore = (foundKeywords.length / keywords.length) * criterion.points;

    // Additional scoring factors
    let additionalScore = 0;

    // Length bonus (encourages detailed answers)
    if (userAnswer.length > 50) {
      additionalScore += criterion.points * 0.1;
    }
    if (userAnswer.length > 100) {
      additionalScore += criterion.points * 0.1;
    }

    // Sentence structure bonus
    const sentences = userAnswer.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length >= 2) {
      additionalScore += criterion.points * 0.1;
    }

    // Specificity bonus (mentions specific concepts)
    const conceptWords = ['concept', 'definition', 'example', 'application', 'importance', 'significance'];
    const hasSpecificity = conceptWords.some(word => answer.includes(word));
    if (hasSpecificity) {
      additionalScore += criterion.points * 0.1;
    }

    // Connection bonus (shows understanding of relationships)
    const connectionWords = ['relates', 'connects', 'links', 'associated', 'related', 'because', 'therefore'];
    const hasConnection = connectionWords.some(word => answer.includes(word));
    if (hasConnection) {
      additionalScore += criterion.points * 0.1;
    }

    // Cap the additional score
    additionalScore = Math.min(additionalScore, criterion.points * 0.3);

    const totalScore = Math.min(keywordScore + additionalScore, criterion.points);

    // Generate reasoning
    const reasoning = this.generateCriterionReasoning(criterion, foundKeywords, totalScore, userAnswer);

    return {
      criterion: criterion.criterion,
      awardedPoints: Math.round(totalScore * 10) / 10, // Round to 1 decimal
      maxPoints: criterion.points,
      reasoning: reasoning,
      keywords: foundKeywords
    };
  }

  generateCriterionReasoning(criterion, foundKeywords, score, userAnswer) {
    let reasoning = '';
    
    if (foundKeywords.length > 0) {
      reasoning += `Found ${foundKeywords.length} out of ${criterion.keywords.length} keywords: ${foundKeywords.join(', ')}. `;
    } else {
      reasoning += 'No keywords found. ';
    }

    if (userAnswer.length > 100) {
      reasoning += 'Answer shows good detail and depth. ';
    } else if (userAnswer.length < 30) {
      reasoning += 'Answer is quite brief. ';
    }

    const sentences = userAnswer.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length >= 2) {
      reasoning += 'Answer demonstrates good structure with multiple sentences. ';
    }

    if (score >= criterion.points * 0.8) {
      reasoning += 'Excellent understanding demonstrated.';
    } else if (score >= criterion.points * 0.6) {
      reasoning += 'Good understanding shown.';
    } else if (score >= criterion.points * 0.4) {
      reasoning += 'Basic understanding present.';
    } else {
      reasoning += 'Limited understanding demonstrated.';
    }

    return reasoning;
  }

  generateIntelligentFeedback(breakdown, userAnswer, question) {
    const totalScore = breakdown.reduce((sum, b) => sum + b.awardedPoints, 0);
    const maxScore = breakdown.reduce((sum, b) => sum + b.maxPoints, 0);
    const percentage = Math.round((totalScore / maxScore) * 100);

    let feedback = '';

    // Overall performance assessment
    if (percentage >= 90) {
      feedback += 'Excellent work! ';
    } else if (percentage >= 80) {
      feedback += 'Very good! ';
    } else if (percentage >= 70) {
      feedback += 'Good job! ';
    } else if (percentage >= 60) {
      feedback += 'Satisfactory. ';
    } else {
      feedback += 'Needs improvement. ';
    }

    // Specific feedback for each criterion
    for (const criterion of breakdown) {
      const criterionPercentage = Math.round((criterion.awardedPoints / criterion.maxPoints) * 100);
      
      if (criterionPercentage >= 80) {
        feedback += `${criterion.criterion}: Well done. `;
      } else if (criterionPercentage >= 60) {
        feedback += `${criterion.criterion}: Good effort. `;
      } else {
        feedback += `${criterion.criterion}: Could be stronger. `;
      }
    }

    // Suggestions for improvement
    if (percentage < 80) {
      feedback += 'Consider providing more specific examples and explaining the connections between concepts.';
    }

    return feedback.trim();
  }

  displayResults() {
    const results = this.quizResults;
    const percentage = Math.round((results.totalScore / results.maxScore) * 100);
    
    // Update score display
    document.getElementById('final-score').textContent = Math.round(results.totalScore);
    document.getElementById('max-score').textContent = Math.round(results.maxScore);
    
    // Calculate correct/incorrect counts
    let correctCount = 0;
    let incorrectCount = 0;
    
    results.scores.forEach(score => {
      if (score.totalScore >= score.maxScore * 0.5) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    });
    
    document.getElementById('correct-count').textContent = correctCount;
    document.getElementById('incorrect-count').textContent = incorrectCount;
    document.getElementById('percentage').textContent = `${percentage}%`;
    
    // Display detailed breakdown
    this.displayResultsBreakdown(results);
  }

  displayResultsBreakdown(results) {
    const container = document.getElementById('results-breakdown');
    container.innerHTML = '';
    
    results.scores.forEach((score, index) => {
      const question = results.quiz.questions[index];
      const userAnswer = results.answers[index] || 'No answer provided';
      
      const questionDiv = document.createElement('div');
      questionDiv.className = 'result-item';
      
      const isCorrect = score.totalScore >= score.maxScore * 0.5;
      const statusClass = isCorrect ? 'correct' : 'incorrect';
      
      questionDiv.innerHTML = `
        <div class="result-item__header">
          <h5>Question ${index + 1}</h5>
          <span class="result-score ${statusClass}">
            ${Math.round(score.totalScore)}/${Math.round(score.maxScore)}
          </span>
        </div>
        <div class="result-item__content">
          <p class="result-question">${question.prompt}</p>
          <p class="result-answer"><strong>Your answer:</strong> ${userAnswer}</p>
          <p class="result-feedback">${score.feedback}</p>
        </div>
      `;
      
      container.appendChild(questionDiv);
    });
  }

  saveQuizToHistory() {
    const historyItem = {
      id: Date.now(),
      topic: this.currentQuiz.topic,
      difficulty: this.currentQuiz.difficulty,
      questions: this.currentQuiz.questions.length,
      score: Math.round(this.quizResults.totalScore),
      maxScore: Math.round(this.quizResults.maxScore),
      percentage: Math.round((this.quizResults.totalScore / this.quizResults.maxScore) * 100),
      engine: this.currentQuiz.metadata.source,
      completedAt: new Date().toISOString(),
      results: this.quizResults
    };
    
    this.quizHistory.unshift(historyItem);
    
    // Keep only last 20 quizzes
    if (this.quizHistory.length > 20) {
      this.quizHistory = this.quizHistory.slice(0, 20);
    }
    
    this.saveQuizHistory();
    this.updateQuizHistory();
  }

  updateQuizHistory() {
    const container = document.getElementById('quiz-history-list');
    
    if (this.quizHistory.length === 0) {
      container.innerHTML = `
        <div class="quiz-history__empty">
          <p>No quizzes taken yet. Create your first quiz above!</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    this.quizHistory.forEach(item => {
      const historyDiv = document.createElement('div');
      historyDiv.className = 'quiz-history__item';
      
      const date = new Date(item.completedAt).toLocaleDateString();
      const time = new Date(item.completedAt).toLocaleTimeString();
      
      historyDiv.innerHTML = `
        <div class="history-item__header">
          <h4>${item.topic}</h4>
          <span class="history-date">${date} at ${time}</span>
        </div>
        <div class="history-item__content">
          <div class="history-stats">
            <span class="stat-item">
              <strong>${item.questions}</strong> questions
            </span>
            <span class="stat-item">
              <strong>${item.difficulty}</strong> difficulty
            </span>
            <span class="stat-item">
              <strong>${item.engine === 'device-llm' ? 'AI Boost' : 'Rules'}</strong> engine
            </span>
          </div>
          <div class="history-score">
            <span class="score-value">${item.score}/${item.maxScore}</span>
            <span class="score-percentage">${item.percentage}%</span>
          </div>
        </div>
      `;
      
      container.appendChild(historyDiv);
    });
  }

  retakeQuiz() {
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.quizResults = null;
    
    this.displayQuestion(0);
    this.updateProgress();
    this.showQuizDisplay();
  }

  createNewQuiz() {
    this.currentQuiz = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.quizResults = null;
    
    this.showQuizCreation();
    this.clearForm();
  }

  viewAnswers() {
    // Toggle detailed answer view
    const breakdown = document.getElementById('results-breakdown');
    breakdown.style.display = breakdown.style.display === 'none' ? 'block' : 'none';
  }

  showQuizCreation() {
    document.getElementById('quiz-creation').style.display = 'block';
    document.getElementById('quiz-display').style.display = 'none';
    document.getElementById('quiz-results').style.display = 'none';
  }

  showQuizDisplay() {
    document.getElementById('quiz-creation').style.display = 'none';
    document.getElementById('quiz-display').style.display = 'block';
    document.getElementById('quiz-results').style.display = 'none';
  }

  showQuizResults() {
    document.getElementById('quiz-creation').style.display = 'none';
    document.getElementById('quiz-display').style.display = 'none';
    document.getElementById('quiz-results').style.display = 'block';
  }

  clearForm() {
    document.getElementById('quiz-form').reset();
    document.getElementById('quiz-questions').value = '5';
    document.getElementById('quiz-difficulty').value = 'medium';
    document.getElementById('quiz-engine').value = 'auto';
  }

  setLoadingState(loading, message = 'Generating quiz...') {
    const button = document.getElementById('generate-quiz');
    const buttonText = button.querySelector('.button-text');
    const buttonSpinner = button.querySelector('.button-spinner');
    
    if (loading) {
      button.disabled = true;
      buttonText.textContent = message;
      buttonSpinner.style.display = 'inline';
    } else {
      button.disabled = false;
      buttonText.textContent = 'Generate Quiz';
      buttonSpinner.style.display = 'none';
    }
  }

  showError(message) {
    // Create or update error message
    let errorDiv = document.getElementById('quiz-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'quiz-error';
      errorDiv.className = 'quiz-error';
      document.getElementById('quiz-form').appendChild(errorDiv);
    }

    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    // Hide error after 5 seconds
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }

  showInfo(message) {
    // Create or update info message
    let infoDiv = document.getElementById('quiz-info');
    if (!infoDiv) {
      infoDiv = document.createElement('div');
      infoDiv.id = 'quiz-info';
      infoDiv.className = 'quiz-info';
      const quizDisplay = document.getElementById('quiz-display');
      if (quizDisplay) {
        quizDisplay.insertBefore(infoDiv, quizDisplay.firstChild);
      }
    }

    infoDiv.textContent = message;
    infoDiv.style.display = 'block';

    // Hide info after 8 seconds
    setTimeout(() => {
      infoDiv.style.display = 'none';
    }, 8000);
  }

  loadQuizHistory() {
    try {
      const stored = localStorage.getItem('studyhive_quiz_history');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load quiz history:', error);
      return [];
    }
  }

  saveQuizHistory() {
    try {
      localStorage.setItem('studyhive_quiz_history', JSON.stringify(this.quizHistory));
    } catch (error) {
      console.error('Failed to save quiz history:', error);
    }
  }
}

// Initialize quiz engine when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  window.quizEngine = new QuizEngine();

  // Auto-populate quiz form with note content if coming from Notes page
  const quizNotesTextarea = document.getElementById('quiz-notes');
  if (quizNotesTextarea) {
    const noteContent = sessionStorage.getItem('quizNoteContent');
    const noteTitle = sessionStorage.getItem('quizNoteTitle');

    if (noteContent) {
      quizNotesTextarea.value = noteContent;

      // Clear session storage after using it
      sessionStorage.removeItem('quizNoteContent');
      sessionStorage.removeItem('quizNoteTitle');

      // Show feedback to user
      if (noteTitle) {
        const feedback = document.createElement('div');
        feedback.className = 'quiz-form__feedback success';
        feedback.textContent = `Note "${noteTitle}" loaded successfully. Ready to generate quiz!`;
        feedback.style.cssText = 'margin-bottom: 1rem; padding: 0.75rem; border-radius: 8px; background: rgba(46, 204, 113, 0.2); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3);';
        quizNotesTextarea.parentElement.insertBefore(feedback, quizNotesTextarea);

        setTimeout(() => feedback.remove(), 4000);
      }

      // Scroll to the textarea
      quizNotesTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});
