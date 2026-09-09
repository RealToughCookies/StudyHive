import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { X, Minus } from 'lucide-react'
import { StickyNote } from '../../types'

const FloatingStickyNotes = () => {
  const { currentUser } = useStore()
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([])

  useEffect(() => {
    loadStickyNotes()

    // Listen for updates from the manager
    const handleUpdate = () => loadStickyNotes()
    window.addEventListener('sticky-notes-updated', handleUpdate)
    return () => window.removeEventListener('sticky-notes-updated', handleUpdate)
  }, [currentUser])

  const loadStickyNotes = async () => {
    if (!currentUser) return
    try {
      const results = await window.electronAPI.db.query(
        'SELECT * FROM sticky_notes WHERE user_id = ? AND is_visible = 1',
        [currentUser.id]
      )
      setStickyNotes(results || [])
    } catch (error) {
      console.error('Failed to load sticky notes:', error)
    }
  }

  const updateNote = async (id: number, updates: Partial<StickyNote>) => {
    try {
      const setClauses = Object.keys(updates)
        .map(key => `${key} = ?`)
        .join(', ')
      const values = [...Object.values(updates), id]

      await window.electronAPI.db.run(
        `UPDATE sticky_notes SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
        values
      )

      setStickyNotes(notes =>
        notes.map(n => (n.id === id ? { ...n, ...updates } : n))
      )
    } catch (error) {
      console.error('Failed to update sticky note:', error)
    }
  }

  const hideNote = async (id: number) => {
    await updateNote(id, { is_visible: false } as any)
    setStickyNotes(notes => notes.filter(n => n.id !== id))
    window.dispatchEvent(new CustomEvent('sticky-notes-updated'))
  }

  const toggleMinimize = async (note: StickyNote) => {
    await updateNote(note.id, { is_minimized: !note.is_minimized } as any)
  }

  if (stickyNotes.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {stickyNotes.map((note) => (
        <DraggableStickyNote
          key={note.id}
          note={note}
          onUpdate={updateNote}
          onHide={hideNote}
          onToggleMinimize={toggleMinimize}
        />
      ))}
    </div>
  )
}

interface DraggableStickyNoteProps {
  note: StickyNote
  onUpdate: (id: number, updates: Partial<StickyNote>) => void
  onHide: (id: number) => void
  onToggleMinimize: (note: StickyNote) => void
}

const DraggableStickyNote = ({ note, onUpdate, onHide, onToggleMinimize }: DraggableStickyNoteProps) => {
  const [position, setPosition] = useState({ x: note.position_x, y: note.position_y })
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(note.content)
  const dragOffset = useRef({ x: 0, y: 0 })
  const didDrag = useRef(false)
  const noteRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setPosition({ x: note.position_x, y: note.position_y })
    setContent(note.content)
  }, [note.position_x, note.position_y, note.content])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return
    if ((e.target as HTMLElement).closest('button')) return

    setIsDragging(true)
    didDrag.current = false
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      didDrag.current = true
      const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.current.x))
      const newY = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.current.y))
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      onUpdate(note.id, { position_x: position.x, position_y: position.y })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, position, note.id, onUpdate])

  const handleContentBlur = () => {
    setIsEditing(false)
    if (content !== note.content) {
      onUpdate(note.id, { content })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false)
      setContent(note.content)
    }
  }

  // Minimized view - just a small colored dot
  if (note.is_minimized) {
    return (
      <div
        ref={noteRef}
        className="absolute pointer-events-auto cursor-move"
        style={{
          left: position.x,
          top: position.y,
        }}
        onMouseDown={handleMouseDown}
      >
        <div
          className="w-6 h-6 rounded-full shadow-lg border-2 border-white/50 hover:scale-110 transition-transform"
          style={{ backgroundColor: note.color }}
          onClick={() => !didDrag.current && onToggleMinimize(note)}
          title="Click to expand"
        />
      </div>
    )
  }

  return (
    <div
      ref={noteRef}
      className={`absolute pointer-events-auto rounded-lg shadow-xl transition-shadow ${
        isDragging ? 'shadow-2xl cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: note.width,
        minHeight: note.height,
        backgroundColor: note.color,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-black/10">
        <div className="w-16 h-1 bg-black/20 rounded-full" />
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onToggleMinimize(note)}
            className="p-1 rounded hover:bg-black/10 transition-colors"
            title="Minimize"
          >
            <Minus className="w-3 h-3 text-gray-600" />
          </button>
          <button
            onClick={() => onHide(note.id)}
            className="p-1 rounded hover:bg-black/10 transition-colors"
            title="Hide"
          >
            <X className="w-3 h-3 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="p-3 min-h-[80px]"
        onClick={() => !isDragging && setIsEditing(true)}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleContentBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full min-h-[80px] bg-transparent border-none outline-none resize-none text-gray-800 text-sm"
            placeholder="Write something..."
          />
        ) : (
          <p className="text-gray-800 text-sm whitespace-pre-wrap">
            {content || <span className="text-gray-500 italic">Click to edit...</span>}
          </p>
        )}
      </div>
    </div>
  )
}

export default FloatingStickyNotes
