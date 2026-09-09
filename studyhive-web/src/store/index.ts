import { create } from 'zustand'
import { User, Settings, THEMES } from '../types'

type TimerMode = 'work' | 'shortBreak' | 'longBreak'

interface TimerState {
  mode: TimerMode
  timeLeft: number
  isRunning: boolean
  sessionsCompleted: number
  soundEnabled: boolean
  wasPausedByBlur: boolean
}

interface FloatingTimerPosition {
  x: number
  y: number
}

interface AppState {
  // Auth state
  currentUser: User | null
  isAuthenticated: boolean

  // Settings
  settings: Settings | null

  // UI state
  currentPage: string
  floatingTimerPosition: FloatingTimerPosition

  // Timer state (shared between floating timer and timer page)
  timer: TimerState

  // Actions
  setUser: (user: User | null) => void
  setSettings: (settings: Settings) => void
  setCurrentPage: (page: string) => void
  setFloatingTimerPosition: (position: FloatingTimerPosition) => void
  logout: () => void
  applyTheme: (theme: Settings['theme']) => void
  applyDarkMode: (enabled: boolean) => void

  // Timer actions
  setTimerSoundEnabled: (enabled: boolean) => void
  setTimerMode: (mode: TimerMode) => void
  setTimeLeft: (seconds: number) => void
  setIsRunning: (running: boolean) => void
  setWasPausedByBlur: (paused: boolean) => void
  tickTimer: (elapsedSeconds?: number) => void
  incrementSessions: () => void
  resetTimer: (workMinutes: number) => void
}

const initialTimer = (): TimerState => ({
  mode: 'work', timeLeft: 25 * 60, isRunning: false,
  sessionsCompleted: 0, wasPausedByBlur: false, soundEnabled: true,
})

// Default position: top right corner (will be adjusted on mount based on window size)
const DEFAULT_FLOATING_TIMER_POSITION = { x: -1, y: 20 } // -1 signals "use window width"

export const useStore = create<AppState>((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  settings: null,
  currentPage: 'dashboard',
  floatingTimerPosition: DEFAULT_FLOATING_TIMER_POSITION,

  timer: initialTimer(),

  setUser: (user) => {
    const changingAccount = get().currentUser?.id !== user?.id
    set({ currentUser: user, isAuthenticated: !!user,
      ...(changingAccount ? { settings: null, timer: initialTimer() } : {}) })
  },

  setSettings: (settings) => {
    const previousSettings = get().settings
    settings = {
      ...settings,
      dark_mode: Boolean(settings.dark_mode),
      notification_sound: Boolean(settings.notification_sound),
      timer_sound: Boolean(settings.timer_sound),
      show_floating_timer: Boolean(settings.show_floating_timer),
      pause_on_blur: Boolean(settings.pause_on_blur),
      auto_resume_on_focus: Boolean(settings.auto_resume_on_focus),
    }
    set({ settings, ...(!previousSettings ? {
      timer: { ...initialTimer(), timeLeft: settings.pomodoro_work_minutes * 60 }
    } : {}) })
    // Apply color theme
    const colors = THEMES[settings.theme] || THEMES.blue
    document.documentElement.style.setProperty('--color-primary', colors.primary)
    document.documentElement.style.setProperty('--color-primary-dark', colors.primaryDark)
    document.documentElement.style.setProperty('--color-primary-light', colors.primaryLight)
    document.documentElement.style.setProperty('--color-secondary', colors.secondary)
    document.documentElement.style.setProperty('--color-secondary-dark', colors.secondaryDark)
    document.documentElement.style.setProperty('--color-accent', colors.accent)

    // Toggle dark mode class on body (independent of color theme)
    if (settings.dark_mode) {
      document.body.classList.add('dark-mode')
      document.body.classList.add('dark') // For Tailwind dark: variants
    } else {
      document.body.classList.remove('dark-mode')
      document.body.classList.remove('dark')
    }
  },

  setCurrentPage: (page) => set({ currentPage: page }),

  setFloatingTimerPosition: (position) => set({ floatingTimerPosition: position }),

  logout: () => {
    set({ currentUser: null, isAuthenticated: false, settings: null,
      currentPage: 'login', timer: initialTimer(), floatingTimerPosition: DEFAULT_FLOATING_TIMER_POSITION })
    get().applyTheme('blue')
    get().applyDarkMode(false)
  },

  applyTheme: (theme) => {
    const colors = THEMES[theme] || THEMES.blue
    document.documentElement.style.setProperty('--color-primary', colors.primary)
    document.documentElement.style.setProperty('--color-primary-dark', colors.primaryDark)
    document.documentElement.style.setProperty('--color-primary-light', colors.primaryLight)
    document.documentElement.style.setProperty('--color-secondary', colors.secondary)
    document.documentElement.style.setProperty('--color-secondary-dark', colors.secondaryDark)
    document.documentElement.style.setProperty('--color-accent', colors.accent)
  },

  applyDarkMode: (enabled: boolean) => {
    if (enabled) {
      document.body.classList.add('dark-mode')
      document.body.classList.add('dark') // For Tailwind dark: variants
    } else {
      document.body.classList.remove('dark-mode')
      document.body.classList.remove('dark')
    }
    // Update settings in store to keep UI in sync
    const currentSettings = get().settings
    if (currentSettings) {
      set({ settings: { ...currentSettings, dark_mode: enabled } })
    }
  },

  // Timer actions
  setTimerSoundEnabled: (enabled) => set(state => ({ timer: { ...state.timer, soundEnabled: enabled } })),
  setTimerMode: (mode) => set((state) => ({
    timer: { ...state.timer, mode }
  })),

  setTimeLeft: (seconds) => set((state) => ({
    timer: { ...state.timer, timeLeft: seconds }
  })),

  setIsRunning: (running) => set((state) => ({
    timer: { ...state.timer, isRunning: running }
  })),

  setWasPausedByBlur: (paused) => set((state) => ({
    timer: { ...state.timer, wasPausedByBlur: paused }
  })),

  tickTimer: (elapsedSeconds = 1) => set((state) => ({
    timer: { ...state.timer, timeLeft: Math.max(0, state.timer.timeLeft - elapsedSeconds) }
  })),

  incrementSessions: () => set((state) => ({
    timer: { ...state.timer, sessionsCompleted: state.timer.sessionsCompleted + 1 }
  })),

  resetTimer: (workMinutes) => set((state) => ({
    timer: {
      ...state.timer,
      timeLeft: state.timer.mode === 'work' ? workMinutes * 60 :
                state.timer.mode === 'shortBreak' ? (get().settings?.pomodoro_break_minutes || 5) * 60 :
                (get().settings?.pomodoro_long_break_minutes || 15) * 60,
      isRunning: false
    }
  })),
}))
