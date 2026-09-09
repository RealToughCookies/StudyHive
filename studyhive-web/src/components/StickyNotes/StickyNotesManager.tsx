import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { Plus, StickyNote as StickyNoteIcon, Eye, EyeOff, Trash2 } from 'lucide-react'
import { StickyNote } from '../../types'

const STICKY_COLORS = [
  '#fef08a', // yellow
  '#bbf7d0', // green
  '#bfdbfe', // blue
  '#fbcfe8', // pink
  '#fed7aa', // orange
  '#ddd6fe', // purple
]

const StickyNotesManager = () => {
  const { currentUser } = useStore()
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([])
  const [newNoteColor, setNewNoteColor] = useState(STICKY_COLORS[0])

  useEffect(() => {
    loadStickyNotes()
  }, [currentUser])

  const loadStickyNotes = async () => {
    if (!currentUser) return
    try {
      const results = await window.electronAPI.db.query(
        'SELECT * FROM sticky_notes WHERE user_id = ? ORDER BY created_at DESC',
        [currentUser.id]
      )
      setStickyNotes(results || [])
    } catch (error) {
      console.error('Failed to load sticky notes:', error)
    }
  }

  const createStickyNote = async () => {
    if (!currentUser) return

    try {
      // Random position offset to avoid stacking
      const offsetX = Math.floor(Math.random() * 200) + 100
      const offsetY = Math.floor(Math.random() * 200) + 100

      await window.electronAPI.db.run(
        `INSERT INTO sticky_notes (user_id, content, position_x, position_y, color, is_visible)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [currentUser.id, '', offsetX, offsetY, newNoteColor]
      )
      loadStickyNotes()
      // Dispatch event to notify floating notes to refresh
      window.dispatchEvent(new CustomEvent('sticky-notes-updated'))
    } catch (error) {
      console.error('Failed to create sticky note:', error)
    }
  }

  const toggleVisibility = async (note: StickyNote) => {
    try {
      await window.electronAPI.db.run(
        'UPDATE sticky_notes SET is_visible = ? WHERE id = ?',
        [note.is_visible ? 0 : 1, note.id]
      )
      loadStickyNotes()
      window.dispatchEvent(new CustomEvent('sticky-notes-updated'))
    } catch (error) {
      console.error('Failed to toggle visibility:', error)
    }
  }

  const deleteStickyNote = async (id: number) => {
    if (!confirm('Delete this sticky note?')) return

    try {
      await window.electronAPI.db.run('DELETE FROM sticky_notes WHERE id = ?', [id])
      loadStickyNotes()
      window.dispatchEvent(new CustomEvent('sticky-notes-updated'))
    } catch (error) {
      console.error('Failed to delete sticky note:', error)
    }
  }

  const showAllNotes = async () => {
    try {
      await window.electronAPI.db.run(
        'UPDATE sticky_notes SET is_visible = 1 WHERE user_id = ?',
        [currentUser?.id]
      )
      loadStickyNotes()
      window.dispatchEvent(new CustomEvent('sticky-notes-updated'))
    } catch (error) {
      console.error('Failed to show all notes:', error)
    }
  }

  const hideAllNotes = async () => {
    try {
      await window.electronAPI.db.run(
        'UPDATE sticky_notes SET is_visible = 0 WHERE user_id = ?',
        [currentUser?.id]
      )
      loadStickyNotes()
      window.dispatchEvent(new CustomEvent('sticky-notes-updated'))
    } catch (error) {
      console.error('Failed to hide all notes:', error)
    }
  }

  const visibleCount = stickyNotes.filter(n => n.is_visible).length
  const hiddenCount = stickyNotes.filter(n => !n.is_visible).length

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sticky Notes</h1>
            <p className="text-gray-600">Quick notes that float on your screen</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Color picker for new note */}
            <div className="flex items-center gap-1 bg-white rounded-lg p-2 shadow-sm border border-gray-200">
              {STICKY_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewNoteColor(color)}
                  className={`w-6 h-6 rounded transition-transform ${
                    newNoteColor === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button
              onClick={createStickyNote}
              className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Sticky
            </button>
          </div>
        </div>

        {/* Quick actions */}
        {stickyNotes.length > 0 && (
          <div className="flex items-center gap-4 mb-6">
            <div className="text-sm text-gray-600">
              {visibleCount} visible, {hiddenCount} hidden
            </div>
            <div className="flex gap-2">
              <button
                onClick={showAllNotes}
                className="text-sm px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors flex items-center gap-1"
              >
                <Eye className="w-4 h-4" />
                Show All
              </button>
              <button
                onClick={hideAllNotes}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-1"
              >
                <EyeOff className="w-4 h-4" />
                Hide All
              </button>
            </div>
          </div>
        )}

        {/* Sticky Notes List */}
        {stickyNotes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-md">
            <StickyNoteIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No sticky notes yet</h3>
            <p className="text-gray-500 mb-4">Create a sticky note to keep quick reminders on screen</p>
            <button
              onClick={createStickyNote}
              className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Sticky Note
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {stickyNotes.map((note) => (
              <div
                key={note.id}
                className={`relative rounded-lg shadow-md p-4 min-h-[120px] transition-opacity ${
                  note.is_visible ? 'opacity-100' : 'opacity-50'
                }`}
                style={{ backgroundColor: note.color }}
              >
                <p className="text-gray-800 text-sm whitespace-pre-wrap line-clamp-5">
                  {note.content || 'Empty note'}
                </p>
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <button
                    onClick={() => toggleVisibility(note)}
                    className="p-1.5 rounded hover:bg-black/10 transition-colors"
                    title={note.is_visible ? 'Hide note' : 'Show note'}
                  >
                    {note.is_visible ? (
                      <EyeOff className="w-4 h-4 text-gray-600" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteStickyNote(note.id)}
                    className="p-1.5 rounded hover:bg-black/10 transition-colors"
                    title="Delete note"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <h4 className="font-medium text-amber-800 mb-2">Tips</h4>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• Visible sticky notes appear as floating windows you can drag around</li>
            <li>• Click the eye icon to show/hide individual notes</li>
            <li>• Edit sticky notes by clicking on them when they're floating</li>
            <li>• Minimize notes to small dots to keep them out of the way</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default StickyNotesManager
