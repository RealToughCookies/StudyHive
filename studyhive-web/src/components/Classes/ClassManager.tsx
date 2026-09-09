import { parseStoredDate } from '../../services/dates'
import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { Plus, Edit2, Trash2, X, Check, GraduationCap, ArrowLeft, FileText, Brain, ClipboardList, ChevronRight } from 'lucide-react'
import { Class, Note, Flashcard, Quiz } from '../../types'

const CLASS_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
]

interface ClassItems {
  notes: Note[]
  flashcards: Flashcard[]
  quizzes: Quiz[]
}

const ClassManager = () => {
  const { currentUser, setCurrentPage } = useStore()
  const [classes, setClasses] = useState<Class[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newClassName, setNewClassName] = useState('')
  const [newClassColor, setNewClassColor] = useState(CLASS_COLORS[0])
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [selectedClass, setSelectedClass] = useState<Class | null>(null)
  const [classItems, setClassItems] = useState<ClassItems>({ notes: [], flashcards: [], quizzes: [] })

  useEffect(() => {
    loadClasses()
  }, [currentUser])

  useEffect(() => {
    if (selectedClass) {
      loadClassItems(selectedClass.id)
    }
  }, [selectedClass])

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

  const loadClassItems = async (classId: number) => {
    if (!currentUser) return
    try {
      const [notes, flashcards, quizzes] = await Promise.all([
        window.electronAPI.db.query(
          'SELECT * FROM notes WHERE user_id = ? AND class_id = ? ORDER BY updated_at DESC',
          [currentUser.id, classId]
        ),
        window.electronAPI.db.query(
          'SELECT * FROM flashcards WHERE user_id = ? AND class_id = ? ORDER BY created_at DESC',
          [currentUser.id, classId]
        ),
        window.electronAPI.db.query(
          'SELECT * FROM quizzes WHERE user_id = ? AND class_id = ? ORDER BY created_at DESC',
          [currentUser.id, classId]
        ),
      ])
      setClassItems({
        notes: notes || [],
        flashcards: flashcards || [],
        quizzes: quizzes || [],
      })
    } catch (error) {
      console.error('Failed to load class items:', error)
    }
  }

  const createClass = async () => {
    if (!currentUser || !newClassName.trim()) return

    try {
      await window.electronAPI.db.run(
        'INSERT INTO classes (user_id, name, color) VALUES (?, ?, ?)',
        [currentUser.id, newClassName.trim(), newClassColor]
      )
      setNewClassName('')
      setNewClassColor(CLASS_COLORS[0])
      setIsCreating(false)
      loadClasses()
    } catch (error) {
      console.error('Failed to create class:', error)
    }
  }

  const updateClass = async (id: number) => {
    if (!editName.trim()) return

    try {
      await window.electronAPI.db.run(
        'UPDATE classes SET name = ?, color = ? WHERE id = ?',
        [editName.trim(), editColor, id]
      )
      setEditingId(null)
      loadClasses()
      // Update selected class if it was being edited
      if (selectedClass?.id === id) {
        setSelectedClass({ ...selectedClass, name: editName.trim(), color: editColor })
      }
    } catch (error) {
      console.error('Failed to update class:', error)
    }
  }

  const deleteClass = async (id: number) => {
    if (!confirm('Delete this class? Items in this class will be unassigned.')) return

    try {
      // Delete the class
      await window.electronAPI.db.run('DELETE FROM classes WHERE id = ?', [id])
      loadClasses()
      if (selectedClass?.id === id) {
        setSelectedClass(null)
      }
    } catch (error) {
      console.error('Failed to delete class:', error)
    }
  }

  const startEditing = (cls: Class, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(cls.id)
    setEditName(cls.name)
    setEditColor(cls.color)
  }

  const handleDeleteClick = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteClass(id)
  }

  const formatDate = (dateStr: string) => {
    const date = parseStoredDate(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  // Class Detail View
  if (selectedClass) {
    const totalItems = classItems.notes.length + classItems.flashcards.length + classItems.quizzes.length

    return (
      <div className="p-8 h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setSelectedClass(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div
              className="w-4 h-12 rounded-full flex-shrink-0"
              style={{ backgroundColor: selectedClass.color }}
            />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{selectedClass.name}</h1>
              <p className="text-gray-600">{totalItems} item{totalItems !== 1 ? 's' : ''} in this class</p>
            </div>
          </div>

          {totalItems === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl shadow-md">
              <GraduationCap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No items in this class</h3>
              <p className="text-gray-500">Assign notes, flashcards, or quizzes to this class to see them here</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Notes Section */}
              {classItems.notes.length > 0 && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-gray-900">Notes ({classItems.notes.length})</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {classItems.notes.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => setCurrentPage('notes')}
                        className="w-full px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{note.title}</h3>
                          <p className="text-sm text-gray-500 truncate">
                            {note.content ? stripHtml(note.content) : 'Empty note'}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(note.updated_at)}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Flashcards Section */}
              {classItems.flashcards.length > 0 && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                    <Brain className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-gray-900">Flashcards ({classItems.flashcards.length})</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {classItems.flashcards.slice(0, 10).map((card) => (
                      <button
                        key={card.id}
                        onClick={() => setCurrentPage('flashcards')}
                        className="w-full px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{card.front}</h3>
                          <p className="text-sm text-gray-500 truncate">{card.back}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </button>
                    ))}
                    {classItems.flashcards.length > 10 && (
                      <button
                        onClick={() => setCurrentPage('flashcards')}
                        className="w-full px-6 py-3 text-center text-primary hover:bg-primary/5 transition-colors text-sm font-medium"
                      >
                        View all {classItems.flashcards.length} flashcards
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Quizzes Section */}
              {classItems.quizzes.length > 0 && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-gray-900">Quizzes ({classItems.quizzes.length})</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {classItems.quizzes.map((quiz) => {
                      const questions = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions || '[]') : quiz.questions
                      return (
                        <button
                          key={quiz.id}
                          onClick={() => setCurrentPage('quiz')}
                          className="w-full px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">{quiz.title}</h3>
                            <p className="text-sm text-gray-500">{questions.length} questions</p>
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(quiz.created_at)}</span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Classes</h1>
            <p className="text-gray-600">Organize your notes, flashcards, and quizzes by class</p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Class
          </button>
        </div>

        {/* Create New Class Form */}
        {isCreating && (
          <div className="bg-white p-6 rounded-xl shadow-md mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Create New Class</h3>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Class name (e.g. Math 151)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && createClass()}
              />
              <div className="flex items-center gap-2">
                {CLASS_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewClassColor(color)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      newClassColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button
                onClick={createClass}
                disabled={!newClassName.trim()}
                className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setIsCreating(false)
                  setNewClassName('')
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Classes List */}
        {classes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-md">
            <GraduationCap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No classes yet</h3>
            <p className="text-gray-500 mb-4">Create your first class to organize your study materials</p>
            <button
              onClick={() => setIsCreating(true)}
              className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Class
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {classes.map((cls) => (
              <div
                key={cls.id}
                onClick={() => editingId !== cls.id && setSelectedClass(cls)}
                className={`bg-white p-4 rounded-xl shadow-md flex items-center gap-4 ${
                  editingId !== cls.id ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
                }`}
              >
                {editingId === cls.id ? (
                  <>
                    <div
                      className="w-4 h-12 rounded-full flex-shrink-0"
                      style={{ backgroundColor: editColor }}
                    />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.key === 'Enter' && updateClass(cls.id)}
                    />
                    <div className="flex items-center gap-1">
                      {CLASS_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditColor(color)
                          }}
                          className={`w-6 h-6 rounded-full transition-transform ${
                            editColor === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        updateClass(cls.id)
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingId(null)
                      }}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="w-4 h-12 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cls.color }}
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                      <p className="text-sm text-gray-500">Click to view items</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                    <button
                      onClick={(e) => startEditing(cls, e)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(cls.id, e)}
                      className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ClassManager
