import { useEffect, useState } from 'react'
import { cloudClient } from '../../services/cloud/client'
import { proRequest } from '../../services/pro'
import { useStore } from '../../store'

export default function FileUsage() {
  const owner = useStore(s => s.currentUser?.id)
  const [usage, setUsage] = useState<{ file_count: number; file_limit: number } | null>(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState('')
  const [cleaning, setCleaning] = useState(false)
  const [busy, setBusy] = useState(false)
  async function refresh() {
    if (!cloudClient || !owner) return
    setBusy(true)
    setError('')
    try {
      const { data, error } = await cloudClient.rpc('my_file_usage')
      if (useStore.getState().currentUser?.id !== owner) return
      if (error || !data?.[0]) throw new Error('File usage is unavailable. Try again later.')
      setUsage(data[0])
    } catch (e) {
      if (useStore.getState().currentUser?.id === owner) setError(e instanceof Error ? e.message : 'Could not load file usage.')
    } finally { setBusy(false) }
  }
  async function cleanup() {
    if (cleaning) return
    setCleaning(true); setError(''); setMessage('')
    try {
      const result = await proRequest({ action: 'cleanup-uploads', confirmation: 'REMOVE UNUSED UPLOADS' })
      if (useStore.getState().currentUser?.id !== owner) return
      setMessage(`${result.removed} unused uploads removed. Cleanup processes up to 50 files at a time.`)
      setConfirming(false)
      await refresh()
    } catch (e) { if (useStore.getState().currentUser?.id === owner) setError(e instanceof Error ? e.message : 'Cleanup failed. Please retry.') }
    finally { setCleaning(false) }
  }
  useEffect(() => { setUsage(null); void refresh() }, [owner])
  return <section className="bg-white p-6 rounded-xl shadow-md space-y-3">
    <h3 className="text-lg font-semibold">File storage</h3>
    {usage && <p>{usage.file_count} / {usage.file_limit} files stored</p>}
    <p>Attachments and AI source uploads share your file allowance. Each file can be up to 10 MB; AI imports can be up to 2 MB.</p>
    {usage && usage.file_count >= usage.file_limit && <p>Remove an existing attachment to make room. Your saved files remain available.</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" className="btn-secondary" disabled={busy || cleaning} onClick={refresh}>{busy ? 'Loading…' : 'Refresh file usage'}</button>
    <p>Unused uploads older than 24 hours can be removed to recover space. Saved note attachments are kept.</p>
    {!confirming && <button type="button" className="btn-secondary" disabled={busy || cleaning} onClick={() => setConfirming(true)}>Clean up unused uploads…</button>}
    {confirming && <div className="space-y-2">
      <p>This permanently removes abandoned uploads and old AI source files that are not attached to a saved note. Generated notes remain. This cannot be undone.</p>
      <button type="button" className="btn-secondary" disabled={cleaning} onClick={cleanup}>{cleaning ? 'Removing…' : 'Permanently remove unused uploads'}</button>
      <button type="button" className="btn-secondary" disabled={cleaning} onClick={() => setConfirming(false)}>Cancel</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>
}
