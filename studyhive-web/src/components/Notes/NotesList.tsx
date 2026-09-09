import { parseStoredDate } from '../../services/dates'
import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { Plus, Search, FileText, Trash2, Calendar, Tag, ChevronDown } from 'lucide-react'
import { Note, Class } from '../../types'
import NoteEditor from './NoteEditor'

const NotesList = () => {
  const { currentUser } = useStore()
  const [notes, setNotes] = useState<Note[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClassFilter, setSelectedClassFilter] = useState<number | 'all' | ''>('all')
  const [isCreating, setIsCreating] = useState(false)
  const [classMenuOpen, setClassMenuOpen] = useState<number | null>(null)

  useEffect(() => {
    loadNotes()
    loadClasses()
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

  const loadClasses = async () => {
    if (!currentUser) return
    try {
      const results = await window.electronAPI.db.query(
        'SELECT * FROM classes WHERE user_id = ? ORDER BY name',
        [currentUser.id]
      )
      setClasses(results || [])
    } catch (error) {
      console.error('Failed to load classes:', error)
    }
  }

  const createNewNote = async (classId?: number) => {
    if (!currentUser) return

    try {
      const result = await window.electronAPI.db.run(
        `INSERT INTO notes (user_id, class_id, title, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [currentUser.id, classId || null, 'Untitled Note', '']
      )

      const noteId = Number(result.lastInsertRowid)
      const newNote = await window.electronAPI.db.get(
        'SELECT * FROM notes WHERE id = ?',
        [noteId]
      )

      if (newNote) {
        setNotes([newNote, ...notes])
        setSelectedNote(newNote)
      } else {
        const fallbackNote = await window.electronAPI.db.get(
          'SELECT * FROM notes WHERE user_id = ? ORDER BY id DESC LIMIT 1',
          [currentUser.id]
        )
        if (fallbackNote) {
          setNotes([fallbackNote, ...notes])
          setSelectedNote(fallbackNote)
        }
      }
      setIsCreating(false)
    } catch (error) {
      console.error('Failed to create note:', error)
    }
  }

  const assignNoteToClass = async (noteId: number, classId: number | null) => {
    try {
      await window.electronAPI.db.run(
        'UPDATE notes SET class_id = ? WHERE id = ?',
        [classId, noteId]
      )
      setNotes(notes.map(n => n.id === noteId ? { ...n, class_id: classId || undefined } : n))
      setClassMenuOpen(null)
    } catch (error) {
      console.error('Failed to assign class:', error)
    }
  }

  const deleteNote = async (id: number) => {
    if (!confirm('Delete this note? This cannot be undone.')) return

    try {
      const attachments = await window.electronAPI.db.query('SELECT filename FROM note_attachments WHERE note_id = ?', [id])
      await window.electronAPI.db.run('DELETE FROM notes WHERE id = ? AND user_id = ?', [id, currentUser?.id])
      await Promise.all(attachments.map(attachment => window.electronAPI.file.deleteAttachment(attachment.filename)
        .catch(error => console.error('Failed to remove attachment file:', error))))
      setNotes(notes.filter((n) => n.id !== id))
      if (selectedNote?.id === id) {
        setSelectedNote(null)
      }
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  const handleNoteUpdate = (updatedNote: Note) => {
    setNotes(notes.map((n) => (n.id === updatedNote.id ? updatedNote : n)))
    setSelectedNote(updatedNote)
  }

  const getClassById = (classId?: number) => classes.find(c => c.id === classId)

  const filteredNotes = notes.filter((note) => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          note.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesClass = selectedClassFilter === 'all' || (selectedClassFilter === '' ? note.class_id == null : note.class_id === selectedClassFilter)
    return matchesSearch && matchesClass
  })

  const formatDate = (dateStr: string) => {
    const date = parseStoredDate(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Strip HTML tags for preview
  const stripHtml = (html: string) => {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  if (selectedNote || isCreating) {
    return (
      <NoteEditor
        note={selectedNote}
        classes={classes}
        onBack={() => {
          setSelectedNote(null)
          setIsCreating(false)
          loadNotes()
        }}
        onUpdate={handleNoteUpdate}
      />
    )
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Notes</h1>
            <p className="text-gray-600">Your study notes and materials</p>
          </div>
          <button
            onClick={() => createNewNote(selectedClassFilter === 'all' || selectedClassFilter === '' ? undefined : selectedClassFilter)}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Note
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value === 'all' ? 'all' : e.target.value === '' ? '' : Number(e.target.value))}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
          >
            <option value="all">All Classes</option>
            <option value="">Unassigned</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>

        {/* Notes Grid */}
        {filteredNotes.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              {searchQuery || selectedClassFilter !== 'all' ? 'No notes found' : 'No notes yet'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || selectedClassFilter !== 'all'
                ? 'Try different filters'
                : 'Create your first note to get started'}
            </p>
            {!searchQuery && selectedClassFilter === 'all' && (
              <button
                onClick={() => createNewNote()}
                className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Note
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map((note) => {
              const noteClass = getClassById(note.class_id)
              return (
                <div
                  key={note.id}
                  className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow cursor-pointer group relative"
                >
                  {/* Class indicator */}
                  {noteClass && (
                    <div
                      className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                      style={{ backgroundColor: noteClass.color }}
                    />
                  )}

                  <div onClick={() => setSelectedNote(note)}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {note.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {note.content ? stripHtml(note.content) : 'Empty note'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(note.updated_at)}
                      </div>
                      {noteClass && (
                        <span
                          className="px-2 py-0.5 rounded-full text-white text-xs"
                          style={{ backgroundColor: noteClass.color }}
                        >
                          {noteClass.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                    {/* Class assignment dropdown */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setClassMenuOpen(classMenuOpen === note.id ? null : note.id)
                        }}
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 p-2 rounded hover:bg-gray-50 transition-colors text-sm"
                      >
                        <Tag className="w-4 h-4" />
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {classMenuOpen === note.id && (
                        <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[150px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              assignNoteToClass(note.id, null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-600"
                          >
                            No Class
                          </button>
                          {classes.map((cls) => (
                            <button
                              key={cls.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                assignNoteToClass(note.id, cls.id)
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cls.color }}
                              />
                              {cls.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNote(note.id)
                      }}
                      className="text-red-600 hover:text-red-700 p-2 rounded hover:bg-red-50 transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotesList
