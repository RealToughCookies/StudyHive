import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React, { useRef } from 'react'
import { create, act } from 'react-test-renderer'
import { useStore } from '../src/store'
import { useTimerEngine, useSharedTimer } from '../src/hooks/useSharedTimer'
import FocusMode from '../src/components/FocusMode'
import SettingsPanel from '../src/components/Settings/SettingsPanel'
import { useNoteAutosave } from '../src/hooks/useNoteAutosave'
import { generateFlashcards, generateQuiz } from '../src/services/openai'
import { initDatabase, getDB, saveDatabase } from '../src/services/database'

const intervals = new Map<number, () => void>()
let intervalId = 0
const nativeSetInterval = globalThis.setInterval
const nativeClearInterval = globalThis.clearInterval
const nativeNow = Date.now
let testNow = 100000
const initialState = useStore.getState()
const settings = {
  id: 1, user_id: 1, theme: 'blue', dark_mode: false,
  pomodoro_work_minutes: 25, pomodoro_break_minutes: 5, pomodoro_long_break_minutes: 15,
  notification_sound: false, timer_sound: false, show_floating_timer: true,
  pause_on_blur: false, auto_resume_on_focus: false,
}
const user = { id: 1, username: 'test', email: 'test@example.com', subscription_tier: 'free' }
let root: ReturnType<typeof create> | undefined
let controls: ReturnType<typeof useSharedTimer>
let writes: unknown[][]
function Engine() { useTimerEngine(); return null }
function Controls() { controls = useSharedTimer(); return null }

beforeEach(() => {
  writes = []
  testNow = 100000
  Date.now = () => testNow
  const win = new EventTarget() as any
  win.setTimeout = setTimeout
  win.electronAPI = {
    db: { run: async (...args: unknown[]) => { writes.push(args); return {} }, query: async () => [] },
    notify: () => {},
    onWindowBlur: (fn: EventListener) => { win.addEventListener('blur', fn); return () => win.removeEventListener('blur', fn) },
    onWindowFocus: (fn: EventListener) => { win.addEventListener('focus', fn); return () => win.removeEventListener('focus', fn) },
  }
  globalThis.window = win
  const doc = new EventTarget() as any
  doc.hidden = false
  doc.documentElement = { style: { setProperty() {} } }
  doc.body = { classList: { add() {}, remove() {} } }
  globalThis.document = doc
  globalThis.setInterval = ((fn: () => void) => { intervals.set(++intervalId, () => { testNow += 1000; fn() }); return intervalId }) as any
  globalThis.clearInterval = ((id: number) => intervals.delete(id)) as any
  useStore.setState({ ...initialState, timer: { ...initialState.timer } }, true)
  useStore.getState().setSettings(settings as any)
})
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  intervals.clear()
  Date.now = nativeNow
  globalThis.setInterval = nativeSetInterval
  globalThis.clearInterval = nativeClearInterval
})

async function completeWorkSession() {
  act(() => useStore.setState(s => ({ timer: { ...s.timer, mode: 'work', timeLeft: 1, isRunning: true } })))
  await act(async () => { for (const tick of [...intervals.values()]) tick(); await Promise.resolve() })
}

test('the long break follows the fourth completed work session', async () => {
  useStore.getState().setUser(user as any)
  act(() => { root = create(<Engine />) })
  for (let i = 1; i <= 8; i++) {
    await completeWorkSession()
    assert.equal(useStore.getState().timer.sessionsCompleted, i)
    assert.equal(useStore.getState().timer.mode, i % 4 === 0 ? 'longBreak' : 'shortBreak', `session ${i}`)
  }
  assert.equal(writes.length, 8)
})

test('focus mode shows the running shared timer and controls it', () => {
  useStore.setState(s => ({ timer: { ...s.timer, timeLeft: 754, isRunning: true } }))
  act(() => { root = create(<><Engine /><FocusMode onExit={() => {}} /></>) })
  assert.equal(root!.root.findByType('span').children.join(''), '12:34')
  const pause = root!.root.findAllByType('button').find(b => b.children.includes('Pause'))!
  act(() => pause.props.onClick())
  assert.equal(useStore.getState().timer.isRunning, false)
  assert.equal(intervals.size, 0)
})

test('SQLite settings flags become actual booleans', () => {
  useStore.getState().setSettings({ ...settings, timer_sound: 0, notification_sound: 0, pause_on_blur: 0, auto_resume_on_focus: 1 } as any)
  assert.equal(useStore.getState().settings!.pause_on_blur, false)
  assert.equal(useStore.getState().settings!.timer_sound, false)
  assert.equal(useStore.getState().settings!.notification_sound, false)
  assert.equal(useStore.getState().settings!.auto_resume_on_focus, true)
})

test('disabled pause-on-blur leaves a running timer running', () => {
  useStore.getState().setSettings({ ...settings, pause_on_blur: 0 } as any)
  useStore.getState().setIsRunning(true)
  act(() => { root = create(<Engine />) })
  act(() => window.dispatchEvent(new Event('blur')))
  assert.equal(useStore.getState().timer.isRunning, true)
})

test('logout clears the previous account settings and timer', () => {
  useStore.getState().setUser(user as any)
  useStore.getState().setSettings({ ...settings, openai_api_key: 'test-only-key' } as any)
  useStore.getState().setIsRunning(true)
  useStore.getState().incrementSessions()
  useStore.getState().logout()
  assert.equal(useStore.getState().settings, null)
  assert.equal(useStore.getState().timer.isRunning, false)
  assert.equal(useStore.getState().timer.sessionsCompleted, 0)
})

test('reset uses the latest saved duration, even from an existing control callback', () => {
  act(() => { root = create(<Controls />) })
  const reset = controls.resetTimer
  act(() => {
    useStore.getState().setSettings({ ...settings, pomodoro_work_minutes: 40 } as any)
    reset()
  })
  assert.equal(useStore.getState().timer.timeLeft, 2400)
})

test('database initialization preserves a saved pause-on-blur preference', async () => {
  let saved: Uint8Array | undefined
  // Minimal IndexedDB transport; schema creation and migrations run in real sql.js.
  globalThis.indexedDB = {
    open: () => {
      const request: any = {}
      queueMicrotask(() => {
        request.result = {
          createObjectStore() {},
          close() {},
          transaction() {
            const tx: any = { objectStore: () => ({
              get() { const req: any = {}; queueMicrotask(() => { req.result = saved; req.onsuccess() }); return req },
              put(data: Uint8Array) { saved = data; queueMicrotask(() => tx.oncomplete()) },
            }) }
            return tx
          },
        }
        request.onsuccess()
      })
      return request
    },
  } as any
  await initDatabase()
  getDB().run('INSERT INTO settings (user_id, pause_on_blur) VALUES (1, 1)')
  await saveDatabase()
  await new Promise(resolve => setTimeout(resolve, 150))
  await initDatabase()
  assert.equal(getDB().exec('SELECT pause_on_blur FROM settings')[0].values[0][0], 1)
  await new Promise(resolve => setTimeout(resolve, 150))
})


test('pause and auto-resume respect enabled settings', () => {
  useStore.getState().setSettings({ ...settings, pause_on_blur: 1, auto_resume_on_focus: 1 } as any)
  useStore.getState().setIsRunning(true)
  act(() => { root = create(<Engine />) })
  act(() => window.dispatchEvent(new Event('blur')))
  assert.equal(useStore.getState().timer.isRunning, false)
  assert.equal(useStore.getState().timer.wasPausedByBlur, true)
  act(() => window.dispatchEvent(new Event('focus')))
  assert.equal(useStore.getState().timer.isRunning, true)
  assert.equal(intervals.size, 1)
})

test('sound controls are shared across timer views', () => {
  let first: ReturnType<typeof useSharedTimer>
  let second: ReturnType<typeof useSharedTimer>
  function First() { first = useSharedTimer(); return null }
  function Second() { second = useSharedTimer(); return null }
  act(() => { root = create(<><First /><Second /></>) })
  act(() => first.setSoundEnabled(false))
  assert.equal(second!.soundEnabled, false)
})

test('pending note edits, including empty content, flush on navigation', async () => {
  const note = { id: 12, user_id: 1, title: 'Original', content: '<p>Existing</p>' }
  let change: (text: string) => void
  window.electronAPI.db.get = async () => note
  function Editor() {
    const content = useRef(note.content)
    const saver = useNoteAutosave(note as any, note.title, undefined, content, () => {})
    change = text => { content.current = text; saver.triggerSave() }
    return null
  }
  act(() => { root = create(<Editor />) })
  act(() => change(''))
  await act(async () => root!.unmount())
  root = undefined
  assert.equal(writes.length, 1)
  assert.deepEqual(writes[0][1], ['Original', '', null, 12])
})

test('AI requests use the supplied key each time and reject malformed study materials', async () => {
  const previousFetch = globalThis.fetch
  const previousError = console.error
  const keys: string[] = []
  let output = '[{"front":"Question","back":"Answer"}]'
  globalThis.fetch = async (_url, init) => {
    keys.push(new Headers(init?.headers).get('authorization')!)
    return new Response(JSON.stringify({ choices: [{ message: { content: output } }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }
  console.error = () => {}
  try {
    assert.equal((await generateFlashcards('note', 'first-test-key')).length, 1)
    await generateFlashcards('note', 'second-test-key')
    assert.deepEqual(keys, ['Bearer first-test-key', 'Bearer second-test-key'])
    output = '[{"front":"Missing answer"}]'
    await assert.rejects(generateFlashcards('note', 'test-key'))
    output = '[{"question":"Question","options":["A","B","C","D"],"correct":9}]'
    await assert.rejects(generateQuiz('note', 'test-key'))
    output = '[{"question":"Question","options":["A","B","C","D"],"correct":0}]'
    assert.equal((await generateQuiz('note', 'test-key'))[0].correct, 0)
    await assert.rejects(generateQuiz('note', ''))
  } finally {
    globalThis.fetch = previousFetch
    console.error = previousError
  }
})

test('saving a new API key keeps it in memory without persisting it by default', async () => {
  useStore.getState().setUser(user as any)
  useStore.getState().setSettings(settings as any)
  window.electronAPI.db.get = async () => ({ ...settings, openai_api_key: null })
  const originalAlert = globalThis.alert
  globalThis.alert = () => {}
  try {
    act(() => { root = create(<SettingsPanel />) })
    const apiInput = root!.root.findByProps({ placeholder: 'sk-...' })
    act(() => apiInput.props.onChange({ target: { value: 'session-test-key' } }))
    const save = root!.root.findAllByType('button').find(b => b.children.includes('Save Settings'))!
    await act(async () => save.props.onClick())
    assert.equal((writes[0][1] as unknown[])[6], null)
    assert.equal(useStore.getState().settings!.openai_api_key, 'session-test-key')
    assert.equal(useStore.getState().settings!.remember_api_key, false)
  } finally {
    globalThis.alert = originalAlert
  }
})
