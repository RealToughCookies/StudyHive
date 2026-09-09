import { notePlainText } from '../../services/noteContent'
import { parseStoredDate } from '../../services/dates'
import { assertActiveAccount } from '../../services/studyMaterials'
import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { Search, ClipboardList, Trash2, Play, Sparkles, Calendar, Tag, ChevronDown, Crown } from 'lucide-react'
import { Quiz, Note, Class } from '../../types'
import QuizTaker from './QuizTaker'
import { generateQuiz } from '../../services/openai'

const QuizList = () => {
  const { currentUser, settings } = useStore()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClassFilter, setSelectedClassFilter] = useState<number | 'all'>('all')
  const [classMenuOpen, setClassMenuOpen] = useState<number | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    loadQuizzes()
    loadNotes()
    loadClasses()
  }, [currentUser, settings])

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

  const getClassById = (classId?: number) => classes.find(c => c.id === classId)

  const assignQuizToClass = async (quizId: number, classId: number | null) => {
    try {
      await window.electronAPI.db.run(
        'UPDATE quizzes SET class_id = ? WHERE id = ?',
        [classId, quizId]
      )
      setQuizzes(quizzes.map(q => q.id === quizId ? { ...q, class_id: classId || undefined } : q))
      setClassMenuOpen(null)
    } catch (error) {
      console.error('Failed to assign class:', error)
    }
  }

  const loadQuizzes = async () => {
    if (!currentUser) return
    try {
      const results = await window.electronAPI.db.query(
        'SELECT * FROM quizzes WHERE user_id = ? ORDER BY created_at DESC',
        [currentUser.id]
      )
      const quizzesWithParsedQuestions = (results || []).map((quiz: any) => ({
        ...quiz,
        questions: typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions
      }))
      setQuizzes(quizzesWithParsedQuestions)
    } catch (error) {
      console.error('Failed to load quizzes:', error)
    }
  }

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

  const generateFromNote = async (noteId: number) => {
    if (!currentUser) return
    const note = notes.find(n => n.id === noteId)
    if (!note) return
    if (!settings?.openai_api_key) {
      alert('Please add your OpenAI API key in Settings to use AI features.')
      return
    }
    setIsGenerating(true)
    try {
      const generatedQuestions = await generateQuiz(notePlainText(note.content), settings.openai_api_key)
      assertActiveAccount(currentUser.id)
      await window.electronAPI.db.run(
        `INSERT INTO quizzes (user_id, note_id, class_id, title, questions, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [currentUser.id, noteId, note.class_id || null, `Quiz: ${note.title}`, JSON.stringify(generatedQuestions)]
      )
      setShowGenerateModal(false)
      loadQuizzes()
      alert(`Successfully generated quiz with ${generatedQuestions.length} questions!`)
    } catch (error: any) {
      console.error('Failed to generate quiz:', error)
      alert(error.message || 'Failed to generate quiz')
    } finally {
      setIsGenerating(false)
    }
  }

  const deleteQuiz = async (id: number) => {
    if (!confirm('Delete this quiz? This will also delete all associated attempts.')) return
    try {
      await window.electronAPI.db.run('DELETE FROM quiz_attempts WHERE quiz_id = ?', [id])
      await window.electronAPI.db.run('DELETE FROM quizzes WHERE id = ?', [id])
      setQuizzes(quizzes.filter(q => q.id !== id))
    } catch (error) {
      console.error('Failed to delete quiz:', error)
    }
  }

  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesClass = selectedClassFilter === 'all' || quiz.class_id === selectedClassFilter
    return matchesSearch && matchesClass
  })

  const formatDate = (dateStr: string) => {
    const date = parseStoredDate(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (selectedQuiz) {
    return (
      <QuizTaker
        quiz={selectedQuiz}
        onExit={() => {
          setSelectedQuiz(null)
          loadQuizzes()
        }}
      />
    )
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">Quizzes</h1>
              <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                <Crown className="w-3.5 h-3.5" />
                Premium
              </span>
            </div>
            <p className="text-gray-600">Test your knowledge with AI-generated quizzes</p>
          </div>
          <button onClick={() => setShowGenerateModal(true)} className="bg-gradient-to-r from-primary to-primary-dark text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors hover:opacity-90">
            <Sparkles className="w-5 h-5" />Generate Quiz
          </button>
        </div>
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Search quizzes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
          </div>
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
          >
            <option value="all">All Classes</option>
            <option value="">Unassigned</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>
        {filteredQuizzes.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">{searchQuery ? 'No quizzes found' : 'No quizzes yet'}</h3>
            <p className="text-gray-500 mb-4">{searchQuery ? 'Try a different search term' : 'Generate a quiz from your notes to get started'}</p>
            {!searchQuery && (
              <button onClick={() => setShowGenerateModal(true)} className="bg-gradient-to-r from-primary to-primary-dark text-white px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2 transition-colors hover:opacity-90">
                <Sparkles className="w-5 h-5" />Generate Quiz
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuizzes.map((quiz) => {
              const quizClass = getClassById(quiz.class_id)
              return (
                <div key={quiz.id} className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow relative">
                  {/* Class indicator */}
                  {quizClass && (
                    <div
                      className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                      style={{ backgroundColor: quizClass.color }}
                    />
                  )}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{quiz.title}</h3>
                    <p className="text-sm text-gray-600">{quiz.questions.length} questions</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />{formatDate(quiz.created_at)}
                    </div>
                    {quizClass && (
                      <span
                        className="px-2 py-0.5 rounded-full text-white text-xs"
                        style={{ backgroundColor: quizClass.color }}
                      >
                        {quizClass.name}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    {/* Class assignment dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setClassMenuOpen(classMenuOpen === quiz.id ? null : quiz.id)}
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 p-2 rounded hover:bg-gray-50 transition-colors text-sm"
                      >
                        <Tag className="w-4 h-4" />
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {classMenuOpen === quiz.id && (
                        <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[150px]">
                          <button
                            onClick={() => assignQuizToClass(quiz.id, null)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-600"
                          >
                            No Class
                          </button>
                          {classes.map((cls) => (
                            <button
                              key={cls.id}
                              onClick={() => assignQuizToClass(quiz.id, cls.id)}
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
                    <button onClick={() => setSelectedQuiz(quiz)} className="flex-1 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors">
                      <Play className="w-4 h-4" />Take Quiz
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteQuiz(quiz.id) }} className="text-red-600 hover:text-red-700 p-2 rounded hover:bg-red-50 transition-colors" title="Delete quiz">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Generate Quiz</h2>
              <p className="text-gray-600 mb-6">Select a note to generate a quiz from using AI</p>
              {notes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No notes found. Create a note first to generate a quiz.</p>
              ) : (
                <div className="space-y-3 mb-6">
                  {notes.map((note) => (
                    <button key={note.id} onClick={() => generateFromNote(note.id)} disabled={isGenerating} className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <h3 className="font-semibold text-gray-900 mb-1">{note.title}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{note.content || 'Empty note'}</p>
                    </button>
                  ))}
                </div>
              )}
              {isGenerating && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-blue-900 font-medium">Generating quiz with AI...</span>
                  </div>
                </div>
              )}
              <button onClick={() => setShowGenerateModal(false)} disabled={isGenerating} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuizList
