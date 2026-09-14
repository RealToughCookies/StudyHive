import { saveNoteContent } from '../services/saveNote'
import { registerPendingEditor } from '../services/pendingEdits'
import { useCallback, useEffect, useRef, useState, MutableRefObject } from 'react'
import { Note } from '../types'

// A pending save captures its note ID and contents, so navigation cannot redirect it.
export function useNoteAutosave(
  note: Note | null, title: string, classId: number | undefined,
  content: MutableRefObject<string>, onUpdate: (note: Note) => void,
) {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const latest = useRef({ note, title, classId, onUpdate })
  latest.current = { note, title, classId, onUpdate }
  const revision = useRef(0)
  const inFlight = useRef(0)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const serverVersions = useRef(new Map<number, number | undefined>())
  if (note && !serverVersions.current.has(note.id)) serverVersions.current.set(note.id, note.revision)
  const pending = useRef<{ revision: number; id: number; title: string; classId?: number; content: string } | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(false)

  const flush = useCallback(async () => {
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = null
    const snapshot = pending.current
    if (!snapshot) return true
    pending.current = null
    inFlight.current++
    if (mounted.current) { setIsSaving(true); setSaveError(null) }
    try {
      const operation = saveQueue.current.then(async () => {
        const updated = await saveNoteContent(snapshot.id, snapshot.title, snapshot.content, snapshot.classId,
          serverVersions.current.get(snapshot.id))
        serverVersions.current.set(snapshot.id, updated?.revision)
        return updated
      })
      saveQueue.current = operation.catch(() => {})
      const updated = await operation
      if (mounted.current && latest.current.note?.id === snapshot.id && revision.current === snapshot.revision) {
        latest.current.onUpdate(updated)
        setLastSaved(new Date())
      }
      return true
    } catch (error) {
      console.error('Failed to save note:', error)
      if (revision.current === snapshot.revision) pending.current ??= snapshot
      if (mounted.current && revision.current === snapshot.revision) setSaveError(error instanceof Error ? error.message : 'Could not save this note. Please try saving again.')
      return false
    } finally {
      inFlight.current--
      if (mounted.current) setIsSaving(inFlight.current > 0)
    }
  }, [])

  const triggerSave = useCallback(() => {
    const current = latest.current
    if (!current.note) return
    pending.current = { revision: ++revision.current, id: current.note.id, title: current.title,
      classId: current.classId, content: content.current }
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(() => { void flush() }, 1000)
  }, [content, flush])

  const saveNote = useCallback(async () => {
    triggerSave()
    return flush()
  }, [triggerSave, flush])

  useEffect(() => {
    mounted.current = true
    const unregisterEditor = registerPendingEditor(async () => {
      const saved = await flush()
      await saveQueue.current
      return saved && !pending.current
    })
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current || inFlight.current > 0) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    const saveOnHide = () => { if (document.hidden) void flush() }
    const saveOnPageHide = () => { void flush() }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('pagehide', saveOnPageHide)
    document.addEventListener('visibilitychange', saveOnHide)
    return () => {
      unregisterEditor()
      mounted.current = false
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('pagehide', saveOnPageHide)
      document.removeEventListener('visibilitychange', saveOnHide)
      void flush()
    }
  }, [flush])

  useEffect(() => {
    if (note && (title !== note.title || classId !== note.class_id)) triggerSave()
  }, [title, classId, note?.id, triggerSave])

  return { isSaving, lastSaved, saveError, triggerSave, saveNote }
}
