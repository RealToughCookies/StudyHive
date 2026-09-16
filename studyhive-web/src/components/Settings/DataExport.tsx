import { useEffect, useRef, useState } from 'react'
import { buildAccountExport } from '../../services/accountExport'
import { savePendingEdits } from '../../services/pendingEdits'
import { useStore } from '../../store'

export default function DataExport() {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const task = useRef<AbortController | null>(null)
  useEffect(() => () => task.current?.abort(), [])
  async function download() {
    if (task.current) return
    const controller = new AbortController()
    task.current = controller
    const userId = useStore.getState().currentUser?.id
    setBusy(true); setError(''); setStatus('Saving pending edits…')
    try {
      if (!await savePendingEdits()) throw new Error('Save your pending note edits before exporting.')
      if (controller.signal.aborted) return
      if (useStore.getState().currentUser?.id !== userId) throw new Error('Your account changed. Please start again.')
      const result = await buildAccountExport({ signal: controller.signal, onProgress: setStatus })
      if (controller.signal.aborted || useStore.getState().currentUser?.id !== userId) return
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url; link.download = result.filename
      document.body.appendChild(link)
      try { link.click() } finally {
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      }
      setStatus(`Download started: ${result.records} records and ${result.files} attached files. Check your Downloads folder.`)
    } catch (e) {
      if (!controller.signal.aborted) {
        setStatus(''); setError(e instanceof Error ? e.message : 'Export failed. Please retry.')
      }
    } finally {
      if (!controller.signal.aborted) { task.current = null; setBusy(false) }
    }
  }
  return <section className="bg-white p-6 rounded-xl shadow-md space-y-4" aria-labelledby="export-title">
    <h2 id="export-title" className="text-xl font-bold text-gray-900">Export your study data</h2>
    <p className="text-gray-600">Download your saved notes, classes, flashcards, quizzes, review history, settings and attached files as a JSON file. Available on every plan.</p>
    <p className="text-sm text-gray-600">Exports up to 50 MB. Automatic restore is not available yet. Save changes and pause editing on other devices while the export runs. The download contains your private study data.</p>
    <button className="btn-primary px-4 py-3" disabled={busy} onClick={() => void download()}>{busy ? 'Preparing export…' : 'Download study data'}</button>
    {status && <p role="status" className="text-sm text-gray-600">{status}</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </section>
}
