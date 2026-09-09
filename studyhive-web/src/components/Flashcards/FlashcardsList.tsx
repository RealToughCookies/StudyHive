import { notePlainText } from '../../services/noteContent'
import { saveFlashcardDeck } from '../../services/studyMaterials'
import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { Plus, Search, GraduationCap, Trash2, Play, Sparkles, ArrowLeft, BookOpen, Layers, X, Check } from 'lucide-react'
import { Flashcard, FlashcardDeck, Note, Class } from '../../types'
import StudySession from './StudySession'
import { generateFlashcards } from '../../services/openai'

type DeckWithCount = FlashcardDeck & { card_count: number }

const FlashcardsList = () => {
  const { currentUser, settings } = useStore()
  const [decks, setDecks] = useState<DeckWithCount[]>([])
  const [activeDeck, setActiveDeck] = useState<DeckWithCount | null>(null)
  const [deckCards, setDeckCards] = useState<Flashcard[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [isStudying, setIsStudying] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // New deck modal
  const [showNewDeckModal, setShowNewDeckModal] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckClassId, setNewDeckClassId] = useState<number | undefined>()
  const [pendingCards, setPendingCards] = useState<{ front: string; back: string }[]>([])
  const [cardFront, setCardFront] = useState('')
  const [cardBack, setCardBack] = useState('')

  // Add card to open deck
  const [showAddCard, setShowAddCard] = useState(false)
  const [addFront, setAddFront] = useState('')
  const [addBack, setAddBack] = useState('')

  // Generate from note
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (currentUser) {
      loadDecks()
      loadClasses()
      loadNotes()
    }
  }, [currentUser, settings])

  // Escape closes the new deck modal
  useEffect(() => {
    if (!showNewDeckModal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeNewDeckModal() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showNewDeckModal])

  const loadDecks = async () => {
    if (!currentUser) return
    try {
      const results = await window.electronAPI.db.query(
        `SELECT d.*, COUNT(f.id) as card_count
         FROM flashcard_decks d
         LEFT JOIN flashcards f ON f.deck_id = d.id
         WHERE d.user_id = ?
         GROUP BY d.id
         ORDER BY d.created_at DESC`,
        [currentUser.id]
      )
      setDecks(results || [])
    } catch (error) {
      console.error('Failed to load decks:', error)
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

  const loadNotes = async () => {
    if (!currentUser) return
    try {
      const results = await window.electronAPI.db.query(
        'SELECT id, title, class_id, content FROM notes WHERE user_id = ? ORDER BY updated_at DESC',
        [currentUser.id]
      )
      setNotes(results || [])
    } catch (error) {
      console.error('Failed to load notes:', error)
    }
  }

  const openDeck = async (deck: DeckWithCount) => {
    setActiveDeck(deck)
    try {
      const cards = await window.electronAPI.db.query(
        'SELECT * FROM flashcards WHERE deck_id = ? ORDER BY created_at ASC',
        [deck.id]
      )
      setDeckCards(cards || [])
    } catch (error) {
      console.error('Failed to load deck cards:', error)
    }
  }

  const closeDeck = () => {
    setActiveDeck(null)
    setDeckCards([])
    setIsStudying(false)
    setShowAddCard(false)
    setAddFront('')
    setAddBack('')
  }

  const createDeck = async () => {
    if (!newDeckName.trim() || !currentUser) return
    try {
      await saveFlashcardDeck(currentUser.id, newDeckName.trim(), pendingCards, newDeckClassId)
      closeNewDeckModal()
      loadDecks()
    } catch (error) {
      console.error('Failed to create deck:', error)
    }
  }

  const closeNewDeckModal = () => {
    setShowNewDeckModal(false)
    setNewDeckName('')
    setNewDeckClassId(undefined)
    setPendingCards([])
    setCardFront('')
    setCardBack('')
  }

  const deleteDeck = async (deckId: number) => {
    if (!confirm('Delete this deck and all its cards?')) return
    try {
      await window.electronAPI.db.run('DELETE FROM flashcard_decks WHERE id = ?', [deckId])
      if (activeDeck?.id === deckId) closeDeck()
      loadDecks()
    } catch (error) {
      console.error('Failed to delete deck:', error)
    }
  }

  const addCardToDeck = async () => {
    if (!addFront.trim() || !addBack.trim() || !activeDeck || !currentUser) return
    try {
      await window.electronAPI.db.run(
        `INSERT INTO flashcards (user_id, deck_id, class_id, front, back, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [currentUser.id, activeDeck.id, activeDeck.class_id || null, addFront.trim(), addBack.trim()]
      )
      setAddFront('')
      setAddBack('')
      setShowAddCard(false)
      const updatedDeck = { ...activeDeck, card_count: activeDeck.card_count + 1 }
      setActiveDeck(updatedDeck)
      await openDeck(updatedDeck)
      loadDecks()
    } catch (error) {
      console.error('Failed to add card:', error)
    }
  }

  const deleteCard = async (cardId: number) => {
    if (!confirm('Delete this card?')) return
    try {
      await window.electronAPI.db.run('DELETE FROM flashcards WHERE id = ?', [cardId])
      setDeckCards(cards => cards.filter(c => c.id !== cardId))
      if (activeDeck) {
        setActiveDeck({ ...activeDeck, card_count: Math.max(0, activeDeck.card_count - 1) })
        loadDecks()
      }
    } catch (error) {
      console.error('Failed to delete card:', error)
    }
  }

  const generateFromNote = async (note: Note) => {
    if (!currentUser) return
    if (!settings?.openai_api_key) {
      alert('Please add your OpenAI API key in Settings to use AI features.')
      return
    }
    setIsGenerating(true)
    try {
      const generatedCards = await generateFlashcards(notePlainText(note.content), settings.openai_api_key)
      await saveFlashcardDeck(currentUser.id, note.title, generatedCards, note.class_id, note.id)
      setShowGenerateModal(false)
      loadDecks()
      alert(`Created deck "${note.title}" with ${generatedCards.length} flashcards!`)
    } catch (error: any) {
      console.error('Failed to generate flashcards:', error)
      alert(error.message || 'Failed to generate flashcards')
    } finally {
      setIsGenerating(false)
    }
  }

  const filteredDecks = decks.filter(deck =>
    deck.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Study view
  if (isStudying && activeDeck) {
    return (
      <StudySession
        flashcards={deckCards}
        onExit={() => {
          setIsStudying(false)
          openDeck(activeDeck)
        }}
      />
    )
  }

  // Deck detail view
  if (activeDeck) {
    const deckClass = classes.find(c => c.id === activeDeck.class_id)
    return (
      <div className="p-8 h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={closeDeck}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{activeDeck.name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                <span>{deckCards.length} card{deckCards.length !== 1 ? 's' : ''}</span>
                {deckClass && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: deckClass.color + '22', color: deckClass.color }}
                    >
                      {deckClass.name}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowAddCard(true)}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Card
            </button>
            {deckCards.length > 0 && (
              <button
                onClick={() => setIsStudying(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Play className="w-4 h-4" />
                Study
              </button>
            )}
          </div>

          {/* Cards */}
          {deckCards.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No cards yet</h3>
              <p className="text-gray-500 mb-6">Add your first card to get started</p>
              <button
                onClick={() => setShowAddCard(true)}
                className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add First Card
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deckCards.map((card, i) => (
                <div key={card.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 group relative">
                  <span className="absolute top-3 right-3 text-xs text-gray-300 font-mono select-none">#{i + 1}</span>
                  <div className="mb-3 pr-6">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Front</p>
                    <p className="text-gray-900 text-sm leading-relaxed">{card.front}</p>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Back</p>
                    <p className="text-gray-600 text-sm leading-relaxed">{card.back}</p>
                  </div>
                  <button
                    onClick={() => deleteCard(card.id)}
                    className="absolute bottom-3 right-3 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                    title="Delete card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add card modal */}
        {showAddCard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Add Card</h2>
              <div className="space-y-3 mb-4">
                <textarea
                  value={addFront}
                  onChange={e => setAddFront(e.target.value)}
                  placeholder="Front (question / term)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm outline-none"
                  autoFocus
                />
                <textarea
                  value={addBack}
                  onChange={e => setAddBack(e.target.value)}
                  placeholder="Back (answer / definition)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={addCardToDeck}
                  disabled={!addFront.trim() || !addBack.trim()}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors disabled:opacity-40"
                >
                  Add Card
                </button>
                <button
                  onClick={() => { setShowAddCard(false); setAddFront(''); setAddBack('') }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Deck list view
  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Flashcards</h1>
            <p className="text-gray-500">{decks.length} deck{decks.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="bg-gradient-to-r from-primary to-primary-dark text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Sparkles className="w-4 h-4" />
              Generate from Note
            </button>
            <button
              onClick={() => setShowNewDeckModal(true)}
              className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Deck
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search decks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Deck grid */}
        {filteredDecks.length === 0 ? (
          <div className="text-center py-16">
            <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              {searchQuery ? 'No decks found' : 'No decks yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery ? 'Try a different search' : 'Create a deck or generate one from your notes'}
            </p>
            {!searchQuery && (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="bg-gradient-to-r from-primary to-primary-dark text-white px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <Sparkles className="w-5 h-5" />
                  Generate from Note
                </button>
                <button
                  onClick={() => setShowNewDeckModal(true)}
                  className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  New Deck
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDecks.map(deck => {
              const deckClass = classes.find(c => c.id === deck.class_id)
              return (
                <div
                  key={deck.id}
                  onClick={() => openDeck(deck)}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group overflow-hidden"
                >
                  {/* Color stripe */}
                  <div
                    className="h-1.5"
                    style={{ backgroundColor: deckClass?.color || 'var(--color-primary, #3b82f6)' }}
                  />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {deck.name}
                      </h3>
                      <button
                        onClick={e => { e.stopPropagation(); deleteDeck(deck.id) }}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                        title="Delete deck"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{deck.card_count} card{deck.card_count !== 1 ? 's' : ''}</span>
                        {deckClass && (
                          <>
                            <span className="text-gray-300 ml-0.5">·</span>
                            <span
                              className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: deckClass.color + '22', color: deckClass.color }}
                            >
                              {deckClass.name}
                            </span>
                          </>
                        )}
                      </div>
                      {deck.card_count > 0 && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            openDeck(deck).then(() => setIsStudying(true))
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-full transition-colors"
                        >
                          <Play className="w-3 h-3" />
                          Study
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* New deck modal */}
        {showNewDeckModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between p-5 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-gray-900">New Deck</h2>
                </div>
                <button onClick={closeNewDeckModal} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deck Name</label>
                  <input
                    type="text"
                    value={newDeckName}
                    onChange={e => setNewDeckName(e.target.value)}
                    placeholder="e.g. Biology Chapter 5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  />
                </div>
                {classes.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class (optional)</label>
                    <select
                      value={newDeckClassId || ''}
                      onChange={e => setNewDeckClassId(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white outline-none"
                    >
                      <option value="">No Class</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Add Cards</p>
                  <div className="space-y-2">
                    <textarea
                      value={cardFront}
                      onChange={e => setCardFront(e.target.value)}
                      placeholder="Front (question / term)"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <textarea
                      value={cardBack}
                      onChange={e => setCardBack(e.target.value)}
                      placeholder="Back (answer / definition)"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <button
                      onClick={() => {
                        if (!cardFront.trim() || !cardBack.trim()) return
                        setPendingCards(c => [...c, { front: cardFront.trim(), back: cardBack.trim() }])
                        setCardFront('')
                        setCardBack('')
                      }}
                      disabled={!cardFront.trim() || !cardBack.trim()}
                      className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                    >
                      + Add Card
                    </button>
                  </div>
                  {pendingCards.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs text-gray-400">{pendingCards.length} card{pendingCards.length !== 1 ? 's' : ''} ready</p>
                      {pendingCards.map((card, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-800 block truncate">{card.front}</span>
                            <span className="text-gray-500 block truncate">{card.back}</span>
                          </div>
                          <button
                            onClick={() => setPendingCards(c => c.filter((_, idx) => idx !== i))}
                            className="p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5 border-t border-gray-200">
                <button
                  onClick={createDeck}
                  disabled={!newDeckName.trim()}
                  className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Create Deck{pendingCards.length > 0 ? ` (${pendingCards.length} card${pendingCards.length !== 1 ? 's' : ''})` : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generate from note modal */}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Generate Flashcard Deck</h2>
              <p className="text-gray-500 mb-4 text-sm">AI will create a flashcard deck from your note</p>
              {notes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No notes found. Create a note first.</p>
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto mb-4">
                  {notes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => generateFromNote(note)}
                      disabled={isGenerating}
                      className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-semibold text-gray-900">{note.title}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {isGenerating && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-blue-800 text-sm font-medium">Generating with AI...</span>
                </div>
              )}
              <button
                onClick={() => setShowGenerateModal(false)}
                disabled={isGenerating}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FlashcardsList
