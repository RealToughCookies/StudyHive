import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import ProPanel from '../src/components/Subscription/ProPanel'
import { useStore } from '../src/store'
import { User } from '../src/types'

let root: ReturnType<typeof create> | undefined
const free = { id: 101, subscription_tier: 'free', subscription_expires_at: null } as User
const premium = { ...free, subscription_tier: 'premium', subscription_expires_at: new Date(Date.now() + 86400000).toISOString() } as User
const result = (user = free) => ({ enabled: true, user, allowance: { limit: 0, used: 0 } })
const text = () => JSON.stringify(root!.toJSON())
const button = (name: string) => root!.root.findAllByType('button').find(b => b.children.includes(name))
beforeEach(() => useStore.getState().setUser(free))
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  useStore.getState().setUser(null)
})

test('billing shows loading, not a configuration failure, before the server responds', async () => {
  let resolve: (value: ReturnType<typeof result>) => void
  const pending = new Promise<ReturnType<typeof result>>(done => { resolve = done })
  act(() => { root = create(<ProPanel onClose={() => {}} load={() => pending} />) })
  assert.ok(text().includes('Checking your membership'))
  assert.ok(!text().includes('Checkout is not configured'))
  assert.equal(button('Test Pro checkout')!.props.disabled, true)
  await act(async () => resolve!(result()))
  assert.equal(button('Test Pro checkout')!.props.disabled, false)
  assert.ok(!text().includes('Checking your membership'))
})

test('checkout return waits for the server entitlement before showing Pro', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  const load = async () => result(++calls === 1 ? free : premium)
  await act(async () => { root = create(<ProPanel billingReturn="success" onClose={() => {}} load={load} />) })
  assert.equal(useStore.getState().currentUser!.subscription_tier, 'free')
  assert.ok(!text().includes('Your Pro membership is active'))
  assert.equal(button('Test Pro checkout'), undefined)
  await act(async () => t.mock.timers.tick(2000))
  assert.equal(calls, 2)
  assert.ok(text().includes('Your Pro membership is active'))
  assert.ok(!text().includes('Checking your membership'))
  await act(async () => t.mock.timers.tick(20000))
  assert.equal(calls, 2)
})

test('a forged success URL cannot grant Pro and automatic checks stop before manual retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  const load = async () => { calls++; return result() }
  await act(async () => { root = create(<ProPanel billingReturn="success" onClose={() => {}} load={load} />) })
  for (let n = 0; n < 5; n++) await act(async () => t.mock.timers.tick(2000))
  assert.equal(calls, 6)
  assert.equal(useStore.getState().currentUser!.subscription_tier, 'free')
  assert.ok(text().includes('Pro activation is still pending'))
  assert.equal(button('Test Pro checkout'), undefined)
  await act(async () => t.mock.timers.tick(20000))
  assert.equal(calls, 6)
  await act(async () => button('Refresh membership')!.props.onClick())
  assert.equal(calls, 7)
  act(() => root!.unmount())
  root = undefined
  await act(async () => t.mock.timers.tick(20000))
  assert.equal(calls, 7)
})

test('late membership responses cannot restore a signed-out account', async () => {
  let resolve: (value: ReturnType<typeof result>) => void
  const pending = new Promise<ReturnType<typeof result>>(done => { resolve = done })
  act(() => { root = create(<ProPanel billingReturn="success" onClose={() => {}} load={() => pending} />) })
  act(() => useStore.getState().setUser(null))
  await act(async () => resolve!(result(premium)))
  assert.equal(useStore.getState().currentUser, null)
})

test('billing failures allow retry without claiming activation or missing configuration', async () => {
  let failed = true
  const load = async () => { if (failed) throw new Error('Connection failed'); return result(premium) }
  await act(async () => { root = create(<ProPanel billingReturn="success" onClose={() => {}} load={load} />) })
  assert.ok(text().includes('Connection failed'))
  assert.ok(!text().includes('Checkout is not configured'))
  assert.equal(button('Refresh membership')!.props.disabled, false)
  failed = false
  await act(async () => button('Refresh membership')!.props.onClick())
  assert.ok(text().includes('Your Pro membership is active'))
  assert.ok(!text().includes('Connection failed'))
})
