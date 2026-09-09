import { localDateKey } from '../../services/dates'
import { useState, useRef } from 'react'
import { Check, GripVertical, Calendar, Clock, RotateCcw } from 'lucide-react'
import { Reminder } from '../../types'

interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  velocityX: number
  velocityY: number
  rotation: number
}

interface ReminderBubbleColumnProps {
  reminders: Reminder[]
  onComplete: (id: number) => void
  onReorder: (reminders: Reminder[]) => void
  onEdit: (reminder: Reminder) => void
}

const ReminderBubbleColumn = ({ reminders, onComplete, onReorder, onEdit }: ReminderBubbleColumnProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [completingIds, setCompletingIds] = useState<Set<number>>(new Set())
  const [particles, setParticles] = useState<Particle[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // Sort by priority (lower = higher priority = top of list)
  const sortedReminders = [...reminders]
    .filter(r => !r.completed)
    .sort((a, b) => a.priority - b.priority)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    // Make drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const newReminders = [...sortedReminders]
    const [draggedItem] = newReminders.splice(draggedIndex, 1)
    newReminders.splice(targetIndex, 0, draggedItem)

    // Update priorities based on new order
    const updatedReminders = newReminders.map((r, index) => ({
      ...r,
      priority: index
    }))

    onReorder(updatedReminders)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleComplete = (id: number, _event: React.MouseEvent) => {
    const element = document.querySelector(`[data-reminder-id="${id}"]`) as HTMLElement
    if (!element) return

    const rect = element.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const reminder = reminders.find(r => r.id === id)
    const color = reminder?.color || '#3b82f6'

    // Create particles for shatter effect
    const newParticles: Particle[] = []
    const particleCount = 12

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2
      const speed = 2 + Math.random() * 4
      newParticles.push({
        id: Date.now() + i,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2,
        color,
        size: 8 + Math.random() * 12,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed - 2, // slight upward bias
        rotation: Math.random() * 360,
      })
    }

    setParticles(prev => [...prev, ...newParticles])
    setCompletingIds(prev => new Set(prev).add(id))

    // Animate particles
    let frame = 0
    const maxFrames = 30
    const animateParticles = () => {
      frame++
      if (frame >= maxFrames) {
        setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)))
        return
      }

      setParticles(prev => prev.map(p => {
        if (!newParticles.find(np => np.id === p.id)) return p
        return {
          ...p,
          x: p.x + p.velocityX,
          y: p.y + p.velocityY + frame * 0.3, // gravity
          velocityX: p.velocityX * 0.95,
          velocityY: p.velocityY * 0.95,
          rotation: p.rotation + 10,
          size: p.size * 0.95,
        }
      }))

      requestAnimationFrame(animateParticles)
    }
    requestAnimationFrame(animateParticles)

    // Wait for shatter animation, then trigger actual completion
    setTimeout(() => {
      onComplete(id)
      setCompletingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 500)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (dateStr === localDateKey(today)) return 'Today'
    if (dateStr === localDateKey(tomorrow)) return 'Tomorrow'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getRepeatIcon = (repeat?: string | null) => {
    if (!repeat) return null
    return (
      <span title={`Repeats ${repeat}`}>
        <RotateCcw className="w-3 h-3 text-white/50" />
      </span>
    )
  }

  if (sortedReminders.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-4 h-full flex flex-col">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Priority Stack</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <Check className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm">No reminders yet</p>
            <p className="text-xs mt-1">Add one from the calendar</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 h-full flex flex-col">
      <h3 className="text-lg font-bold text-gray-900 mb-2">Priority Stack</h3>
      <p className="text-xs text-gray-500 mb-4">Drag to reorder by importance</p>

      <div
        ref={containerRef}
        className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-0 relative"
      >
        {sortedReminders.map((reminder, index) => {
          const isCompleting = completingIds.has(reminder.id)
          const isDragging = draggedIndex === index
          const isDragOver = dragOverIndex === index

          return (
            <div
              key={reminder.id}
              data-reminder-id={reminder.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onClick={() => onEdit(reminder)}
              className={`
                relative rounded-xl p-3 cursor-grab active:cursor-grabbing
                transition-all duration-200
                ${isCompleting ? 'animate-pop scale-0 opacity-0' : ''}
                ${isDragging ? 'opacity-50 scale-95 z-10' : ''}
                ${isDragOver ? 'ring-2 ring-primary ring-offset-2 scale-105' : ''}
              `}
              style={{
                backgroundColor: reminder.color,
                // Gravity effect - items lower have more shadow
                boxShadow: isDragOver
                  ? '0 8px 16px rgba(0,0,0,0.2)'
                  : `0 ${2 + (sortedReminders.length - index)}px ${4 + (sortedReminders.length - index) * 2}px rgba(0,0,0,0.15)`,
              }}
            >
              {/* Drag handle */}
              <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70">
                <GripVertical className="w-4 h-4 text-white" />
              </div>

              {/* Checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleComplete(reminder.id, e)
                }}
                className="absolute right-2 top-2 w-5 h-5 rounded-md bg-white/30 hover:bg-white/50 flex items-center justify-center transition-colors"
              >
                <Check className="w-3 h-3 text-white opacity-0 hover:opacity-100 transition-opacity" />
              </button>

              {/* Content */}
              <div className="pl-5 pr-7">
                <p className="font-medium text-white text-sm truncate">
                  {reminder.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1 text-white/70">
                    <Calendar className="w-3 h-3" />
                    <span className="text-xs">{formatDate(reminder.date)}</span>
                  </div>
                  {reminder.time && (
                    <div className="flex items-center gap-1 text-white/70">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{reminder.time}</span>
                    </div>
                  )}
                  {getRepeatIcon(reminder.repeat)}
                </div>
              </div>

              {/* Priority indicator */}
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-8 rounded-full bg-white/30" />
            </div>
          )
        })}

        {/* Particles */}
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute pointer-events-none rounded-sm"
            style={{
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              transform: `translate(-50%, -50%) rotate(${particle.rotation}deg)`,
              opacity: particle.size / 20,
              boxShadow: `0 2px 4px rgba(0,0,0,0.2)`,
            }}
          />
        ))}
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes shatter {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          30% {
            transform: scale(1.05);
            opacity: 1;
          }
          100% {
            transform: scale(0);
            opacity: 0;
          }
        }
        .animate-pop {
          animation: shatter 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

export default ReminderBubbleColumn
