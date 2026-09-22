import type { SupabaseClient } from '@supabase/supabase-js'
import { cloudClient, createReauthClient } from './cloud/client'
import { useStore } from '../store'

async function deletionRequest(client: SupabaseClient, body: object, token?: string) {
  const { data, error } = await client.functions.invoke('delete-account', {
    body, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  })
  if (error) {
    let message = 'Account deletion is unavailable. Check your connection and try again.'
    if (error.context instanceof Response) {
      try { const detail = await error.context.json(); if (typeof detail.error === 'string') message = detail.error } catch { /* generic error */ }
    }
    throw new Error(message)
  }
  return data
}

export async function accountDeletionStatus(client = cloudClient) {
  if (!client) throw new Error('Cloud account required.')
  return deletionRequest(client, { action: 'status' })
}

export async function deleteAccount(password: string, confirmation: string, client = cloudClient, reauthFactory = createReauthClient, captchaToken?: string) {
  if (!client || !password || confirmation !== 'DELETE') throw new Error('Enter your password and type DELETE to confirm.')
  const profileId = useStore.getState().currentUser?.id
  let changed = false
  const unsubscribe = useStore.subscribe(state => { if (state.currentUser?.id !== profileId) changed = true })
  const ensureAccount = () => { if (!profileId || changed || useStore.getState().currentUser?.id !== profileId) throw new Error('Your account changed. Start again.') }
  let reauth: SupabaseClient | undefined
  try {
    const { data, error } = await client.auth.getUser()
    if (error || !data.user?.email || !data.user.email_confirmed_at) throw new Error('Sign in with your verified account first.')
    const owner = await client.from('users').select('auth_user_id').eq('id', profileId).single()
    if (owner.error || owner.data?.auth_user_id !== data.user.id) throw new Error('Your account changed. Start again.')
    ensureAccount()
    reauth = reauthFactory()
    const verified = await reauth.auth.signInWithPassword({ email: data.user.email, password, ...(captchaToken ? { options: { captchaToken } } : {}) })
    if (verified.error || !verified.data.session || verified.data.user?.id !== data.user.id) throw new Error('Password verification failed. Check your password and retry.')
    ensureAccount()
    const result = await deletionRequest(client, { action: 'delete', confirmation }, verified.data.session.access_token)
    if (result?.deleted !== true) throw new Error(result?.message || 'Deletion is incomplete. Retry to finish removing your account.')
    ensureAccount()
    await client.auth.signOut({ scope: 'local' })
    if (useStore.getState().currentUser?.id === profileId) useStore.getState().logout()
    return result
  } finally {
    unsubscribe()
    // Revoke only the temporary password-verification session; never another device's session.
    if (reauth) await reauth.auth.signOut({ scope: 'local' }).catch(() => {})
  }
}
