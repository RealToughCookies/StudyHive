import { useEffect } from 'react'
import { useStore } from '../store'

type TimerMode = 'work' | 'shortBreak' | 'longBreak'

// This hook runs the timer engine - call it ONCE in Layout
export const useTimerEngine = () => {
  const { settings, timer, setIsRunning, setWasPausedByBlur, tickTimer } = useStore()

  const playSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const playBeep = (freq: number, delay: number, duration: number) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()
          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)
          oscillator.frequency.value = freq
          oscillator.type = 'sine'
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + duration)
        }, delay)
      }
      playBeep(800, 0, 0.5)
      playBeep(800, 600, 0.5)
      playBeep(1000, 1200, 0.8)
    } catch (e) {
      console.log('Audio not supported')
    }
  }

  const handleTimerComplete = () => {
    const { settings: currentSettings, currentUser, timer: currentTimer } = useStore.getState()
    if (!currentTimer.isRunning) return

    const sessions = currentTimer.sessionsCompleted + (currentTimer.mode === 'work' ? 1 : 0)
    const nextMode = currentTimer.mode === 'work'
      ? (sessions % 4 === 0 ? 'longBreak' : 'shortBreak') : 'work'
    const minutes = nextMode === 'work' ? (currentSettings?.pomodoro_work_minutes || 25)
      : nextMode === 'shortBreak' ? (currentSettings?.pomodoro_break_minutes || 5)
      : (currentSettings?.pomodoro_long_break_minutes || 15)

    // Transition once, before asynchronous persistence or notifications can fail.
    useStore.setState({ timer: { ...currentTimer, mode: nextMode,
      timeLeft: minutes * 60, sessionsCompleted: sessions, wasPausedByBlur: false } })

    if (currentSettings?.timer_sound && currentTimer.soundEnabled) playSound()
    if (currentSettings?.notification_sound) {
      try {
        window.electronAPI.notify('Pomodoro Complete!', currentTimer.mode === 'work'
          ? 'Great job! Time for a break.' : 'Break is over. Ready to focus?')
      } catch (error) { console.error('Unable to show timer notification:', error) }
    }
    if (currentTimer.mode === 'work' && currentUser) {
      window.electronAPI.db.run(
        `INSERT INTO pomodoro_sessions (user_id, duration_minutes, completed, completed_at)
         VALUES (?, ?, 1, datetime('now'))`,
        [currentUser.id, currentSettings?.pomodoro_work_minutes || 25]
      ).catch(error => console.error('Failed to save session:', error))
    }
  }

  useEffect(() => {
    if (!timer.isRunning) return
    let lastTick = Date.now()
    const interval = setInterval(() => {
      const current = useStore.getState().timer
      if (!current.isRunning) return
      const now = Date.now()
      if (now < lastTick) lastTick = now
      const elapsed = Math.floor((now - lastTick) / 1000)
      if (elapsed === 0) return
      lastTick += elapsed * 1000
      if (current.timeLeft <= elapsed) handleTimerComplete()
      else tickTimer(elapsed)
    }, 1000)
    return () => clearInterval(interval)
  }, [timer.isRunning, timer.mode])

  // Handle window/tab visibility for auto-pause
  useEffect(() => {
    if (!settings?.pause_on_blur) return

    const handleVisibilityChange = () => {
      const timerState = useStore.getState().timer
      const currentSettings = useStore.getState().settings

      if (!currentSettings?.pause_on_blur) return

      if (document.hidden && timerState.isRunning) {
        setIsRunning(false)
        setWasPausedByBlur(true)
      } else if (!document.hidden && timerState.wasPausedByBlur) {
        if (currentSettings?.auto_resume_on_focus) {
          setIsRunning(true)
        }
        setWasPausedByBlur(false)
      }
    }

    const handleWindowBlur = () => {
      const timerState = useStore.getState().timer
      const currentSettings = useStore.getState().settings

      if (!currentSettings?.pause_on_blur) return

      if (timerState.isRunning) {
        setIsRunning(false)
        setWasPausedByBlur(true)
      }
    }

    const handleWindowFocus = () => {
      const timerState = useStore.getState().timer
      const currentSettings = useStore.getState().settings

      if (!currentSettings?.pause_on_blur) return

      if (timerState.wasPausedByBlur) {
        if (currentSettings?.auto_resume_on_focus) {
          setIsRunning(true)
        }
        setWasPausedByBlur(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    const cleanupBlur = window.electronAPI.onWindowBlur(handleWindowBlur)
    const cleanupFocus = window.electronAPI.onWindowFocus(handleWindowFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      cleanupBlur()
      cleanupFocus()
    }
  }, [settings?.pause_on_blur, settings?.auto_resume_on_focus])
}

// This hook provides timer controls and state - can be called from any component
export const useSharedTimer = () => {
  const {
    settings,
    timer,
    setTimerMode,
    setTimeLeft,
    setIsRunning,
    setWasPausedByBlur,
    setTimerSoundEnabled,
  } = useStore()

  const workMinutes = settings?.pomodoro_work_minutes || 25
  const shortBreakMinutes = settings?.pomodoro_break_minutes || 5
  const longBreakMinutes = settings?.pomodoro_long_break_minutes || 15

  const switchModeAndStart = (newMode: TimerMode) => {
    setWasPausedByBlur(false)
    setTimerMode(newMode)
    const minutes = newMode === 'work' ? workMinutes :
                    newMode === 'shortBreak' ? shortBreakMinutes : longBreakMinutes
    setTimeLeft(minutes * 60)
    setIsRunning(true)
  }

  const switchMode = (newMode: TimerMode) => {
    setWasPausedByBlur(false)
    setTimerMode(newMode)
    setIsRunning(false)
    const minutes = newMode === 'work' ? workMinutes :
                    newMode === 'shortBreak' ? shortBreakMinutes : longBreakMinutes
    setTimeLeft(minutes * 60)
  }

  const toggleTimer = () => {
    setWasPausedByBlur(false)
    setIsRunning(!useStore.getState().timer.isRunning)
  }

  const resetTimer = () => {
    const state = useStore.getState()
    setWasPausedByBlur(false)
    state.resetTimer(state.settings?.pomodoro_work_minutes || 25)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getProgress = () => {
    const totalSeconds = timer.mode === 'work' ? workMinutes * 60 :
                        timer.mode === 'shortBreak' ? shortBreakMinutes * 60 : longBreakMinutes * 60
    return ((totalSeconds - timer.timeLeft) / totalSeconds) * 100
  }

  const getModeColor = () => {
    return 'bg-primary'
  }

  const getModeLabel = () => {
    switch (timer.mode) {
      case 'work': return 'Focus'
      case 'shortBreak': return 'Short Break'
      case 'longBreak': return 'Long Break'
    }
  }

  const setSoundEnabled = (enabled: boolean) => {
    setTimerSoundEnabled(enabled)
  }

  return {
    mode: timer.mode,
    timeLeft: timer.timeLeft,
    isRunning: timer.isRunning,
    sessionsCompleted: timer.sessionsCompleted,
    wasPausedByBlur: timer.wasPausedByBlur,
    workMinutes,
    shortBreakMinutes,
    longBreakMinutes,
    switchMode,
    switchModeAndStart,
    toggleTimer,
    resetTimer,
    formatTime,
    getProgress,
    getModeColor,
    getModeLabel,
    setSoundEnabled,
    soundEnabled: timer.soundEnabled,
  }
}
