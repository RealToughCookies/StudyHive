import { useState, useEffect } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Shuffle, Check, X, Keyboard } from 'lucide-react'
import { Flashcard } from '../../types'

interface StudySessionProps {
  flashcards: Flashcard[]
  onExit: () => void
}

// Shuffle array using Fisher-Yates algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const StudySession = ({ flashcards, onExit }: StudySessionProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [reviewedCards, setReviewedCards] = useState<Set<number>>(new Set())
  const [isShuffled, setIsShuffled] = useState(false)
  const [studyCards, setStudyCards] = useState(flashcards)
  const [knownCards, setKnownCards] = useState<Set<number>>(new Set())
  const [unknownCards, setUnknownCards] = useState<Set<number>>(new Set())
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return
      if ([' ', 'Enter', 'ArrowLeft', 'ArrowRight', '1', '2', 'k', 'u', 's', 'r', 'Escape', '?'].includes(e.key)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault()
          setIsFlipped(!isFlipped)
          break
        case 'ArrowLeft':
          e.preventDefault()
          prevCard()
          break
        case 'ArrowRight':
          e.preventDefault()
          nextCard()
          break
        case '1':
        case 'k':
          if (isFlipped) markAsKnown()
          break
        case '2':
        case 'u':
          if (isFlipped) markAsUnknown()
          break
        case 's':
          toggleShuffle()
          break
        case 'r':
          resetSession()
          break
        case 'Escape':
          onExit()
          break
        case '?':
          setShowKeyboardHelp(!showKeyboardHelp)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isFlipped, currentIndex, studyCards, reviewedCards, knownCards, unknownCards, isShuffled, showKeyboardHelp, onExit])

  const currentCard = studyCards[currentIndex]

  const nextCard = () => {
    if (currentIndex < studyCards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setIsFlipped(false)
      setReviewedCards(new Set([...reviewedCards, currentCard.id]))
    }
  }

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setIsFlipped(false)
    }
  }

  const toggleShuffle = () => {
    if (isShuffled) {
      setStudyCards(flashcards)
    } else {
      setStudyCards(shuffleArray(flashcards))
    }
    setIsShuffled(!isShuffled)
    setCurrentIndex(0)
    setIsFlipped(false)
    setReviewedCards(new Set())
    setKnownCards(new Set())
    setUnknownCards(new Set())
  }

  const markAsKnown = () => {
    if (!currentCard) return
    setReviewedCards(cards => new Set(cards).add(currentCard.id))
    setKnownCards(new Set([...knownCards, currentCard.id]))
    setUnknownCards(new Set([...unknownCards].filter(id => id !== currentCard.id)))
    if (currentIndex < studyCards.length - 1) {
      nextCard()
    }
  }

  const markAsUnknown = () => {
    if (!currentCard) return
    setReviewedCards(cards => new Set(cards).add(currentCard.id))
    setUnknownCards(new Set([...unknownCards, currentCard.id]))
    setKnownCards(new Set([...knownCards].filter(id => id !== currentCard.id)))
    if (currentIndex < studyCards.length - 1) {
      nextCard()
    }
  }

  const studyUnknownOnly = () => {
    const unknownFlashcards = flashcards.filter(card => unknownCards.has(card.id))
    if (unknownFlashcards.length > 0) {
      setStudyCards(unknownFlashcards)
      setCurrentIndex(0)
      setIsFlipped(false)
      setReviewedCards(new Set())
    }
  }

  const resetSession = () => {
    setCurrentIndex(0)
    setIsFlipped(false)
    setReviewedCards(new Set())
    setKnownCards(new Set())
    setUnknownCards(new Set())
    setStudyCards(isShuffled ? shuffleArray(flashcards) : flashcards)
  }

  const progress = ((currentIndex + 1) / studyCards.length) * 100
  const isComplete = studyCards.length > 0 && studyCards.every(card => reviewedCards.has(card.id))

  if (!currentCard) return (
    <div className="p-8"><p>No cards in this deck.</p><button onClick={onExit}>Back to Flashcards</button></div>
  )

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Exit (Esc)">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Study Session</h2>
            <p className="text-sm text-gray-600">
              Card {currentIndex + 1} of {studyCards.length}
              {knownCards.size > 0 && <span className="text-green-600 ml-2">✓{knownCards.size}</span>}
              {unknownCards.size > 0 && <span className="text-red-600 ml-2">✗{unknownCards.size}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
            className={`p-2 rounded-lg transition-colors ${showKeyboardHelp ? 'bg-primary text-white' : 'hover:bg-gray-100 text-gray-600'}`}
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            onClick={toggleShuffle}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isShuffled ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            title="Shuffle cards (S)"
          >
            <Shuffle className="w-4 h-4" />
            {isShuffled ? 'Shuffled' : 'Shuffle'}
          </button>
          <button onClick={resetSession} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Restart (R)">
            <RotateCcw className="w-4 h-4" />Restart
          </button>
        </div>
      </div>

      {/* Keyboard Help */}
      {showKeyboardHelp && (
        <div className="bg-blue-50 border-b border-blue-200 px-8 py-3 flex flex-wrap gap-4 text-sm">
          <span className="font-medium text-blue-900">Shortcuts:</span>
          <span className="text-blue-700"><kbd className="bg-white px-2 py-0.5 rounded shadow-sm">Space</kbd> Flip</span>
          <span className="text-blue-700"><kbd className="bg-white px-2 py-0.5 rounded shadow-sm">←</kbd><kbd className="bg-white px-2 py-0.5 rounded shadow-sm ml-1">→</kbd> Navigate</span>
          <span className="text-blue-700"><kbd className="bg-white px-2 py-0.5 rounded shadow-sm">K</kbd> Know it</span>
          <span className="text-blue-700"><kbd className="bg-white px-2 py-0.5 rounded shadow-sm">U</kbd> Don't know</span>
          <span className="text-blue-700"><kbd className="bg-white px-2 py-0.5 rounded shadow-sm">S</kbd> Shuffle</span>
          <span className="text-blue-700"><kbd className="bg-white px-2 py-0.5 rounded shadow-sm">R</kbd> Restart</span>
          <span className="text-blue-700"><kbd className="bg-white px-2 py-0.5 rounded shadow-sm">Esc</kbd> Exit</span>
        </div>
      )}
      <div className="bg-gray-200 h-2">
        <div className="bg-gradient-to-r from-primary to-primary-dark h-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-3xl">
          <div className="relative w-full h-96 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
            <div className="absolute inset-0 w-full h-full transition-transform duration-500" style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div className="absolute inset-0 w-full h-full bg-white rounded-2xl shadow-2xl p-12 flex flex-col items-center justify-center" style={{ backfaceVisibility: 'hidden' }}>
                <p className="text-sm font-medium text-gray-500 mb-4">Question</p>
                <p className="text-3xl font-bold text-gray-900 text-center">{currentCard.front}</p>
                <p className="text-sm text-gray-400 mt-8">Click to reveal answer</p>
              </div>
              <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-primary to-primary-dark rounded-2xl shadow-2xl p-12 flex flex-col items-center justify-center" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <p className="text-sm font-medium text-white/80 mb-4">Answer</p>
                <p className="text-3xl font-bold text-white text-center">{currentCard.back}</p>
                <p className="text-sm text-white/70 mt-8">Click to flip back</p>
              </div>
            </div>
          </div>
          {/* Know / Don't Know Buttons - show when flipped */}
          {isFlipped && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                onClick={markAsUnknown}
                className="flex items-center gap-2 px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-semibold transition-colors"
                title="Don't know (U)"
              >
                <X className="w-5 h-5" />
                Don't Know
              </button>
              <button
                onClick={markAsKnown}
                className="flex items-center gap-2 px-6 py-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-semibold transition-colors"
                title="Know it (K)"
              >
                <Check className="w-5 h-5" />
                Know It
              </button>
            </div>
          )}

          <div className="flex justify-center items-center gap-4 mt-8">
            <button onClick={prevCard} disabled={currentIndex === 0} className="p-4 bg-white rounded-full shadow-lg hover:shadow-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-lg" title="Previous card (←)">
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>
            <div className="px-6 py-3 bg-white rounded-full shadow-md">
              <span className="text-lg font-semibold text-gray-900">{currentIndex + 1} / {studyCards.length}</span>
            </div>
            <button onClick={nextCard} disabled={currentIndex === studyCards.length - 1} className="p-4 bg-white rounded-full shadow-lg hover:shadow-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-lg" title="Next card (→)">
              <ChevronRight className="w-6 h-6 text-gray-700" />
            </button>
          </div>

          {isComplete && (
            <div className="mt-8 p-6 bg-green-50 border-2 border-green-200 rounded-xl text-center">
              <h3 className="text-xl font-bold text-green-900 mb-2">Session Complete!</h3>
              <p className="text-green-700 mb-2">You've reviewed all {studyCards.length} flashcards</p>
              {(knownCards.size > 0 || unknownCards.size > 0) && (
                <p className="text-gray-600 mb-4">
                  <span className="text-green-600 font-semibold">{knownCards.size} known</span>
                  {' · '}
                  <span className="text-red-600 font-semibold">{unknownCards.size} need review</span>
                </p>
              )}
              <div className="flex gap-3 justify-center flex-wrap">
                {unknownCards.size > 0 && (
                  <button onClick={studyUnknownOnly} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                    Study Missed Cards ({unknownCards.size})
                  </button>
                )}
                <button onClick={resetSession} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">Study All Again</button>
                <button onClick={onExit} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors">Exit</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="bg-white border-t border-gray-200 px-8 py-3 text-center text-sm text-gray-500">Tip: Click the card to flip it, or use the arrow buttons to navigate</div>
    </div>
  )
}

export default StudySession
