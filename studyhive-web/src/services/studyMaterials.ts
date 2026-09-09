import { useStore } from '../store'

export function assertActiveAccount(userId: number) {
  if (useStore.getState().currentUser?.id !== userId) {
    throw new Error('The active account changed. Please try again from your current account.')
  }
}

export async function saveFlashcardDeck(
  userId: number, name: string, cards: { front: string; back: string }[],
  classId?: number | null, noteId?: number | null,
) {
  assertActiveAccount(userId)
  const results = await window.electronAPI.db.batch([
    {
      sql: 'INSERT INTO flashcard_decks (user_id, name, class_id, note_id) VALUES (?, ?, ?, ?)',
      params: [userId, name, classId ?? null, noteId ?? null],
    },
    ...cards.map(card => ({
      sql: 'INSERT INTO flashcards (user_id, deck_id, note_id, class_id, front, back) VALUES (?, ?, ?, ?, ?, ?)',
      params: [userId, { insertIdFrom: 0 }, noteId ?? null, classId ?? null, card.front, card.back],
    })),
  ])
  return results[0].lastInsertRowid
}
