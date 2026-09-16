import { useEffect, useRef, useState } from 'react'
import { accountDeletionStatus, deleteAccount } from '../../services/accountDeletion'

export default function AccountDeletion() {
  const [available, setAvailable] = useState(false)
  const [pending, setPending] = useState(false)
  const [opened, setOpened] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Checking availability…')
  const running = useRef(false)
  useEffect(() => {
    let active = true
    accountDeletionStatus().then(result => {
      if (!active) return
      setAvailable(result?.available === true); setPending(result?.pending === true); setMessage('')
    }).catch(() => { if (active) setMessage('Account deletion is not available yet. Please try again later.') })
    return () => { active = false }
  }, [])
  async function remove(event: React.FormEvent) {
    event.preventDefault()
    if (running.current) return
    running.current = true; setBusy(true); setMessage('Canceling your subscription and removing your account…')
    try { await deleteAccount(password, confirmation) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Deletion could not finish. Retry in Settings.') }
    finally { setPassword(''); setBusy(false); running.current = false }
  }
  return <section className="bg-white p-6 rounded-xl shadow-md space-y-4 border border-red-200" aria-labelledby="delete-account-title">
    <h2 id="delete-account-title" className="text-xl font-bold text-gray-900">Delete account</h2>
    <p className="text-gray-600">Permanently remove your StudyHive login, study data and uploaded files, and cancel your subscription immediately. This cannot be undone. Download your study data above first if you want to keep it.</p>
    <p className="text-sm text-gray-600">Deletion does not issue a refund. Payment history and provider backups may remain under their retention policies.</p>
    {pending && <p role="status" className="text-red-700">Deletion has started. Editing and Pro services are blocked. Retry below to finish cleanup.</p>}
    {!opened && <button className="btn-secondary px-4 py-3 text-red-700" disabled={!available} onClick={() => setOpened(true)}>{pending ? 'Finish account deletion' : 'Delete my account…'}</button>}
    {opened && <form onSubmit={event => void remove(event)} className="space-y-4">
      <label className="block text-gray-900">Current password
        <input type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} className="block w-full rounded-lg border p-3 mt-1" />
      </label>
      <label className="block text-gray-900">Type DELETE to confirm
        <input autoComplete="off" spellCheck={false} required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} className="block w-full rounded-lg border p-3 mt-1" />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || !password || confirmation !== 'DELETE'} className="px-4 py-3 rounded-lg bg-red-700 text-white disabled:opacity-50">{busy ? 'Deleting…' : 'Permanently delete account'}</button>
        <button type="button" disabled={busy} className="btn-secondary px-4 py-3" onClick={() => { setOpened(false); setPassword(''); setConfirmation(''); setMessage('') }}>Close</button>
      </div>
      <p className="text-sm text-gray-600">Once deletion starts, it cannot be canceled. If cleanup is interrupted, sign in and retry here.</p>
    </form>}
    {message && <p role="status" className="text-gray-700">{message}</p>}
  </section>
}
