import { localDateKey } from '../../services/dates'
import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { useSharedTimer } from '../../hooks/useSharedTimer'
import { Play, Pause, RotateCcw, Coffee, Brain, TrendingUp, Settings, Check } from 'lucide-react'

const PomodoroTimer = () => {
  const { currentUser, setSettings } = useStore()
  const {
    mode,
    timeLeft,
    isRunning,
    sessionsCompleted,
    workMinutes,
    shortBreakMinutes,
    longBreakMinutes,
    switchMode,
    toggleTimer,
    resetTimer,
    formatTime,
    getProgress,
    getModeColor,
  } = useSharedTimer()

  const [todayStats, setTodayStats] = useState({ sessions: 0, minutes: 0 })
  const [showSettings, setShowSettings] = useState(false)
  const [workMins, setWorkMins] = useState(workMinutes)
  const [shortBreakMins, setShortBreakMins] = useState(shortBreakMinutes)
  const [longBreakMins, setLongBreakMins] = useState(longBreakMinutes)
  const [saving, setSaving] = useState(false)

  // Sync local state with settings
  useEffect(() => {
    setWorkMins(workMinutes)
    setShortBreakMins(shortBreakMinutes)
    setLongBreakMins(longBreakMinutes)
  }, [workMinutes, shortBreakMinutes, longBreakMinutes])

  const saveTimerSettings = async () => {
    if (!currentUser) return
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `UPDATE settings SET pomodoro_work_minutes = ?, pomodoro_break_minutes = ?, pomodoro_long_break_minutes = ? WHERE user_id = ?`,
        [workMins, shortBreakMins, longBreakMins, currentUser.id]
      )
      const updatedSettings = await window.electronAPI.db.get(
        'SELECT * FROM settings WHERE user_id = ?',
        [currentUser.id]
      )
      if (useStore.getState().currentUser?.id !== currentUser.id) return
      setSettings({ ...updatedSettings,
        openai_api_key: useStore.getState().settings?.openai_api_key,
        remember_api_key: useStore.getState().settings?.remember_api_key,
      })
      setShowSettings(false)
      // Reset timer to apply new duration
      resetTimer()
    } catch (error) {
      console.error('Failed to save timer settings:', error)
    } finally {
      setSaving(false)
    }
  }

  // Load today's stats on mount
  useEffect(() => {
    loadTodayStats()
  }, [currentUser, sessionsCompleted])

  const loadTodayStats = async () => {
    if (!currentUser) return

    try {
      const today = localDateKey()
      const sessions = await window.electronAPI.db.query(
        `SELECT COUNT(*) as count, SUM(duration_minutes) as total_minutes
         FROM pomodoro_sessions
         WHERE user_id = ? AND completed = 1 AND DATE(completed_at, 'localtime') = ?`,
        [currentUser.id, today]
      )

      if (sessions && sessions.length > 0) {
        setTodayStats({
          sessions: sessions[0].count || 0,
          minutes: sessions[0].total_minutes || 0
        })
      }
    } catch (error) {
      console.error('Failed to load today stats:', error)
    }
  }

  const getModeIcon = () => {
    switch (mode) {
      case 'work': return Brain
      case 'shortBreak': return Coffee
      case 'longBreak': return Coffee
    }
  }

  const ModeIcon = getModeIcon()

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pomodoro Timer</h1>
          <p className="text-gray-600">Stay focused with timed work sessions</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Today's Sessions</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{todayStats.sessions}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Minutes Focused</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{todayStats.minutes}</p>
              </div>
              <Brain className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Current Streak</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{sessionsCompleted}</p>
              </div>
              <Coffee className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Timer Display */}
        <div className="bg-white p-12 rounded-2xl shadow-lg mb-6 relative">
          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
              showSettings ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Timer Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Timer Durations</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Work (minutes)
                  </label>
                  <input
                    type="number"
                    value={workMins}
                    onChange={(e) => setWorkMins(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                    min="1"
                    max="60"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Short Break (minutes)
                  </label>
                  <input
                    type="number"
                    value={shortBreakMins}
                    onChange={(e) => setShortBreakMins(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                    min="1"
                    max="30"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Long Break (minutes)
                  </label>
                  <input
                    type="number"
                    value={longBreakMins}
                    onChange={(e) => setLongBreakMins(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                    min="1"
                    max="60"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={saveTimerSettings}
                  disabled={saving}
                  className="bg-primary text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save & Apply'}
                </button>
              </div>
            </div>
          )}

          {/* Mode Selector */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={() => switchMode('work')}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                mode === 'work'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Work
            </button>
            <button
              onClick={() => switchMode('shortBreak')}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                mode === 'shortBreak'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Short Break
            </button>
            <button
              onClick={() => switchMode('longBreak')}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                mode === 'longBreak'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Long Break
            </button>
          </div>

          {/* Circular Progress */}
          <div className="relative w-80 h-80 mx-auto mb-8">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="160"
                cy="160"
                r="140"
                stroke="#e5e7eb"
                strokeWidth="20"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="160"
                cy="160"
                r="140"
                stroke="currentColor"
                strokeWidth="20"
                fill="none"
                className={getModeColor().replace('bg-', 'text-')}
                strokeDasharray={`${2 * Math.PI * 140}`}
                strokeDashoffset={`${2 * Math.PI * 140 * (1 - getProgress() / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>

            {/* Timer display in center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <ModeIcon className={`w-12 h-12 mb-4 ${getModeColor().replace('bg-', 'text-')}`} />
              <div className="text-7xl font-bold text-gray-900">
                {formatTime(timeLeft)}
              </div>
              <p className="text-gray-600 mt-2 capitalize">{mode.replace(/([A-Z])/g, ' $1')}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4">
            <button
              onClick={toggleTimer}
              className={`${getModeColor()} text-white px-8 py-4 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-5 h-5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Start
                </>
              )}
            </button>

            <button
              onClick={resetTimer}
              className="bg-gray-200 text-gray-700 px-8 py-4 rounded-lg font-semibold flex items-center gap-2 hover:bg-gray-300 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-primary/10 border border-primary/20 p-6 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-2">Pomodoro Tips</h3>
          <ul className="text-gray-700 space-y-1 text-sm">
            <li>• Focus on one task during each work session</li>
            <li>• Take breaks seriously - step away from your desk</li>
            <li>• After 4 work sessions, take a longer break</li>
            <li>• Click the gear icon above to customize timer durations</li>
            <li>• The timer continues when you navigate to other pages!</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default PomodoroTimer
