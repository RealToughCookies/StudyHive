import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { proRequest } from '../src/services/pro'
import { useStore } from '../src/store'
import { loadMembership } from '../src/components/Subscription/ProPanel'

const clientWithError = (error: Error) => ({ functions: { invoke: async () => ({ data: null, error }) } }) as any
function signIn() { useStore.getState().setUser({ id: 101, subscription_tier: 'free' } as any) }
afterEach(() => useStore.getState().setUser(null))

test('a gateway authentication failure is actionable instead of saying Pro is not available yet', async () => {
  signIn()
  const error = new FunctionsHttpError(new Response(JSON.stringify({ code: 401, message: 'Invalid JWT' }), { status: 401 }))
  await assert.rejects(proRequest({ action: 'billing-info' }, clientWithError(error)), /401.*sign in again/i)
})

test('a browser transport failure identifies connectivity rather than missing Pro configuration', async () => {
  signIn()
  const error = new FunctionsFetchError(new TypeError('Failed to fetch'))
  await assert.rejects(proRequest({ action: 'billing-info' }, clientWithError(error)), /Could not reach Pro services/)
})

test('non-JSON gateway failures include the HTTP status without exposing the response body', async () => {
  signIn()
  const error = new FunctionsHttpError(new Response('<html>upstream unavailable</html>', { status: 503 }))
  await assert.rejects(proRequest({ action: 'billing-info' }, clientWithError(error)), /503/)
})

test('the backend actionable error is retained', async () => {
  signIn()
  const error = new FunctionsHttpError(new Response(JSON.stringify({ error: 'You already have a subscription. Use Manage subscription.' }), { status: 409 }))
  await assert.rejects(proRequest({ action: 'checkout' }, clientWithError(error)), /already have a subscription/)
})

test('a failed billing endpoint cannot hide the server-confirmed membership', async () => {
  signIn()
  const profile = { id: 101, subscription_tier: 'premium', subscription_expires_at: new Date(Date.now() + 86400000).toISOString() }
  const client = clientWithError(new FunctionsFetchError(new TypeError('Failed to fetch')))
  client.from = () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile, error: null }) }) }) })
  client.rpc = async () => ({ data: { used: 0, limit: 0 }, error: null })
  const membership = await loadMembership(101, client)
  assert.equal(membership.user.subscription_tier, 'premium')
  assert.equal(membership.enabled, null)
  assert.match(membership.billingError!, /Could not reach Pro services/)
})
