import type { SupabaseClient } from '@supabase/supabase-js'
import type { User, Settings } from '../../types'

interface AccountObserver {
  pending: (hasSession: boolean) => void
  loaded: (user: User, settings: Settings) => void
  failed: (message: string) => void
  recovery: () => void
}

// A newer auth event invalidates every older profile/settings request, including after cleanup.
export function observeAccount(client: SupabaseClient, observer: AccountObserver) {
  let active = true
  let identity: string | null = null
  let generation = 0
  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    if (!active) return
    if (event === 'PASSWORD_RECOVERY') observer.recovery()
    if (session?.user.id === identity && event !== 'INITIAL_SESSION') return
    identity = session?.user.id || null
    const version = ++generation
    observer.pending(!!session)
    if (!session) return
    // Auth callbacks execute under the SDK's lock; defer calls into the SDK until it releases it.
    setTimeout(async () => {
      if (!active || version !== generation) return
      try {
        const { data: verified, error: authError } = await client.auth.getUser()
        if (authError || verified.user?.id !== session.user.id || !verified.user.email_confirmed_at) {
          throw new Error('Please verify your email before signing in.')
        }
        if (!active || version !== generation) return
        const { data: profile, error: profileError } = await client.from('users').select('*').eq('auth_user_id', session.user.id).single()
        if (profileError) throw new Error('Could not load your account. Check your connection and try again.')
        if (!active || version !== generation) return
        const { data: settings, error: settingsError } = await client.from('settings').select('*').eq('user_id', profile.id).single()
        if (settingsError) throw new Error('Could not load your settings. Check your connection and try again.')
        if (!active || version !== generation) return
        observer.loaded({ ...profile, email: verified.user.email,
          subscription_tier: profile.subscription_tier === 'premium' && Date.parse(profile.subscription_expires_at) > Date.now() ? 'premium' : 'free',
        }, settings)
      } catch (failure) {
        if (active && version === generation) observer.failed(failure instanceof Error ? failure.message : 'Could not load your account.')
      }
    }, 0)
  })
  return () => { active = false; generation++; subscription.unsubscribe() }
}
