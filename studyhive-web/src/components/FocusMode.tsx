import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { X, Play, Pause, RotateCcw, Volume2, VolumeX, FileText, ChevronDown, Plus } from 'lucide-react'
import { Note } from '../types'

import { useSharedTimer } from '../hooks/useSharedTimer'
import NoteEditor from './Notes/NoteEditor'

interface FocusModeProps {
  onExit: () => void
}

const FocusMode = ({ onExit }: FocusModeProps) => {
  const { currentUser } = useStore()
  const { mode, timeLeft, isRunning, sessionsCompleted, soundEnabled, setSoundEnabled,
    toggleTimer, resetTimer, formatTime, getProgress } = useSharedTimer()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [showNoteSelector, setShowNoteSelector] = useState(false)
  const [isCreatingNote, setIsCreatingNote] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')


  // Load notes
  useEffect(() => {
    loadNotes()
  }, [currentUser])

  const loadNotes = async () => {
    if (!currentUser) return
    try {
      const results = await window.electronAPI.db.query(
        'SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC',
        [currentUser.id]
      )
      setNotes(results || [])
    } catch (error) {
      console.error('Failed to load notes:', error)
    }
  }

  const createNewNote = async () => {
    if (!currentUser || !newNoteTitle.trim()) return

    try {
      const result = await window.electronAPI.db.run(
        `INSERT INTO notes (user_id, class_id, title, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [currentUser.id, null, newNoteTitle.trim(), '']
      )

      const noteId = Number(result.lastInsertRowid)
      const newNote = await window.electronAPI.db.get(
        'SELECT * FROM notes WHERE id = ?',
        [noteId]
      )

      if (newNote) {
        setNotes([newNote, ...notes])
        selectNote(newNote)
      }
      setIsCreatingNote(false)
      setNewNoteTitle('')
    } catch (error) {
      console.error('Failed to create note:', error)
    }
  }

  // Get background style using theme colors
  const getBackgroundStyle = () => {
    return {
      background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)'
    }
  }

  const selectNote = (note: Note) => {
    setSelectedNote(note)
    setShowNoteSelector(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex" style={getBackgroundStyle()}>
      {/* Exit button */}
      <button
        onClick={onExit}
        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
        title="Exit Focus Mode (Esc)"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Timer Section */}
      <div className={`flex-1 flex flex-col items-center justify-center ${selectedNote ? 'border-r border-white/20' : ''}`}>
        <div className="text-center">
          <p className="text-white/80 text-xl mb-2 capitalize">
            {mode === 'work' ? 'Focus Time' : mode === 'shortBreak' ? 'Short Break' : 'Long Break'}
          </p>

          {/* Large Timer */}
          <div className="relative w-80 h-80 mx-auto mb-8">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="160"
                cy="160"
                r="140"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="160"
                cy="160"
                r="140"
                stroke="white"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 140}`}
                strokeDashoffset={`${2 * Math.PI * 140 * (1 - getProgress() / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl font-bold text-white font-mono tracking-wider">{formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            >
              {soundEnabled ? <Volume2 className="w-6 h-6 text-white" /> : <VolumeX className="w-6 h-6 text-white" />}
            </button>
            <button
              onClick={toggleTimer}
              className="px-12 py-4 bg-white text-gray-900 rounded-full font-bold text-xl hover:bg-white/90 transition-colors flex items-center gap-3"
            >
              {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={resetTimer}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            >
              <RotateCcw className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Session Count */}
          <p className="text-white/60">Sessions completed: {sessionsCompleted}</p>

          {/* Note Selector */}
          {!selectedNote && (
            <div className="mt-8">
              <button
                onClick={() => setShowNoteSelector(!showNoteSelector)}
                className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
              >
                <FileText className="w-5 h-5" />
                Add a note to work on
                <ChevronDown className="w-4 h-4" />
              </button>

              {showNoteSelector && (
                <div className="mt-2 bg-white rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {/* Create new note option */}
                  {!isCreatingNote ? (
                    <button
                      onClick={() => setIsCreatingNote(true)}
                      className="w-full px-4 py-3 text-left hover:bg-primary/10 transition-colors text-primary font-medium border-b flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create New Note
                    </button>
                  ) : (
                    <div className="p-3 border-b">
                      <input
                        type="text"
                        value={newNoteTitle}
                        onChange={(e) => setNewNoteTitle(e.target.value)}
                        placeholder="Note title..."
                        className="w-full px-3 py-2 border rounded-lg text-gray-900 mb-2"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') createNewNote()
                          if (e.key === 'Escape') {
                            setIsCreatingNote(false)
                            setNewNoteTitle('')
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={createNewNote}
                          disabled={!newNoteTitle.trim()}
                          className="flex-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => {
                            setIsCreatingNote(false)
                            setNewNoteTitle('')
                          }}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Existing notes */}
                  {notes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => selectNote(note)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors text-gray-900 border-b last:border-b-0"
                    >
                      {note.title}
                    </button>
                  ))}
                  {notes.length === 0 && !isCreatingNote && (
                    <p className="px-4 py-3 text-gray-500 text-sm">No notes yet. Create one above!</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Note Section */}
      {selectedNote && (
        <div className="w-1/2 bg-white overflow-hidden">
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            onBack={() => setSelectedNote(null)}
            onUpdate={updated => {
              setSelectedNote(updated)
              setNotes(items => items.map(item => item.id === updated.id ? updated : item))
            }}
          />
        </div>
      )}
    </div>
  )
}

export default FocusMode
