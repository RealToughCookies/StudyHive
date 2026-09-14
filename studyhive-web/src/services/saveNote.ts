import { cloudClient } from './cloud/client'
import { studyData } from './studyData'
import { useStore } from '../store'
import type { Note } from '../types'

export async function saveNoteContent(id: number, title: string, content: string, classId: number | undefined, expectedRevision?: number): Promise<Note> {
  if (!cloudClient) {
    await studyData.saveNote(title, content, classId || null, id)
    return studyData.getNote(id)
  }
  if (expectedRevision === undefined) throw new Error('Reopen this note before saving to load its latest version.')
  const owner = useStore.getState().currentUser?.id
  if (!owner) throw new Error('Please sign in again.')
  const { data, error } = await cloudClient.rpc('save_note', {
    note_ref: id, expected_revision: expectedRevision, note_title: title,
    note_content: content, class_ref: classId || null,
  }).single()
  if (error) throw new Error(error.message)
  if (useStore.getState().currentUser?.id !== owner) throw new Error('Your account changed.')
  window.dispatchEvent(new CustomEvent('studyhive-data-updated'))
  return data as Note
}
