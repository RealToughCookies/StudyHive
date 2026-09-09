import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { Save, User, Palette, Bell, Key, Crown, Timer, Moon, Sun, Keyboard } from 'lucide-react'
import { ShortcutConfig, KeyboardShortcut, DEFAULT_SHORTCUTS } from '../../types'

const SettingsPanel = () => {
  const { currentUser, settings, setSettings, applyTheme, applyDarkMode } = useStore()

  const [theme, setThemeState] = useState(settings?.theme || 'blue')
  const [darkMode, setDarkModeState] = useState(settings?.dark_mode ?? false)

  // Apply theme immediately when changed
  const setTheme = (newTheme: 'blue' | 'green' | 'purple' | 'amber' | 'rose') => {
    setThemeState(newTheme)
    applyTheme(newTheme)
  }

  // Apply dark mode immediately when toggled
  const setDarkMode = (enabled: boolean) => {
    setDarkModeState(enabled)
    applyDarkMode(enabled)
  }
  const [notificationSound, setNotificationSound] = useState(settings?.notification_sound ?? true)
  const [timerSound, setTimerSound] = useState(settings?.timer_sound ?? true)
  const [pauseOnBlur, setPauseOnBlur] = useState(Boolean(settings?.pause_on_blur))
  const [autoResumeOnFocus, setAutoResumeOnFocus] = useState(settings?.auto_resume_on_focus ?? false)
  const [rememberApiKey, setRememberApiKey] = useState(settings?.remember_api_key ?? Boolean(settings?.openai_api_key))
  const [apiKey, setApiKey] = useState(settings?.openai_api_key || '')
  const [saving, setSaving] = useState(false)

  // Shortcuts
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>(() => {
    if (settings?.shortcuts) {
      try {
        return JSON.parse(settings.shortcuts)
      } catch {
        return DEFAULT_SHORTCUTS
      }
    }
    return DEFAULT_SHORTCUTS
  })
  const [recordingFor, setRecordingFor] = useState<keyof ShortcutConfig | null>(null)
  const recordingRef = useRef<HTMLButtonElement>(null)

  // Handle shortcut recording
  useEffect(() => {
    if (!recordingFor) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()

      // Escape cancels recording
      if (e.key === 'Escape') {
        setRecordingFor(null)
        return
      }

      // Ignore modifier-only presses
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return
      }

      const newShortcut: KeyboardShortcut = {
        key: e.key.toLowerCase(),
        modifiers: {
          ctrl: e.ctrlKey || e.metaKey,
          alt: e.altKey,
          shift: e.shiftKey,
        }
      }

      setShortcuts(prev => ({
        ...prev,
        [recordingFor]: newShortcut
      }))
      setRecordingFor(null)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recordingFor])

  const formatShortcut = (shortcut: KeyboardShortcut | null): string => {
    if (!shortcut) return 'Not set'

    const parts: string[] = []
    if (shortcut.modifiers.ctrl) parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
    if (shortcut.modifiers.alt) parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt')
    if (shortcut.modifiers.shift) parts.push('⇧')

    // Format key nicely
    let key = shortcut.key
    if (key === ',') key = ','
    else if (key === ' ') key = 'Space'
    else if (key.length === 1) key = key.toUpperCase()
    parts.push(key)

    return parts.join(' + ')
  }

  const clearShortcut = (action: keyof ShortcutConfig) => {
    setShortcuts(prev => ({
      ...prev,
      [action]: null
    }))
  }

  const resetShortcuts = () => {
    setShortcuts(DEFAULT_SHORTCUTS)
  }

  const shortcutLabels: Record<keyof ShortcutConfig, string> = {
    dashboard: 'Dashboard',
    classes: 'Classes',
    timer: 'Pomodoro Timer',
    notes: 'Notes',
    stickynotes: 'Sticky Notes',
    flashcards: 'Flashcards',
    quiz: 'Quizzes',
    review: 'Review History',
    settings: 'Settings',
    focusMode: 'Focus Mode',
  }

  const saveSettings = async () => {
    if (!currentUser) return

    setSaving(true)
    try {
      const shortcutsJson = JSON.stringify(shortcuts)

      await window.electronAPI.db.run(
        `UPDATE settings
         SET theme = ?, dark_mode = ?, notification_sound = ?, timer_sound = ?,
             pause_on_blur = ?, auto_resume_on_focus = ?, openai_api_key = ?, shortcuts = ?
         WHERE user_id = ?`,
        [theme, darkMode ? 1 : 0, notificationSound ? 1 : 0,
         timerSound ? 1 : 0, pauseOnBlur ? 1 : 0, autoResumeOnFocus ? 1 : 0, rememberApiKey ? apiKey.trim() : null, shortcutsJson, currentUser.id]
      )

      const updatedSettings = await window.electronAPI.db.get(
        'SELECT * FROM settings WHERE user_id = ?',
        [currentUser.id]
      )

      if (useStore.getState().currentUser?.id !== currentUser.id) return
      setSettings({ ...updatedSettings, openai_api_key: apiKey.trim(), remember_api_key: rememberApiKey })
      alert('Settings saved successfully!')
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const themeOptions = [
    { value: 'blue', label: 'Ocean Blue', color: 'bg-blue-500' },
    { value: 'green', label: 'Forest Green', color: 'bg-green-500' },
    { value: 'purple', label: 'Royal Purple', color: 'bg-purple-500' },
    { value: 'amber', label: 'Golden Amber', color: 'bg-amber-500' },
    { value: 'rose', label: 'Rose Pink', color: 'bg-rose-500' },
  ]

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Customize your StudyHive experience</p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-gray-900">Profile</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={currentUser?.username || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Crown className="w-5 h-5 text-amber-600" />
                <span className="text-sm text-amber-800 capitalize font-medium">
                  {currentUser?.subscription_tier || 'free'} Plan
                </span>
              </div>
            </div>
          </div>

          {/* Theme Settings */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-3 mb-6">
              <Palette className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-gray-900">Appearance</h2>
            </div>

            {/* Dark Mode Toggle */}
            <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {darkMode ? (
                    <Moon className="w-5 h-5 text-indigo-500" />
                  ) : (
                    <Sun className="w-5 h-5 text-amber-500" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">Dark Mode</p>
                    <p className="text-sm text-gray-500">Switch between light and dark appearance</p>
                  </div>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    darkMode ? 'bg-indigo-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                      darkMode ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Color Theme */}
            <p className="text-sm font-medium text-gray-700 mb-3">Color Theme</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value as any)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    theme === option.value
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${option.color} mx-auto mb-2 shadow-md`} />
                  <p className="text-xs font-medium text-gray-900">{option.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Timer Options */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-3 mb-6">
              <Timer className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-gray-900">Timer Options</h2>
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timerSound}
                  onChange={(e) => setTimerSound(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-gray-900">Timer completion sound</span>
                  <p className="text-xs text-gray-500">Play a chime when timer completes</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pauseOnBlur}
                  onChange={(e) => setPauseOnBlur(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-gray-900">Pause when app loses focus</span>
                  <p className="text-xs text-gray-500">Automatically pause the timer when you switch to another app</p>
                </div>
              </label>

              {pauseOnBlur && (
                <label className="flex items-center gap-3 cursor-pointer ml-8">
                  <input
                    type="checkbox"
                    checked={autoResumeOnFocus}
                    onChange={(e) => setAutoResumeOnFocus(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-gray-900">Auto-resume on focus</span>
                    <p className="text-xs text-gray-500">Automatically resume the timer when you return to the app</p>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSound}
                onChange={(e) => setNotificationSound(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-gray-900">Enable desktop notifications</span>
            </label>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Keyboard className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold text-gray-900">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={resetShortcuts}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Reset to defaults
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Click on a shortcut to change it. Press Escape to cancel.
            </p>
            <div className="space-y-2">
              {(Object.keys(shortcuts) as Array<keyof ShortcutConfig>).map((action) => (
                <div
                  key={action}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                >
                  <span className="text-gray-900">{shortcutLabels[action]}</span>
                  <div className="flex items-center gap-2">
                    <button
                      ref={recordingFor === action ? recordingRef : null}
                      onClick={() => setRecordingFor(action)}
                      className={`px-3 py-1.5 rounded-lg font-mono text-sm min-w-[100px] text-center transition-colors ${
                        recordingFor === action
                          ? 'bg-primary text-white animate-pulse'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {recordingFor === action ? 'Press keys...' : formatShortcut(shortcuts[action])}
                    </button>
                    {shortcuts[action] && (
                      <button
                        onClick={() => clearShortcut(action)}
                        className="text-gray-400 hover:text-red-500 text-sm"
                        title="Clear shortcut"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* OpenAI API Key */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-3 mb-6">
              <Key className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-gray-900">OpenAI API Key</h2>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key (for AI features)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <label className="flex items-center gap-2 mt-3 text-sm text-gray-700">
                <input type="checkbox" checked={rememberApiKey} onChange={e => setRememberApiKey(e.target.checked)} />
                Remember this key on this browser
              </label>
              <p className="text-xs text-gray-500 mt-2">
                By default, your key is kept until you log out or reload. Remembering it stores it
                unencrypted on this browser. AI generation sends the selected note to OpenAI.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Required for AI-powered flashcards, quizzes, and study guides.{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Get your API key here
                </a>
              </p>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary-dark text-white px-6 py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
