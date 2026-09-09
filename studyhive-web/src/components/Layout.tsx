import { useEffect, useState, useMemo } from 'react'
import { useStore } from '../store'
import {
  Home,
  Timer,
  FileText,
  Brain,
  ClipboardList,
  History,
  Settings as SettingsIcon,
  LogOut,
  Crown,
  Zap,
  GraduationCap,
  StickyNote
} from 'lucide-react'
import { ShortcutConfig, KeyboardShortcut, DEFAULT_SHORTCUTS } from '../types'
import Dashboard from './Dashboard'
import PomodoroTimer from './Timer/PomodoroTimer'
import NotesList from './Notes/NotesList'
import FlashcardsList from './Flashcards/FlashcardsList'
import QuizList from './Quiz/QuizList'
import ReviewHistory from './Review/ReviewHistory'
import SettingsPanel from './Settings/SettingsPanel'
import FocusMode from './FocusMode'
import ClassManager from './Classes/ClassManager'
import StickyNotesManager from './StickyNotes/StickyNotesManager'
import FloatingStickyNotes from './StickyNotes/FloatingStickyNotes'
import { useTimerEngine } from '../hooks/useSharedTimer'

const Layout = () => {
  const { currentPage, currentUser, settings, setCurrentPage, logout, timer } = useStore()
  const [isFocusMode, setIsFocusMode] = useState(false)

  // Keep the timer running globally, even when not on the timer page
  useTimerEngine()

  // Parse shortcuts from settings
  const shortcuts: ShortcutConfig = useMemo(() => {
    if (settings?.shortcuts) {
      try {
        return JSON.parse(settings.shortcuts)
      } catch {
        return DEFAULT_SHORTCUTS
      }
    }
    return DEFAULT_SHORTCUTS
  }, [settings?.shortcuts])

  // Format time for display on nav item
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Check if a keyboard event matches a shortcut
  const matchesShortcut = (e: KeyboardEvent, shortcut: KeyboardShortcut | null): boolean => {
    if (!shortcut) return false

    const ctrlMatch = shortcut.modifiers.ctrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey)
    const altMatch = shortcut.modifiers.alt ? e.altKey : !e.altKey
    const shiftMatch = shortcut.modifiers.shift ? e.shiftKey : !e.shiftKey
    const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

    return ctrlMatch && altMatch && shiftMatch && keyMatch
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false)
        return
      }
      // Ignore if typing in input/textarea/contentEditable
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (e.target instanceof HTMLElement && e.target.isContentEditable) {
        return
      }

      // Check against configured shortcuts
      const shortcutActions: Array<{ action: keyof ShortcutConfig; handler: () => void }> = [
        { action: 'dashboard', handler: () => setCurrentPage('dashboard') },
        { action: 'classes', handler: () => setCurrentPage('classes') },
        { action: 'timer', handler: () => setCurrentPage('timer') },
        { action: 'notes', handler: () => setCurrentPage('notes') },
        { action: 'stickynotes', handler: () => setCurrentPage('stickynotes') },
        { action: 'flashcards', handler: () => setCurrentPage('flashcards') },
        { action: 'quiz', handler: () => setCurrentPage('quiz') },
        { action: 'review', handler: () => setCurrentPage('review') },
        { action: 'settings', handler: () => setCurrentPage('settings') },
        { action: 'focusMode', handler: () => setIsFocusMode(true) },
      ]

      for (const { action, handler } of shortcutActions) {
        if (matchesShortcut(e, shortcuts[action])) {
          e.preventDefault()
          handler()
          return
        }
      }

    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCurrentPage, isFocusMode, shortcuts])

  // Render Focus Mode if active
  if (isFocusMode) {
    return <FocusMode onExit={() => setIsFocusMode(false)} />
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'classes', label: 'Classes', icon: GraduationCap },
    { id: 'timer', label: 'Pomodoro', icon: Timer },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'stickynotes', label: 'Sticky Notes', icon: StickyNote },
    { id: 'flashcards', label: 'Flashcards', icon: Brain },
    { id: 'quiz', label: 'Quizzes', icon: ClipboardList, premium: true },
    { id: 'review', label: 'Review', icon: History },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ]

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'classes':
        return <ClassManager />
      case 'timer':
        return <PomodoroTimer />
      case 'notes':
        return <NotesList />
      case 'stickynotes':
        return <StickyNotesManager />
      case 'flashcards':
        return <FlashcardsList />
      case 'quiz':
        return <QuizList />
      case 'review':
        return <ReviewHistory />
      case 'settings':
        return <SettingsPanel />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-72 sidebar flex flex-col shadow-xl">
        {/* Draggable area for Mac window controls (traffic lights) */}

        {/* Logo */}
        <div className="px-6 pt-4 pb-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden shadow-lg bg-amber-50 dark-mode-logo">
              <img
                src="./assets/StudyHiveLogo.png"
                alt="StudyHive"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">StudyHive</h1>
              <p className="text-xs text-gray-500 font-medium">Study Smarter</p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="p-4 mx-4 mt-4 rounded-2xl bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-lg shadow-md">
              {currentUser?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {currentUser?.username || 'User'}
              </p>
              <div className="flex items-center space-x-1">
                {currentUser?.subscription_tier === 'premium' ? (
                  <>
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-amber-600">Premium</span>
                  </>
                ) : (
                  <span className="text-xs font-medium text-gray-500">Free Plan</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            const isTimerTab = item.id === 'timer'
            const showTimerCountdown = isTimerTab && !isActive && (timer.isRunning || timer.timeLeft < (settings?.pomodoro_work_minutes || 25) * 60)

            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`
                  sidebar-nav-item w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl
                  transition-all duration-200 group
                  ${isActive
                    ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25'
                    : showTimerCountdown
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 ${!isActive && 'group-hover:scale-110'} ${showTimerCountdown && timer.isRunning ? 'animate-pulse' : ''}`} />
                <span className="font-medium">{item.label}</span>
                {(item as any).premium && (
                  <Crown className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-amber-500'}`} />
                )}
                {isActive && !(item as any).premium && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-white/50" />
                )}
                {showTimerCountdown && (
                  <span className="ml-auto font-mono text-sm font-bold text-primary">
                    {formatTime(timer.timeLeft)}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Focus Mode & Logout */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={() => setIsFocusMode(true)}
            className="w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 hover:from-amber-100 hover:to-orange-100 transition-all duration-200 border border-amber-200/50 group"
            title="Focus Mode (Press F)"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">Focus Mode</span>
            <kbd className="ml-auto text-xs font-mono bg-amber-200/50 px-2 py-0.5 rounded text-amber-800">F</kbd>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
          >
            <LogOut className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Draggable title bar area */}
        <div className="flex-1 overflow-y-auto page-gradient">
          {renderContent()}
        </div>
      </div>

      {/* Floating Sticky Notes */}
      <FloatingStickyNotes />
    </div>
  )
}

export default Layout
