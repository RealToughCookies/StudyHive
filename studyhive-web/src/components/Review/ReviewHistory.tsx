import { parseStoredDate } from '../../services/dates'
import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { Trophy, Timer, Calendar, RotateCcw } from 'lucide-react'
import { QuizAttempt, Quiz, PomodoroSession } from '../../types'
import QuizTaker from '../Quiz/QuizTaker'

const ReviewHistory = () => {
  const { currentUser, setCurrentPage } = useStore()
  const [quizAttempts, setQuizAttempts] = useState<(QuizAttempt & { quiz: Quiz })[]>([])
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([])
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [activeTab, setActiveTab] = useState<'quizzes' | 'pomodoro'>('quizzes')
  const [filterDays, setFilterDays] = useState(30)

  useEffect(() => {
    loadQuizAttempts()
    loadPomodoroSessions()
  }, [currentUser, filterDays])

  const loadQuizAttempts = async () => {
    if (!currentUser) return
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - filterDays)
      const attempts = await window.electronAPI.db.query(
        'SELECT qa.*, q.title as quiz_title, q.questions FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id = q.id WHERE qa.user_id = ? AND datetime(qa.completed_at) >= datetime(?) ORDER BY qa.completed_at DESC',
        [currentUser.id, cutoffDate.toISOString()]
      )
      const attemptsWithParsedData = (attempts || []).map((attempt: any) => ({
        ...attempt,
        answers: typeof attempt.answers === 'string' ? JSON.parse(attempt.answers) : attempt.answers,
        quiz: {
          id: attempt.quiz_id,
          title: attempt.quiz_title,
          questions: typeof attempt.questions === 'string' ? JSON.parse(attempt.questions) : attempt.questions,
          user_id: currentUser.id,
          created_at: ''
        }
      }))
      setQuizAttempts(attemptsWithParsedData)
    } catch (error) {
      console.error('Failed to load quiz attempts:', error)
    }
  }

  const loadPomodoroSessions = async () => {
    if (!currentUser) return
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - filterDays)
      const sessions = await window.electronAPI.db.query(
        'SELECT * FROM pomodoro_sessions WHERE user_id = ? AND completed = 1 AND datetime(completed_at) >= datetime(?) ORDER BY completed_at DESC',
        [currentUser.id, cutoffDate.toISOString()]
      )
      setPomodoroSessions(sessions || [])
    } catch (error) {
      console.error('Failed to load pomodoro sessions:', error)
    }
  }

  const retryQuiz = (quizAttempt: QuizAttempt & { quiz: Quiz }) => {
    setSelectedQuiz(quizAttempt.quiz)
  }

  const formatDate = (dateStr: string) => {
    const date = parseStoredDate(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100
    if (percentage >= 70) return 'text-green-600'
    if (percentage >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number, total: number) => {
    const percentage = (score / total) * 100
    if (percentage >= 70) return 'bg-green-50 border-green-200'
    if (percentage >= 50) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const totalMinutesStudied = pomodoroSessions.reduce((sum, session) => sum + session.duration_minutes, 0)
  const avgQuizScore = quizAttempts.length > 0 ? Math.round(quizAttempts.reduce((sum, attempt) => sum + (attempt.score / attempt.total) * 100, 0) / quizAttempts.length) : 0

  if (selectedQuiz) {
    return <QuizTaker quiz={selectedQuiz} onExit={() => { setSelectedQuiz(null); loadQuizAttempts() }} />
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Review History</h1>
          <p className="text-gray-600">Track your learning progress over time</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Quiz Attempts</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{quizAttempts.length}</p>
              </div>
              <Trophy className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Average Score</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{avgQuizScore}%</p>
              </div>
              <Trophy className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Minutes Studied</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{totalMinutesStudied}</p>
              </div>
              <Timer className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md mb-6">
          <div className="flex border-b border-gray-200">
            <button onClick={() => setActiveTab('quizzes')} className={'flex-1 px-6 py-4 text-center font-semibold transition-colors ' + (activeTab === 'quizzes' ? 'text-primary border-b-2 border-primary' : 'text-gray-600 hover:text-gray-900')}>Quiz History</button>
            <button onClick={() => setActiveTab('pomodoro')} className={'flex-1 px-6 py-4 text-center font-semibold transition-colors ' + (activeTab === 'pomodoro' ? 'text-primary border-b-2 border-primary' : 'text-gray-600 hover:text-gray-900')}>Pomodoro Sessions</button>
          </div>
          <div className="p-6">
            <div className="flex gap-3 mb-6">
              <button onClick={() => setFilterDays(7)} className={'px-4 py-2 rounded-lg font-medium transition-colors ' + (filterDays === 7 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>Last 7 Days</button>
              <button onClick={() => setFilterDays(30)} className={'px-4 py-2 rounded-lg font-medium transition-colors ' + (filterDays === 30 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>Last 30 Days</button>
              <button onClick={() => setFilterDays(90)} className={'px-4 py-2 rounded-lg font-medium transition-colors ' + (filterDays === 90 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>Last 90 Days</button>
            </div>
            {activeTab === 'quizzes' && (
              <div className="space-y-4">
                {quizAttempts.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No quiz attempts yet</h3>
                    <p className="text-gray-500 mb-4">Take a quiz to see your history here</p>
                    <button onClick={() => setCurrentPage('quiz')} className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors">Go to Quizzes</button>
                  </div>
                ) : (
                  quizAttempts.map((attempt) => {
                    const percentage = Math.round((attempt.score / attempt.total) * 100)
                    return (
                      <div key={attempt.id} className={'p-6 rounded-xl border-2 ' + getScoreBgColor(attempt.score, attempt.total)}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-2">{attempt.quiz.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                              <div className="flex items-center gap-1"><Calendar className="w-4 h-4" />{formatDate(attempt.completed_at)}</div>
                              <div className={'font-semibold ' + getScoreColor(attempt.score, attempt.total)}>Score: {attempt.score}/{attempt.total} ({percentage}%)</div>
                            </div>
                          </div>
                          <button onClick={() => retryQuiz(attempt)} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"><RotateCcw className="w-4 h-4" />Retry</button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
            {activeTab === 'pomodoro' && (
              <div className="space-y-4">
                {pomodoroSessions.length === 0 ? (
                  <div className="text-center py-12">
                    <Timer className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No pomodoro sessions yet</h3>
                    <p className="text-gray-500 mb-4">Complete a pomodoro session to see your history here</p>
                    <button onClick={() => setCurrentPage('timer')} className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors">Go to Timer</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pomodoroSessions.map((session) => (
                      <div key={session.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <Timer className="w-5 h-5 text-primary" />
                          <span className="text-lg font-bold text-gray-900">{session.duration_minutes} min</span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(session.completed_at || '')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewHistory
