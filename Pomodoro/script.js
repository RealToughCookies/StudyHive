(() => {
  const display = document.getElementById('timer-display');
  const startPauseBtn = document.getElementById('start-pause');
  const resetBtn = document.getElementById('reset');
  const modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
  const settingsForm = document.getElementById('settings-form');
  const themeToggle = document.getElementById('theme-toggle');
  const historyList = document.getElementById('session-history');
  const confettiCanvas = document.getElementById('confetti-canvas');
  const quizForm = document.getElementById('quiz-form');
  const quizTitleInput = document.getElementById('quiz-title');
  const quizNotesInput = document.getElementById('quiz-notes');
  const quizQuestionCountInput = document.getElementById('quiz-question-count');
  const quizFeedback = document.getElementById('quiz-feedback');
  const quizCurrentSection = document.getElementById('quiz-current');
  const quizCurrentTitle = document.getElementById('quiz-current-title');
  const quizCurrentMeta = document.getElementById('quiz-current-meta');
  const quizQuestionsList = document.getElementById('quiz-questions');
  const quizScore = document.getElementById('quiz-score');
  const checkAnswersBtn = document.getElementById('check-answers');
  const retakeQuizBtn = document.getElementById('retake-quiz');
  const savedQuizzesList = document.getElementById('saved-quizzes');
  const clearQuizzesBtn = document.getElementById('clear-quizzes');
  const quizGenerateBtn = document.getElementById('quiz-generate');
  const quizAiToggle = document.getElementById('quiz-ai-enabled');
  const quizAiConfig = document.getElementById('quiz-ai-config');
  const quizAiSettings = document.getElementById('quiz-ai-settings');
  const quizAiStatus = document.getElementById('quiz-ai-status');
  const quizAiNote = document.querySelector('.quiz__ai-note');
  const quizAiProviderSelect = document.getElementById('quiz-ai-provider');
  const quizAiEndpointInput = document.getElementById('quiz-ai-endpoint');
  const quizAiModelInput = document.getElementById('quiz-ai-model');
  const quizAiKeyInput = document.getElementById('quiz-ai-key');
  const quizAiTemperatureInput = document.getElementById('quiz-ai-temperature');
  const quizAiSaveBtn = document.getElementById('quiz-ai-save');
  const quizAiClearBtn = document.getElementById('quiz-ai-clear');
  const quizAiAzureFields = document.getElementById('quiz-ai-azure-fields');
  const quizAiAzureResourceInput = document.getElementById('quiz-ai-azure-resource');
  const quizAiAzureDeploymentInput = document.getElementById('quiz-ai-azure-deployment');
  const quizAiAzureVersionInput = document.getElementById('quiz-ai-azure-version');
  const noteForm = document.getElementById('note-form');
  const noteIdInput = document.getElementById('note-id');
  const noteTitleInput = document.getElementById('note-title');
  const noteCourseSelect = document.getElementById('note-course-select');
  const noteContentInput = document.getElementById('note-content');
  const noteFeedback = document.getElementById('note-feedback');
  const noteList = document.getElementById('note-list');
  const noteCancelBtn = document.getElementById('note-cancel');
  const cheatsheetForm = document.getElementById('cheatsheet-form');
  const cheatsheetIdInput = document.getElementById('cheatsheet-id');
  const cheatsheetTitleInput = document.getElementById('cheatsheet-title');
  const cheatsheetCourseSelect = document.getElementById('cheatsheet-course-select');
  const cheatsheetIncludeContext = document.getElementById('cheatsheet-include-context');
  const cheatsheetIncludeTopics = document.getElementById('cheatsheet-include-topics');
  const cheatsheetIncludeNotes = document.getElementById('cheatsheet-include-notes');
  const cheatsheetFeedback = document.getElementById('cheatsheet-feedback');
  const cheatsheetList = document.getElementById('cheatsheet-list');
  const cheatsheetCancelBtn = document.getElementById('cheatsheet-cancel');
  const workspaceTabs = document.getElementById('workspace-tabs');
  const tabButtons = workspaceTabs ? Array.from(workspaceTabs.querySelectorAll('.tab-button')) : [];
  const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
  const courseForm = document.getElementById('course-form');
  const courseIdInput = document.getElementById('course-id');
  const courseNameInput = document.getElementById('course-name');
  const courseCodeInput = document.getElementById('course-code');
  const courseInstructorInput = document.getElementById('course-instructor');
  const courseTermInput = document.getElementById('course-term');
  const courseContextInput = document.getElementById('course-context');
  const courseTopicsInput = document.getElementById('course-topics');
  const courseFeedback = document.getElementById('course-feedback');
  const courseList = document.getElementById('course-list');
  const courseCancelBtn = document.getElementById('course-cancel');
  const quizCourseSelect = document.getElementById('quiz-course-select');
  const gamesAvailability = document.getElementById('games-availability');
  const adventureStoryEl = document.getElementById('adventure-story');
  const adventureStatsEl = document.getElementById('adventure-stats');
  const adventureChoicesEl = document.getElementById('adventure-choices');
  const adventureLogEl = document.getElementById('adventure-log');
  const adventureRestartBtn = document.getElementById('adventure-restart');
  const adventureStatusEl = document.getElementById('adventure-status');

  const THEME_STORAGE_KEY = 'studyhive.theme';
  const storedThemePreference = getStoredTheme();
  const prefersDarkScheme = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const initialTheme = storedThemePreference || (prefersDarkScheme && prefersDarkScheme.matches ? 'dark' : 'light');
  applyTheme(initialTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      storeTheme(nextTheme);
    });
  }

  if (!storedThemePreference && prefersDarkScheme && typeof prefersDarkScheme.addEventListener === 'function') {
    prefersDarkScheme.addEventListener('change', (event) => {
      applyTheme(event.matches ? 'dark' : 'light');
    });
  }

  function applyTheme(theme) {
    const normalized = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', normalized);
    if (themeToggle) {
      const isDark = normalized === 'dark';
      themeToggle.setAttribute('aria-pressed', isDark.toString());
      themeToggle.textContent = isDark ? 'Light mode' : 'Dark mode';
    }
  }

  function storeTheme(theme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('Unable to store theme preference', error);
    }
  }

  function getStoredTheme() {
    try {
      const value = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (value === 'dark' || value === 'light') return value;
      return null;
    } catch (error) {
      console.warn('Unable to read theme preference', error);
      return null;
    }
  }

  const durations = {
    focus: 25 * 60,
    'short-break': 5 * 60,
    'long-break': 15 * 60,
  };
  const BREAK_MODES = new Set(['short-break', 'long-break']);
  const TIMER_STATE_KEY = 'pomodoro.timerState';
  const hasTimerUI = Boolean(display && startPauseBtn && resetBtn);

  let sessionsBeforeLongBreak = 4;
  let currentMode = 'focus';
  let remainingSeconds = durations[currentMode];
  let targetEndTime = null;
  let intervalId = null;
  let isRunning = false;
  let completedFocusSessions = 0;
  const sessionHistory = [];
  let gamesController = null;
  let passiveTimerSyncId = null;

  restoreTimerState({ passive: !hasTimerUI });
  if (!hasTimerUI) {
    startPassiveTimerSync();
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleWindowFocus, { passive: true });
  }

  class TimerAudio {
    constructor() {
      this.context = null;
      this.supported = typeof window.AudioContext === 'function' || typeof window.webkitAudioContext === 'function';
    }

    async ensureContext() {
      if (!this.supported) return null;
      if (!this.context) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.context = new Ctx();
      }
      if (this.context.state === 'suspended') {
        try {
          await this.context.resume();
        } catch (err) {
          console.warn('Unable to resume audio context', err);
        }
      }
      return this.context;
    }

    warmup() {
      return this.ensureContext();
    }

    async playSessionComplete() {
      const ctx = await this.ensureContext();
      if (!ctx) return;
      const notes = [660, 880, 1320];
      const now = ctx.currentTime;

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.2);
        gain.gain.setValueAtTime(0, now + index * 0.2);
        gain.gain.linearRampToValueAtTime(0.3, now + index * 0.2 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.2 + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + index * 0.2);
        osc.stop(now + index * 0.2 + 0.32);
      });
    }
  }

  class ConfettiBurst {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
      this.frameId = null;
      this.isRunning = false;
      this.startTime = null;
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.handleResize = this.handleResize.bind(this);
      this.step = this.step.bind(this);
      this.handleResize();
      window.addEventListener('resize', this.handleResize);
    }

    handleResize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    createParticles() {
      const colors = ['#ff6f61', '#ffd166', '#06d6a0', '#118ab2', '#ef476f'];
      const particleCount = Math.round(160 * (window.innerWidth / 1440));
      const count = Math.min(Math.max(particleCount, 80), 240);
      const { width, height } = this.canvas;

      return Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: -Math.random() * height * 0.2,
        tilt: Math.random() * 10,
        size: Math.random() * 8 + 4,
        velocityX: (Math.random() - 0.5) * 8,
        velocityY: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
    }

    burst() {
      if (this.prefersReducedMotion) return;
      this.particles = this.createParticles();
      this.startTime = null;
      if (!this.isRunning) {
        this.isRunning = true;
        this.frameId = requestAnimationFrame(this.step);
      }
    }

    step(timestamp) {
      if (!this.startTime) this.startTime = timestamp;
      const elapsed = timestamp - this.startTime;
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gravity = 0.35;
      const drag = 0.998;

      this.particles.forEach((p) => {
        p.velocityX *= drag;
        p.velocityY = p.velocityY * drag + gravity;
        p.x += p.velocityX;
        p.y += p.velocityY;
        p.rotation += p.rotationSpeed;

        if (p.y > canvas.height + 50) {
          p.y = -20;
          p.velocityY = Math.random() * 4 + 2;
        }
      });

      this.drawParticles();

      if (elapsed < 2800) {
        this.frameId = requestAnimationFrame(this.step);
      } else {
        this.stop();
      }
    }

    drawParticles() {
      const { ctx } = this;
      this.particles.forEach((p) => {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
        ctx.restore();
      });
    }

    stop() {
      this.isRunning = false;
      cancelAnimationFrame(this.frameId);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  const audio = new TimerAudio();
  const confetti = confettiCanvas ? new ConfettiBurst(confettiCanvas) : null;

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const paddedSeconds = seconds.toString().padStart(2, '0');
    return `${minutes}:${paddedSeconds}`;
  }

  function updateTimerDisplay() {
    if (!display) return;
    display.textContent = formatTime(remainingSeconds);
  }

  function setMode(mode) {
    stopTimer();
    currentMode = mode;
    remainingSeconds = durations[currentMode];
    updateTimerDisplay();
    updateModeButtons();
    updateGamesAvailability();
    persistTimerState();
  }

  function updateModeButtons() {
    if (!modeButtons || !modeButtons.length) return;
    modeButtons.forEach((btn) => {
      const isActive = btn.dataset.mode === currentMode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive.toString());
    });
  }

  function startTimerInterval() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (typeof targetEndTime !== 'number') return;
    intervalId = setInterval(() => {
      const secondsLeft = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000));
      remainingSeconds = secondsLeft;
      updateTimerDisplay();
      if (secondsLeft <= 0) {
        handleTimerComplete();
      }
    }, 250);
  }

  function stopTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isRunning = false;
    if (startPauseBtn) startPauseBtn.textContent = 'Start';
  }

  function startTimer() {
    if (isRunning) return;
    audio.warmup();
    isRunning = true;
    if (startPauseBtn) startPauseBtn.textContent = 'Pause';
    const now = Date.now();
    targetEndTime = now + remainingSeconds * 1000;
    startTimerInterval();
    updateGamesAvailability();
    persistTimerState();
  }

  function pauseTimer() {
    if (!isRunning) return;
    const secondsLeft = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000));
    remainingSeconds = secondsLeft;
    stopTimer();
    updateTimerDisplay();
    updateGamesAvailability();
    persistTimerState();
  }

  function resetTimer() {
    stopTimer();
    remainingSeconds = durations[currentMode];
    updateTimerDisplay();
    updateGamesAvailability();
    persistTimerState();
  }

  function getTimerStateSnapshot() {
    return {
      mode: currentMode,
      remainingSeconds,
      targetEndTime,
      isRunning,
      durations: {
        focus: durations.focus,
        'short-break': durations['short-break'],
        'long-break': durations['long-break'],
      },
      sessionsBeforeLongBreak,
      updatedAt: Date.now(),
    };
  }

  function persistTimerState() {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(getTimerStateSnapshot()));
    } catch (error) {
      console.warn('Unable to persist timer state', error);
    }
  }

  function readStoredTimerState() {
    try {
      if (!window.localStorage) return null;
      const raw = window.localStorage.getItem(TIMER_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (error) {
      console.warn('Unable to read timer state', error);
      return null;
    }
  }

  function restoreTimerState(options = {}) {
    const { passive = false } = options;
    const stored = readStoredTimerState();
    if (!stored) return;

    if (stored.durations && typeof stored.durations === 'object') {
      if (Number.isFinite(stored.durations.focus)) durations.focus = stored.durations.focus;
      if (Number.isFinite(stored.durations['short-break'])) durations['short-break'] = stored.durations['short-break'];
      if (Number.isFinite(stored.durations['long-break'])) durations['long-break'] = stored.durations['long-break'];
    }

    if (Number.isFinite(stored.sessionsBeforeLongBreak)) {
      sessionsBeforeLongBreak = Math.max(1, Math.round(stored.sessionsBeforeLongBreak));
    }

    if (typeof stored.mode === 'string' && typeof durations[stored.mode] === 'number') {
      currentMode = stored.mode;
    }

    let running = Boolean(stored.isRunning);
    let storedTargetEnd = typeof stored.targetEndTime === 'number' ? stored.targetEndTime : null;
    let secondsLeft = typeof stored.remainingSeconds === 'number' ? stored.remainingSeconds : durations[currentMode];

    if (running && storedTargetEnd) {
      secondsLeft = Math.max(0, Math.round((storedTargetEnd - Date.now()) / 1000));
      if (secondsLeft <= 0) {
        running = false;
        storedTargetEnd = null;
        secondsLeft = durations[currentMode];
      }
    }

    remainingSeconds = Math.max(0, secondsLeft);
    targetEndTime = storedTargetEnd;
    isRunning = running;

    if (!passive && hasTimerUI && isRunning && targetEndTime) {
      if (startPauseBtn) startPauseBtn.textContent = 'Pause';
      startTimerInterval();
    } else if (!isRunning) {
      stopTimer();
    }

    updateModeButtons();
    updateTimerDisplay();
  }

  function startPassiveTimerSync() {
    if (passiveTimerSyncId !== null) return;
    if (typeof window === 'undefined') return;
    passiveTimerSyncId = window.setInterval(() => {
      restoreTimerState({ passive: true });
      updateGamesAvailability();
    }, 1000);
  }

  function handleWindowFocus() {
    restoreTimerState({ passive: !hasTimerUI });
    updateGamesAvailability();
  }

  function handleTimerComplete() {
    stopTimer();
    remainingSeconds = 0;
    updateTimerDisplay();
    audio.playSessionComplete();
    if (confetti) confetti.burst();

    if (currentMode === 'focus') {
      completedFocusSessions += 1;
      sessionHistory.push({
        id: completedFocusSessions,
        completedAt: new Date(),
        duration: durations.focus,
      });
      renderHistory();
      const needLongBreak = completedFocusSessions % sessionsBeforeLongBreak === 0;
      const nextMode = needLongBreak ? 'long-break' : 'short-break';
      setMode(nextMode);
    } else {
      setMode('focus');
    }
  }

  function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';
    sessionHistory.slice().reverse().forEach((entry) => {
      const li = document.createElement('li');
      const time = entry.completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      li.innerHTML = `<strong>Session ${entry.id}</strong><span>${time}</span>`;
      historyList.appendChild(li);
    });
  }

  if (startPauseBtn) {
    startPauseBtn.addEventListener('click', () => {
      if (isRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', resetTimer);
  }

  if (modeButtons.length) {
    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.mode;
        if (mode === currentMode) return;
        setMode(mode);
      });
    });
  }

  if (settingsForm) {
    settingsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const focusInput = document.getElementById('focus-duration');
      const shortBreakInput = document.getElementById('short-break-duration');
      const longBreakInput = document.getElementById('long-break-duration');
      const sessionsBeforeLongBreakInput = document.getElementById('sessions-before-long-break');

      const focusMinutes = clamp(parseInt(focusInput.value, 10), focusInput.min, focusInput.max);
      const shortBreakMinutes = clamp(parseInt(shortBreakInput.value, 10), shortBreakInput.min, shortBreakInput.max);
      const longBreakMinutes = clamp(parseInt(longBreakInput.value, 10), longBreakInput.min, longBreakInput.max);
      const sessionsBeforeBreak = clamp(parseInt(sessionsBeforeLongBreakInput.value, 10), sessionsBeforeLongBreakInput.min, sessionsBeforeLongBreakInput.max);

      focusInput.value = focusMinutes;
      shortBreakInput.value = shortBreakMinutes;
      longBreakInput.value = longBreakMinutes;
      sessionsBeforeLongBreakInput.value = sessionsBeforeBreak;

      durations.focus = focusMinutes * 60;
      durations['short-break'] = shortBreakMinutes * 60;
      durations['long-break'] = longBreakMinutes * 60;
      sessionsBeforeLongBreak = sessionsBeforeBreak;

      remainingSeconds = durations[currentMode];
      updateTimerDisplay();
      persistTimerState();
    });
  }

  const STORAGE_KEYS = Object.freeze({
    quizzes: 'pomodoro.quizzes',
    aiConfig: 'pomodoro.aiConfig',
    courses: 'pomodoro.courses',
    notes: 'pomodoro.notes',
    cheatsheets: 'pomodoro.cheatsheets',
  });
  const STOPWORDS = new Set([
    'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'been', 'but', 'by', 'for', 'from', 'has',
    'have', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their', 'there', 'these', 'they',
    'this', 'to', 'was', 'were', 'with', 'your', 'you', 'we', 'our', 'can', 'will', 'should', 'could', 'may',
  ]);
  const FALLBACK_DISTRACTORS = ['analysis', 'approach', 'concept', 'principle', 'method', 'insight'];
  const MAX_OPTIONS = 4;
  const MIN_SENTENCE_WORDS = 4;
  const QUESTION_TYPES = Object.freeze({
    MULTIPLE_CHOICE: 'multiple-choice',
    SHORT_ANSWER: 'short-answer',
  });
  const AI_PROVIDERS = Object.freeze({
    OPENAI: 'openai',
    AZURE_OPENAI: 'azure-openai',
    CUSTOM: 'custom',
  });
  const PROVIDER_PRESETS = Object.freeze({
    [AI_PROVIDERS.OPENAI]: {
      label: 'OpenAI',
      endpointPlaceholder: 'https://api.openai.com/v1',
      modelPlaceholder: 'gpt-4o-mini',
      notes: 'Use an OpenAI API key with chat.completions access.',
    },
    [AI_PROVIDERS.AZURE_OPENAI]: {
      label: 'Azure OpenAI',
      endpointPlaceholder: 'https://your-resource.openai.azure.com',
      modelPlaceholder: 'gpt-4o-mini',
      notes: 'Provide your Azure resource name, deployment, and API version.',
    },
    [AI_PROVIDERS.CUSTOM]: {
      label: 'Custom',
      endpointPlaceholder: 'https://your-endpoint.example.com/v1',
      modelPlaceholder: 'model-id',
      notes: 'Endpoint must speak the OpenAI chat completions API.',
    },
  });

  class LLMQuizService {
    constructor(configManager, statusUpdater) {
      this.configManager = configManager;
      this.statusUpdater = statusUpdater;
    }

    shouldUseAI() {
      const config = this.configManager.get();
      return Boolean(config.enabled && this.isConfigured());
    }

    isConfigured() {
      return this.configManager.isConfigured();
    }

    async generateQuiz({ notes, desiredCount, requestedTitle }) {
      const config = this.configManager.get();
      if (!config.enabled) return null;
      if (!this.isConfigured()) {
        throw new Error('AI configuration incomplete.');
      }

      const clampedCount = Math.max(1, Math.min(Number(desiredCount) || 1, 20));
      const temperature = Number.isFinite(config.temperature) ? Math.min(Math.max(config.temperature, 0), 1) : 0.6;

      const maxChars = 6000;
      const trimmedNotes = notes.length > maxChars ? `${notes.slice(0, maxChars)}…` : notes;
      const truncatedNotice = notes.length > maxChars ? '\n\n(Note: content truncated for length.)' : '';
      const preferredTitle = requestedTitle ? `\nPreferred quiz title: ${requestedTitle}` : '';

      const systemPrompt = [
        'You are an expert learning coach who writes high-quality study quizzes.',
        'Generate a JSON object with a descriptive "title" and a "questions" array.',
        'Each question must include type ("multiple-choice" or "short-answer") and a clear prompt.',
        'Multiple-choice questions must include an "options" array plus the single correct answer and a brief explanation.',
        'Short-answer questions must include a "sample_answer" and a "rubric" with keywords, must_include terms, important phrases, synonyms, and minimum word count.',
        'Cover the most important ideas from the notes and avoid fabricating unknown details.',
        'Return JSON only—no markdown fences or commentary.'
      ].join(' ');

      const userPrompt = `Notes:\n${trimmedNotes}${truncatedNotice}\n\nRequested number of questions: ${clampedCount}.${preferredTitle}\nMix conceptual and recall prompts when appropriate.`;

      if (this.statusUpdater) this.statusUpdater('Contacting AI model…', 'loading');

      const baseBody = {
        model: config.model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      };

      const requestConfig = this.buildRequestConfig(config, baseBody);

      const response = await fetch(requestConfig.url, {
        method: 'POST',
        headers: requestConfig.headers,
        body: JSON.stringify(requestConfig.body),
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMessage = data && data.error && data.error.message || data && data.message || 'AI request failed';
        throw new Error(errorMessage);
      }

      const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      const parsed = safeJsonParse(content);
      if (!parsed) {
        throw new Error('AI returned invalid JSON.');
      }

      const quiz = this.transformQuizPayload(parsed, {
        desiredCount: clampedCount,
        requestedTitle,
      });

      if (!quiz.questions.length) {
        throw new Error('AI response did not contain any usable questions.');
      }

      if (this.statusUpdater) this.statusUpdater('AI quiz ready.', 'success');
      return quiz;
    }

    buildRequestConfig(config, baseBody) {
      const provider = config.provider || AI_PROVIDERS.OPENAI;
      const headers = { 'Content-Type': 'application/json' };
      let url = '';
      const body = { ...baseBody };

      if (provider === AI_PROVIDERS.AZURE_OPENAI) {
        const base = this.resolveAzureBase(config);
        const deployment = config.azureDeployment || config.model;
        if (!deployment) {
          throw new Error('Azure deployment name missing.');
        }
        const apiVersion = config.azureApiVersion || '2024-02-15';
        url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
        headers['api-key'] = config.apiKey;
        delete body.model;
      } else {
        const baseEndpoint = (config.endpoint || 'https://api.openai.com/v1').replace(/\/$/, '');
        url = baseEndpoint.endsWith('/chat/completions') ? baseEndpoint : `${baseEndpoint}/chat/completions`;
        headers.Authorization = `Bearer ${config.apiKey}`;
      }

      return { url, headers, body };
    }

    resolveAzureBase(config) {
      if (config.endpoint) {
        return config.endpoint.replace(/\/$/, '');
      }
      if (!config.azureResource) {
        throw new Error('Azure resource name missing.');
      }
      const resource = config.azureResource.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return `https://${resource}`;
    }

    transformQuizPayload(payload, context) {
      const desired = context.desiredCount || (Array.isArray(payload.questions) ? payload.questions.length : 0) || 1;
      const baseId = Date.now();
      const rawQuestions = Array.isArray(payload.questions)
        ? payload.questions
        : Array.isArray(payload.items)
          ? payload.items
          : [];
      const questions = [];
      rawQuestions.forEach((rawQuestion, index) => {
        const normalized = this.normalizeQuestion(rawQuestion, index, baseId);
        if (normalized) {
          questions.push(normalized);
        }
      });
      const limited = questions.slice(0, desired);
      return {
        title: String(payload.title || context.requestedTitle || 'AI Practice Quiz').trim(),
        questions: limited,
      };
    }

    normalizeQuestion(rawQuestion, index, baseId) {
      if (!rawQuestion) return null;
      const typeHint = String(rawQuestion.type || rawQuestion.question_type || rawQuestion.kind || '').toLowerCase();
      let type = null;
      if (typeHint.includes('choice') || Array.isArray(rawQuestion.options) || Array.isArray(rawQuestion.choices)) {
        type = QUESTION_TYPES.MULTIPLE_CHOICE;
      } else if (typeHint.includes('short') || typeHint.includes('free')) {
        type = QUESTION_TYPES.SHORT_ANSWER;
      }

      const prompt = String(rawQuestion.prompt || rawQuestion.question || rawQuestion.text || '').trim();
      if (!prompt) return null;

      if (!type) {
        type = Array.isArray(rawQuestion.options) || Array.isArray(rawQuestion.choices)
          ? QUESTION_TYPES.MULTIPLE_CHOICE
          : QUESTION_TYPES.SHORT_ANSWER;
      }

      if (type === QUESTION_TYPES.MULTIPLE_CHOICE) {
        const options = this.normalizeOptions(rawQuestion);
        if (!options.length) return null;

        const correct = this.resolveCorrectOption(rawQuestion, options);
        return {
          id: createQuestionId(baseId, index),
          type: QUESTION_TYPES.MULTIPLE_CHOICE,
          prompt,
          options,
          answer: correct.label,
          answerKey: correct.value,
          explanation: String(rawQuestion.explanation || rawQuestion.rationale || correct.explanation || '').trim(),
          sentence: rawQuestion.reference || rawQuestion.source || '',
          source: 'ai',
        };
      }

      const sampleAnswer = String(
        rawQuestion.sample_answer ||
          rawQuestion.sampleAnswer ||
          rawQuestion.answer ||
          rawQuestion.expected_answer ||
          rawQuestion.exemplar ||
          '',
      ).trim();

      const rubric = normalizeAiRubric({
        ...rawQuestion,
        sample_answer: sampleAnswer,
      });

      return {
        id: createQuestionId(baseId, index),
        type: QUESTION_TYPES.SHORT_ANSWER,
        prompt,
        hint: rawQuestion.hint || rawQuestion.reference || rawQuestion.context || '',
        answer: sampleAnswer,
        answerKey: ((rubric.keywords && rubric.keywords.length) ? rubric.keywords[0] : undefined) || rubric.sampleAnswer || sampleAnswer,
        explanation: rawQuestion.explanation || rubric.explanation || '',
        sentence: rawQuestion.reference || rawQuestion.source || '',
        aiRubric: rubric,
        answerKeyTokens: rubric.keywords,
        requiredTokens: rubric.requiredTokens,
        expectedTokens: rubric.expectedTokens,
        mustTokens: rubric.mustTokens,
        corePhrases: rubric.phrases,
        source: 'ai',
      };
    }

    normalizeOptions(rawQuestion) {
      const optionsRaw = ensureArray(rawQuestion.options || rawQuestion.choices || rawQuestion.answers);
      const normalized = [];
      optionsRaw.forEach((entry, idx) => {
        if (entry === null || entry === undefined) return;
        if (typeof entry === 'string') {
          const label = entry.trim();
          if (!label) return;
          normalized.push({
            value: `option-${idx}`,
            label,
          });
          return;
        }
        if (typeof entry === 'object') {
          const label = String(entry.label || entry.text || entry.answer || entry.option || '').trim();
          const value = String(entry.value || entry.id || entry.key || `option-${idx}`);
          if (!label && !value) return;
          normalized.push({
            value,
            label: label || value,
            explanation: entry.explanation || entry.rationale || '',
            isCorrect: Boolean(entry.correct || entry.isCorrect),
          });
        }
      });
      return normalized;
    }

    resolveCorrectOption(rawQuestion, options) {
      const expected = (rawQuestion.correct_answer !== undefined ? rawQuestion.correct_answer : (rawQuestion.answerKey !== undefined ? rawQuestion.answerKey : (rawQuestion.answer_key !== undefined ? rawQuestion.answer_key : (rawQuestion.correct !== undefined ? rawQuestion.correct : rawQuestion.answer))));
      if (expected !== undefined && expected !== null) {
        const expectedStr = String(expected).trim();
        const byValue = options.find((option) => option.value === expectedStr);
        if (byValue) return byValue;
        const byLabel = options.find((option) => option.label.toLowerCase() === expectedStr.toLowerCase());
        if (byLabel) return byLabel;
        if (/^\d+$/.test(expectedStr)) {
          const numeric = Number(expectedStr);
          if (Number.isInteger(numeric) && options[numeric]) return options[numeric];
        }
      }
      const flagged = options.find((option) => option.isCorrect);
      if (flagged) return flagged;
      return options[0];
    }
  }
  let courses = loadCourses();
  let notes = loadNotes();
  let cheatSheets = loadCheatSheets();
  let quizzes = loadQuizzes();
  let activeQuiz = null;
  let quizGenerationActive = false;

  const aiConfigManager = createAIConfigManager();
  const aiService = new LLMQuizService(aiConfigManager, updateAiStatus);

  renderCourses();
  renderNotes();
  renderCheatSheets();
  refreshCourseSelect();
  setCourseFeedback('Ready to add a new course.', 'default');
  setNoteFeedback('Ready to add a new note.', 'default');
  setCheatsheetFeedback('Select a course to build a cheat sheet.', 'default');
  renderSavedQuizzes();
  if (quizzes.length > 0) {
    setActiveQuiz(quizzes[0], { silent: true });
  }

  setupAiControls();

  if (courseForm) {
    courseForm.addEventListener('submit', handleCourseSubmit);
    courseForm.addEventListener('reset', () => {
      window.setTimeout(() => {
        clearCourseForm(true);
        setCourseFeedback('Ready to add a new course.', 'default');
        if (courseNameInput) courseNameInput.focus();
      }, 0);
    });
  }
  if (courseCancelBtn) {
    courseCancelBtn.addEventListener('click', () => {
      clearCourseForm(true);
      setCourseFeedback('Course editing cancelled.', 'default');
    });
  }
  if (courseList) {
    courseList.addEventListener('click', handleCourseListClick);
  }

  if (noteForm) {
    noteForm.addEventListener('submit', handleNoteSubmit);
    noteForm.addEventListener('reset', () => {
      window.setTimeout(() => {
        clearNoteForm(true);
        setNoteFeedback('Ready to add a new note.', 'default');
      }, 0);
    });
  }
  if (noteCancelBtn) {
    noteCancelBtn.addEventListener('click', () => {
      clearNoteForm(true);
      setNoteFeedback('Note editing cancelled.', 'default');
    });
  }
  if (noteList) {
    noteList.addEventListener('click', handleNoteListClick);
  }

  if (cheatsheetForm) {
    cheatsheetForm.addEventListener('submit', handleCheatsheetSubmit);
  }
  if (cheatsheetCancelBtn) {
    cheatsheetCancelBtn.addEventListener('click', () => {
      clearCheatsheetForm();
      setCheatsheetFeedback('Cheat sheet editing cancelled.', 'default');
    });
  }
  if (cheatsheetList) {
    cheatsheetList.addEventListener('click', handleCheatsheetListClick);
  }

  initializeTabs();
  initializeBreakGames();

  if (quizForm) {
    quizForm.addEventListener('submit', handleQuizSubmit);
  }
  if (quizQuestionsList) {
    quizQuestionsList.addEventListener('change', handleQuizInteraction);
    quizQuestionsList.addEventListener('input', handleQuizInteraction);
  }
  if (checkAnswersBtn) {
    checkAnswersBtn.addEventListener('click', handleCheckAnswers);
  }
  if (retakeQuizBtn) {
    retakeQuizBtn.addEventListener('click', () => resetActiveQuizSelections());
  }
  if (savedQuizzesList) {
    savedQuizzesList.addEventListener('click', handleSavedQuizClick);
  }
  if (clearQuizzesBtn) {
    clearQuizzesBtn.addEventListener('click', handleClearQuizzes);
  }


  function handleCourseSubmit(event) {
    event.preventDefault();
    if (!courseNameInput) return;

    const name = courseNameInput.value ? courseNameInput.value.trim() : '';
    if (!name) {
      setCourseFeedback('Course name is required.', 'error');
      if (courseNameInput) courseNameInput.focus();
      return;
    }

    const now = new Date().toISOString();
    const id = courseIdInput && courseIdInput.value ? courseIdInput.value : '';
    const coursePayload = {
      name,
      code: courseCodeInput && courseCodeInput.value ? courseCodeInput.value.trim() : '',
      instructor: courseInstructorInput && courseInstructorInput.value ? courseInstructorInput.value.trim() : '',
      term: courseTermInput && courseTermInput.value ? courseTermInput.value.trim() : '',
      context: courseContextInput && courseContextInput.value ? courseContextInput.value.trim() : '',
      topics: parseCourseTopicsInput(courseTopicsInput && courseTopicsInput.value ? courseTopicsInput.value : ''),
      updatedAt: now,
    };

    let savedCourseId = id;
    if (id) {
      const index = courses.findIndex((course) => course.id === id);
      if (index === -1) {
        setCourseFeedback('Unable to update course. Please try again.', 'error');
        clearCourseForm();
        return;
      }
      const existing = courses[index];
      courses[index] = { ...existing, ...coursePayload };
      setCourseFeedback(`Updated ${name}.`, 'success');
    } else {
      const newCourse = {
        id: createCourseId(),
        ...coursePayload,
        createdAt: now,
      };
      courses = [newCourse, ...courses];
      setCourseFeedback(`Saved ${name}.`, 'success');
      savedCourseId = newCourse.id;
    }

    persistCourses();
    renderCourses();
    renderNotes();
    renderCheatSheets();
    refreshCourseSelect();
    if (quizCourseSelect && savedCourseId && courses.some((course) => course.id === savedCourseId)) {
      quizCourseSelect.value = savedCourseId;
    }
    clearCourseForm(true);
    if (courseNameInput) courseNameInput.focus();
  }

  function handleCourseListClick(event) {
    const button = event.target.closest('button');
    if (!button || !button.dataset.action) return;
    const courseId = button.dataset.courseId;
    if (!courseId) return;
    const action = button.dataset.action;
    if (action === 'edit') {
      const course = getCourseById(courseId);
      if (!course) {
        setCourseFeedback('Course not found.', 'error');
        return;
      }
      populateCourseForm(course);
      setCourseFeedback(`Editing ${course.name}.`, 'default');
    } else if (action === 'delete') {
      const course = getCourseById(courseId);
      const courseName = course ? course.name : 'this course';
      const confirmed = window.confirm(`Remove ${courseName}? Quizzes linked to this course will stay saved but lose their association.`);
      if (!confirmed) return;
      courses = courses.filter((item) => item.id !== courseId);
      persistCourses();
      let quizzesChanged = false;
      quizzes = quizzes.map((quiz) => {
        if (quiz.courseId && quiz.courseId === courseId) {
          quizzesChanged = true;
          return { ...quiz, courseId: null };
        }
        return quiz;
      });
      if (quizzesChanged) {
        persistQuizzes();
      }
      let notesChanged = false;
      notes = notes.map((note) => {
        if (note.courseId && note.courseId === courseId) {
          notesChanged = true;
          return { ...note, courseId: null };
        }
        return note;
      });
      if (notesChanged) {
        persistNotes();
      }
      let sheetsChanged = false;
      cheatSheets = cheatSheets.map((sheet) => {
        if (sheet.courseId && sheet.courseId === courseId) {
          sheetsChanged = true;
          return { ...sheet, courseId: null };
        }
        return sheet;
      });
      if (sheetsChanged) {
        persistCheatSheets();
      }
      renderCourses();
      renderNotes();
      renderCheatSheets();
      refreshCourseSelect();
      renderSavedQuizzes();
      if (activeQuiz && activeQuiz.courseId === courseId) {
        setActiveQuiz({ ...activeQuiz, courseId: null }, { silent: true });
      }
      setCourseFeedback(`${courseName} removed.`, 'success');
      clearCourseForm(false);
    } else if (action === 'select') {
      const course = getCourseById(courseId);
      if (quizCourseSelect) {
        quizCourseSelect.value = courseId;
      }
      if (quizForm) {
        quizForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (quizNotesInput) {
        quizNotesInput.focus();
      }
      const name = course ? course.name : 'course';
      setCourseFeedback(`${name} selected for the next quiz.`, 'success');
    }
  }

  function populateCourseForm(course) {
    if (!courseForm) return;
    if (courseIdInput) courseIdInput.value = course.id;
    if (courseNameInput) courseNameInput.value = course.name || '';
    if (courseCodeInput) courseCodeInput.value = course.code || '';
    if (courseInstructorInput) courseInstructorInput.value = course.instructor || '';
    if (courseTermInput) courseTermInput.value = course.term || '';
    if (courseContextInput) courseContextInput.value = course.context || '';
    if (courseTopicsInput) courseTopicsInput.value = (course.topics || []).join('\n');
    if (courseCancelBtn) courseCancelBtn.hidden = false;
    courseNameInput.focus();
  }

  function clearCourseForm(fromReset = false) {
    if (!fromReset && courseForm) {
      courseForm.reset();
    }
    if (courseIdInput) courseIdInput.value = '';
    if (courseNameInput) courseNameInput.value = '';
    if (courseCodeInput) courseCodeInput.value = '';
    if (courseInstructorInput) courseInstructorInput.value = '';
    if (courseTermInput) courseTermInput.value = '';
    if (courseContextInput) courseContextInput.value = '';
    if (courseTopicsInput) courseTopicsInput.value = '';
    if (courseCancelBtn) courseCancelBtn.hidden = true;
  }

  function parseCourseTopicsInput(raw) {
    return raw
      .split(/\r?\n/)
      .map((topic) => topic.trim())
      .filter((topic) => topic.length > 0);
  }

  function renderCourses() {
    if (!courseList) return;
    courseList.innerHTML = '';
    if (!courses.length) {
      const empty = document.createElement('p');
      empty.className = 'course-list__empty';
      empty.textContent = 'No courses yet. Add your classes to keep quizzes organized.';
      courseList.appendChild(empty);
      return;
    }

    const sorted = courses.slice().sort((a, b) => a.name.localeCompare(b.name));
    sorted.forEach((course) => {
      const quizCount = getQuizCountForCourse(course.id);
      const card = document.createElement('article');
      card.className = 'course-card';
      card.dataset.courseId = course.id;

      const header = document.createElement('div');
      header.className = 'course-card__header';

      const title = document.createElement('h3');
      title.textContent = course.name;
      header.appendChild(title);

      const metaParts = [];
      if (course.code) metaParts.push(course.code);
      if (course.instructor) metaParts.push(course.instructor);
      if (course.term) metaParts.push(course.term);
      if (metaParts.length) {
        const meta = document.createElement('p');
        meta.className = 'course-card__meta';
        meta.textContent = metaParts.join(' • ');
        header.appendChild(meta);
      }

      card.appendChild(header);

      if (course.context) {
        const context = document.createElement('p');
        context.className = 'course-card__context';
        context.textContent = course.context;
        card.appendChild(context);
      }

      if (course.topics && course.topics.length) {
        const topicsWrapper = document.createElement('div');
        topicsWrapper.className = 'course-card__topics';
        course.topics.forEach((topic) => {
          const chip = document.createElement('span');
          chip.textContent = topic;
          topicsWrapper.appendChild(chip);
        });
        card.appendChild(topicsWrapper);
      }

      const noteCount = getNoteCountForCourse(course.id);
      const cheatCount = getCheatsheetCountForCourse(course.id);
      const statsWrapper = document.createElement('div');
      statsWrapper.className = 'course-card__stats';

      const quizStat = document.createElement('div');
      quizStat.className = 'course-card__stat';
      quizStat.innerHTML = `<strong>${quizCount}</strong> quiz${quizCount === 1 ? '' : 'zes'} linked`;
      statsWrapper.appendChild(quizStat);

      const noteStat = document.createElement('div');
      noteStat.className = 'course-card__stat';
      noteStat.innerHTML = `<strong>${noteCount}</strong> note${noteCount === 1 ? '' : 's'}`;
      statsWrapper.appendChild(noteStat);

      const cheatStat = document.createElement('div');
      cheatStat.className = 'course-card__stat';
      cheatStat.innerHTML = `<strong>${cheatCount}</strong> cheat sheet${cheatCount === 1 ? '' : 's'}`;
      statsWrapper.appendChild(cheatStat);

      if (course.updatedAt) {
        const updated = document.createElement('div');
        updated.className = 'course-card__stat';
        updated.textContent = `Last updated • ${formatTimestamp(course.updatedAt)}`;
        statsWrapper.appendChild(updated);
      }

      card.appendChild(statsWrapper);

      const actions = document.createElement('div');
      actions.className = 'course-card__actions';

      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'secondary small';
      useBtn.dataset.action = 'select';
      useBtn.dataset.courseId = course.id;
      useBtn.textContent = 'Use in quiz';
      actions.appendChild(useBtn);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'secondary small';
      editBtn.dataset.action = 'edit';
      editBtn.dataset.courseId = course.id;
      editBtn.textContent = 'Edit';
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'small';
      deleteBtn.dataset.action = 'delete';
      deleteBtn.dataset.courseId = course.id;
      deleteBtn.textContent = 'Delete';
      actions.appendChild(deleteBtn);

      card.appendChild(actions);
      courseList.appendChild(card);
    });
  }

  function refreshCourseSelect() {
    const selects = [];
    if (quizCourseSelect) {
      selects.push({ element: quizCourseSelect, defaultLabel: 'No course selected' });
    }
    if (noteCourseSelect) {
      selects.push({ element: noteCourseSelect, defaultLabel: 'Select course…' });
    }
    if (cheatsheetCourseSelect) {
      selects.push({ element: cheatsheetCourseSelect, defaultLabel: 'Select course…' });
    }

    if (!selects.length) return;

    const sorted = courses.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

    selects.forEach(function (entry) {
      const selectEl = entry.element;
      const previous = selectEl.value;
      while (selectEl.firstChild) {
        selectEl.removeChild(selectEl.firstChild);
      }
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = entry.defaultLabel;
      selectEl.appendChild(defaultOption);

      sorted.forEach(function (course) {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = course.code ? `${course.name} (${course.code})` : course.name;
        selectEl.appendChild(option);
      });

      if (previous && courses.some(function (course) { return course.id === previous; })) {
        selectEl.value = previous;
      } else if (selectEl !== noteCourseSelect && selectEl !== cheatsheetCourseSelect) {
        selectEl.value = '';
      } else if (selectEl.value !== previous) {
        selectEl.value = '';
      }
    });
  }

  function setCourseFeedback(message, tone = 'default') {
    if (!courseFeedback) return;
    courseFeedback.textContent = message;
    courseFeedback.classList.remove('course-feedback--success', 'course-feedback--error');
    if (tone === 'success') {
      courseFeedback.classList.add('course-feedback--success');
    } else if (tone === 'error') {
      courseFeedback.classList.add('course-feedback--error');
    }
  }

  function loadCourses() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.courses);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((course) => course && course.id && course.name)
        .map((course) => {
          const copy = { ...course };
          copy.name = typeof copy.name === 'string' ? copy.name : '';
          copy.code = typeof copy.code === 'string' ? copy.code : '';
          copy.instructor = typeof copy.instructor === 'string' ? copy.instructor : '';
          copy.term = typeof copy.term === 'string' ? copy.term : '';
          copy.context = typeof copy.context === 'string' ? copy.context : '';
          if (!Array.isArray(copy.topics)) {
            const rawTopics = typeof copy.topics === 'string' ? copy.topics : '';
            copy.topics = parseCourseTopicsInput(rawTopics);
          } else {
            copy.topics = copy.topics.map((topic) => (typeof topic === 'string' ? topic.trim() : '')).filter((topic) => topic.length > 0);
          }
          return copy;
        });
    } catch (error) {
      console.warn('Unable to load courses', error);
      return [];
    }
  }

  function persistCourses() {
    try {
      window.localStorage.setItem(STORAGE_KEYS.courses, JSON.stringify(courses));
    } catch (error) {
      console.warn('Unable to persist courses', error);
    }
  }

  function createCourseId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `course-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function getCourseById(courseId) {
    if (!courseId) return null;
    return courses.find((course) => course.id === courseId) || null;
  }

  function getQuizCountForCourse(courseId) {
    if (!courseId) return 0;
    let count = 0;
    quizzes.forEach((quiz) => {
      if (quiz.courseId && quiz.courseId === courseId) {
        count += 1;
      }
    });
    return count;
  }

  function getCourseName(courseId) {
    const course = getCourseById(courseId);
    return course ? course.name : '';
  }

  function getNotesForCourse(courseId) {
    if (!courseId) return [];
    return notes.filter((note) => note.courseId === courseId);
  }

  function getNoteCountForCourse(courseId) {
    if (!courseId) return 0;
    let count = 0;
    notes.forEach((note) => {
      if (note.courseId && note.courseId === courseId) {
        count += 1;
      }
    });
    return count;
  }

  function getCheatsheetCountForCourse(courseId) {
    if (!courseId) return 0;
    let count = 0;
    cheatSheets.forEach((sheet) => {
      if (sheet.courseId && sheet.courseId === courseId) {
        count += 1;
      }
    });
    return count;
  }

  function handleNoteSubmit(event) {
    event.preventDefault();
    if (!noteTitleInput || !noteCourseSelect || !noteContentInput) return;

    const title = noteTitleInput.value ? noteTitleInput.value.trim() : '';
    const courseId = noteCourseSelect.value ? noteCourseSelect.value.trim() : '';
    const content = noteContentInput.value ? noteContentInput.value.trim() : '';

    if (!title) {
      setNoteFeedback('Note title is required.', 'error');
      noteTitleInput.focus();
      return;
    }
    if (!courseId) {
      setNoteFeedback('Select a course for this note.', 'error');
      noteCourseSelect.focus();
      return;
    }
    if (!content) {
      setNoteFeedback('Add some content to your note.', 'error');
      noteContentInput.focus();
      return;
    }

    const now = new Date().toISOString();
    const existingId = noteIdInput && noteIdInput.value ? noteIdInput.value : '';
    if (existingId) {
      const index = notes.findIndex((note) => note.id === existingId);
      if (index === -1) {
        setNoteFeedback('Unable to update note. Please try again.', 'error');
        clearNoteForm(false);
        return;
      }
      notes[index] = {
        ...notes[index],
        title,
        courseId,
        content,
        updatedAt: now,
      };
      setNoteFeedback(`Updated ${title}.`, 'success');
    } else {
      const newNote = {
        id: createNoteId(),
        title,
        courseId,
        content,
        createdAt: now,
        updatedAt: now,
      };
      notes = [newNote, ...notes];
      setNoteFeedback(`Saved ${title}.`, 'success');
    }

    persistNotes();
    renderNotes();
    renderCourses();
    refreshCourseSelect();
    clearNoteForm(true, courseId);
    if (noteTitleInput) noteTitleInput.focus();
  }

  function handleNoteListClick(event) {
    const button = event.target.closest('button');
    if (!button || !button.dataset.action) return;
    const noteId = button.dataset.noteId;
    if (!noteId) return;
    const action = button.dataset.action;
    if (action === 'edit') {
      const note = getNoteById(noteId);
      if (!note) {
        setNoteFeedback('Note not found.', 'error');
        return;
      }
      populateNoteForm(note);
      setNoteFeedback(`Editing ${note.title}.`, 'default');
    } else if (action === 'delete') {
      const note = getNoteById(noteId);
      const title = note ? note.title : 'this note';
      const confirmed = window.confirm(`Delete ${title}? This cannot be undone.`);
      if (!confirmed) return;
      notes = notes.filter((item) => item.id !== noteId);
      persistNotes();
      renderNotes();
      renderCourses();
      refreshCourseSelect();
      setNoteFeedback(`${title} removed.`, 'success');
      clearNoteForm(false);
    } else if (action === 'copy') {
      const note = getNoteById(noteId);
      if (!note) return;
      const success = copyTextToClipboard(note.content);
      setNoteFeedback(success ? `Copied ${note.title} to clipboard.` : 'Unable to copy note automatically.', success ? 'success' : 'error');
    } else if (action === 'cheatsheet') {
      const note = getNoteById(noteId);
      if (!note) return;
      if (cheatsheetCourseSelect) {
        cheatsheetCourseSelect.value = note.courseId || '';
      }
      if (cheatsheetForm) {
        cheatsheetForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (cheatsheetTitleInput && !cheatsheetTitleInput.value) {
        cheatsheetTitleInput.value = `${note.title} cheat sheet`;
      }
      setCheatsheetFeedback('Course selected for cheat sheet generation.', 'default');
    }
  }

  function populateNoteForm(note) {
    if (!noteForm) return;
    if (noteIdInput) noteIdInput.value = note.id;
    if (noteTitleInput) noteTitleInput.value = note.title || '';
    if (noteCourseSelect) noteCourseSelect.value = note.courseId || '';
    if (noteContentInput) noteContentInput.value = note.content || '';
    if (noteCancelBtn) noteCancelBtn.hidden = false;
    noteTitleInput.focus();
  }

  function clearNoteForm(preserveCourse, courseId) {
    const previousCourse = noteCourseSelect ? noteCourseSelect.value : '';
    if (noteForm) {
      noteForm.reset();
    }
    if (noteIdInput) noteIdInput.value = '';
    if (noteCancelBtn) noteCancelBtn.hidden = true;
    if (noteCourseSelect) {
      if (preserveCourse) {
        const targetCourse = courseId || previousCourse;
        if (targetCourse && courses.some((course) => course.id === targetCourse)) {
          noteCourseSelect.value = targetCourse;
        }
      }
    }
  }

  function setNoteFeedback(message, tone) {
    if (!noteFeedback) return;
    noteFeedback.textContent = message;
    noteFeedback.classList.remove('note-feedback--success', 'note-feedback--error');
    if (tone === 'success') {
      noteFeedback.classList.add('note-feedback--success');
    } else if (tone === 'error') {
      noteFeedback.classList.add('note-feedback--error');
    }
  }

  function renderNotes() {
    if (!noteList) return;
    noteList.innerHTML = '';
    if (!notes.length) {
      const empty = document.createElement('p');
      empty.className = 'note-list__empty';
      empty.textContent = 'No notes yet. Add your first set of notes above.';
      noteList.appendChild(empty);
      return;
    }

    const sorted = notes.slice().sort((a, b) => {
      const aTime = a.updatedAt || a.createdAt || '';
      const bTime = b.updatedAt || b.createdAt || '';
      return bTime.localeCompare(aTime);
    });

    sorted.forEach((note) => {
      const card = document.createElement('article');
      card.className = 'note-card';
      card.dataset.noteId = note.id;

      const header = document.createElement('div');
      header.className = 'note-card__header';

      const title = document.createElement('h3');
      title.textContent = note.title;
      header.appendChild(title);

      const courseName = note.courseId ? getCourseName(note.courseId) || 'Unassigned' : 'Unassigned';
      const meta = document.createElement('p');
      meta.className = 'note-card__meta';
      const timestamp = formatTimestamp(note.updatedAt || note.createdAt);
      const metaParts = [`Course: ${courseName}`];
      if (timestamp) metaParts.push(`Updated • ${timestamp}`);
      meta.textContent = metaParts.join(' • ');
      header.appendChild(meta);

      card.appendChild(header);

      const content = document.createElement('p');
      content.className = 'note-card__content';
      content.textContent = note.content;
      card.appendChild(content);

      const actions = document.createElement('div');
      actions.className = 'note-card__actions';

      const cheatBtn = document.createElement('button');
      cheatBtn.type = 'button';
      cheatBtn.className = 'secondary small';
      cheatBtn.dataset.action = 'cheatsheet';
      cheatBtn.dataset.noteId = note.id;
      cheatBtn.textContent = 'Use in cheat sheet';
      actions.appendChild(cheatBtn);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'secondary small';
      editBtn.dataset.action = 'edit';
      editBtn.dataset.noteId = note.id;
      editBtn.textContent = 'Edit';
      actions.appendChild(editBtn);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'secondary small';
      copyBtn.dataset.action = 'copy';
      copyBtn.dataset.noteId = note.id;
      copyBtn.textContent = 'Copy';
      actions.appendChild(copyBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'small';
      deleteBtn.dataset.action = 'delete';
      deleteBtn.dataset.noteId = note.id;
      deleteBtn.textContent = 'Delete';
      actions.appendChild(deleteBtn);

      card.appendChild(actions);
      noteList.appendChild(card);
    });
  }

  function handleCheatsheetSubmit(event) {
    event.preventDefault();
    if (!cheatsheetCourseSelect) return;
    const courseId = cheatsheetCourseSelect.value ? cheatsheetCourseSelect.value.trim() : '';
    if (!courseId) {
      setCheatsheetFeedback('Select a course to generate a cheat sheet.', 'error');
      cheatsheetCourseSelect.focus();
      return;
    }
    const course = getCourseById(courseId);
    if (!course) {
      setCheatsheetFeedback('Course not found. Please refresh and try again.', 'error');
      return;
    }

    const includeContext = !cheatsheetIncludeContext || cheatsheetIncludeContext.checked;
    const includeTopics = !cheatsheetIncludeTopics || cheatsheetIncludeTopics.checked;
    const includeNotes = !cheatsheetIncludeNotes || cheatsheetIncludeNotes.checked;

    if (!includeContext && !includeTopics && !includeNotes) {
      setCheatsheetFeedback('Select at least one data source (context, topics, or notes).', 'error');
      return;
    }

    const relatedNotes = includeNotes ? getNotesForCourse(courseId) : [];
    const content = buildCheatSheetContent(course, relatedNotes, {
      includeContext,
      includeTopics,
      includeNotes,
    });

    if (!content.trim()) {
      setCheatsheetFeedback('Nothing to include yet. Add course context, topics, or notes first.', 'error');
      return;
    }

    const titleInput = cheatsheetTitleInput && cheatsheetTitleInput.value ? cheatsheetTitleInput.value.trim() : '';
    const sheetTitle = titleInput || `${course.name} Cheat Sheet`;
    const now = new Date().toISOString();
    const existingId = cheatsheetIdInput && cheatsheetIdInput.value ? cheatsheetIdInput.value : '';

    if (existingId) {
      const index = cheatSheets.findIndex((sheet) => sheet.id === existingId);
      if (index === -1) {
        setCheatsheetFeedback('Unable to update cheat sheet. Please try again.', 'error');
        clearCheatsheetForm();
        return;
      }
      cheatSheets[index] = {
        ...cheatSheets[index],
        title: sheetTitle,
        courseId,
        content,
        includeContext,
        includeTopics,
        includeNotes,
        updatedAt: now,
      };
      setCheatsheetFeedback(`Updated ${sheetTitle}.`, 'success');
    } else {
      const newSheet = {
        id: createCheatsheetId(),
        title: sheetTitle,
        courseId,
        content,
        includeContext,
        includeTopics,
        includeNotes,
        createdAt: now,
        updatedAt: now,
      };
      cheatSheets = [newSheet, ...cheatSheets];
      setCheatsheetFeedback(`Saved ${sheetTitle}.`, 'success');
    }

    persistCheatSheets();
    renderCheatSheets();
    renderCourses();
    refreshCourseSelect();
    clearCheatsheetForm(true, courseId);
  }

  function handleCheatsheetListClick(event) {
    const button = event.target.closest('button');
    if (!button || !button.dataset.action) return;
    const sheetId = button.dataset.sheetId;
    if (!sheetId) return;
    const action = button.dataset.action;
    if (action === 'copy') {
      const sheet = getCheatsheetById(sheetId);
      if (!sheet) return;
      const success = copyTextToClipboard(sheet.content);
      setCheatsheetFeedback(success ? `Copied ${sheet.title} to clipboard.` : 'Unable to copy cheat sheet automatically.', success ? 'success' : 'error');
    } else if (action === 'download') {
      const sheet = getCheatsheetById(sheetId);
      if (!sheet) return;
      const filename = `${sheet.title.replace(/[^a-z0-9\-]+/gi, '_') || 'cheatsheet'}.txt`;
      downloadTextFile(filename, sheet.content);
      setCheatsheetFeedback(`Downloaded ${sheet.title}.`, 'success');
    } else if (action === 'edit') {
      const sheet = getCheatsheetById(sheetId);
      if (!sheet) {
        setCheatsheetFeedback('Cheat sheet not found.', 'error');
        return;
      }
      populateCheatsheetForm(sheet);
      setCheatsheetFeedback(`Editing ${sheet.title}. Adjust options and regenerate to update.`, 'default');
    } else if (action === 'delete') {
      const sheet = getCheatsheetById(sheetId);
      const title = sheet ? sheet.title : 'this cheat sheet';
      const confirmed = window.confirm(`Delete ${title}? This cannot be undone.`);
      if (!confirmed) return;
      cheatSheets = cheatSheets.filter((item) => item.id !== sheetId);
      persistCheatSheets();
      renderCheatSheets();
      renderCourses();
      refreshCourseSelect();
      setCheatsheetFeedback(`${title} removed.`, 'success');
      clearCheatsheetForm();
    }
  }

  function populateCheatsheetForm(sheet) {
    if (cheatsheetIdInput) cheatsheetIdInput.value = sheet.id;
    if (cheatsheetTitleInput) cheatsheetTitleInput.value = sheet.title || '';
    if (cheatsheetCourseSelect) cheatsheetCourseSelect.value = sheet.courseId || '';
    if (cheatsheetIncludeContext) cheatsheetIncludeContext.checked = sheet.includeContext !== false;
    if (cheatsheetIncludeTopics) cheatsheetIncludeTopics.checked = sheet.includeTopics !== false;
    if (cheatsheetIncludeNotes) cheatsheetIncludeNotes.checked = sheet.includeNotes !== false;
    if (cheatsheetCancelBtn) cheatsheetCancelBtn.hidden = false;
    if (cheatsheetTitleInput) cheatsheetTitleInput.focus();
  }

  function clearCheatsheetForm(preserveCourse, courseId) {
    const previousCourse = cheatsheetCourseSelect ? cheatsheetCourseSelect.value : '';
    if (cheatsheetForm) {
      cheatsheetForm.reset();
    }
    if (cheatsheetIdInput) cheatsheetIdInput.value = '';
    if (cheatsheetCancelBtn) cheatsheetCancelBtn.hidden = true;
    if (cheatsheetIncludeContext) cheatsheetIncludeContext.checked = true;
    if (cheatsheetIncludeTopics) cheatsheetIncludeTopics.checked = true;
    if (cheatsheetIncludeNotes) cheatsheetIncludeNotes.checked = true;
    if (cheatsheetCourseSelect) {
      const targetCourse = preserveCourse ? (courseId || previousCourse) : '';
      if (targetCourse && courses.some((course) => course.id === targetCourse)) {
        cheatsheetCourseSelect.value = targetCourse;
      } else {
        cheatsheetCourseSelect.value = '';
      }
    }
    if (cheatsheetTitleInput) cheatsheetTitleInput.value = '';
  }

  function setCheatsheetFeedback(message, tone) {
    if (!cheatsheetFeedback) return;
    cheatsheetFeedback.textContent = message;
    cheatsheetFeedback.classList.remove('cheatsheet-feedback--success', 'cheatsheet-feedback--error');
    if (tone === 'success') {
      cheatsheetFeedback.classList.add('cheatsheet-feedback--success');
    } else if (tone === 'error') {
      cheatsheetFeedback.classList.add('cheatsheet-feedback--error');
    }
  }

  function initializeTabs() {
    if (!tabButtons.length || !tabPanels.length) return;
    const defaultButton = tabButtons.find(function (button) {
      return button.getAttribute('aria-selected') === 'true';
    }) || tabButtons[0];
    if (defaultButton && defaultButton.dataset.tab) {
      showTab(defaultButton.dataset.tab);
    }
    tabButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        if (!button.dataset.tab) return;
        showTab(button.dataset.tab);
      });
    });
  }

  function showTab(tabId) {
    tabPanels.forEach(function (panel) {
      const isActive = panel.id === tabId;
      panel.hidden = !isActive;
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
    tabButtons.forEach(function (button) {
      const isActive = button.dataset.tab === tabId;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.classList.toggle('tab-button--active', isActive);
    });
  }

  function renderCheatSheets() {
    if (!cheatsheetList) return;
    cheatsheetList.innerHTML = '';
    if (!cheatSheets.length) {
      const empty = document.createElement('p');
      empty.className = 'cheatsheet-list__empty';
      empty.textContent = 'No cheat sheets yet. Generate one when you\'re ready to revise.';
      cheatsheetList.appendChild(empty);
      return;
    }

    const sorted = cheatSheets.slice().sort((a, b) => {
      const aTime = a.updatedAt || a.createdAt || '';
      const bTime = b.updatedAt || b.createdAt || '';
      return bTime.localeCompare(aTime);
    });

    sorted.forEach((sheet) => {
      const card = document.createElement('article');
      card.className = 'cheatsheet-card';
      card.dataset.sheetId = sheet.id;

      const header = document.createElement('div');
      header.className = 'cheatsheet-card__header';

      const title = document.createElement('h3');
      title.textContent = sheet.title;
      header.appendChild(title);

      const courseName = sheet.courseId ? getCourseName(sheet.courseId) || 'Unassigned' : 'Unassigned';
      const meta = document.createElement('p');
      meta.className = 'cheatsheet-card__meta';
      const timestamp = formatTimestamp(sheet.updatedAt || sheet.createdAt);
      const metaParts = [`Course: ${courseName}`];
      if (timestamp) metaParts.push(`Updated • ${timestamp}`);
      meta.textContent = metaParts.join(' • ');
      header.appendChild(meta);

      card.appendChild(header);

      const content = document.createElement('div');
      content.className = 'cheatsheet-card__content';
      content.textContent = sheet.content;
      card.appendChild(content);

      const actions = document.createElement('div');
      actions.className = 'cheatsheet-card__actions';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'secondary small';
      copyBtn.dataset.action = 'copy';
      copyBtn.dataset.sheetId = sheet.id;
      copyBtn.textContent = 'Copy';
      actions.appendChild(copyBtn);

      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'secondary small';
      downloadBtn.dataset.action = 'download';
      downloadBtn.dataset.sheetId = sheet.id;
      downloadBtn.textContent = 'Download';
      actions.appendChild(downloadBtn);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'secondary small';
      editBtn.dataset.action = 'edit';
      editBtn.dataset.sheetId = sheet.id;
      editBtn.textContent = 'Regenerate';
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'small';
      deleteBtn.dataset.action = 'delete';
      deleteBtn.dataset.sheetId = sheet.id;
      deleteBtn.textContent = 'Delete';
      actions.appendChild(deleteBtn);

      card.appendChild(actions);
      cheatsheetList.appendChild(card);
    });
  }

  function loadNotes() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.notes);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((note) => note && note.id && note.title)
        .map((note) => ({
          id: note.id,
          title: typeof note.title === 'string' ? note.title : '',
          courseId: typeof note.courseId === 'string' ? note.courseId : '',
          content: typeof note.content === 'string' ? note.content : '',
          createdAt: note.createdAt || '',
          updatedAt: note.updatedAt || note.createdAt || '',
        }));
    } catch (error) {
      console.warn('Unable to load notes', error);
      return [];
    }
  }

  function persistNotes() {
    try {
      window.localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
    } catch (error) {
      console.warn('Unable to persist notes', error);
    }
  }

  function createNoteId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function getNoteById(noteId) {
    if (!noteId) return null;
    return notes.find((note) => note.id === noteId) || null;
  }

  function loadCheatSheets() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.cheatsheets);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((sheet) => sheet && sheet.id && sheet.title)
        .map((sheet) => ({
          id: sheet.id,
          title: typeof sheet.title === 'string' ? sheet.title : '',
          courseId: typeof sheet.courseId === 'string' ? sheet.courseId : '',
          content: typeof sheet.content === 'string' ? sheet.content : '',
          includeContext: sheet.includeContext !== false,
          includeTopics: sheet.includeTopics !== false,
          includeNotes: sheet.includeNotes !== false,
          createdAt: sheet.createdAt || '',
          updatedAt: sheet.updatedAt || sheet.createdAt || '',
        }));
    } catch (error) {
      console.warn('Unable to load cheat sheets', error);
      return [];
    }
  }

  function persistCheatSheets() {
    try {
      window.localStorage.setItem(STORAGE_KEYS.cheatsheets, JSON.stringify(cheatSheets));
    } catch (error) {
      console.warn('Unable to persist cheat sheets', error);
    }
  }

  function createCheatsheetId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `cheatsheet-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function getCheatsheetById(sheetId) {
    if (!sheetId) return null;
    return cheatSheets.find((sheet) => sheet.id === sheetId) || null;
  }

  function buildCheatSheetContent(course, courseNotes, options) {
    const lines = [];
    const titleParts = [];
    if (course.name) titleParts.push(course.name);
    if (course.code) titleParts.push(`(${course.code})`);
    if (titleParts.length) {
      lines.push(titleParts.join(' '));
    }
    if (course.term || course.instructor) {
      const metaParts = [];
      if (course.term) metaParts.push(`Term: ${course.term}`);
      if (course.instructor) metaParts.push(`Instructor: ${course.instructor}`);
      lines.push(metaParts.join(' • '));
    }

    if (options.includeContext && course.context) {
      lines.push('Course Overview:');
      lines.push(`- ${course.context}`);
    }

    if (options.includeTopics && course.topics && course.topics.length) {
      lines.push('Key Topics:');
      course.topics.slice(0, 12).forEach((topic) => {
        lines.push(`• ${topic}`);
      });
    }

    if (options.includeNotes && courseNotes.length) {
      lines.push('Notes Highlights:');
      courseNotes.forEach((note) => {
        lines.push(`• ${note.title}`);
        const points = extractKeyPoints(note.content, 5);
        points.forEach((point) => {
          lines.push(`  - ${point}`);
        });
      });
    }

    return lines.join('\n');
  }

  function extractKeyPoints(text, maxPoints) {
    if (!text) return [];
    const lines = text.replace(/\r/g, '').split(/\n+/).map(function(line) {
      return line.trim();
    }).filter(function(line) {
      return line.length > 0;
    });
    const points = [];
    for (let i = 0; i < lines.length && points.length < maxPoints; i += 1) {
      points.push(lines[i]);
    }
    if (!points.length) {
      const sentences = text.split(/(?<=[.!?])\s+/);
      for (let j = 0; j < sentences.length && points.length < maxPoints; j += 1) {
        const sentence = sentences[j].trim();
        if (sentence.length > 0) {
          points.push(sentence);
        }
      }
    }
    return points;
  }

  function copyTextToClipboard(text) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (error) {
      success = false;
    }
    document.body.removeChild(textarea);
    return success;
  }

  function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

async function handleQuizSubmit(event) {
  event.preventDefault();
  if (!quizNotesInput || quizGenerationActive) return;
  const rawNotes = quizNotesInput.value.trim();
  if (!rawNotes) {
    updateQuizFeedback('Add a few sentences of notes to build a quiz.', 'error');
    quizNotesInput.focus();
    return;
  }

  const requestedCount = clamp(parseInt(quizQuestionCountInput.value, 10), quizQuestionCountInput.min, quizQuestionCountInput.max);
  quizQuestionCountInput.value = requestedCount;

  const titleBase = quizTitleInput.value.trim();
  const useAI = aiService.shouldUseAI();
  const selectedCourseId = quizCourseSelect ? quizCourseSelect.value : '';
  let aiResult = null;
  let aiFailed = false;

  try {
    setQuizLoading(true, useAI ? 'Generating quiz with AI…' : 'Building quiz…');

    if (useAI) {
      try {
        aiResult = await aiService.generateQuiz({
          notes: rawNotes,
          desiredCount: requestedCount,
          requestedTitle: titleBase,
        });
      } catch (error) {
        console.error('AI quiz generation failed', error);
        updateQuizFeedback(`AI generation failed: ${error.message}. Falling back to offline mode.`, 'error');
        updateAiStatus(`AI error: ${error.message}`, 'error');
        aiFailed = true;
        aiResult = null;
      }
    }

    let questions = [];
    const aiQuestions = aiResult && Array.isArray(aiResult.questions) ? aiResult.questions : null;
    if (aiQuestions && aiQuestions.length) {
      questions = aiQuestions.slice(0, requestedCount);
    } else {
      if (useAI && !aiFailed) {
        updateAiStatus('AI response was incomplete. Using offline generator.', 'warning');
      }
      aiResult = null;
      questions = buildQuizQuestions(rawNotes, requestedCount);
    }

    if (!questions.length) {
      updateQuizFeedback('We could not find enough unique facts. Try adding more detail to your notes.', 'error');
      return;
    }

    const finalTitle = titleBase || (aiResult && aiResult.title) || deriveQuizTitle(questions);
    const currentConfig = aiConfigManager.get();
    const providerId = aiResult ? currentConfig.provider : null;
    const providerLabel = getProviderLabel(providerId);
    const quiz = {
      id: createQuizId(),
      title: finalTitle,
      createdAt: new Date().toISOString(),
      questions,
      generator: aiResult ? 'ai' : 'heuristic',
      provider: providerId,
      courseId: selectedCourseId ? selectedCourseId : null,
    };

    quizzes = [quiz, ...quizzes];
    persistQuizzes();
    renderCourses();
    renderSavedQuizzes();
    setActiveQuiz(quiz);
    const prefix = aiResult ? `AI (${providerLabel}) quiz saved` : 'Saved';
    updateQuizFeedback(`${prefix} "${quiz.title}" with ${quiz.questions.length} question${quiz.questions.length === 1 ? '' : 's'}.`, 'success');
    quizNotesInput.value = '';
    quizTitleInput.value = '';
    quizNotesInput.focus();
  } finally {
    setQuizLoading(false);
  }
}

  function handleQuizInteraction() {
    if (!quizQuestionsList) return;
    const hasChoice = Boolean(quizQuestionsList.querySelector('input[type="radio"]:checked'));
    const hasShortAnswer = Array.from(quizQuestionsList.querySelectorAll('textarea.quiz-short-answer')).some((textarea) => textarea.value.trim().length >= 3);
    const enable = hasChoice || hasShortAnswer;
    if (checkAnswersBtn) checkAnswersBtn.disabled = !enable;
    if (retakeQuizBtn && !quizScore.textContent) {
      retakeQuizBtn.disabled = !enable;
    }
  }

  function handleCheckAnswers() {
    if (!activeQuiz) return;
    let correct = 0;
    let answered = 0;

    activeQuiz.questions.forEach((question, index) => {
      const item = quizQuestionsList.children[index];
      if (!item) return;
      const feedbackEl = item.querySelector('.quiz-question__feedback');
      item.classList.remove('quiz-question--correct', 'quiz-question--incorrect');
      if (feedbackEl) {
        feedbackEl.textContent = '';
      }

      if (question.type === QUESTION_TYPES.MULTIPLE_CHOICE) {
        const selected = item.querySelector(`input[name="${question.id}"]:checked`);
        if (!selected) {
          if (feedbackEl) feedbackEl.textContent = 'No answer selected.';
          return;
        }

        answered += 1;
        if (selected.value === question.answerKey) {
          correct += 1;
          item.classList.add('quiz-question--correct');
          if (feedbackEl) feedbackEl.textContent = 'Correct!';
        } else {
          item.classList.add('quiz-question--incorrect');
          if (feedbackEl) {
            feedbackEl.textContent = `Answer: ${question.answer}`;
          }
        }

  } else if (question.type === QUESTION_TYPES.SHORT_ANSWER) {
    const input = item.querySelector('textarea.quiz-short-answer');
    if (!input) return;
    const response = input.value.trim();
    if (!response) {
      if (feedbackEl) feedbackEl.textContent = 'No answer provided.';
      return;
    }

    answered += 1;
    const evaluation = evaluateShortAnswer(response, question);
    if (evaluation.correct) {
      correct += 1;
      item.classList.add('quiz-question--correct');
      if (feedbackEl) {
        let message = 'Nice explanation!';
        if (question.explanation) {
          message += ` ${question.explanation}`;
        } else if ((question.aiRubric && question.aiRubric.sampleAnswer)) {
          message += ` Example: ${question.aiRubric.sampleAnswer}.`;
        }
        feedbackEl.textContent = message.trim();
      }
    } else {
      item.classList.add('quiz-question--incorrect');
      if (feedbackEl) {
        const hints = [];
        if (evaluation.needsMoreWords) {
          const minimum = (question.aiRubric && question.aiRubric.minWords) || (question.aiRubric && question.aiRubric.min_words) || 0;
          hints.push(minimum ? `add more detail (≥${minimum} words)` : 'add more detail');
        }
        if ((evaluation.missingPhrases && evaluation.missingPhrases.length)) {
          hints.push(`mention ${evaluation.missingPhrases.join(', ')}`);
        }
        if ((evaluation.missingTokens && evaluation.missingTokens.length)) {
          hints.push(`include ${evaluation.missingTokens.map((token) => `'${token}'`).join(', ')}`);
        }
        let message = '';
        if (question.answer) {
          message = `Answer: ${question.answer}.`;
        }
        if ((question.aiRubric && question.aiRubric.sampleAnswer) && (!question.answer || question.answer !== question.aiRubric.sampleAnswer)) {
          message += ` Example: ${question.aiRubric.sampleAnswer}.`;
        }
        if (question.explanation) {
          message += ` ${question.explanation}`;
        }
        if (hints.length) {
          message += ` Hint: ${hints.join('; ')}.`;
        }
        feedbackEl.textContent = message.trim() || 'Keep refining your answer with the key ideas.';
      }
    }
  }
});

    const total = activeQuiz.questions.length;
    const scorePercent = Math.round((correct / Math.max(total, 1)) * 100);
    const answeredSummary = answered === total ? '' : ` • answered ${answered}/${total}`;
    quizScore.textContent = `Score: ${correct}/${total} (${scorePercent}%)${answeredSummary}`;
    updateQuizFeedback('Review the highlighted answers, then try again if you like.', 'default');
    if (retakeQuizBtn) retakeQuizBtn.disabled = false;
  }

  function handleSavedQuizClick(event) {
    const button = event.target.closest('button');
    if (!button || !button.dataset.action) return;
    const quizId = button.dataset.quizId;
    if (!quizId) return;

    if (button.dataset.action === 'open') {
      const quiz = quizzes.find((item) => item.id === quizId);
      if (quiz) {
        setActiveQuiz(quiz);
      }
    }

    if (button.dataset.action === 'delete') {
      quizzes = quizzes.filter((item) => item.id !== quizId);
      persistQuizzes();
      renderSavedQuizzes();
      renderCourses();
      if (activeQuiz && activeQuiz.id === quizId) {
        setActiveQuiz(quizzes[0] || null);
      }
      updateQuizFeedback('Quiz removed.', 'default');
    }
  }

  function handleClearQuizzes() {
    if (!quizzes.length) return;
    const confirmed = window.confirm('Delete all saved quizzes? This cannot be undone.');
    if (!confirmed) return;
    quizzes = [];
    persistQuizzes();
    renderSavedQuizzes();
    renderCourses();
    setActiveQuiz(null);
    updateQuizFeedback('All saved quizzes cleared.', 'default');
  }


function setQuizLoading(isLoading, message) {
  quizGenerationActive = isLoading;
  if (quizGenerateBtn) {
    quizGenerateBtn.disabled = isLoading;
  }
  if (quizForm) {
    quizForm.classList.toggle('quiz-form--loading', isLoading);
  }
  if (message) {
    updateQuizFeedback(message, 'default');
  } else if (isLoading) {
    updateQuizFeedback('Working on your quiz…', 'default');
  }
}

function setupAiControls() {
  applyAiConfigToUI();

  if (quizAiProviderSelect) {
    quizAiProviderSelect.addEventListener('change', () => {
      const provider = quizAiProviderSelect.value;
      const current = aiConfigManager.get();
      const patch = { provider };
      if (provider === AI_PROVIDERS.OPENAI) {
        const shouldReset = !current.endpoint || current.provider !== AI_PROVIDERS.OPENAI || current.endpoint === '';
        if (shouldReset) patch.endpoint = 'https://api.openai.com/v1';
      } else if (provider === AI_PROVIDERS.AZURE_OPENAI) {
        if (!current.endpoint || current.endpoint === 'https://api.openai.com/v1') {
          patch.endpoint = '';
        }
      } else if (provider === AI_PROVIDERS.CUSTOM) {
        if (!current.endpoint || current.endpoint === 'https://api.openai.com/v1') {
          patch.endpoint = '';
        }
      }
      aiConfigManager.update(patch);
      applyAiConfigToUI();
      updateAiStatus();
    });
  }

  if (quizAiToggle) {
    quizAiToggle.addEventListener('change', () => {
      aiConfigManager.update({ enabled: quizAiToggle.checked });
      refreshAiSettingsVisibility();
      updateAiStatus();
    });
  }

  if (quizAiSaveBtn) {
    quizAiSaveBtn.addEventListener('click', (event) => {
      event.preventDefault();
      const provider = quizAiProviderSelect ? quizAiProviderSelect.value : AI_PROVIDERS.OPENAI;
      const endpointValue = quizAiEndpointInput && typeof quizAiEndpointInput.value === 'string' ? quizAiEndpointInput.value.trim() : '';
      const modelValue = quizAiModelInput && typeof quizAiModelInput.value === 'string' ? quizAiModelInput.value.trim() : '';
      const apiKeyValue = quizAiKeyInput && typeof quizAiKeyInput.value === 'string' ? quizAiKeyInput.value.trim() : '';
      const temperatureRaw = quizAiTemperatureInput ? Number(quizAiTemperatureInput.value) : NaN;
      const temperature = Number.isFinite(temperatureRaw) ? temperatureRaw : 0.6;
      const azureResource = quizAiAzureResourceInput && typeof quizAiAzureResourceInput.value === 'string' ? quizAiAzureResourceInput.value.trim() : '';
      const azureDeployment = quizAiAzureDeploymentInput && typeof quizAiAzureDeploymentInput.value === 'string' ? quizAiAzureDeploymentInput.value.trim() : '';
      const azureApiVersion = quizAiAzureVersionInput && typeof quizAiAzureVersionInput.value === 'string' ? quizAiAzureVersionInput.value.trim() : '';
      const patch = {
        provider,
        endpoint: endpointValue,
        model: modelValue,
        apiKey: apiKeyValue,
        temperature,
        azureResource,
        azureDeployment,
        azureApiVersion,
        enabled: quizAiToggle ? quizAiToggle.checked : true,
      };
      aiConfigManager.update(patch);
      applyAiConfigToUI();
      updateAiStatus('AI settings saved.', aiConfigManager.isConfigured() ? 'success' : 'default');
    });
  }

  if (quizAiClearBtn) {
    quizAiClearBtn.addEventListener('click', (event) => {
      event.preventDefault();
      aiConfigManager.clear();
      applyAiConfigToUI();
      updateAiStatus('AI settings cleared. Using on-device generator.', 'default');
    });
  }
}

function applyAiConfigToUI() {
  const config = aiConfigManager.get();
  const provider = config.provider || AI_PROVIDERS.OPENAI;
  if (quizAiProviderSelect) quizAiProviderSelect.value = provider;
  if (quizAiToggle) quizAiToggle.checked = Boolean(config.enabled);
  if (quizAiEndpointInput) quizAiEndpointInput.value = config.endpoint || '';
  if (quizAiModelInput) quizAiModelInput.value = config.model || '';
  if (quizAiKeyInput) quizAiKeyInput.value = config.apiKey || '';
  if (quizAiTemperatureInput) {
    const temp = Number.isFinite(config.temperature) ? config.temperature : 0.6;
    quizAiTemperatureInput.value = String(temp);
  }
  if (quizAiAzureResourceInput) quizAiAzureResourceInput.value = config.azureResource || '';
  if (quizAiAzureDeploymentInput) quizAiAzureDeploymentInput.value = config.azureDeployment || '';
  if (quizAiAzureVersionInput) quizAiAzureVersionInput.value = config.azureApiVersion || '2024-02-15';
  refreshAiSettingsVisibility();
  updateAiStatus();
}

function refreshAiSettingsVisibility() {
  if (!quizAiSettings) return;
  const shouldShow = quizAiToggle ? quizAiToggle.checked : false;
  quizAiSettings.hidden = !shouldShow;
  if (quizAiConfig) {
    quizAiConfig.classList.toggle('quiz__ai--enabled', shouldShow && aiConfigManager.isConfigured());
  }
  refreshProviderVisibility();
  if (!shouldShow && quizAiAzureFields) {
    quizAiAzureFields.hidden = true;
  }
}

function refreshProviderVisibility() {
  const provider = quizAiProviderSelect ? quizAiProviderSelect.value : AI_PROVIDERS.OPENAI;
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS[AI_PROVIDERS.OPENAI];
  if (quizAiEndpointInput) quizAiEndpointInput.placeholder = preset.endpointPlaceholder;
  if (quizAiModelInput) quizAiModelInput.placeholder = preset.modelPlaceholder;
  if (quizAiAzureFields) quizAiAzureFields.hidden = provider !== AI_PROVIDERS.AZURE_OPENAI;
  if (quizAiConfig) {
    quizAiConfig.classList.toggle('quiz__ai--azure-provider', provider === AI_PROVIDERS.AZURE_OPENAI);
  }
  if (quizAiNote) {
    const baseNote = 'Keys stay in this browser only.';
    if (preset.notes) {
      quizAiNote.textContent = `${baseNote} ${preset.notes}`;
    } else {
      quizAiNote.textContent = `${baseNote} Use your own endpoint or provider you trust.`;
    }
  }
}

function updateAiStatus(message, tone = 'default') {
  if (!quizAiStatus) return;
  const config = aiConfigManager.get();
  const providerLabel = getProviderLabel(config.provider);
  let statusMessage = message;
  if (!statusMessage) {
    if (!config.enabled) {
      statusMessage = 'AI generation is off.';
      tone = 'muted';
    } else if (aiConfigManager.isConfigured()) {
      statusMessage = `AI ready via ${providerLabel}.`;
      tone = 'success';
    } else {
      statusMessage = `Enable AI by adding credentials for ${providerLabel}.`;
      tone = 'warning';
    }
  }
  quizAiStatus.textContent = statusMessage;
  quizAiStatus.dataset.tone = tone;
}

function getProviderLabel(provider) {
  const meta = PROVIDER_PRESETS[provider];
  if (meta && meta.label) return meta.label;
  if (provider === AI_PROVIDERS.AZURE_OPENAI) return 'Azure OpenAI';
  if (provider === AI_PROVIDERS.CUSTOM) return 'your custom endpoint';
  return 'OpenAI';
}

  function buildQuizQuestions(notes, desiredCount) {
    const cleanNotes = notes.replace(/\r\n/g, '\n').trim();
    if (!cleanNotes) return [];

    const sentences = cleanNotes
      .split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
      .filter((sentence) => sentence && sentence.split(' ').length >= MIN_SENTENCE_WORDS);

    if (!sentences.length) return [];

    const wordFrequency = new Map();
    const wordForms = new Map();
    const sentenceData = sentences.map((sentence) => {
      const words = Array.from(sentence.matchAll(/[A-Za-z][A-Za-z'’-]*/g))
        .map((match) => {
          const original = match[0];
          const lower = original.toLowerCase();
          if (!wordForms.has(lower)) {
            wordForms.set(lower, original);
          }
          if (STOPWORDS.has(lower) || original.length <= 3) {
            return null;
          }
          wordFrequency.set(lower, (wordFrequency.get(lower) || 0) + 1);
          return {
            original,
            lower,
            index: (typeof match.index === 'number' ? match.index : 0),
          };
        })
        .filter(Boolean);

      return { sentence, words };
    });

    const candidatePool = [];
    sentenceData.forEach(({ sentence, words }) => {
      if (!words.length) return;
      const sorted = words
        .slice()
        .sort((a, b) => {
          const freqDiff = (wordFrequency.get(a.lower) || 0) - (wordFrequency.get(b.lower) || 0);
          if (freqDiff !== 0) return freqDiff;
          return b.original.length - a.original.length;
        })
        .slice(0, 3);

      sorted.forEach((keyword, rank) => {
        candidatePool.push({
          keyword,
          sentence,
          rank,
          score: (wordFrequency.get(keyword.lower) || 0) * 10 - keyword.original.length,
          key: `${keyword.lower}|${sentence}`,
        });
      });
    });

    if (!candidatePool.length) return [];

    const seen = new Set();
    const uniqueCandidates = [];
    candidatePool
      .sort((a, b) => a.score - b.score)
      .forEach((candidate) => {
        if (seen.has(candidate.key)) return;
        seen.add(candidate.key);
        uniqueCandidates.push(candidate);
      });

    const chosen = uniqueCandidates.slice(0, Math.min(desiredCount, uniqueCandidates.length));
    const vocab = Array.from(wordFrequency.keys());
    const baseId = Date.now();

    return chosen.map((candidate, index) => {
      const questionIndex = index;
      if (index % 3 === 0) {
        return createShortAnswerQuestion(candidate, questionIndex, baseId);
      }
      return createMultipleChoiceQuestion(candidate, questionIndex, vocab, wordForms, baseId);
    });
  }

  function createMultipleChoiceQuestion(candidate, index, vocab, wordForms, baseId) {
    const { keyword, sentence } = candidate;
    const options = buildOptions(keyword.lower, keyword.original, vocab, wordForms);
    return {
      id: createQuestionId(baseId, index),
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      prompt: createFillPrompt(sentence, keyword.original),
      answer: keyword.original,
      answerKey: keyword.lower,
      options,
      sentence,
    };
  }

  function createShortAnswerQuestion(candidate, index, baseId) {
    const { keyword, sentence } = candidate;
    const answerKeyTokens = tokenizeSentence(keyword.original).filter(Boolean);
    const sentenceTokens = tokenizeSentence(sentence);
    const nonStopTokens = sentenceTokens.filter((token) => !STOPWORDS.has(token));
    const informativeTokens = nonStopTokens.filter((token) => !answerKeyTokens.includes(token));
    const requiredTokens = uniqueTokens(informativeTokens).slice(0, 6);
    const expectedTokens = uniqueTokens(nonStopTokens);
    const mustTokens = requiredTokens.slice(0, Math.min(requiredTokens.length, 3));
    const corePhrases = extractCorePhrases(sentence, keyword.original);

    return {
      id: createQuestionId(baseId, index),
      type: QUESTION_TYPES.SHORT_ANSWER,
      prompt: `Short answer: In your own words, explain ${capitalize(keyword.original)}.`,
      hint: sentence,
      answer: sentence,
      answerKey: keyword.lower,
      answerKeyTokens,
      requiredTokens,
      expectedTokens,
      mustTokens,
      corePhrases,
      sentence,
    };
  }


  function uniqueTokens(tokens) {
    const seen = new Set();
    const result = [];
    tokens.forEach((token) => {
      if (!token || seen.has(token)) return;
      seen.add(token);
      result.push(token);
    });
    return result;
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const result = [];
    values.forEach((value) => {
      if (value === null || value === undefined) return;
      const normalized = String(value).trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      result.push(normalized);
    });
    return result;
  }

  function extractCorePhrases(sentence, keyword) {
    const normalizedKeyword = normalizeText(keyword || '');
    const tokens = tokenizeSentence(sentence);
    const nonStopTokens = tokens.filter((token) => !STOPWORDS.has(token));
    const phrases = new Set();

    for (let size = Math.min(4, nonStopTokens.length); size >= 2; size -= 1) {
      for (let i = 0; i <= nonStopTokens.length - size; i += 1) {
        const chunk = nonStopTokens.slice(i, i + size);
        if (normalizedKeyword && chunk.includes(normalizedKeyword)) continue;
        phrases.add(chunk.join(' '));
        if (phrases.size >= 4) break;
      }
      if (phrases.size >= 4) break;
    }

    if (normalizedKeyword) {
      const normalizedSentence = normalizeText(sentence);
      if (normalizedSentence.includes(normalizedKeyword)) {
        const segments = sentence.split(/[,;:.!?]/);
        segments.forEach((segment) => {
          const normalizedSegment = normalizeText(segment);
          if (!normalizedSegment || !normalizedSegment.includes(normalizedKeyword)) return;
          const cleaned = normalizedSegment.replace(normalizedKeyword, '').trim();
          if (cleaned && cleaned.length > 3) {
            phrases.add(cleaned);
          }
        });
      }
    }

    return Array.from(phrases).map((phrase) => normalizeText(phrase)).filter(Boolean).slice(0, 4);
  }

  function ensureShortAnswerMetadata(question) {
    if (!question || question.type !== QUESTION_TYPES.SHORT_ANSWER) {
      return {
        answerKeyTokens: [],
        requiredTokens: [],
        expectedTokens: [],
        mustTokens: [],
        corePhrases: [],
      };
    }

    if (!question.__memoizedShortAnswerMeta) {
      const meta = deriveShortAnswerMetadata(question);
      question.answerKeyTokens = meta.answerKeyTokens;
      question.requiredTokens = meta.requiredTokens;
      question.expectedTokens = meta.expectedTokens;
      question.mustTokens = meta.mustTokens;
      question.corePhrases = meta.corePhrases;
      question.__memoizedShortAnswerMeta = true;
    }

    return {
      answerKeyTokens: question.answerKeyTokens || [],
      requiredTokens: question.requiredTokens || [],
      expectedTokens: question.expectedTokens || [],
      mustTokens: question.mustTokens || [],
      corePhrases: question.corePhrases || [],
    };
  }

  function deriveShortAnswerMetadata(question) {
    if (question.aiRubric) {
      const normalizedRubric = normalizeAiRubric(question.aiRubric);
      question.aiRubric = normalizedRubric;
      return {
        answerKeyTokens: normalizedRubric.keywords || [],
        requiredTokens: normalizedRubric.requiredTokens || normalizedRubric.keywords || [],
        expectedTokens: normalizedRubric.expectedTokens || normalizedRubric.requiredTokens || [],
        mustTokens: normalizedRubric.mustTokens || [],
        corePhrases: normalizedRubric.phrases || [],
      };
    }

    const sentence = question.sentence || question.hint || question.answer || '';
    const keywordSource = question.answerKeyTokens && question.answerKeyTokens.length
      ? question.answerKeyTokens.join(' ')
      : (question.answerKey || '');
    const answerKeyTokens = uniqueTokens(
      (question.answerKeyTokens && question.answerKeyTokens.length
        ? question.answerKeyTokens
        : tokenizeSentence(keywordSource))
        .filter(Boolean),
    );
    const sentenceTokens = tokenizeSentence(sentence);
    const nonStopTokens = sentenceTokens.filter((token) => !STOPWORDS.has(token));
    const informativeTokens = nonStopTokens.filter((token) => !answerKeyTokens.includes(token));
    const requiredTokens = question.requiredTokens && question.requiredTokens.length
      ? uniqueTokens(question.requiredTokens)
      : uniqueTokens(informativeTokens).slice(0, 6);
    const expectedTokens = question.expectedTokens && question.expectedTokens.length
      ? uniqueTokens(question.expectedTokens)
      : uniqueTokens(nonStopTokens);
    const mustTokens = question.mustTokens && question.mustTokens.length
      ? uniqueTokens(question.mustTokens)
      : requiredTokens.slice(0, Math.min(requiredTokens.length, 3));
    const corePhrases = question.corePhrases && question.corePhrases.length
      ? question.corePhrases.map((phrase) => normalizeText(phrase)).filter(Boolean)
      : extractCorePhrases(sentence, keywordSource || (answerKeyTokens[0] || ''));
    return {
      answerKeyTokens,
      requiredTokens,
      expectedTokens,
      mustTokens,
      corePhrases,
    };
  }

  function buildTokenSet(tokens) {
    const set = new Set();
    tokens.forEach((token) => {
      if (!token) return;
      createTokenVariants(token).forEach((variant) => {
        if (variant) set.add(variant);
      });
    });
    return set;
  }

  function createTokenVariants(token) {
    if (!token) return [];
    const variants = new Set([token]);
    if (token.includes('-')) {
      token.split('-').forEach((part) => {
        if (part.length > 2) variants.add(part);
      });
    }
    const stem = stemToken(token);
    variants.add(stem);
    if (token.endsWith('ing') && token.length > 5) {
      variants.add(`${stem}e`);
    }
    return Array.from(variants).filter(Boolean);
  }

  function stemToken(token) {
    if (!token || token.length <= 3) return token;
    if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
    if (token.endsWith('ves') && token.length > 4) return `${token.slice(0, -3)}f`;
    if (/(sses|shes|ches|xes|zes)$/.test(token)) return token.slice(0, -2);
    if (token.endsWith('s') && token.length > 4 && !token.endsWith('ss')) return token.slice(0, -1);
    if (token.endsWith('ing') && token.length > 5) return token.slice(0, -3);
    if (token.endsWith('ed') && token.length > 4) return token.slice(0, -2);
    return token;
  }

  function buildOptions(answerKey, answerLabel, vocab, wordForms) {
    const options = [createOption(answerKey, answerLabel)];
    const distractorPool = vocab.filter((word) => word !== answerKey);
    shuffle(distractorPool);

    distractorPool.forEach((word) => {
      if (options.length >= MAX_OPTIONS) return;
      const label = wordForms.get(word) || prettifyWord(word);
      if (!options.some((option) => option.value === word)) {
        options.push(createOption(word, label));
      }
    });

    let fallbackIndex = 0;
    while (options.length < Math.min(MAX_OPTIONS, 4) && fallbackIndex < FALLBACK_DISTRACTORS.length) {
      const word = FALLBACK_DISTRACTORS[fallbackIndex];
      fallbackIndex += 1;
      if (word === answerKey || options.some((option) => option.value === word)) continue;
      options.push(createOption(word, prettifyWord(word)));
    }

    return shuffle(options.slice());
  }

  function evaluateShortAnswer(response, question) {
    const normalized = normalizeText(response);
    const meta = ensureShortAnswerMetadata(question);

    if (!normalized) {
      return { correct: false, missingTokens: meta.mustTokens.slice(0, 3), missingPhrases: [], coverage: 0, needsMoreWords: Boolean((question.aiRubric && question.aiRubric.minWords)) };
    }

    const userTokens = tokenizeNormalized(normalized);
    const userTokenSet = buildTokenSet(userTokens);
    const hasToken = (token) => Boolean(token) && userTokenSet.has(token);

    const keywordSatisfied = meta.answerKeyTokens.length ? meta.answerKeyTokens.every(hasToken) : true;
    const mustTokensSatisfied = meta.mustTokens.length ? meta.mustTokens.every(hasToken) : true;

    const basis = meta.expectedTokens.length ? meta.expectedTokens : meta.requiredTokens;
    const hits = basis.filter(hasToken);
    const totalBasis = Math.max(1, basis.length);
    const allowPartial = (question.aiRubric && question.aiRubric.allowPartial) !== false;
    const requiredCoverage = totalBasis <= 3 ? 1 : allowPartial ? 0.6 : 0.8;
    const coverage = hits.length / totalBasis;
    const minHits = Math.min(totalBasis, Math.max(1, Math.ceil(totalBasis * requiredCoverage)));
    const meetsCoverage = hits.length >= minHits;

    const phrases = meta.corePhrases || [];
    const phraseHit = !phrases.length || phrases.some((phrase) => normalized.includes(phrase));
    const missingPhraseSet = phrases.filter((phrase) => !normalized.includes(phrase));

    const minWords = Number((question.aiRubric && question.aiRubric.minWords)) || 0;
    const meetsLength = !minWords || userTokens.length >= minWords;

    const correct = keywordSatisfied && mustTokensSatisfied && meetsCoverage && phraseHit && meetsLength;

    if (correct) {
      return { correct: true, missingTokens: [], missingPhrases: [], coverage, needsMoreWords: false };
    }

    const missingTokens = uniqueTokens([
      ...meta.answerKeyTokens.filter((token) => !hasToken(token)),
      ...meta.mustTokens.filter((token) => !hasToken(token)),
      ...basis.filter((token) => !hasToken(token)),
    ]).slice(0, 4);

    const phrasesDisplay = (question.aiRubric && question.aiRubric.phrasesDisplay) || [];
    const missingPhrases = missingPhraseSet
      .map((phrase) => phrasesDisplay.find((display) => normalizeText(display) === phrase) || phrase)
      .slice(0, 2);

    return {
      correct: false,
      missingTokens,
      missingPhrases,
      coverage,
      needsMoreWords: !meetsLength,
    };
  }


function createAIConfigManager() {
  const defaults = {
    enabled: false,
    provider: AI_PROVIDERS.OPENAI,
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
    temperature: 0.6,
    azureResource: '',
    azureDeployment: '',
    azureApiVersion: '2024-02-15',
  };

  let config = load();

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.aiConfig);
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw);
      const hydrated = { ...defaults, ...(parsed || {}) };
      if (!Object.values(AI_PROVIDERS).includes(hydrated.provider)) {
        hydrated.provider = defaults.provider;
      }
      return hydrated;
    } catch (error) {
      console.warn('Unable to load AI config', error);
      return { ...defaults };
    }
  }

  function apply(newConfig) {
    const normalized = { ...defaults, ...newConfig };
    if (!Object.values(AI_PROVIDERS).includes(normalized.provider)) {
      normalized.provider = defaults.provider;
    }
    normalized.endpoint = typeof normalized.endpoint === 'string' ? normalized.endpoint.trim() : '';
    normalized.model = typeof normalized.model === 'string' ? normalized.model.trim() : '';
    normalized.apiKey = typeof normalized.apiKey === 'string' ? normalized.apiKey.trim() : '';
    normalized.azureResource = typeof normalized.azureResource === 'string' ? normalized.azureResource.trim() : '';
    normalized.azureDeployment = typeof normalized.azureDeployment === 'string' ? normalized.azureDeployment.trim() : '';
    normalized.azureApiVersion = typeof normalized.azureApiVersion === 'string' && normalized.azureApiVersion.trim() ? normalized.azureApiVersion.trim() : defaults.azureApiVersion;
    if (normalized.provider === AI_PROVIDERS.AZURE_OPENAI && normalized.endpoint === defaults.endpoint) {
      normalized.endpoint = '';
    }
    if (normalized.provider === AI_PROVIDERS.OPENAI && !normalized.endpoint) {
      normalized.endpoint = defaults.endpoint;
    }
    normalized.temperature = Number.isFinite(normalized.temperature) ? Math.min(Math.max(normalized.temperature, 0), 1) : defaults.temperature;
    config = normalized;
    persist();
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEYS.aiConfig, JSON.stringify(config));
    } catch (error) {
      console.warn('Unable to persist AI config', error);
    }
  }

  return {
    get() {
      return { ...config };
    },
    set(newConfig) {
      apply(newConfig);
    },
    update(patch) {
      apply({ ...config, ...patch });
    },
    clear() {
      config = { ...defaults };
      try {
        window.localStorage.removeItem(STORAGE_KEYS.aiConfig);
      } catch (error) {
        console.warn('Unable to clear AI config', error);
      }
    },
    isConfigured() {
      if (!config.enabled) return false;
      const provider = config.provider || defaults.provider;
      if (provider === AI_PROVIDERS.AZURE_OPENAI) {
        const hasResource = Boolean(config.azureResource || config.endpoint);
        const hasDeployment = Boolean(config.azureDeployment || config.model);
        return Boolean(config.apiKey && hasResource && hasDeployment);
      }
      if (provider === AI_PROVIDERS.CUSTOM) {
        return Boolean(config.apiKey && config.endpoint && config.model);
      }
      return Boolean(config.apiKey && config.endpoint && config.model);
    },
  };
}

function normalizeAiRubric(raw = {}) {
  const rubric = { ...(raw.rubric || {}), ...raw };
  const phrasesOriginal = [];
  const phrasesNormalized = [];
  const keywords = [];
  const mustInclude = [];
  const expectedTokens = [];

  const pushTerm = (term, { must = false, treatAsPhrase = false } = {}) => {
    if (term === null || term === undefined) return;
    const text = String(term).trim();
    if (!text) return;
    const normalized = normalizeText(text);
    if (!normalized) return;

    if (treatAsPhrase || text.includes(' ')) {
      phrasesOriginal.push(text);
      phrasesNormalized.push(normalized);
      tokenizeNormalized(normalized).forEach((token) => {
        expectedTokens.push(token);
        if (must) mustInclude.push(token);
      });
      return;
    }

    keywords.push(normalized);
    expectedTokens.push(normalized);
    if (must) mustInclude.push(normalized);
  };

  const keywordSources = [rubric.keywords, raw.keywords, rubric.terms, raw.terms];
  keywordSources.forEach((collection) => ensureArray(collection).forEach((item) => pushTerm(item)));

  const mustSources = [rubric.must_include, raw.must_include, rubric.required_terms, raw.required_terms];
  mustSources.forEach((collection) => ensureArray(collection).forEach((item) => pushTerm(item, { must: true }))); 

  const phraseSources = [rubric.phrases, raw.phrases, rubric.important_phrases, raw.important_phrases];
  phraseSources.forEach((collection) => ensureArray(collection).forEach((item) => pushTerm(item, { treatAsPhrase: true })));

  ensureArray(rubric.synonyms || raw.synonyms).forEach((synonym) => {
    tokenizeNormalized(normalizeText(String(synonym))).forEach((token) => {
      expectedTokens.push(token);
    });
  });

  const sampleAnswer = String(rubric.sample_answer || raw.sample_answer || rubric.sampleAnswer || raw.sampleAnswer || '').trim();
  if (sampleAnswer) {
    tokenizeNormalized(normalizeText(sampleAnswer)).forEach((token) => expectedTokens.push(token));
  }

  const minWordsGuess = sampleAnswer ? Math.max(4, tokenizeNormalized(normalizeText(sampleAnswer)).length - 1) : 6;
  const minWords = Number((rubric.min_word_count !== undefined ? rubric.min_word_count : (raw.min_word_count !== undefined ? raw.min_word_count : minWordsGuess)));

  const normalizedKeywords = uniqueTokens(keywords);
  const normalizedMust = uniqueTokens(mustInclude.length ? mustInclude : normalizedKeywords.slice(0, Math.min(3, normalizedKeywords.length)));
  const normalizedExpected = uniqueTokens(expectedTokens.length ? expectedTokens : normalizedKeywords);
  const normalizedPhrases = uniqueStrings(phrasesNormalized);

  return {
    keywords: normalizedKeywords,
    requiredTokens: normalizedExpected,
    expectedTokens: normalizedExpected,
    mustTokens: normalizedMust,
    phrases: normalizedPhrases,
    phrasesDisplay: uniqueStrings(phrasesOriginal),
    sampleAnswer,
    explanation: String(rubric.explanation || raw.explanation || ''),
    minWords: Number.isFinite(minWords) ? Math.max(3, minWords) : minWordsGuess,
    allowPartial: (rubric.allow_partial !== undefined ? rubric.allow_partial : (raw.allow_partial !== undefined ? raw.allow_partial : true)),
    focus: String(rubric.focus || rubric.topic || raw.focus || ''),
  };
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Unable to parse AI JSON payload', error, value);
    return null;
  }
}


  function createOption(value, label) {
    return { value, label };
  }

  function createFillPrompt(sentence, answer) {
    const escaped = escapeRegExp(answer);
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    const replaced = sentence.replace(pattern, '_____');
    const formatted = replaced === sentence ? sentence.replace(answer, '_____') : replaced;
    return `Fill in the blank: ${formatted}`;
  }

  function deriveQuizTitle(questions) {
    if (!questions.length) {
      return 'Practice Quiz';
    }
    const first = questions[0].answer;
    return first && first.length > 3 ? `${capitalize(first)} Review` : 'Practice Quiz';
  }

  function setActiveQuiz(quiz, { silent = false } = {}) {
    activeQuiz = quiz || null;
    if (!quizCurrentSection) return;
    if (!activeQuiz) {
      quizCurrentSection.hidden = true;
      quizScore.textContent = '';
      if (checkAnswersBtn) checkAnswersBtn.disabled = true;
      if (retakeQuizBtn) retakeQuizBtn.disabled = true;
      return;
    }

    quizCurrentSection.hidden = false;
    quizCurrentTitle.textContent = activeQuiz.title;
    const metaParts = [];
    metaParts.push(`${activeQuiz.questions.length} question${activeQuiz.questions.length === 1 ? '' : 's'}`);
    metaParts.push(formatTimestamp(activeQuiz.createdAt));
    if (activeQuiz.courseId) {
      const courseName = getCourseName(activeQuiz.courseId);
      metaParts.push(`Course: ${courseName || 'Archived'}`);
    }
    quizCurrentMeta.textContent = metaParts.join(' • ');
    renderActiveQuiz(activeQuiz);
    resetActiveQuizSelections(true);
    if (!silent) {
      updateQuizFeedback(`Loaded "${activeQuiz.title}".`, 'success');
    }
  }

  function renderActiveQuiz(quiz) {
    if (!quizQuestionsList) return;
    quizQuestionsList.innerHTML = '';
    quiz.questions.forEach((question, index) => {
      const item = document.createElement('li');
      item.className = 'quiz-question';
      item.dataset.questionId = question.id;

      const promptEl = document.createElement('p');
      promptEl.className = 'quiz-question__prompt';
      promptEl.textContent = `${index + 1}. ${question.prompt}`;
      item.appendChild(promptEl);

      if (question.type === QUESTION_TYPES.MULTIPLE_CHOICE) {
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'quiz-options';
        question.options.forEach((option, optionIndex) => {
          const optionId = `${question.id}-${optionIndex}`;
          const label = document.createElement('label');
          label.className = 'quiz-option';

          const input = document.createElement('input');
          input.type = 'radio';
          input.name = question.id;
          input.value = option.value;
          input.id = optionId;

          const optionText = document.createElement('span');
          optionText.textContent = option.label;

          label.appendChild(input);
          label.appendChild(optionText);
          optionsContainer.appendChild(label);
        });
        item.appendChild(optionsContainer);
      } else if (question.type === QUESTION_TYPES.SHORT_ANSWER) {
        item.classList.add('quiz-question--short');
        if (question.hint) {
          const hint = document.createElement('p');
          hint.className = 'quiz-question__context';
          hint.textContent = `Hint from your notes: ${question.hint}`;
          item.appendChild(hint);
        }
        const textarea = document.createElement('textarea');
        textarea.className = 'quiz-short-answer';
        textarea.rows = 2;
        textarea.placeholder = 'Type your response...';
        textarea.setAttribute('aria-label', `Response for question ${index + 1}`);
        item.appendChild(textarea);
      }

      const feedback = document.createElement('p');
      feedback.className = 'quiz-question__feedback';
      feedback.textContent = '';
      item.appendChild(feedback);

      quizQuestionsList.appendChild(item);
    });
  }

  function resetActiveQuizSelections(silent = false) {
    if (!quizQuestionsList) return;
    quizQuestionsList.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.checked = false;
    });
    quizQuestionsList.querySelectorAll('textarea.quiz-short-answer').forEach((textarea) => {
      textarea.value = '';
    });
    quizQuestionsList.querySelectorAll('.quiz-question').forEach((item) => {
      item.classList.remove('quiz-question--correct', 'quiz-question--incorrect');
    });
    quizQuestionsList.querySelectorAll('.quiz-question__feedback').forEach((feedback) => {
      feedback.textContent = '';
    });
    quizScore.textContent = '';
    if (checkAnswersBtn) checkAnswersBtn.disabled = true;
    if (retakeQuizBtn) retakeQuizBtn.disabled = true;
    if (!silent) {
      updateQuizFeedback('Selections cleared. Give it another shot!', 'default');
    }
  }

  function renderSavedQuizzes() {
    if (!savedQuizzesList) return;
    savedQuizzesList.innerHTML = '';
    if (!quizzes.length) {
      if (clearQuizzesBtn) clearQuizzesBtn.disabled = true;
      const empty = document.createElement('li');
      empty.className = 'quiz__saved-empty';
      empty.textContent = 'No quizzes yet. Generate one to get started.';
      savedQuizzesList.appendChild(empty);
      return;
    }

    if (clearQuizzesBtn) clearQuizzesBtn.disabled = false;

    quizzes.forEach((quiz) => {
      const item = document.createElement('li');
      item.className = 'quiz__saved-item';
      item.dataset.quizId = quiz.id;

      const info = document.createElement('div');
      info.className = 'quiz__saved-item-info';
      const title = document.createElement('strong');
      title.textContent = quiz.title;
      const meta = document.createElement('span');

      const metaParts = [];
      metaParts.push(`${quiz.questions.length} question${quiz.questions.length === 1 ? '' : 's'}`);
      metaParts.push(formatTimestamp(quiz.createdAt));

      if (quiz.courseId) {
        const courseName = getCourseName(quiz.courseId);
        metaParts.push(`Course: ${courseName || 'Archived'}`);
      }

      if (quiz.generator === 'ai') {
        metaParts.push(`AI · ${getProviderLabel(quiz.provider)}`);
      } else if (quiz.generator === 'heuristic') {
        metaParts.push('Local');
      }

      meta.textContent = metaParts.join(' • ');
      info.appendChild(title);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'quiz__saved-item-actions';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'secondary small';
      openBtn.dataset.action = 'open';
      openBtn.dataset.quizId = quiz.id;
      openBtn.textContent = 'Open';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'small';
      deleteBtn.dataset.action = 'delete';
      deleteBtn.dataset.quizId = quiz.id;
      deleteBtn.textContent = 'Remove';

      actions.appendChild(openBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(info);
      item.appendChild(actions);
      savedQuizzesList.appendChild(item);
    });
  }

  function loadQuizzes() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.quizzes);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((quiz) => quiz && Array.isArray(quiz.questions));
    } catch (err) {
      console.warn('Unable to load saved quizzes', err);
      return [];
    }
  }

  function persistQuizzes() {
    try {
      window.localStorage.setItem(STORAGE_KEYS.quizzes, JSON.stringify(quizzes));
    } catch (err) {
      console.warn('Unable to persist quizzes', err);
    }
  }

  function initializeBreakGames() {
    if (gamesController) return;
    gamesController = createBreakGamesController({
      availabilityEl: gamesAvailability,
      adventure: {
        storyEl: adventureStoryEl,
        statsEl: adventureStatsEl,
        choicesEl: adventureChoicesEl,
        logEl: adventureLogEl,
        restartBtn: adventureRestartBtn,
        statusEl: adventureStatusEl,
      },
    });
    updateGamesAvailability();
  }

  function updateGamesAvailability() {
    if (!gamesController) return;
    gamesController.updateAvailability();
  }

  function createBreakGamesController(config) {
    const adventure = createRefractionRelayGame(config.adventure || {});
    const availabilityEl = config.availabilityEl || null;
    let wasPlayable = false;

    function updateAvailability() {
      const breakModeActive = BREAK_MODES.has(currentMode);
      if (!breakModeActive && wasPlayable) {
        adventure.forceStop();
      }

      adventure.setPlayable(breakModeActive);

      if (availabilityEl) {
        if (breakModeActive) {
          availabilityEl.textContent = isRunning
            ? 'Break window open. Guide the lightship until focus resumes.'
            : 'Break mode active. Chart the relay before you dive back into work.';
        } else if (wasPlayable) {
          availabilityEl.textContent = 'Focus mode resumed. The relay ship drifts in standby, progress saved.';
        } else {
          availabilityEl.textContent = 'Focus mode active. Complete a focus session to relaunch the relay.';
        }
      }

      wasPlayable = breakModeActive;
    }

    return {
      updateAvailability,
      forceStopAll() {
        adventure.forceStop();
      },
    };
  }



  function createRefractionRelayGame(elements) {
    const { storyEl, statsEl, choicesEl, logEl, restartBtn, statusEl } = elements;
    if (!storyEl || !statsEl || !choicesEl || !logEl) {
      return { setPlayable() {}, forceStop() {} };
    }

    const STORAGE_KEY = 'pomodoro.adventureState';
    const MAX_TRACK = 5;
    const MAX_LOG_ENTRIES = 12;

    const state = loadState() || createDefaultState();
    let canPlay = false;

    render();

    return {
      setPlayable(nextPlayable) {
        const wasPlayable = canPlay;
        canPlay = Boolean(nextPlayable);
        if (!canPlay && wasPlayable) {
          persistState();
        }
        render();
      },
      forceStop() {
        persistState();
        render();
      },
    };

    function createDefaultState() {
      return {
        cycle: 1,
        energy: 3,
        hull: 4,
        signals: 0,
        alloys: 0,
        storyStage: 0,
        modules: [],
        location: 'relay',
        pendingEvent: null,
        log: [],
        lastAction: '',
      };
    }

    function loadState() {
      try {
        if (!window.localStorage) return null;
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;

        const log = Array.isArray(parsed.log)
          ? parsed.log
              .slice(-MAX_LOG_ENTRIES)
              .map((entry) => {
                if (!entry || typeof entry.text !== 'string') return null;
                return {
                  id:
                    entry.id ||
                    `log-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                  cycle: Number.isFinite(entry.cycle)
                    ? entry.cycle
                    : Number.isFinite(entry.day)
                      ? entry.day
                      : 1,
                  text: entry.text,
                };
              })
              .filter(Boolean)
          : [];

        const restored = {
          cycle: readNumber(parsed.cycle, parsed.day, 1),
          energy: clamp(readNumber(parsed.energy, parsed.fire, 3), 0, MAX_TRACK),
          hull: clamp(readNumber(parsed.hull, parsed.health, 4), 0, MAX_TRACK),
          signals: Math.max(0, Math.round(readNumber(parsed.signals, 0, 0))),
          alloys: Math.max(0, Math.round(readNumber(parsed.alloys, parsed.wood, 0))),
          storyStage: clamp(readNumber(parsed.storyStage, parsed.questStage, 0), 0, 3),
          modules: Array.isArray(parsed.modules)
            ? parsed.modules.filter((module) => typeof module === 'string')
            : [],
          location: 'relay',
          pendingEvent: null,
          log,
          lastAction: typeof parsed.lastAction === 'string' ? parsed.lastAction : '',
        };

        if (restored.storyStage > 3) restored.storyStage = 3;
        return restored;
      } catch (error) {
        console.warn('Unable to load relay state', error);
        return null;
      }
    }

    function readNumber(primary, fallback, defaultValue) {
      if (Number.isFinite(primary)) return primary;
      if (Number.isFinite(fallback)) return fallback;
      return defaultValue;
    }

    function persistState() {
      try {
        if (!window.localStorage) return;
        const payload = {
          cycle: state.cycle,
          energy: state.energy,
          hull: state.hull,
          signals: state.signals,
          alloys: state.alloys,
          storyStage: state.storyStage,
          modules: state.modules,
          log: state.log,
          lastAction: state.lastAction,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        console.warn('Unable to persist relay state', error);
      }
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(Math.round(value), min), max);
    }

    function logEntry(text) {
      const entry = {
        id: `log-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        cycle: state.cycle,
        text,
      };
      state.log.push(entry);
      if (state.log.length > MAX_LOG_ENTRIES) {
        state.log.splice(0, state.log.length - MAX_LOG_ENTRIES);
      }
    }

    function advanceCycle() {
      state.cycle += 1;
    }

    function handleAction(actionId) {
      if (!canPlay) return;

      switch (actionId) {
        case 'charge-core':
          advanceCycle();
          if (state.energy >= MAX_TRACK) {
            logEntry('The resonance array already hums at full capacity.');
            break;
          }
          state.energy = Math.min(MAX_TRACK, state.energy + 1);
          logEntry('You divert spare current into the resonance array.');
          break;

        case 'patch-hull':
          advanceCycle();
          if (state.alloys <= 0) {
            logEntry('No composite alloys remain to patch the hull.');
            break;
          }
          if (state.hull >= MAX_TRACK) {
            logEntry('Hull integrity is already stable.');
            break;
          }
          state.alloys -= 1;
          state.hull = Math.min(MAX_TRACK, state.hull + 1);
          logEntry('You weld fresh plating into place and steady the hull.');
          break;

        case 'listen-echoes':
          advanceCycle();
          if (state.energy <= 0) {
            logEntry('The array needs power before it can listen for echoes.');
            break;
          }
          state.energy = Math.max(0, state.energy - 1);
          {
            const gained = 1 + Math.floor(Math.random() * 2);
            state.signals += gained;
            logEntry(`The array captures ${gained} signal packet${gained === 1 ? '' : 's'}.`);
          }
          break;

        case 'salvage-drift':
          advanceCycle();
          if (state.energy <= 0) {
            logEntry('Without spare energy the salvage drones refuse to launch.');
            break;
          }
          state.energy = Math.max(0, state.energy - 1);
          {
            const haul = 1 + Math.floor(Math.random() * 2);
            state.alloys += haul;
            logEntry(`Salvage drones return with ${haul} alloy fragment${haul === 1 ? '' : 's'}.`);
            if (Math.random() < 0.3) {
              state.hull = Math.max(0, state.hull - 1);
              logEntry('Debris clips the hull on re-entry, scarring the plating.');
            }
          }
          break;

        case 'assemble-resonator':
          advanceCycle();
          if (state.storyStage !== 0 || !canAssembleResonator()) {
            logEntry('You still need more resources before the resonator will hum.');
            break;
          }
          state.signals -= 3;
          state.alloys -= 2;
          if (!state.modules.includes('Harmonic Resonator')) state.modules.push('Harmonic Resonator');
          state.storyStage = 1;
          logEntry('The harmonic resonator spins up, stabilising the relay core.');
          break;

        case 'deploy-array':
          advanceCycle();
          if (state.storyStage !== 1 || !canDeployArray()) {
            logEntry('The beacon array components are not ready yet.');
            break;
          }
          state.signals -= 5;
          state.alloys -= 3;
          state.energy = Math.max(0, state.energy - 1);
          if (!state.modules.includes('Beacon Array')) state.modules.push('Beacon Array');
          state.storyStage = 2;
          logEntry('You deploy a spinning beacon array that paints the void with light.');
          break;

        case 'send-distress':
          advanceCycle();
          if (state.storyStage !== 2 || !canSendDistress()) {
            logEntry('The distress burst requires more stored signal and stability.');
            break;
          }
          state.energy = Math.max(0, state.energy - 3);
          state.signals = Math.max(0, state.signals - 8);
          state.storyStage = 3;
          logEntry('A focused distress signal arcs across the dark. Now you wait for an answer.');
          break;

        default:
          break;
      }

      state.lastAction = actionId;
      persistState();
      render();
    }

    function canAssembleResonator() {
      return state.signals >= 3 && state.alloys >= 2;
    }

    function canDeployArray() {
      return state.signals >= 5 && state.alloys >= 3 && state.energy >= 2;
    }

    function canSendDistress() {
      return state.signals >= 8 && state.energy >= 3 && state.hull >= 3;
    }

    function currentObjective() {
      if (state.storyStage === 0) {
        return 'Objective: Assemble the harmonic resonator (3 signals, 2 alloys).';
      }
      if (state.storyStage === 1) {
        return 'Objective: Deploy the beacon array (5 signals, 3 alloys, 2 energy).';
      }
      if (state.storyStage === 2) {
        return 'Objective: Gather 8 signals and steady the hull to send a distress burst.';
      }
      return 'Distress signal dispatched. Monitor the relay while you await a reply.';
    }

    function render() {
      renderStory();
      renderStats();
      renderChoices();
      renderLog();
      updateStatus();
    }

    function renderStory() {
      let description = '';
      if (state.storyStage === 0) {
        description = 'The relay drifts half-awake. Pieces of the harmonic resonator lie scattered within reach.';
      } else if (state.storyStage === 1) {
        description = 'The resonator pulses steadily. You sketch plans for a beacon array that could pierce the void.';
      } else if (state.storyStage === 2) {
        description = 'Light floods the relay. One focused burst could reach the nearest listening post.';
      } else {
        description = 'Silence follows your distress call. Every sensor waits for the faintest reply.';
      }
      storyEl.textContent = description;
    }

    function renderStats() {
      const modules = state.modules.length ? state.modules.join(', ') : 'None';
      statsEl.innerHTML = `
        <ul class="adventure-stats__list">
          <li><strong>Cycle</strong> ${state.cycle}</li>
          <li><strong>Energy</strong> ${state.energy}/${MAX_TRACK}</li>
          <li><strong>Hull</strong> ${state.hull}/${MAX_TRACK}</li>
          <li><strong>Signals</strong> ${state.signals}</li>
          <li><strong>Alloys</strong> ${state.alloys}</li>
        </ul>
        <p class="adventure-stats__discoveries"><strong>Modules:</strong> ${modules}</p>
      `;
    }

    function renderChoices() {
      const actions = [
        { id: 'charge-core', label: 'Charge array', disabled: state.energy >= MAX_TRACK },
        { id: 'patch-hull', label: 'Patch hull plating', disabled: state.alloys <= 0 || state.hull >= MAX_TRACK },
        { id: 'listen-echoes', label: 'Listen for echoes', disabled: state.energy <= 0 },
        { id: 'salvage-drift', label: 'Salvage the drift', disabled: state.energy <= 0 },
      ];

      if (state.storyStage === 0) {
        actions.push({ id: 'assemble-resonator', label: 'Assemble resonator', disabled: !canAssembleResonator() });
      } else if (state.storyStage === 1) {
        actions.push({ id: 'deploy-array', label: 'Deploy beacon array', disabled: !canDeployArray() });
      } else if (state.storyStage === 2) {
        actions.push({ id: 'send-distress', label: 'Send distress burst', disabled: !canSendDistress() });
      }

      choicesEl.innerHTML = '';
      actions.forEach((action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'adventure-choice';
        button.textContent = action.label;
        button.disabled = !canPlay || Boolean(action.disabled);
        button.addEventListener('click', () => handleAction(action.id));
        choicesEl.appendChild(button);
      });
    }

    function renderLog() {
      logEl.innerHTML = '';
      if (!state.log.length) {
        const empty = document.createElement('p');
        empty.className = 'adventure-log__empty';
        empty.textContent = 'No transmissions logged yet. Take a step to wake the relay.';
        logEl.appendChild(empty);
        return;
      }

      state.log
        .slice()
        .reverse()
        .forEach((entry) => {
          const item = document.createElement('div');
          item.className = 'adventure-log__entry';
          item.innerHTML = `<span class="adventure-log__label">Cycle ${entry.cycle}</span><p>${entry.text}</p>`;
          logEl.appendChild(item);
        });
    }

    function updateStatus() {
      if (!statusEl) return;
      statusEl.textContent = canPlay
        ? currentObjective()
        : 'Focus resumed. The relay ship drifts in standby and retains its state.';
    }

    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        const confirmed = window.confirm('Reboot the relay ship and purge all logged cycles?');
        if (!confirmed) return;
        const fresh = createDefaultState();
        state.cycle = fresh.cycle;
        state.energy = fresh.energy;
        state.hull = fresh.hull;
        state.signals = fresh.signals;
        state.alloys = fresh.alloys;
        state.storyStage = fresh.storyStage;
        state.modules = [];
        state.log = [];
        state.lastAction = '';
        logEntry('Systems scrubbed. The relay thrums softly, awaiting new directives.');
        persistState();
        render();
      });
    }
  }
  function updateQuizFeedback(message, tone = 'default') {
    if (!quizFeedback) return;
    quizFeedback.textContent = message;
    quizFeedback.classList.remove('quiz__feedback--success', 'quiz__feedback--error');
    if (tone === 'success') {
      quizFeedback.classList.add('quiz__feedback--success');
    } else if (tone === 'error') {
      quizFeedback.classList.add('quiz__feedback--error');
    }
  }

  function formatTimestamp(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  function createQuizId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `quiz-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function createQuestionId(baseId, index) {
    return `question-${baseId}-${index}-${Math.random().toString(16).slice(2, 6)}`;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function capitalize(value) {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function prettifyWord(word) {
    return capitalize(word.replace(/[-_]/g, ' '));
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function normalizeText(value) {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenizeSentence(sentence) {
    return tokenizeNormalized(normalizeText(sentence));
  }

  function tokenizeNormalized(normalized) {
    if (!normalized) return [];
    return normalized.split(' ').filter(Boolean);
  }

  function clamp(value, min, max) {
    const numericMin = Number(min);
    const numericMax = Number(max);
    if (Number.isNaN(value)) return numericMin;
    return Math.min(Math.max(value, numericMin), numericMax);
  }

  updateModeButtons();
  updateTimerDisplay();
})();
