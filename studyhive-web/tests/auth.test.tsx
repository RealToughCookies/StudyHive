import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { JSDOM } from 'jsdom'
import CloudAuthForm from '../src/components/Auth/CloudAuthForm'
import { registerPendingEditor, savePendingEdits } from '../src/services/pendingEdits'
import { observeAccount } from '../src/services/cloud/auth'

let root: ReturnType<typeof create> | undefined
let dom: JSDOM
beforeEach(() => {
  dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost/studyhive/' })
  Object.defineProperty(globalThis, 'location', { value: dom.window.location, configurable: true })
})
afterEach(() => { act(() => root?.unmount()); root = undefined; dom.window.close() })
const text = () => JSON.stringify(root!.toJSON())
const button = (label: string) => root!.root.findAllByType('button').find(b => b.children.includes(label))!
const fill = (type: string, value: string, index = 0) => act(() => root!.root.findAllByType('input').filter(i => i.props.type === type)[index].props.onChange({ target: { value } }))
const submit = () => act(async () => root!.root.findByType('form').props.onSubmit({ preventDefault() {} }))

test('password recovery uses a fixed same-origin redirect and an account-neutral success message', async () => {
  let received: any
  const auth = { resetPasswordForEmail: async (...args: any[]) => { received = args; return { error: null } } } as any
  act(() => { root = create(<CloudAuthForm recovery={false} authenticated={false} onRecovered={() => {}} auth={auth} />) })
  act(() => button('Forgot password?').props.onClick())
  fill('email', ' student@example.test ')
  await submit()
  assert.deepEqual(received, ['student@example.test', { redirectTo: 'http://localhost/studyhive/?auth=recovery' }])
  assert.ok(text().includes('If an account exists for this email'))
})

test('recovery rejects mismatched passwords and completes only after the password update succeeds', async () => {
  let updates = 0, completed = 0
  const auth = { updateUser: async ({ password }: any) => {
    updates++; assert.equal(password, 'long passphrase 123'); return { error: null }
  } } as any
  act(() => { root = create(<CloudAuthForm recovery authenticated onRecovered={() => { completed++ }} auth={auth} />) })
  fill('password', 'long passphrase 123'); fill('password', 'does not match', 1)
  await submit()
  assert.equal(updates, 0); assert.equal(completed, 0)
  assert.ok(text().includes('both passwords match'))
  fill('password', 'long passphrase 123', 1)
  await submit()
  assert.equal(updates, 1); assert.equal(completed, 1)
})

test('an unavailable recovery session offers a new link without allowing a password update', () => {
  act(() => { root = create(<CloudAuthForm recovery authenticated={false} onRecovered={() => {}} auth={{} as any} />) })
  assert.ok(text().includes('unavailable or expired'))
  assert.ok(button('Send reset link'))
  assert.equal(root!.root.findAllByType('input').some(i => i.props.type === 'password'), false)
})

test('failed password updates stay on the recovery form and do not report success', async () => {
  let completed = false
  act(() => { root = create(<CloudAuthForm recovery authenticated onRecovered={() => { completed = true }} auth={{ updateUser: async () => ({ error: new Error('Link expired') }) } as any} />) })
  fill('password', 'long passphrase 123'); fill('password', 'long passphrase 123', 1)
  await submit()
  assert.equal(completed, false)
  assert.ok(text().includes('Link expired'))
  assert.equal(button('Save password').props.disabled, false)
})

function sessionHarness() {
  let handler: any
  let user: any = { id: 'alice', email: 'a@example.test', email_confirmed_at: new Date().toISOString() }
  let profile: any = Promise.resolve({ data: { id: 1, subscription_tier: 'free' }, error: null })
  const events: any[] = []
  const client = {
    auth: {
      onAuthStateChange: (callback: any) => { handler = callback; return { data: { subscription: { unsubscribe() {} } } } },
      getUser: async () => ({ data: { user }, error: null }),
    },
    from: (table: string) => ({ select: () => ({ eq: () => ({ single: () => table === 'users' ? profile : Promise.resolve({ data: { user_id: 1 }, error: null }) }) }) }),
  } as any
  const stop = observeAccount(client, {
    pending: hasSession => events.push(['pending', hasSession]),
    loaded: account => events.push(['loaded', account.id]),
    failed: message => events.push(['error', message]),
    recovery: () => events.push(['recovery']),
  })
  return { events, stop, emit: (event: string, id: string | null) => handler(event, id ? { user: { id } } : null), setUser: (value: any) => { user = value }, setProfile: (value: any) => { profile = value } }
}
const drain = () => new Promise(resolve => setTimeout(resolve, 10))

test('sign-out invalidates an in-flight profile response', async () => {
  const harness = sessionHarness()
  let resolveProfile: any
  harness.setProfile(new Promise(resolve => { resolveProfile = resolve }))
  harness.emit('SIGNED_IN', 'alice')
  await drain()
  harness.emit('SIGNED_OUT', null)
  resolveProfile({ data: { id: 1 }, error: null })
  await drain()
  assert.equal(harness.events.some(event => event[0] === 'loaded'), false)
  assert.deepEqual(harness.events.at(-1), ['pending', false])
  harness.stop()
})

test('token refresh preserves the loaded workspace, and recovery is still signaled', async () => {
  const harness = sessionHarness()
  harness.emit('INITIAL_SESSION', 'alice')
  await drain()
  assert.deepEqual(harness.events, [['pending', true], ['loaded', 1]])
  harness.emit('TOKEN_REFRESHED', 'alice')
  harness.emit('PASSWORD_RECOVERY', 'alice')
  await drain()
  assert.deepEqual(harness.events, [['pending', true], ['loaded', 1], ['recovery']])
  harness.stop()
})

test('unverified sessions and responses after cleanup cannot open a workspace', async () => {
  const harness = sessionHarness()
  harness.setUser({ id: 'alice', email_confirmed_at: null })
  harness.emit('SIGNED_IN', 'alice')
  await drain()
  assert.ok(harness.events.some(event => event[0] === 'error'))
  assert.equal(harness.events.some(event => event[0] === 'loaded'), false)
  harness.stop()
  const length = harness.events.length
  harness.emit('SIGNED_IN', 'bob')
  await drain()
  assert.equal(harness.events.length, length)
})


test('leaving an editor waits for durability and remains blocked after a failed save', async () => {
  let finish: (value: boolean) => void
  const unregister = registerPendingEditor(() => new Promise(resolve => { finish = resolve }))
  let settled = false
  const save = savePendingEdits().then(result => { settled = true; return result })
  await Promise.resolve()
  assert.equal(settled, false)
  finish!(false)
  assert.equal(await save, false)
  unregister()
  assert.equal(await savePendingEdits(), true)
})

test('expired email callbacks explain recovery and provide a signup confirmation resend', async () => {
  dom.reconfigure({ url: 'http://localhost/studyhive/?error_code=otp_expired#error=access_denied' })
  let received: any
  act(() => { root = create(<CloudAuthForm recovery={false} authenticated={false} onRecovered={() => {}} auth={{ resend: async (input: any) => { received = input; return { error: null } } } as any} />) })
  assert.ok(text().includes('invalid or expired'))
  act(() => button('Resend confirmation email').props.onClick())
  fill('email', ' student@example.test ')
  assert.equal(root!.root.findAllByType('input').some(i => i.props.type === 'password'), false)
  await submit()
  assert.deepEqual(received, { type: 'signup', email: 'student@example.test', options: { emailRedirectTo: 'http://localhost/studyhive/' } })
  assert.ok(text().includes('If this email has an unconfirmed account'))
})

test('confirmation resend reports delivery failures without claiming an email was sent', async () => {
  act(() => { root = create(<CloudAuthForm recovery={false} authenticated={false} onRecovered={() => {}} auth={{ resend: async () => ({ error: new Error('Email rate limit exceeded') }) } as any} />) })
  act(() => button('Resend confirmation email').props.onClick())
  fill('email', 'student@example.test')
  await submit()
  assert.ok(text().includes('Email rate limit exceeded'))
  assert.ok(!text().includes('If this email has an unconfirmed account'))
})
