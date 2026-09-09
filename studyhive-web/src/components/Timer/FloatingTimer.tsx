import { useState, useEffect, useRef } from 'react'
import { useSharedTimer } from '../../hooks/useSharedTimer'
import { useStore } from '../../store'
import { Play, Pause, RotateCcw, X, Maximize2, Volume2, VolumeX } from 'lucide-react'

interface FloatingTimerProps {
  onExpand: () => void
}

const FloatingTimer = ({ onExpand }: FloatingTimerProps) => {
  const {
    mode,
    timeLeft,
    isRunning,
    sessionsCompleted,
    switchMode,
    toggleTimer,
    resetTimer,
    formatTime,
    getProgress,
    getModeColor,
    getModeLabel,
    setSoundEnabled,
    soundEnabled,
  } = useSharedTimer()

  const { floatingTimerPosition, setFloatingTimerPosition } = useStore()

  const [isMinimized, setIsMinimized] = useState(true)
  const [isDragging, setIsDragging] = useState(false)

  // Calculate actual position (handle initial -1 for top right)
  const getActualPosition = () => {
    if (floatingTimerPosition.x === -1) {
      return { x: window.innerWidth - 320, y: 20 }
    }
    return floatingTimerPosition
  }

  const [position, setPosition] = useState(getActualPosition)

  // Initialize position on mount and sync from store
  useEffect(() => {
    const actualPos = getActualPosition()
    setPosition(actualPos)
    // If it was the default -1, save the actual position
    if (floatingTimerPosition.x === -1) {
      setFloatingTimerPosition(actualPos)
    }
  }, [])

  // Sync position from store when it changes (e.g., when coming back to a tab)
  useEffect(() => {
    if (floatingTimerPosition.x !== -1) {
      setPosition(floatingTimerPosition)
    }
  }, [floatingTimerPosition])

  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; currentX?: number; currentY?: number }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 })
  const rafRef = useRef<number | null>(null)

  // Drag handlers with smooth animation
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    }

    // Add grabbing cursor to body during drag
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }

      // Use requestAnimationFrame for smooth updates
      rafRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragRef.current.startX
        const deltaY = e.clientY - dragRef.current.startY
        const newX = Math.max(0, Math.min(window.innerWidth - 200, dragRef.current.initialX + deltaX))
        const newY = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.initialY + deltaY))

        // Direct DOM update for smooth dragging
        if (containerRef.current) {
          containerRef.current.style.left = `${newX}px`
          containerRef.current.style.top = `${newY}px`
        }

        // Store the position for state sync on mouseup
        dragRef.current.currentX = newX
        dragRef.current.currentY = newY
      })
    }

    const handleMouseUp = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }

      // Sync final position to both local state and store
      if (dragRef.current.currentX !== undefined && dragRef.current.currentY !== undefined) {
        const newPosition = {
          x: dragRef.current.currentX,
          y: dragRef.current.currentY
        }
        setPosition(newPosition)
        setFloatingTimerPosition(newPosition) // Persist to store
      }

      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true })
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [isDragging])

  if (isMinimized) {
    return (
      <div
        ref={containerRef}
        className={`fixed z-50 ${getModeColor()} text-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 select-none hover:scale-105 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ left: position.x, top: position.y, willChange: 'left, top' }}
        onMouseDown={handleMouseDown}
        onClick={() => !isDragging && setIsMinimized(false)}
      >
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ opacity: isRunning ? 1 : 0.3 }} />
        <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
        <span className="text-xs opacity-80">{getModeLabel()}</span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`fixed z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4 w-72 select-none border border-gray-200 dark:border-slate-700 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ left: position.x, top: position.y, willChange: 'left, top' }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getModeColor()}`} />
          <span className="font-semibold text-gray-900 dark:text-white">{getModeLabel()}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            )}
          </button>
          <button
            onClick={onExpand}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Full view"
          >
            <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Minimize"
          >
            <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Progress Ring */}
      <div className="relative w-32 h-32 mx-auto mb-3">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            className="text-gray-200 dark:text-slate-600"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className={getModeColor().replace('bg-', 'text-')}
            strokeDasharray={`${2 * Math.PI * 56}`}
            strokeDashoffset={`${2 * Math.PI * 56 * (1 - getProgress() / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-gray-900 dark:text-white font-mono">{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Mode Buttons */}
      <div className="flex gap-1 mb-3">
        {(['work', 'shortBreak', 'longBreak'] as const).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              mode === m
                ? getModeColor() + ' text-white shadow-sm'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            {m === 'work' ? 'Work' : m === 'shortBreak' ? 'Short' : 'Long'}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={toggleTimer}
          className={`flex-1 ${getModeColor()} text-white py-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity shadow-md`}
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={resetTimer}
          className="px-3 py-2.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Session count */}
      <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
        Sessions today: {sessionsCompleted}
      </div>
    </div>
  )
}

export default FloatingTimer
