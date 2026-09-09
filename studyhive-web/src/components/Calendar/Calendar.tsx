import { localDateKey } from '../../services/dates'
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Reminder } from '../../types'

interface CalendarProps {
  reminders: Reminder[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
  onAddReminder: (date: string) => void
}

const Calendar = ({ reminders, selectedDate, onSelectDate, onAddReminder }: CalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: Array<{ date: Date | null; dateStr: string }> = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push({ date: null, dateStr: '' })
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dateStr = localDateKey(date)
      days.push({ date, dateStr })
    }

    return days
  }, [currentMonth])

  const getRemindersByDate = (dateStr: string) => {
    return reminders.filter(r => r.date === dateStr && !r.completed)
  }

  const goToPrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentMonth(new Date())
    onSelectDate(localDateKey())
  }

  const today = localDateKey()
  const monthYear = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white rounded-2xl shadow-md p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">{monthYear}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={goToToday}
            className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
          >
            Today
          </button>
          <button
            onClick={goToPrevMonth}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={goToNextMonth}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((day, index) => {
          if (!day.date) {
            return <div key={`empty-${index}`} className="aspect-square" />
          }

          const dateReminders = getRemindersByDate(day.dateStr)
          const isToday = day.dateStr === today
          const isSelected = day.dateStr === selectedDate
          const hasReminders = dateReminders.length > 0

          return (
            <button
              key={day.dateStr}
              onClick={() => onSelectDate(day.dateStr)}
              className={`
                aspect-square rounded-lg p-1 flex flex-col items-center justify-start
                transition-all relative group
                ${isSelected
                  ? 'bg-primary text-white shadow-md'
                  : isToday
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'hover:bg-gray-100 text-gray-700'
                }
              `}
            >
              <span className="text-sm">{day.date.getDate()}</span>

              {/* Reminder dots */}
              {hasReminders && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-full">
                  {dateReminders.slice(0, 3).map(r => (
                    <div
                      key={r.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? 'white' : r.color }}
                    />
                  ))}
                  {dateReminders.length > 3 && (
                    <span className={`text-[8px] ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                      +{dateReminders.length - 3}
                    </span>
                  )}
                </div>
              )}


            </button>
          )
        })}
      </div>

      {/* Selected date reminders preview */}
      {selectedDate && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
              })}
            </h4>
            <button
              onClick={() => onAddReminder(selectedDate)}
              className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {getRemindersByDate(selectedDate).length === 0 ? (
              <p className="text-xs text-gray-400 italic">No reminders for this day</p>
            ) : (
              getRemindersByDate(selectedDate).map(r => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 text-xs p-1.5 rounded"
                  style={{ backgroundColor: `${r.color}20` }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="text-gray-700 truncate">{r.title}</span>
                  {r.time && (
                    <span className="text-gray-400 ml-auto">{r.time}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Calendar
