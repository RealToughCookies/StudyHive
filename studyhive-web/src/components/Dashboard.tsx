import { localDateKey, nextReminderDate } from '../services/dates'
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Timer, FileText, Brain, TrendingUp, Crown, Flame, Calendar as CalendarIcon } from 'lucide-react'
import UpgradeModal from './Subscription/UpgradeModal'
import Calendar from './Calendar/Calendar'
import ReminderBubbleColumn from './Calendar/ReminderBubbleColumn'
import ReminderForm from './Calendar/ReminderForm'
import { Reminder } from '../types'

const Dashboard = () => {
  const { currentUser } = useStore()
  const [stats, setStats] = useState({
    totalNotes: 0,
    totalQuizzes: 0,
    totalFlashcards: 0,
    pomodoroSessions: 0,
  })
  const [streak, setStreak] = useState({ current: 0, longest: 0 })
  const [weeklyActivity, setWeeklyActivity] = useState<{ date: string; sessions: number; minutes: number }[]>([])
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Calendar & Reminders
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(localDateKey())
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [addingForDate, setAddingForDate] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => {
      loadStats()
      loadStreak()
      loadWeeklyActivity()
      loadReminders()
    }
    refresh()
    window.addEventListener('studyhive-data-updated', refresh)
    return () => window.removeEventListener('studyhive-data-updated', refresh)
  }, [currentUser])

  const loadStats = async () => {
    if (!currentUser) return

    try {
      const notes = await window.electronAPI.db.query(
        'SELECT COUNT(*) as count FROM notes WHERE user_id = ?',
        [currentUser.id]
      )

      const quizzes = await window.electronAPI.db.query(
        'SELECT COUNT(*) as count FROM quizzes WHERE user_id = ?',
        [currentUser.id]
      )

      const flashcards = await window.electronAPI.db.query(
        'SELECT COUNT(*) as count FROM flashcards WHERE user_id = ?',
        [currentUser.id]
      )

      const sessions = await window.electronAPI.db.query(
        'SELECT COUNT(*) as count FROM pomodoro_sessions WHERE user_id = ? AND completed = 1',
        [currentUser.id]
      )

      setStats({
        totalNotes: notes[0]?.count || 0,
        totalQuizzes: quizzes[0]?.count || 0,
        totalFlashcards: flashcards[0]?.count || 0,
        pomodoroSessions: sessions[0]?.count || 0,
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const loadStreak = async () => {
    if (!currentUser) return

    try {
      // Get all unique study dates
      const studyDates = await window.electronAPI.db.query(
        `SELECT DISTINCT DATE(completed_at, 'localtime') as study_date
         FROM pomodoro_sessions
         WHERE user_id = ? AND completed = 1
         ORDER BY study_date DESC`,
        [currentUser.id]
      )

      if (!studyDates || studyDates.length === 0) {
        setStreak({ current: 0, longest: 0 })
        return
      }

      // Calculate current streak
      let currentStreak = 0
      const today = localDateKey()
      const yesterday = localDateKey(new Date(new Date().setDate(new Date().getDate() - 1)))

      const dates = studyDates.map((d: any) => d.study_date)

      // Check if studied today or yesterday to start streak
      if (dates[0] === today || dates[0] === yesterday) {
        currentStreak = 1
        let lastDate = new Date(dates[0])

        for (let i = 1; i < dates.length; i++) {
          const currentDate = new Date(dates[i])
          const diffDays = Math.round((lastDate.getTime() - currentDate.getTime()) / 86400000)

          if (diffDays === 1) {
            currentStreak++
            lastDate = currentDate
          } else {
            break
          }
        }
      }

      // Calculate longest streak
      let longestStreak = 1
      let tempStreak = 1

      for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1])
        const currentDate = new Date(dates[i])
        const diffDays = Math.round((prevDate.getTime() - currentDate.getTime()) / 86400000)

        if (diffDays === 1) {
          tempStreak++
          longestStreak = Math.max(longestStreak, tempStreak)
        } else {
          tempStreak = 1
        }
      }

      setStreak({ current: currentStreak, longest: Math.max(longestStreak, currentStreak) })
    } catch (error) {
      console.error('Failed to load streak:', error)
    }
  }

  const loadWeeklyActivity = async () => {
    if (!currentUser) return

    try {
      // Get last 7 days of activity
      const activity = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = localDateKey(date)

        const result = await window.electronAPI.db.query(
          `SELECT COUNT(*) as sessions, COALESCE(SUM(duration_minutes), 0) as minutes
           FROM pomodoro_sessions
           WHERE user_id = ? AND completed = 1 AND DATE(completed_at, 'localtime') = ?`,
          [currentUser.id, dateStr]
        )

        activity.push({
          date: dateStr,
          sessions: result[0]?.sessions || 0,
          minutes: result[0]?.minutes || 0
        })
      }

      setWeeklyActivity(activity)
    } catch (error) {
      console.error('Failed to load weekly activity:', error)
    }
  }

  const loadReminders = async () => {
    if (!currentUser) return
    try {
      const results = await window.electronAPI.db.query(
        'SELECT * FROM reminders WHERE user_id = ? ORDER BY priority ASC',
        [currentUser.id]
      )
      setReminders(results || [])
    } catch (error) {
      console.error('Failed to load reminders:', error)
    }
  }

  const handleAddReminder = (date: string) => {
    setAddingForDate(date)
    setEditingReminder(null)
    setShowReminderForm(true)
  }

  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder)
    setAddingForDate(null)
    setShowReminderForm(true)
  }

  const handleSaveReminder = async (data: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'priority'>) => {
    if (!currentUser) return

    try {
      if (editingReminder) {
        // Update existing reminder
        await window.electronAPI.db.run(
          `UPDATE reminders SET title = ?, description = ?, date = ?, time = ?, color = ?, repeat = ?, completed = ?, updated_at = datetime('now') WHERE id = ?`,
          [data.title, data.description || null, data.date, data.time || null, data.color, data.repeat || null, data.completed ? 1 : 0, editingReminder.id]
        )
      } else {
        // Create new reminder - get max priority and add 1
        const maxPriority = await window.electronAPI.db.get(
          'SELECT MAX(priority) as max FROM reminders WHERE user_id = ?',
          [currentUser.id]
        )
        const newPriority = (maxPriority?.max ?? -1) + 1

        await window.electronAPI.db.run(
          `INSERT INTO reminders (user_id, title, description, date, time, color, priority, repeat, completed, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
          [currentUser.id, data.title, data.description || null, data.date, data.time || null, data.color, newPriority, data.repeat || null]
        )
      }

      await loadReminders()
      setShowReminderForm(false)
      setEditingReminder(null)
      setAddingForDate(null)
    } catch (error) {
      console.error('Failed to save reminder:', error)
    }
  }

  const handleDeleteReminder = async (id: number) => {
    try {
      await window.electronAPI.db.run('DELETE FROM reminders WHERE id = ?', [id])
      await loadReminders()
      setShowReminderForm(false)
      setEditingReminder(null)
    } catch (error) {
      console.error('Failed to delete reminder:', error)
    }
  }

  const handleCompleteReminder = async (id: number) => {
    try {
      const reminder = reminders.find(r => r.id === id)
      if (!reminder) return

      if (reminder.repeat) {
        // If repeating, create next occurrence and mark current as completed
        const nextDate = nextReminderDate(reminder.date, reminder.repeat)
        await window.electronAPI.db.run(
          `UPDATE reminders SET date = ?, updated_at = datetime('now') WHERE id = ?`,
          [nextDate, id]
        )
      } else {
        // Mark as completed
        await window.electronAPI.db.run(
          `UPDATE reminders SET completed = 1, updated_at = datetime('now') WHERE id = ?`,
          [id]
        )
      }

      await loadReminders()
    } catch (error) {
      console.error('Failed to complete reminder:', error)
    }
  }

  const handleReorderReminders = async (reorderedReminders: Reminder[]) => {
    try {
      // Update priorities in database
      for (const reminder of reorderedReminders) {
        await window.electronAPI.db.run(
          'UPDATE reminders SET priority = ? WHERE id = ?',
          [reminder.priority, reminder.id]
        )
      }
      setReminders(prev => {
        // Update local state with new priorities
        const updated = [...prev]
        for (const r of reorderedReminders) {
          const idx = updated.findIndex(u => u.id === r.id)
          if (idx !== -1) updated[idx] = { ...updated[idx], priority: r.priority }
        }
        return updated
      })
    } catch (error) {
      console.error('Failed to reorder reminders:', error)
    }
  }

  const statCards = [
    {
      title: 'Total Notes',
      value: stats.totalNotes,
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      title: 'Flashcards',
      value: stats.totalFlashcards,
      icon: Brain,
      color: 'bg-purple-500',
    },
    {
      title: 'Quizzes Taken',
      value: stats.totalQuizzes,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      title: 'Focus Sessions',
      value: stats.pomodoroSessions,
      icon: Timer,
      color: 'bg-orange-500',
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {currentUser?.username}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's your study progress overview
        </p>
      </div>

      {/* Upgrade Banner */}
      {currentUser?.subscription_tier === 'free' && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-6 rounded-xl shadow-lg mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Crown className="w-12 h-12" />
              <div>
                <h3 className="text-xl font-bold mb-1">Try the Premium Demo</h3>
                <p className="text-amber-100">Preview the plan change. All study tools are available with either demo tier.</p>
              </div>
            </div>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="bg-white text-amber-600 px-6 py-3 rounded-lg font-semibold hover:bg-amber-50 transition-colors"
            >
              View Demo
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Streak & Weekly Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Streak Card */}
        <div className="bg-gradient-to-br from-orange-500 to-red-500 p-6 rounded-xl shadow-md text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Flame className="w-8 h-8" />
              <h3 className="text-xl font-bold">Study Streak</h3>
            </div>
          </div>
          <div className="flex items-end gap-8">
            <div>
              <p className="text-5xl font-bold">{streak.current}</p>
              <p className="text-orange-100">day{streak.current !== 1 ? 's' : ''} current</p>
            </div>
            <div className="text-orange-100">
              <p className="text-2xl font-semibold">{streak.longest}</p>
              <p className="text-sm">longest streak</p>
            </div>
          </div>
          {streak.current > 0 && (
            <p className="mt-4 text-orange-100 text-sm">
              🔥 Keep going! You're on a roll!
            </p>
          )}
          {streak.current === 0 && (
            <p className="mt-4 text-orange-100 text-sm">
              Start a focus session to begin your streak!
            </p>
          )}
        </div>

        {/* Weekly Activity */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <CalendarIcon className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-bold text-gray-900">This Week</h3>
          </div>
          <div className="flex items-end justify-between h-32 gap-2">
            {weeklyActivity.map((day) => {
              const maxMinutes = Math.max(...weeklyActivity.map(d => d.minutes), 1)
              const height = (day.minutes / maxMinutes) * 100
              const dayName = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
              const isToday = day.date === localDateKey()

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center h-20">
                    <div
                      className={`w-full max-w-8 rounded-t transition-all ${
                        isToday ? 'bg-primary' : day.minutes > 0 ? 'bg-primary/60' : 'bg-gray-200'
                      }`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${day.minutes} min`}
                    />
                  </div>
                  <span className={`text-xs ${isToday ? 'font-bold text-primary' : 'text-gray-500'}`}>
                    {dayName}
                  </span>
                  <span className="text-xs text-gray-400">{day.minutes}m</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Calendar & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Calendar
            reminders={reminders}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onAddReminder={handleAddReminder}
          />
        </div>
        <div>
          <ReminderBubbleColumn
            reminders={reminders}
            onComplete={handleCompleteReminder}
            onReorder={handleReorderReminders}
            onEdit={handleEditReminder}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => useStore.getState().setCurrentPage('notes')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <FileText className="w-8 h-8 text-primary mb-2" />
            <p className="font-semibold text-gray-900">Create Note</p>
            <p className="text-sm text-gray-600">Start taking notes</p>
          </button>

          <button
            onClick={() => useStore.getState().setCurrentPage('timer')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Timer className="w-8 h-8 text-primary mb-2" />
            <p className="font-semibold text-gray-900">Start Focus Timer</p>
            <p className="text-sm text-gray-600">Begin a Pomodoro session</p>
          </button>

          <button
            onClick={() => useStore.getState().setCurrentPage('flashcards')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Brain className="w-8 h-8 text-primary mb-2" />
            <p className="font-semibold text-gray-900">Study Flashcards</p>
            <p className="text-sm text-gray-600">Review your cards</p>
          </button>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}

      {/* Reminder Form Modal */}
      {showReminderForm && (
        <ReminderForm
          reminder={editingReminder}
          initialDate={addingForDate || selectedDate || undefined}
          onSave={handleSaveReminder}
          onDelete={editingReminder ? handleDeleteReminder : undefined}
          onClose={() => {
            setShowReminderForm(false)
            setEditingReminder(null)
            setAddingForDate(null)
          }}
        />
      )}
    </div>
  )
}

export default Dashboard
