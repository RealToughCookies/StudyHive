import { useEffect, useState } from 'react'
import { cloudClient } from '../../services/cloud/client'
import { useStore } from '../../store'

export default function FileUsage() {
  const owner = useStore(s => s.currentUser?.id)
  const [usage, setUsage] = useState<{ file_count: number; file_limit: number } | null>(null)
  const [error, setError] = useState('')
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
  useEffect(() => { setUsage(null); void refresh() }, [owner])
  return <section className="bg-white p-6 rounded-xl shadow-md space-y-3">
    <h3 className="text-lg font-semibold">File storage</h3>
    {usage && <p>{usage.file_count} / {usage.file_limit} files stored</p>}
    <p>Attachments and AI source uploads share your file allowance. Each file can be up to 10 MB; AI imports can be up to 2 MB.</p>
    {usage && usage.file_count >= usage.file_limit && <p>Remove an existing attachment to make room. Your saved files remain available.</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" className="btn-secondary" disabled={busy} onClick={refresh}>{busy ? 'Loading…' : 'Refresh file usage'}</button>
  </section>
}
