import { useState, useRef } from 'react'
import { useStore } from '../../store'
import { ArrowLeft, Check, X, ChevronRight, Trophy, RotateCcw } from 'lucide-react'
import { Quiz } from '../../types'

interface QuizTakerProps {
  quiz: Quiz
  onExit: () => void
}

const QuizTaker = ({ quiz, onExit }: QuizTakerProps) => {
  const { currentUser } = useStore()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>(new Array(quiz.questions.length).fill(-1))
  const [isCompleted, setIsCompleted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const submitting = useRef(false)
  const [, setSavedAttemptId] = useState<number | null>(null)

  const currentQuestion = quiz.questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100

  const handleAnswerSelect = (optionIndex: number) => {
    if (isCompleted || submitting.current) return
    const newAnswers = [...selectedAnswers]
    newAnswers[currentQuestionIndex] = optionIndex
    setSelectedAnswers(newAnswers)
  }

  const handleNext = () => {
    if (submitting.current) return
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (submitting.current) return
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleSubmit = async () => {
    if (submitting.current || isCompleted || !currentUser) return
    if (selectedAnswers.includes(-1)) {
      if (!confirm('You have unanswered questions. Submit anyway?')) return
    }
    submitting.current = true
    setIsSaving(true)
    setSaveError('')
    const score = selectedAnswers.reduce((acc, answer, index) => acc + (answer === quiz.questions[index].correct ? 1 : 0), 0)
    if (currentUser) {
      try {
        const result = await window.electronAPI.db.run(
          'INSERT INTO quiz_attempts (quiz_id, user_id, score, total, answers, completed_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))',
          [quiz.id, currentUser.id, score, quiz.questions.length, JSON.stringify(selectedAnswers)]
        )
        setSavedAttemptId(result.lastInsertRowid)
      } catch (error) {
        console.error('Failed to save quiz attempt:', error)
        setSaveError('Could not save your attempt. Please try again.')
        submitting.current = false
        setIsSaving(false)
        return
      }
    }
    setIsSaving(false)
    setIsCompleted(true)
  }

  const handleRetry = () => {
    setCurrentQuestionIndex(0)
    setSelectedAnswers(new Array(quiz.questions.length).fill(-1))
    setIsCompleted(false)
    submitting.current = false
    setSaveError('')
    setSavedAttemptId(null)
  }

  const calculateScore = () => selectedAnswers.reduce((acc, answer, index) => acc + (answer === quiz.questions[index].correct ? 1 : 0), 0)

  const score = calculateScore()
  const percentage = Math.round((score / quiz.questions.length) * 100)
  const getScoreColor = () => percentage >= 70 ? 'text-green-500' : percentage >= 50 ? 'text-yellow-500' : 'text-red-500'
  const getScoreMessage = () => percentage >= 70 ? 'Great job!' : percentage >= 50 ? 'Good effort!' : 'Keep studying!'
  const getBorderColor = (isCorrect: boolean) => isCorrect ? 'border-green-200' : 'border-red-200'

  if (!currentQuestion) return (
    <div className="p-8"><p>This quiz has no questions.</p><button onClick={onExit}>Back to Quizzes</button></div>
  )

  if (isCompleted) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onExit} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
            <div><h2 className="text-xl font-bold text-gray-900">Quiz Results</h2><p className="text-sm text-gray-600">{quiz.title}</p></div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center mb-8">
              <Trophy className={'w-24 h-24 mx-auto mb-6 ' + getScoreColor()} />
              <h3 className="text-4xl font-bold text-gray-900 mb-2">{score} / {quiz.questions.length}</h3>
              <p className="text-2xl text-gray-600 mb-6">{percentage}%</p>
              <p className="text-lg text-gray-700 mb-8">{getScoreMessage()}</p>
              <div className="flex gap-3 justify-center">
                <button onClick={handleRetry} className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"><RotateCcw className="w-5 h-5" />Retry Quiz</button>
                <button onClick={onExit} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors">Back to Quizzes</button>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-900">Review Answers</h3>
              {quiz.questions.map((question, index) => {
                const userAnswer = selectedAnswers[index]
                const isCorrect = userAnswer === question.correct
                return (
                  <div key={index} className={'bg-white p-6 rounded-xl shadow-md border-2 ' + getBorderColor(isCorrect)}>
                    <div className="flex items-start gap-3 mb-4">
                      {isCorrect ? <Check className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" /> : <X className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-3">Question {index + 1}: {question.question}</p>
                        <div className="space-y-2">
                          {question.options.map((option, optIndex) => {
                            const isUserAnswer = userAnswer === optIndex
                            const isCorrectAnswer = question.correct === optIndex
                            const optClass = isCorrectAnswer ? 'bg-green-100 border-2 border-green-500' : isUserAnswer ? 'bg-red-100 border-2 border-red-500' : 'bg-gray-50'
                            return (
                              <div key={optIndex} className={'p-3 rounded-lg ' + optClass}>
                                <div className="flex items-center gap-2">
                                  {isCorrectAnswer && <Check className="w-5 h-5 text-green-600" />}
                                  {isUserAnswer && !isCorrectAnswer && <X className="w-5 h-5 text-red-600" />}
                                  <span className={isCorrectAnswer || isUserAnswer ? 'font-medium' : ''}>{option}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isSelected = (index: number) => selectedAnswers[currentQuestionIndex] === index
  const getOptionClass = (index: number) => isSelected(index) ? 'border-primary bg-primary/5 font-medium' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
  const getRadioClass = (index: number) => isSelected(index) ? 'border-primary bg-primary' : 'border-gray-300'

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div><h2 className="text-xl font-bold text-gray-900">{quiz.title}</h2><p className="text-sm text-gray-600">Question {currentQuestionIndex + 1} of {quiz.questions.length}</p></div>
        </div>
      </div>
      <div className="bg-gray-200 h-2"><div className="bg-gradient-to-r from-primary to-primary-dark h-full transition-all duration-300" style={{ width: `${progress}%` }} /></div>
      <div className="flex-1 overflow-y-auto p-8">
        {saveError && <p role="alert" className="text-red-600 mb-4">{saveError}</p>}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <p className="text-sm font-medium text-gray-500 mb-4">Question {currentQuestionIndex + 1}</p>
            <h3 className="text-2xl font-bold text-gray-900 mb-8">{currentQuestion.question}</h3>
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button key={index} onClick={() => handleAnswerSelect(index)} className={'w-full text-left p-4 rounded-lg border-2 transition-all ' + getOptionClass(index)}>
                  <div className="flex items-center gap-3">
                    <div className={'w-6 h-6 rounded-full border-2 flex items-center justify-center ' + getRadioClass(index)}>
                      {isSelected(index) && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <span className="flex-1">{option}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <button onClick={handlePrevious} disabled={currentQuestionIndex === 0} className="px-6 py-3 bg-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed">Previous</button>
            <div className="flex gap-2">
              {quiz.questions.map((_, index) => {
                const dotClass = index === currentQuestionIndex ? 'bg-primary' : selectedAnswers[index] !== -1 ? 'bg-green-500' : 'bg-gray-300'
                return <div key={index} className={'w-3 h-3 rounded-full ' + dotClass} />
              })}
            </div>
            {currentQuestionIndex === quiz.questions.length - 1 ? (
              <button onClick={handleSubmit} disabled={isSaving} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all">{isSaving ? 'Saving...' : 'Submit Quiz'}</button>
            ) : (
              <button onClick={handleNext} disabled={currentQuestionIndex === quiz.questions.length - 1} className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">Next<ChevronRight className="w-5 h-5" /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuizTaker
