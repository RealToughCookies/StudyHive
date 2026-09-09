import initSqlJs, { Database } from 'sql.js'

const IDB_NAME = 'studyhive-sql'
const IDB_KEY = 'db'

let db: Database | null = null
let SQLModule: Awaited<ReturnType<typeof initSqlJs>>
let mutationQueue: Promise<unknown> = Promise.resolve()

// IndexedDB helpers
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('data')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  const idb = await openIDB()
  const tx = idb.transaction('data', 'readonly')
  const req = tx.objectStore('data').get(IDB_KEY)
  return new Promise<Uint8Array | null>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  }).finally(() => idb.close())
}

async function saveToIndexedDB(data: Uint8Array): Promise<void> {
  const idb = await openIDB()
  const tx = idb.transaction('data', 'readwrite')
  tx.objectStore('data').put(data, IDB_KEY)
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Database save was aborted'))
  }).finally(() => idb.close())
}

export function getDB(): Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export async function initDatabase(): Promise<void> {
  await mutationQueue
  const SQL = await initSqlJs({
    locateFile: (file: string) => `${import.meta.env.BASE_URL}${file}`
  })

  SQLModule = SQL
  const saved = await loadFromIndexedDB()
  db?.close()
  db = saved ? new SQL.Database(saved) : new SQL.Database()

  createTables()
  await saveDatabase()
  console.log('Database initialized (browser mode)')
}

export async function saveDatabase(): Promise<void> {
  if (!db) return
  await saveToIndexedDB(db.export())
}

export interface SQLCommand {
  sql: string
  params?: any[]
}

export interface MutationResult {
  lastInsertRowid: number
  changes: number
}

// Runs complete operations in order and acknowledges them only after IndexedDB commits.
// A failed commit restores the last durable in-memory database before another operation runs.
export function runDatabaseBatch(commands: SQLCommand[]): Promise<MutationResult[]> {
  const operation = mutationQueue.then(async () => {
    const database = getDB()
    const before = database.export()
    const results: MutationResult[] = []
    try {
      database.run('BEGIN')
      for (const command of commands) {
        const params = command.params?.map(value => {
          if (value && typeof value === 'object' && 'insertIdFrom' in value) {
            const result = results[value.insertIdFrom]
            if (!result) throw new Error('Invalid batch insert reference')
            return result.lastInsertRowid
          }
          return typeof value === 'boolean' ? Number(value) : value ?? null
        })
        database.run(command.sql, params)
        const row = database.exec('SELECT last_insert_rowid(), changes()')[0].values[0]
        results.push({ lastInsertRowid: Number(row[0]), changes: Number(row[1]) })
      }
      database.run('COMMIT')
      await saveDatabase()
      return results
    } catch (error) {
      database.close()
      db = new SQLModule.Database(before)
      throw error
    }
  })
  mutationQueue = operation.catch(() => {})
  return operation.then(results => {
    window.dispatchEvent(new CustomEvent('studyhive-data-updated'))
    return results
  })
}

export async function readDatabase<T>(read: (database: Database) => T): Promise<T> {
  await mutationQueue
  return read(getDB())
}

function createTables() {
  if (!db) return

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      subscription_tier TEXT DEFAULT 'free',
      subscription_expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS flashcard_decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      class_id INTEGER,
      note_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (note_id) REFERENCES notes(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER,
      deck_id INTEGER,
      user_id INTEGER NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id),
      FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      questions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      answers TEXT NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      completed BOOLEAN DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      theme TEXT DEFAULT 'blue',
      dark_mode BOOLEAN DEFAULT 0,
      pomodoro_work_minutes INTEGER DEFAULT 25,
      pomodoro_break_minutes INTEGER DEFAULT 5,
      pomodoro_long_break_minutes INTEGER DEFAULT 15,
      notification_sound BOOLEAN DEFAULT 1,
      timer_sound BOOLEAN DEFAULT 1,
      show_floating_timer BOOLEAN DEFAULT 1,
      openai_api_key TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS note_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS sticky_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      position_x INTEGER DEFAULT 100,
      position_y INTEGER DEFAULT 100,
      width INTEGER DEFAULT 200,
      height INTEGER DEFAULT 150,
      color TEXT DEFAULT '#fef08a',
      is_visible BOOLEAN DEFAULT 1,
      is_minimized BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      time TEXT,
      color TEXT DEFAULT '#3b82f6',
      priority INTEGER DEFAULT 0,
      repeat TEXT,
      completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // Add columns for existing databases
  const alterColumns = [
    `ALTER TABLE settings ADD COLUMN timer_sound BOOLEAN DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN show_floating_timer BOOLEAN DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN dark_mode BOOLEAN DEFAULT 0`,
    `ALTER TABLE notes ADD COLUMN class_id INTEGER REFERENCES classes(id)`,
    `ALTER TABLE flashcards ADD COLUMN class_id INTEGER REFERENCES classes(id)`,
    `ALTER TABLE flashcards ADD COLUMN deck_id INTEGER REFERENCES flashcard_decks(id)`,
    `ALTER TABLE quizzes ADD COLUMN class_id INTEGER REFERENCES classes(id)`,
    `ALTER TABLE settings ADD COLUMN pause_on_blur BOOLEAN DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN auto_resume_on_focus BOOLEAN DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN shortcuts TEXT`,
  ]
  for (const sql of alterColumns) {
    try { db.run(sql) } catch (_) { /* column may already exist */ }
  }

  // Keep relationships consistent without deleting independently useful study materials.
  db.run(`
    CREATE TRIGGER IF NOT EXISTS delete_note_relations AFTER DELETE ON notes BEGIN
      UPDATE flashcard_decks SET note_id = NULL WHERE note_id = OLD.id;
      UPDATE flashcards SET note_id = NULL WHERE note_id = OLD.id;
      UPDATE quizzes SET note_id = NULL WHERE note_id = OLD.id;
      DELETE FROM note_attachments WHERE note_id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS delete_class_relations AFTER DELETE ON classes BEGIN
      UPDATE notes SET class_id = NULL WHERE class_id = OLD.id;
      UPDATE flashcards SET class_id = NULL WHERE class_id = OLD.id;
      UPDATE flashcard_decks SET class_id = NULL WHERE class_id = OLD.id;
      UPDATE quizzes SET class_id = NULL WHERE class_id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS delete_quiz_relations AFTER DELETE ON quizzes BEGIN
      DELETE FROM quiz_attempts WHERE quiz_id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS delete_deck_relations AFTER DELETE ON flashcard_decks BEGIN
      DELETE FROM flashcards WHERE deck_id = OLD.id;
    END;
  `)

  console.log('Database tables created successfully')
}
