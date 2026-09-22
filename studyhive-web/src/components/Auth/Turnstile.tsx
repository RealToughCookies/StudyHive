import { useEffect, useRef, useState } from 'react'

export const turnstileSiteKey = String(import.meta.env?.VITE_TURNSTILE_SITE_KEY || '').trim()
type WidgetApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: WidgetApi } }
let loading: Promise<WidgetApi> | undefined
function loadWidget(): Promise<WidgetApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  loading = new Promise<WidgetApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    const fail = () => { clearTimeout(timer); script.remove(); loading = undefined; reject(new Error('Verification could not load. Check your connection and retry.')) }
    const timer = setTimeout(fail, 15000)
    script.onerror = fail
    script.onload = () => {
      clearTimeout(timer)
      if (window.turnstile) resolve(window.turnstile)
      else fail()
    }
    document.head.appendChild(script)
  })
  return loading
}
export default function Turnstile({ onToken, siteKey = turnstileSiteKey }: { onToken: (token: string) => void; siteKey?: string }) {
  const container = useRef<HTMLDivElement>(null)
  const callback = useRef(onToken)
  callback.current = onToken
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!siteKey || !container.current) return
    let active = true, widget: string | undefined, api: WidgetApi | undefined
    callback.current(''); setError('')
    loadWidget().then(value => {
      if (!active || !container.current) return
      api = value
      widget = api.render(container.current, {
        sitekey: siteKey,
        callback: (token: string) => { if (active) { setError(''); callback.current(token) } },
        'expired-callback': () => { if (active) callback.current('') },
        'error-callback': () => { if (active) { callback.current(''); setError('Verification failed. Please retry.') } },
        'timeout-callback': () => { if (active) { callback.current(''); setError('Verification timed out. Please retry.') } },
      })
    }).catch(() => { if (active) { callback.current(''); setError('Verification could not load. Check your connection and retry.') } })
    return () => { active = false; if (api && widget !== undefined) api.remove(widget) }
  }, [siteKey, attempt])
  if (!siteKey) return null
  return <div>
    <div ref={container} aria-label="Security verification" />
    {error && <p role="alert">{error} <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry verification</button></p>}
  </div>
}
