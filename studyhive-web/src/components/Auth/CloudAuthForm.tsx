import { useRef, useState } from 'react'
import { cloudClient } from '../../services/cloud/client'
import type { SupabaseClient } from '@supabase/supabase-js'

import Turnstile, { turnstileSiteKey } from './Turnstile'

type AuthActions = Pick<SupabaseClient['auth'], 'signInWithPassword' | 'signUp' | 'resetPasswordForEmail' | 'updateUser' | 'resend'>

export default function CloudAuthForm({ recovery, authenticated, onRecovered, auth = cloudClient!.auth, captchaSiteKey = turnstileSiteKey }: { recovery: boolean; authenticated: boolean; onRecovered: () => void; auth?: AuthActions; captchaSiteKey?: string }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset' | 'confirm'>(recovery && authenticated ? 'reset' : recovery ? 'forgot' : 'signin')
  const running = useRef(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [challenge, setChallenge] = useState(0)
  const captchaRequired = !!captchaSiteKey && mode !== 'reset'
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(recovery && !authenticated ? 'This reset link is unavailable or expired. Request a new link below and open it in this browser.' : '')
  const [error, setError] = useState(() => {
    const query = new URLSearchParams(location.search)
    const hash = new URLSearchParams(location.hash.slice(1))
    return query.has('error') || hash.has('error') || query.has('error_code') || hash.has('error_code')
      ? 'This email link is invalid or expired. Try signing in first. If your email still needs verification, resend the confirmation email below. For a password reset, choose Forgot password.' : ''
  })
  const changeMode = (next: typeof mode) => { setMode(next); setError(''); setMessage(''); setPassword(''); setConfirm(''); setCaptchaToken(''); setChallenge(n => n + 1) }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (running.current) return
    setError(''); setMessage('')
    if ((mode === 'signup' || mode === 'reset') && (password.length < 12 || password !== confirm)) {
      setError('Use at least 12 characters and make sure both passwords match.'); return
    }
    if (captchaRequired && !captchaToken) { setError('Complete the security verification first.'); return }
    const captchaOptions = captchaRequired ? { captchaToken } : {}
    running.current = true
    setBusy(true)
    const redirectTo = new URL(location.pathname, location.origin).href
    try {
      if (mode === 'signin') {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password, ...(captchaRequired ? { options: captchaOptions } : {}) })
        if (error) throw new Error('Unable to sign in. Check your email, password, and email verification.')
      } else if (mode === 'signup') {
        const { error } = await auth.signUp({ email: email.trim(), password, options: { ...captchaOptions, data: { username: username.trim() }, emailRedirectTo: redirectTo } })
        if (error) throw error
        setMessage('Check your email for the next step. If you already have an account, sign in or reset your password. Open the link in this browser.')
        setPassword(''); setConfirm('')
      } else if (mode === 'confirm') {
        const { error } = await auth.resend({ type: 'signup', email: email.trim(), options: { ...captchaOptions, emailRedirectTo: redirectTo } })
        if (error) throw error
        setMessage('If this email has an unconfirmed account, a fresh confirmation link will arrive shortly. Use only the newest email and open its link in the same browser where you requested it. If you already confirmed your email, sign in instead.')
      } else if (mode === 'forgot') {
        const { error } = await auth.resetPasswordForEmail(email.trim(), { ...captchaOptions, redirectTo: `${redirectTo}?auth=recovery` })
        if (error) throw error
        setMessage('If an account exists for this email, a password reset link will arrive shortly. Open it in this browser.')
      } else {
        const { error } = await auth.updateUser({ password })
        if (error) throw error
        setPassword(''); setConfirm('')
        onRecovered()
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The request could not be completed. Please try again.')
    } finally { running.current = false; setBusy(false); setCaptchaToken(''); setChallenge(n => n + 1) }
  }

  const titles = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password', reset: 'Choose a new password', confirm: 'Confirm your email' }
  return <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
    <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
      <img className="w-16 h-16 rounded-2xl mx-auto mb-4" src="./assets/StudyHiveLogo.png" alt="StudyHive" />
      <h1 className="text-2xl font-bold text-center">{titles[mode]}</h1>
      <p className="text-gray-600 text-center mt-2 mb-6">Your classes, notes, and study tools in one place.</p>
      <form className="space-y-4" onSubmit={submit}>
        {mode === 'signup' && <label className="block">Name<input className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" autoComplete="nickname" value={username} onChange={e => setUsername(e.target.value)} required maxLength={80} /></label>}
        {mode !== 'reset' && <label className="block">Email<input className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>}
        {mode !== 'forgot' && mode !== 'confirm' && <label className="block">Password<input className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === 'signin' ? 1 : 12} maxLength={128} /></label>}
        {(mode === 'signup' || mode === 'reset') && <label className="block">Confirm password<input className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={12} maxLength={128} /><span className="text-sm text-gray-500">Use at least 12 characters.</span></label>}
        {captchaRequired && <Turnstile key={`${mode}:${challenge}`} siteKey={captchaSiteKey} onToken={setCaptchaToken} />}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {message && <p role="status" className="text-gray-700">{message}</p>}
        <button className="btn-primary w-full py-3 rounded-xl font-semibold disabled:opacity-50" disabled={busy || (captchaRequired && !captchaToken)}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'confirm' ? 'Send confirmation link' : 'Save password'}</button>
      </form>
      <div className="mt-5 flex flex-wrap justify-center gap-4 text-primary">
        {mode !== 'signin' && mode !== 'reset' && <button disabled={busy} onClick={() => { onRecovered(); changeMode('signin') }}>Back to sign in</button>}
        {mode === 'signin' && <><button disabled={busy} onClick={() => changeMode('signup')}>Create account</button><button disabled={busy} onClick={() => changeMode('forgot')}>Forgot password?</button></>}
        {(mode === 'signin' || mode === 'signup') && <button disabled={busy} onClick={() => changeMode('confirm')}>Resend confirmation email</button>}
      </div>
    </div>
  </main>
}
