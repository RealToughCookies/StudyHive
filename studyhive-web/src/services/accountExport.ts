import { cloudClient } from './cloud/client'
import { useStore } from '../store'

export const EXPORT_TABLES = {
  classes: 'id,user_id,name,color,created_at',
  notes: 'id,user_id,title,content,created_at,updated_at,class_id,revision',
  flashcard_decks: 'id,user_id,name,class_id,note_id,created_at,spaced_repetition_enabled',
  flashcards: 'id,user_id,note_id,deck_id,front,back,created_at,class_id',
  quizzes: 'id,user_id,note_id,title,questions,created_at,class_id',
  quiz_attempts: 'id,user_id,quiz_id,score,total,answers,completed_at',
  pomodoro_sessions: 'id,user_id,duration_minutes,completed,started_at,completed_at',
  settings: 'id,user_id,theme,dark_mode,pomodoro_work_minutes,pomodoro_break_minutes,pomodoro_long_break_minutes,notification_sound,timer_sound,show_floating_timer,pause_on_blur,auto_resume_on_focus,shortcuts',
  note_attachments: 'id,user_id,note_id,filename,original_name,file_type,file_size,created_at',
  sticky_notes: 'id,user_id,content,position_x,position_y,width,height,color,is_visible,is_minimized,created_at,updated_at',
  reminders: 'id,user_id,title,description,date,time,color,priority,repeat,completed,created_at,updated_at',
  card_reviews: 'card_id,user_id,due_at,interval_days,repetitions,revision',
  ai_jobs: 'id,user_id,kind,status,created_at,artifact_id,artifact_type',
} as const

type Row = Record<string, any>
const PROFILE_FIELDS = 'id,auth_user_id,username,email,subscription_tier,subscription_expires_at,created_at'
const MAX_BYTES = 50 * 1024 * 1024
const pick = (row: Row, fields: string): Row => Object.fromEntries(fields.split(',').map(key => [key, row[key]]))

async function readPage(client: NonNullable<typeof cloudClient>, userId: number, table: string, fields: string, key: string, cursor?: string | number): Promise<{ data: unknown; error: unknown }> {
  let query = client.from(table).select(fields).eq('user_id', userId).order(key, { ascending: true }).limit(20)
  if (cursor !== undefined) query = query.gt(key, cursor)
  return await query
}

// All reads use the caller's session and existing RLS. No service credentials or RPC grants.
export async function buildAccountExport(options: {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  maxBytes?: number;
} = {}, client = cloudClient) {
  if (!client) throw new Error('Cloud sign-in is required to export your study data.')
  const userId = useStore.getState().currentUser?.id
  if (!userId) throw new Error('Sign in before exporting.')
  let accountChanged = false
  const unsubscribe = useStore.subscribe(state => {
    if (state.currentUser?.id !== userId) accountChanged = true
  })
  const ensureActive = () => {
    if (options.signal?.aborted) throw new Error('Export cancelled.')
    if (accountChanged || useStore.getState().currentUser?.id !== userId) {
      throw new Error('Your account changed. Start a new export from your current account.')
    }
  }
  const limit = Math.min(options.maxBytes ?? MAX_BYTES, MAX_BYTES)
  let estimatedBytes = 1024
  const reserve = (bytes: number) => {
    estimatedBytes += bytes
    if (estimatedBytes > limit) throw new Error('Your export exceeds the 50 MB download limit. No partial export was downloaded.')
  }
  const encoder = new TextEncoder()
  try {
    ensureActive()
    options.onProgress?.('Verifying your account…')
    const auth = await client.auth.getUser()
    ensureActive()
    if (auth.error || !auth.data.user?.email_confirmed_at) throw new Error('Sign in with a verified account before exporting.')
    const profile = await client.from('users').select(PROFILE_FIELDS).eq('id', userId).eq('auth_user_id', auth.data.user.id).single()
    ensureActive()
    if (profile.error || !profile.data || profile.data.id !== userId || profile.data.auth_user_id !== auth.data.user.id) {
      throw new Error('Could not verify your account profile. No export was downloaded.')
    }
    const startedAt = new Date().toISOString()
    const tables: Record<string, Row[]> = { users: [pick(profile.data, PROFILE_FIELDS)] }
    reserve(encoder.encode(JSON.stringify(tables.users)).length)
    for (const [table, fields] of Object.entries(EXPORT_TABLES)) {
      const key = table === 'card_reviews' ? 'card_id' : 'id'
      const rows: Row[] = []
      let cursor: number | string | undefined
      options.onProgress?.(`Reading ${table.split('_').join(' ')}…`)
      while (true) {
        ensureActive()
        const response = await readPage(client, userId, table, fields, key, cursor)
        ensureActive()
        if (response.error || !Array.isArray(response.data)) throw new Error(`Could not export ${table.split('_').join(' ')}. Please retry.`)
        if (!response.data.length) break
        for (const entry of response.data as unknown as Row[]) {
          if (entry.user_id !== userId) throw new Error('Export stopped because a record did not belong to your account.')
          const next = entry[key]
          if ((typeof next !== 'string' && typeof next !== 'number') || (cursor !== undefined && next <= cursor)) {
            throw new Error('Export could not read a complete page of records. Please retry.')
          }
          const row = pick(entry, fields)
          reserve(encoder.encode(JSON.stringify(row)).length + 1)
          rows.push(row)
          cursor = next
        }
      }
      tables[table] = rows
    }
    const files: { path: string; content_type: string; size: number; encoding: 'base64'; data: string }[] = []
    const paths = new Set<string>()
    for (const attachment of tables.note_attachments) {
      const path = attachment.filename
      if (typeof path !== 'string' || !path.startsWith(`${userId}/`) || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new Error('An attachment has an invalid private path. No export was downloaded.')
      }
      if (paths.has(path)) continue
      paths.add(path)
      ensureActive()
      options.onProgress?.(`Downloading attachment ${paths.size}…`)
      if (attachment.file_size > 10 * 1024 * 1024) throw new Error('An attachment exceeds the supported file size.')
      const response = await client.storage.from('study-files').download(path)
      ensureActive()
      if (response.error || !response.data) throw new Error('An attachment could not be downloaded. No partial export was saved. Please retry.')
      if (response.data.size > 10 * 1024 * 1024) throw new Error('An attachment exceeds the supported file size.')
      reserve(4 * Math.ceil(response.data.size / 3) + encoder.encode(path).length + 256)
      const bytes = new Uint8Array(await response.data.arrayBuffer())
      ensureActive()
      const chunks: string[] = []
      for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
      files.push({ path, content_type: response.data.type || attachment.file_type, size: bytes.length, encoding: 'base64', data: btoa(chunks.join('')) })
    }
    ensureActive()
    const exportedAt = new Date().toISOString()
    const json = JSON.stringify({
      format: 'studyhive-study-data', version: 1, started_at: startedAt, exported_at: exportedAt,
      scope: 'Saved study data and registered note attachments. Excludes authentication credentials, billing records and temporary AI uploads. Read over an interval, not a transactional snapshot. Automatic restore is not supported.',
      tables, files,
    })
    const blob = new Blob([json], { type: 'application/json' })
    if (blob.size > limit) throw new Error('Your export exceeds the 50 MB download limit. No partial export was downloaded.')
    return { blob, filename: `StudyHive-export-${exportedAt.slice(0, 10)}.json`, records: Object.values(tables).reduce((n, rows) => n + rows.length, 0), files: files.length }
  } finally {
    unsubscribe()
  }
}
