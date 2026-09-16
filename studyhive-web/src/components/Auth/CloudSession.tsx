import { useEffect, useState } from 'react'
import { observeAccount } from '../../services/cloud/auth'
import { cloudClient } from '../../services/cloud/client'
import { useStore } from '../../store'
import Layout from '../Layout'
import CloudAuthForm from './CloudAuthForm'
import ProPanel from '../Subscription/ProPanel'

export default function CloudSession() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState(new URLSearchParams(location.search).get('auth') === 'recovery')
  const [retry, setRetry] = useState(0)
  const [billingReturn, setBillingReturn] = useState<"success" | "cancelled" | null>(() => {
    const result = new URLSearchParams(location.search).get('billing')
    return result === 'success' || result === 'cancelled' ? result : null
  })
  const { currentUser } = useStore()

  useEffect(() => observeAccount(cloudClient!, {
    pending: hasSession => {
      useStore.getState().logout()
      setError('')
      setReady(!hasSession)
    },
    loaded: (user, settings) => {
      const store = useStore.getState()
      store.setUser(user)
      store.setSettings(settings)
      store.setCurrentPage('dashboard')
      setReady(true)
    },
    failed: message => { setError(message); setReady(true) },
    recovery: () => setRecovery(true),
  }), [retry])

  if (!ready) return <main className="min-h-screen grid place-items-center"><p role="status">Opening your workspace…</p></main>
  if (error) return <main className="max-w-md mx-auto p-8 space-y-4"><p role="alert">{error}</p><button className="btn-primary" onClick={() => { setReady(false); setRetry(r => r + 1) }}>Retry</button><button className="btn-secondary ml-4" onClick={async () => {
    const { error: failure } = await cloudClient!.auth.signOut({ scope: 'local' })
    if (failure) setError('Sign out failed. Check your connection and try again.')
  }}>Sign out</button></main>
  if (recovery || !currentUser) return <CloudAuthForm recovery={recovery} authenticated={!!currentUser} onRecovered={() => {
    history.replaceState(null, '', location.pathname)
    setRecovery(false)
  }} />
  return <>
    <Layout key={currentUser.id} />
    {billingReturn && <ProPanel key={currentUser.id} billingReturn={billingReturn} onClose={() => {
      const url = new URL(location.href)
      url.searchParams.delete('billing')
      history.replaceState(null, '', url.pathname + url.search + url.hash)
      setBillingReturn(null)
    }} />}
  </>
}
