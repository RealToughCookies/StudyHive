// User types
export interface User {
  id: number
  username: string
  email: string
  subscription_tier: 'free' | 'premium'
  subscription_expires_at?: string
  created_at: string
}

// Class types
export interface Class {
  id: number
  user_id: number
  name: string
  color: string
  created_at: string
}

// Note types
export interface Note {
  id: number
  user_id: number
  class_id?: number
  title: string
  content: string
  created_at: string
  updated_at: string
}

// Note attachment types
export interface NoteAttachment {
  id: number
  note_id: number
  user_id: number
  filename: string
  original_name: string
  file_type: string
  file_size: number
  created_at: string
}

// Sticky note types
export interface StickyNote {
  id: number
  user_id: number
  content: string
  position_x: number
  position_y: number
  width: number
  height: number
  color: string
  is_visible: boolean
  is_minimized: boolean
  created_at: string
  updated_at: string
}

// Flashcard deck types
export interface FlashcardDeck {
  id: number
  user_id: number
  name: string
  class_id?: number
  note_id?: number
  created_at: string
}

// Flashcard types
export interface Flashcard {
  id: number
  note_id?: number
  deck_id?: number
  class_id?: number
  user_id: number
  front: string
  back: string
  created_at: string
}

// Quiz types
export interface Quiz {
  id: number
  note_id?: number
  class_id?: number
  user_id: number
  title: string
  questions: QuizQuestion[]
  created_at: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correct: number
}

export interface QuizAttempt {
  id: number
  quiz_id: number
  user_id: number
  score: number
  total: number
  answers: number[]
  completed_at: string
}

// Pomodoro types
export interface PomodoroSession {
  id: number
  user_id: number
  duration_minutes: number
  completed: boolean
  started_at: string
  completed_at?: string
}

// Reminder types
export interface Reminder {
  id: number
  user_id: number
  title: string
  description?: string
  date: string           // YYYY-MM-DD
  time?: string          // HH:MM (optional)
  color: string          // Hex color
  priority: number       // Lower number = higher priority (for ordering)
  repeat?: 'daily' | 'weekly' | 'monthly' | null
  completed: boolean
  created_at: string
  updated_at: string
}

export const REMINDER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
]

// Keyboard shortcut types
export interface KeyboardShortcut {
  key: string           // The key (e.g., '1', 'd', ',')
  modifiers: {
    ctrl?: boolean      // Ctrl on Windows/Linux, Cmd on Mac
    alt?: boolean       // Alt/Option
    shift?: boolean
  }
}

export interface ShortcutConfig {
  dashboard: KeyboardShortcut | null
  classes: KeyboardShortcut | null
  timer: KeyboardShortcut | null
  notes: KeyboardShortcut | null
  stickynotes: KeyboardShortcut | null
  flashcards: KeyboardShortcut | null
  quiz: KeyboardShortcut | null
  review: KeyboardShortcut | null
  settings: KeyboardShortcut | null
  focusMode: KeyboardShortcut | null
}

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  dashboard: { key: '1', modifiers: {} },
  classes: { key: '2', modifiers: {} },
  timer: { key: '3', modifiers: {} },
  notes: { key: '4', modifiers: {} },
  stickynotes: { key: '5', modifiers: {} },
  flashcards: { key: '6', modifiers: {} },
  quiz: { key: '7', modifiers: {} },
  review: { key: '8', modifiers: {} },
  settings: { key: ',', modifiers: { ctrl: true } },
  focusMode: { key: 'f', modifiers: { shift: true } },
}

// Settings types
export interface Settings {
  id: number
  user_id: number
  theme: 'blue' | 'green' | 'purple' | 'amber' | 'rose'
  dark_mode: boolean
  pomodoro_work_minutes: number
  pomodoro_break_minutes: number
  pomodoro_long_break_minutes: number
  notification_sound: boolean
  timer_sound: boolean
  show_floating_timer: boolean
  pause_on_blur: boolean
  auto_resume_on_focus: boolean
  openai_api_key?: string
  remember_api_key?: boolean
  shortcuts?: string    // JSON string of ShortcutConfig
}

// Theme colors
export const THEMES = {
  blue: {
    primary: '#3b82f6',
    primaryDark: '#2563eb',
    primaryLight: '#60a5fa',
    secondary: '#1e40af',
    secondaryDark: '#1e3a8a',
    accent: '#f59e0b',
  },
  green: {
    primary: '#10b981',
    primaryDark: '#059669',
    primaryLight: '#34d399',
    secondary: '#047857',
    secondaryDark: '#065f46',
    accent: '#f59e0b',
  },
  purple: {
    primary: '#8b5cf6',
    primaryDark: '#7c3aed',
    primaryLight: '#a78bfa',
    secondary: '#6d28d9',
    secondaryDark: '#5b21b6',
    accent: '#f59e0b',
  },
  amber: {
    primary: '#f59e0b',
    primaryDark: '#d97706',
    primaryLight: '#fbbf24',
    secondary: '#b45309',
    secondaryDark: '#92400e',
    accent: '#3b82f6',
  },
  rose: {
    primary: '#f43f5e',
    primaryDark: '#e11d48',
    primaryLight: '#fb7185',
    secondary: '#be123c',
    secondaryDark: '#9f1239',
    accent: '#f59e0b',
  },
}
