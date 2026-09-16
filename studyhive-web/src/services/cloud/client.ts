import { createClient } from '@supabase/supabase-js'

export function readCloudConfig(env: Record<string, string | boolean | undefined>) {
  const url = String(env.VITE_SUPABASE_URL || '')
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '')
  const mode = env.VITE_DATA_MODE || 'cloud'
  if (mode !== 'cloud' && mode !== 'local') throw new Error('VITE_DATA_MODE must be cloud or local.')
  if (mode === 'local') return null
  if (!url || !key) throw new Error('Connect a Supabase project using the setup instructions in docs/CLOUD_SETUP.md. For the browser-only demo, explicitly set VITE_DATA_MODE=local.')
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
    throw new Error('Supabase must use HTTPS outside local development.')
  }
  if (!key.startsWith('sb_publishable_')) throw new Error('Use a Supabase publishable key, never a secret or service-role key.')
  return { url, key }
}

// Tests import feature modules without Vite; their existing local database fixture remains usable.
const config = import.meta.env ? readCloudConfig(import.meta.env) : null
export function createReauthClient() {
  if (!config) throw new Error('Account deletion requires a cloud account.')
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'studyhive-reauth' },
  })
}
export const cloudClient = config ? createClient(config.url, config.key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null
