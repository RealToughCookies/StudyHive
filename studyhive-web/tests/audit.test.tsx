import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { JSDOM } from 'jsdom'
import { useStore } from '../src/store'
import { initDatabase, getDB } from '../src/services/database'
import { electronShim } from '../src/services/electronShim'
import { claimDatabaseTab } from '../src/services/databaseOwnership'
import { memoryIDB } from './memoryIDB'
import NotesList from '../src/components/Notes/NotesList'
import Dashboard from '../src/components/Dashboard'
import ReminderBubbleColumn from '../src/components/Calendar/ReminderBubbleColumn'
import Calendar from '../src/components/Calendar/Calendar'
import QuizTaker from '../src/components/Quiz/QuizTaker'
import StudySession from '../src/components/Flashcards/StudySession'
import FlashcardsList from '../src/components/Flashcards/FlashcardsList'
import ReviewHistory from '../src/components/Review/ReviewHistory'
import Layout from '../src/components/Layout'
import SettingsPanel from '../src/components/Settings/SettingsPanel'
import NoteEditor from '../src/components/Notes/NoteEditor'
import AttachmentManager from '../src/components/Notes/AttachmentManager'
import { useNoteAutosave } from '../src/hooks/useNoteAutosave'
import { useTimerEngine } from '../src/hooks/useSharedTimer'
import { saveFlashcardDeck } from '../src/services/studyMaterials'

const originalState = useStore.getState()
const user = { id: 1, username: 'audit', email: 'audit@example.test', subscription_tier: 'free' }
let root: ReturnType<typeof create> | undefined
let dom: JSDOM
let idb: ReturnType<typeof memoryIDB>
let writes: Array<{ sql: string; params?: unknown[] }>
const text = () => JSON.stringify(root!.toJSON())
const button = (label: string) => root!.root.findAllByType('button').find(b => b.children.includes(label))!

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'CustomEvent']) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (dom.window as any)[key] })
  }
  globalThis.confirm = () => true
  globalThis.alert = () => {}
  idb = memoryIDB()
  globalThis.indexedDB = idb.factory
  writes = []
  window.electronAPI = {
    ...electronShim,
    db: {
      query: async () => [], get: async () => null,
      run: async (sql, params) => { writes.push({ sql, params }); return { lastInsertRowid: 1, changes: 1 } },
    },
  }
  useStore.setState({ ...originalState, timer: { ...originalState.timer } }, true)
  useStore.getState().setUser(user as any)
})
afterEach(() => { act(() => root?.unmount()); root = undefined; dom.window.close() })

test('Unassigned notes include SQL NULL class IDs', async () => {
  window.electronAPI.db.query = async sql => sql.includes('FROM notes') ? [
    { id: 1, user_id: 1, title: 'Unassigned biology', content: '', class_id: null, updated_at: '2026-09-07 12:00:00' },
    { id: 2, user_id: 1, title: 'Assigned chemistry', content: '', class_id: 3, updated_at: '2026-09-07 12:00:00' },
  ] : []
  await act(async () => { root = create(<NotesList />) })
  act(() => root!.root.findByType('select').props.onChange({ target: { value: '' } }))
  assert.ok(text().includes('Unassigned biology'))
  assert.ok(!text().includes('Assigned chemistry'))
})

test('monthly reminders clamp to February instead of skipping it', async () => {
  const reminder = { id: 1, user_id: 1, title: 'Month end', date: '2026-01-31', repeat: 'monthly', color: '#000000', priority: 0 }
  window.electronAPI.db.query = async sql => sql.includes('FROM reminders') ? [reminder] : []
  await act(async () => { root = create(<Dashboard />) })
  await act(async () => root!.root.findByType(ReminderBubbleColumn).props.onComplete(1))
  assert.equal(writes[0].params![0], '2026-02-28')
})

test('calendar day 1 selects day 1 east of UTC', () => {
  const tz = process.env.TZ
  process.env.TZ = 'Asia/Tokyo'
  let chosen = ''
  try {
    act(() => { root = create(<Calendar reminders={[]} selectedDate={null} onSelectDate={date => { chosen = date }} onAddReminder={() => {}} />) })
    const dayOne = root!.root.findAllByType('button').find(b => b.findAllByType('span').some(s => s.children.join('') === '1'))!
    act(() => dayOne.props.onClick())
    assert.equal(chosen.slice(-2), '01')
  } finally { process.env.TZ = tz }
})

const quiz = { id: 1, user_id: 1, title: 'Audit quiz', questions: [{ question: '2 + 2?', options: ['4','3','2','1'], correct: 0 }] }
test('double submission saves one quiz attempt', async () => {
  act(() => { root = create(<QuizTaker quiz={quiz as any} onExit={() => {}} />) })
  const submit = button('Submit Quiz')
  await act(async () => { await Promise.all([submit.props.onClick(), submit.props.onClick()]) })
  assert.equal(writes.length, 1)
})

test('a failed quiz save stays retryable instead of claiming completion', async () => {
  window.electronAPI.db.run = async () => { throw new Error('Storage failed') }
  act(() => { root = create(<QuizTaker quiz={quiz as any} onExit={() => {}} />) })
  await act(async () => button('Submit Quiz').props.onClick())
  assert.ok(!text().includes('Quiz Results'))
  assert.ok(text().includes('save'))
})

test('an empty flashcard deck renders a recoverable state', () => {
  act(() => { root = create(<StudySession flashcards={[]} onExit={() => {}} />) })
  assert.ok(text().includes('No cards'))
})

test('one-card sessions are not complete until the card is reviewed', () => {
  act(() => { root = create(<StudySession flashcards={[{ id: 1, front: 'Q', back: 'A' }] as any} onExit={() => {}} />) })
  assert.ok(!text().includes('Session Complete'))
})

test('database mutations resolve only after the database is persisted', async () => {
  await initDatabase()
  window.electronAPI = electronShim
  await electronShim.db.run("INSERT INTO users (username, email, password_hash) VALUES ('audit', 'audit@example.test', 'hash')")
  const saved = idb.databases.get('studyhive-sql')?.get('data')?.get('db')
  assert.ok(saved instanceof Uint8Array, 'No durable database exists after an awaited write')
  await initDatabase()
  assert.equal((await electronShim.db.query('SELECT * FROM users')).length, 1)
})

test('failed durable writes reject and do not leave successful-looking SQL changes', async () => {
  await initDatabase()
  await new Promise(resolve => setTimeout(resolve, 130))
  idb.control.failNextWrite = true
  await assert.rejects(electronShim.db.run("INSERT INTO users (username, email, password_hash) VALUES ('bad', 'bad@example.test', 'hash')"))
  assert.equal(getDB().exec('SELECT count(*) FROM users')[0].values[0][0], 0)
})

test('parent deletion detaches study material and removes owned child rows', async () => {
  await initDatabase()
  window.electronAPI = electronShim
  await electronShim.db.batch([
    { sql: "INSERT INTO classes (id,user_id,name) VALUES (1,1,'Biology')" },
    { sql: "INSERT INTO notes (id,user_id,class_id,title,content) VALUES (1,1,1,'Notes','Text')" },
    { sql: "INSERT INTO flashcard_decks (id,user_id,class_id,note_id,name) VALUES (1,1,1,1,'Deck')" },
    { sql: "INSERT INTO flashcards (id,user_id,deck_id,note_id,class_id,front,back) VALUES (1,1,1,1,1,'Q','A')" },
    { sql: "INSERT INTO quizzes (id,user_id,note_id,class_id,title,questions) VALUES (1,1,1,1,'Quiz','[]')" },
    { sql: "INSERT INTO quiz_attempts (quiz_id,user_id,score,total,answers) VALUES (1,1,1,1,'[0]')" },
    { sql: "INSERT INTO note_attachments (note_id,user_id,filename,original_name,file_type,file_size) VALUES (1,1,'test.txt','test.txt','.txt',0)" },
  ])
  await electronShim.db.run('DELETE FROM classes WHERE id = 1')
  assert.equal((await electronShim.db.get('SELECT class_id FROM flashcard_decks')).class_id, null)
  await electronShim.db.run('DELETE FROM notes WHERE id = 1')
  assert.equal((await electronShim.db.get('SELECT note_id FROM flashcards')).note_id, null)
  assert.equal((await electronShim.db.query('SELECT * FROM note_attachments')).length, 0)
  await electronShim.db.run('DELETE FROM quizzes WHERE id = 1')
  assert.equal((await electronShim.db.query('SELECT * FROM quiz_attempts')).length, 0)
  await electronShim.db.run('DELETE FROM flashcard_decks WHERE id = 1')
  assert.equal((await electronShim.db.query('SELECT * FROM flashcards')).length, 0)
})

test('failed deck creation rolls back the deck and every card', async () => {
  await initDatabase()
  window.electronAPI = electronShim
  await assert.rejects(saveFlashcardDeck(1, 'Invalid deck', [{ front: 'Q', back: null }] as any))
  assert.equal((await electronShim.db.query('SELECT * FROM flashcard_decks')).length, 0)
  assert.equal((await electronShim.db.query('SELECT * FROM flashcards')).length, 0)
  const ids = await Promise.all([
    saveFlashcardDeck(1, 'First', [{ front: 'First Q', back: 'First A' }]),
    saveFlashcardDeck(1, 'Second', [{ front: 'Second Q', back: 'Second A' }]),
  ])
  assert.notEqual(ids[0], ids[1])
  const cards = await electronShim.db.query('SELECT front, deck_id FROM flashcards ORDER BY id')
  assert.deepEqual(cards.map(card => card.deck_id), ids)
})

test('late study-material creation cannot write under a different active account', async () => {
  useStore.getState().setUser({ ...user, id: 2 } as any)
  await assert.rejects(saveFlashcardDeck(1, 'Old request', [{ front: 'Q', back: 'A' }]), /account changed/)
  assert.equal(writes.length, 0)
})

test('review history includes attempts after the cutoff time on the cutoff day', async () => {
  await initDatabase()
  window.electronAPI = electronShim
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  cutoff.setMinutes(cutoff.getMinutes() + 1)
  const stamp = cutoff.toISOString().replace('T', ' ').slice(0, 19)
  await electronShim.db.batch([
    { sql: 'INSERT INTO quizzes (id,user_id,title,questions) VALUES (1,1,?,?)', params: ['Boundary quiz', JSON.stringify(quiz.questions)] },
    { sql: 'INSERT INTO quiz_attempts (quiz_id,user_id,score,total,answers,completed_at) VALUES (1,1,1,1,?,?)', params: ['[0]', stamp] },
  ])
  await act(async () => { root = create(<ReviewHistory />) })
  assert.ok(text().includes('Boundary quiz'))
})

test('canceling a file chooser resolves instead of hanging', async () => {
  const clicked = dom.window.HTMLInputElement.prototype.click
  dom.window.HTMLInputElement.prototype.click = function () {
    this.dispatchEvent(new dom.window.Event('cancel'))
  }
  try {
    const result = await Promise.race([electronShim.file.selectFiles(), new Promise(resolve => setTimeout(() => resolve('hung'), 50))])
    assert.deepEqual(result, [])
  } finally { dom.window.HTMLInputElement.prototype.click = clicked }
})

test('recording a shortcut does not activate global navigation', async () => {
  useStore.getState().setCurrentPage('settings')
  await act(async () => { root = create(<Layout />) })
  const record = root!.root.findByType(SettingsPanel).findAllByType('button').find(b => b.children.includes('1'))!
  act(() => record.props.onClick())
  act(() => window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true })))
  assert.equal(useStore.getState().currentPage, 'settings')
})

test('Enter in the middle of a list item splits and preserves the trailing text', () => {
  const editor = document.createElement('div')
  document.body.appendChild(editor)
  const note = { id: 1, user_id: 1, title: 'List', content: '<ul class="dashed-list"><li>abcdef</li></ul>' }
  act(() => { root = create(<NoteEditor note={note as any} onBack={() => {}} onUpdate={() => {}} />, {
    createNodeMock: element => element.props.contentEditable ? editor : document.createElement('div'),
  }) })
  const li = editor.querySelector('li')!
  const range = document.createRange()
  range.setStart(li.firstChild!, 3)
  range.collapse(true)
  window.getSelection()!.removeAllRanges()
  window.getSelection()!.addRange(range)
  act(() => root!.root.findByProps({ contentEditable: true }).props.onKeyDown({ key: 'Enter', preventDefault() {}, shiftKey: false }))
  assert.deepEqual(Array.from(editor.querySelectorAll('li')).map(item => item.textContent?.replace(/\u200B/g, '')), ['abc', 'def'])
})

test('a throttled timer accounts for elapsed seconds', () => {
  const originalNow = Date.now
  const originalInterval = globalThis.setInterval
  const originalClear = globalThis.clearInterval
  let now = 100000
  let tick: () => void = () => {}
  Date.now = () => now
  globalThis.setInterval = ((fn: () => void) => { tick = fn; return 1 }) as any
  globalThis.clearInterval = (() => {}) as any
  function Engine() { useTimerEngine(); return null }
  try {
    useStore.setState(state => ({ timer: { ...state.timer, isRunning: true, timeLeft: 60 } }))
    act(() => { root = create(<Engine />) })
    now += 5000
    act(() => tick())
    assert.equal(useStore.getState().timer.timeLeft, 55)
    act(() => root!.unmount()); root = undefined
  } finally { Date.now = originalNow; globalThis.setInterval = originalInterval; globalThis.clearInterval = originalClear }
})

test('generated study guides contain formatted headings, not raw Markdown', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '# Biology\n\n- Cells\n- DNA' } }] }), {
    status: 200, headers: { 'content-type': 'application/json' },
  })
  useStore.getState().setSettings({ ...useStore.getState().settings, theme: 'blue', openai_api_key: 'test-key' } as any)
  const editor = document.createElement('div')
  document.body.appendChild(editor)
  // jsdom does not compute innerText; supply the text the browser renders.
  Object.defineProperty(editor, 'innerText', { configurable: true, get: () => editor.textContent })
  const note = { id: 1, user_id: 1, class_id: 4, title: 'Biology', content: '<p>Cells and DNA</p>' }
  try {
    act(() => { root = create(<NoteEditor note={note as any} onBack={() => {}} onUpdate={() => {}} />, {
      createNodeMock: element => element.props.contentEditable ? editor : document.createElement('div'),
    }) })
    const generate = root!.root.findAllByType('button').find(b => b.children.includes('Create Study Guide'))!
    await act(async () => generate.props.onClick())
    const saved = writes.find(write => write.sql.includes('INSERT INTO notes'))!
    assert.ok(saved.params?.some(value => typeof value === 'string' && value.includes('<h1>Biology</h1>')))
    assert.ok(saved.params?.includes(4), 'Study guide should retain the source class')
  } finally { globalThis.fetch = originalFetch }
})

test('an older failed autosave cannot overwrite a newer successful edit on exit', async () => {
  let saver: ReturnType<typeof useNoteAutosave>
  let content: React.MutableRefObject<string>
  let calls = 0
  const stored: string[] = []
  window.electronAPI.db.run = async (_sql, params) => {
    calls++
    if (calls === 1) throw new Error('First write failed')
    stored.push(params![1])
    return { changes: 1 }
  }
  window.electronAPI.db.get = async () => ({ id: 1, content: stored.at(-1) })
  function Editor() {
    content = React.useRef('old edit')
    saver = useNoteAutosave({ id: 1, title: 'Note', content: '' } as any, 'Note', undefined, content, () => {})
    return null
  }
  act(() => { root = create(<Editor />) })
  await act(async () => {
    const oldSave = saver.saveNote()
    content.current = 'new edit'
    const newSave = saver.saveNote()
    await Promise.all([oldSave, newSave])
  })
  await act(async () => root!.unmount()); root = undefined
  assert.equal(stored.at(-1), 'new edit')
})

test('a second app tab is refused until the first releases its database lock', async () => {
  let held = false
  const locks = {
    request: async (_name: string, _options: unknown, callback: (lock: unknown) => Promise<void>) => {
      if (held) return callback(null)
      held = true
      try { return await callback({ name: 'studyhive-database-writer' }) }
      finally { held = false }
    },
  } as any
  const release = await claimDatabaseTab(locks)
  await assert.rejects(claimDatabaseTab(locks), /already open/)
  release()
  await new Promise(resolve => setTimeout(resolve, 0))
  const releaseAgain = await claimDatabaseTab(locks)
  releaseAgain()
})

test('the manual deck form saves cards into the new deck', async () => {
  await initDatabase()
  window.electronAPI = electronShim
  await act(async () => { root = create(<FlashcardsList />) })
  act(() => button('New Deck').props.onClick())
  act(() => root!.root.findByProps({ placeholder: 'e.g. Biology Chapter 5' }).props.onChange({ target: { value: 'Manual deck' } }))
  act(() => root!.root.findByProps({ placeholder: 'Front (question / term)' }).props.onChange({ target: { value: 'Front' } }))
  act(() => root!.root.findByProps({ placeholder: 'Back (answer / definition)' }).props.onChange({ target: { value: 'Back' } }))
  act(() => button('+ Add Card').props.onClick())
  const createDeckButton = root!.root.findAllByType('button').find(b => b.children.some(child => typeof child === 'string' && child.includes('Create Deck')))!
  await act(async () => createDeckButton.props.onClick())
  const cards = await electronShim.db.query('SELECT d.name, f.front FROM flashcard_decks d JOIN flashcards f ON f.deck_id = d.id')
  assert.deepEqual(cards, [{ name: 'Manual deck', front: 'Front' }])
})

test('downloaded attachments retain their original filename and MIME type', async () => {
  const clickedInput = dom.window.HTMLInputElement.prototype.click
  const clickedAnchor = dom.window.HTMLAnchorElement.prototype.click
  let downloaded = ''
  const file = new File(['hello'], 'Lecture.txt', { type: 'text/plain' })
  dom.window.HTMLInputElement.prototype.click = function () {
    Object.defineProperty(this, 'files', { value: [file] })
    this.dispatchEvent(new dom.window.Event('change'))
  }
  dom.window.HTMLAnchorElement.prototype.click = function () { downloaded = this.download }
  try {
    const [selected] = await electronShim.file.selectFiles()
    const { filename } = await electronShim.file.saveAttachment(selected.path, selected.name)
    await electronShim.file.openAttachment(filename, selected.name)
    assert.equal(downloaded, 'Lecture.txt')
    const blob = idb.databases.get('studyhive-files')!.get('files')!.get(filename) as Blob
    assert.equal(blob.type, 'text/plain')
  } finally {
    dom.window.HTMLInputElement.prototype.click = clickedInput
    dom.window.HTMLAnchorElement.prototype.click = clickedAnchor
  }
})

test('a failed attachment deletion keeps the file available', async () => {
  let deletedFiles = 0
  window.electronAPI.db.query = async () => [{ id: 1, user_id: 1, note_id: 1, filename: 'internal.txt', original_name: 'Lecture.txt', file_type: '.txt', file_size: 5 }]
  window.electronAPI.db.run = async () => { throw new Error('Failed to persist deletion') }
  window.electronAPI.file = { ...electronShim.file, deleteAttachment: async () => { deletedFiles++; return true } }
  await act(async () => { root = create(<AttachmentManager noteId={1} />) })
  await act(async () => root!.root.findByProps({ title: 'Delete' }).props.onClick())
  assert.equal(deletedFiles, 0)
  assert.ok(text().includes('Lecture.txt'))
})

test('answers cannot change while a quiz attempt is being saved', async () => {
  let finish: (value: unknown) => void
  window.electronAPI.db.run = () => new Promise(resolve => { finish = resolve })
  act(() => { root = create(<QuizTaker quiz={quiz as any} onExit={() => {}} />) })
  const answer = root!.root.findAllByType('button').find(b => b.findAllByType('span').some(s => s.children.includes('4')))!
  let save: Promise<void>
  act(() => { save = button('Submit Quiz').props.onClick() })
  act(() => answer.props.onClick())
  await act(async () => { finish({ lastInsertRowid: 1 }); await save })
  const score = root!.root.findAllByType('h3')[0].children.join('')
  assert.equal(score, '0 / 1')
})

test('leaving the page with unsaved note edits requests confirmation', () => {
  let saver: ReturnType<typeof useNoteAutosave>
  function Editor() {
    const content = React.useRef('Unsaved text')
    saver = useNoteAutosave({ id: 1, title: 'Note', content: '' } as any, 'Note', undefined, content, () => {})
    return null
  }
  act(() => { root = create(<Editor />) })
  act(() => saver.triggerSave())
  const event = new dom.window.Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  assert.equal(event.defaultPrevented, true)
})
