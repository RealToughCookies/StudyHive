import { cloudClient } from './client'
import { useStore } from '../../store'

type Value = string | number | boolean | null | undefined
type Fields = Record<string, Value>
const booleanColumns = new Set(['completed', 'is_visible', 'is_minimized', 'dark_mode', 'notification_sound', 'timer_sound', 'show_floating_timer', 'pause_on_blur', 'auto_resume_on_focus'])

function normalize(fields: Fields): Fields {
  return Object.fromEntries(Object.entries(fields).filter(([key, value]) => key !== 'openai_api_key' && value !== undefined)
    .map(([key, value]) => [key, booleanColumns.has(key) ? Boolean(value) : value]))
}

function account() {
  const user = useStore.getState().currentUser
  if (!cloudClient || !user) throw new Error('Sign in before accessing your study materials.')
  return user.id
}

function checkAccount(id: number) {
  if (useStore.getState().currentUser?.id !== id) throw new Error('Your account changed. Please try again.')
}

function filter(query: any, fields: Fields) {
  for (const [key, value] of Object.entries(normalize(fields))) {
    query = value === null ? query.is(key, null) : query.eq(key, value)
  }
  return query
}

async function result(query: any, userId: number, mutation = false) {
  const response = await query
  checkAccount(userId)
  if (response.error) throw response.error
  if (mutation) window.dispatchEvent(new CustomEvent('studyhive-data-updated'))
  return response
}

export const cloud = {
  async read(table: string, fields: Fields, order = 'id ASC', single = false, limit?: number): Promise<any> {
    const userId = account()
    const rows: any[] = []
    // Fetch all pages: PostgREST normally caps a response at 1,000 rows.
    for (let offset = 0; ; offset += 500) {
      let query = filter(cloudClient!.from(table).select('*').eq('user_id', userId), fields)
      for (const part of order.split(',')) {
        const [column, direction] = part.trim().split(/\s+/)
        query = query.order(column, { ascending: direction !== 'DESC' })
      }
      query = query.order('id').range(offset, offset + (single ? 1 : limit || 500) - 1)
      const { data } = await result(query, userId)
      rows.push(...data)
      if (single || limit || data.length < 500) break
    }
    return single ? rows[0] || null : rows
  },
  async count(table: string, fields: Fields) {
    const userId = account()
    const { count } = await result(filter(cloudClient!.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId), fields), userId)
    return { count: count || 0 }
  },
  async maximum(table: string, column: string, fields: Fields) {
    const row = await cloud.read(table, fields, `${column} DESC`, true)
    return { max: row?.[column] ?? null }
  },
  async insert(table: string, fields: Fields) {
    const userId = account()
    if (fields.user_id !== undefined && fields.user_id !== userId) throw new Error('Your account changed.')
    const { data } = await result(cloudClient!.from(table).insert({ ...normalize(fields), user_id: userId }).select('id').single(), userId, true)
    return { lastInsertRowid: data.id, changes: 1 }
  },
  async update(table: string, fields: Fields, where: Fields) {
    const userId = account()
    const { data } = await result(filter(cloudClient!.from(table).update(normalize(fields)).eq('user_id', userId), where).select('id'), userId, true)
    if (!data.length) throw new Error('This record was deleted or is no longer accessible.')
    return { changes: data.length, lastInsertRowid: 0 }
  },
  async remove(table: string, where: Fields) {
    const userId = account()
    const { data } = await result(filter(cloudClient!.from(table).delete().eq('user_id', userId), where).select('id'), userId, true)
    return { changes: data.length, lastInsertRowid: 0 }
  },
}

function localDate(timestamp: string) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function sessions(userId: Value) {
  return cloud.read('pomodoro_sessions', { user_id: userId, completed: true }, 'completed_at DESC')
}

export const special = {
  async studyDates(userId: Value) {
    return [...new Set<string>((await sessions(userId)).map((s: any) => localDate(s.completed_at)))].sort().reverse().map(study_date => ({ study_date }))
  },
  async dailyFocus(userId: Value, date: Value) {
    const rows = (await sessions(userId)).filter((s: any) => localDate(s.completed_at) === date)
    return { sessions: rows.length, minutes: rows.reduce((sum: number, s: any) => sum + s.duration_minutes, 0) }
  },
  async dailyTimerStats(userId: Value, date: Value) {
    const stats = await special.dailyFocus(userId, date)
    return { count: stats.sessions, total_minutes: stats.minutes }
  },
  async listDecks(userId: Value) {
    const [decks, cards] = await Promise.all([cloud.read('flashcard_decks', { user_id: userId }, 'created_at DESC'), cloud.read('flashcards', { user_id: userId })])
    const counts = new Map<number, number>()
    for (const card of cards) counts.set(card.deck_id, (counts.get(card.deck_id) || 0) + 1)
    return decks.map((deck: any) => ({ ...deck, card_count: counts.get(deck.id) || 0 }))
  },
  async quizHistory(userId: Value, since: Value) {
    const [attempts, quizzes] = await Promise.all([cloud.read('quiz_attempts', { user_id: userId }, 'completed_at DESC'), cloud.read('quizzes', { user_id: userId })])
    return attempts.filter((a: any) => new Date(a.completed_at).getTime() >= new Date(String(since)).getTime())
      .flatMap((a: any) => { const quiz = quizzes.find((q: any) => q.id === a.quiz_id); return quiz ? [{ ...a, quiz_title: quiz.title, questions: quiz.questions }] : [] })
  },
  async sessionHistory(userId: Value, since: Value) {
    return (await sessions(userId)).filter((s: any) => new Date(s.completed_at).getTime() >= new Date(String(since)).getTime())
  },
}
