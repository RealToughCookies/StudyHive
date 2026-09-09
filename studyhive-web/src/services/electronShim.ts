import { initDatabase, readDatabase, runDatabaseBatch } from './database'
import { saveFile, deleteFile, getFile, getFileAsDataUrl } from './fileStorage'

// Temporary storage for File objects between select and read/save operations
const pendingFiles = new Map<string, File>()
let fileIdCounter = 0

function generateUniqueId(): string {
  return `__file_${Date.now()}_${fileIdCounter++}`
}

function generateStorageFilename(originalName: string): string {
  const ext = originalName.split('.').pop() || ''
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  return `${Date.now()}-${hex}.${ext}`
}

function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.hidden = true
    document.body.appendChild(input)
    const finish = (files: File[]) => { input.remove(); resolve(files) }
    input.onchange = () => finish(Array.from(input.files || []))
    input.addEventListener('cancel', () => finish([]), { once: true })
    try { input.click() } catch (error) { input.remove(); reject(error) }
  })
}

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error || new Error('Unable to read image'))
    reader.onabort = () => reject(new Error('Image reading was canceled'))
    reader.readAsDataURL(file)
  })
}

const electronShim = {
  db: {
    query: (sql: string, params?: any[]) => readDatabase(db => {
      const stmt = db.prepare(sql)
      try {
        if (params) stmt.bind(params)
        const results: any[] = []
        while (stmt.step()) results.push(stmt.getAsObject())
        return results
      } finally { stmt.free() }
    }),
    run: async (sql: string, params?: any[]) => (await runDatabaseBatch([{ sql, params }]))[0],
    batch: runDatabaseBatch,
    get: (sql: string, params?: any[]) => readDatabase(db => {
      const stmt = db.prepare(sql)
      try {
        if (params) stmt.bind(params)
        return stmt.step() ? stmt.getAsObject() : null
      } finally { stmt.free() }
    }),
  },

  file: {
    selectFiles: async () => {
      const files = await pickFiles('.pdf,.doc,.docx,.txt,.rtf,.odt,.png,.jpg,.jpeg,.gif,.webp,.svg,.xls,.xlsx,.csv,.ppt,.pptx', true)
      return files.map(file => {
        const id = generateUniqueId()
        pendingFiles.set(id, file)
        return { path: id, name: file.name, stats: { size: file.size, type: '.' + file.name.split('.').pop()?.toLowerCase() } }
      })
    },

    saveAttachment: async (sourcePath: string, originalName: string) => {
      const file = pendingFiles.get(sourcePath)
      if (!file) throw new Error('File not found in pending files')
      const filename = generateStorageFilename(originalName)
      await saveFile(filename, file)
      pendingFiles.delete(sourcePath)
      return {
        filename,
        stats: { size: file.size, type: '.' + (originalName.split('.').pop() || '') },
      }
    },

    deleteAttachment: async (filename: string) => {
      return deleteFile(filename)
    },

    openAttachment: async (filename: string, originalName?: string) => {
      const blob = await getFile(filename)
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = originalName || filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      if (!blob) throw new Error('This attachment is missing from browser storage')
      return ''
    },

    selectImage: async () => {
      const [file] = await pickFiles('image/*')
      return file ? { dataUrl: await readDataUrl(file), name: file.name } : null
    },

    saveImage: async (dataUrl: string, _filename: string) => {
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
      const filename = generateStorageFilename(`image.${ext}`)
      await saveFile(filename, blob)
      return filename
    },

    getImageDataUrl: async (filename: string) => {
      return getFileAsDataUrl(filename)
    },

    selectDocument: async () => {
      const [file] = await pickFiles('.pdf,.docx,.doc,.txt,.rtf')
      if (!file) return null
      const id = generateUniqueId()
      pendingFiles.set(id, file)
      return { path: id, name: file.name, ext: '.' + file.name.split('.').pop()?.toLowerCase() }
    },

    readBuffer: async (filePath: string) => {
      const file = pendingFiles.get(filePath)
      if (!file) throw new Error('File not found in pending files')
      const buffer = await file.arrayBuffer()
      pendingFiles.delete(filePath)
      return new Uint8Array(buffer)
    },

    readText: async (filePath: string) => {
      const file = pendingFiles.get(filePath)
      if (!file) throw new Error('File not found in pending files')
      const text = await file.text()
      pendingFiles.delete(filePath)
      return text
    },
  },

  onWindowBlur: (callback: () => void) => {
    window.addEventListener('blur', callback)
    return () => window.removeEventListener('blur', callback)
  },

  onWindowFocus: (callback: () => void) => {
    window.addEventListener('focus', callback)
    return () => window.removeEventListener('focus', callback)
  },

  notify: (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') new Notification(title, { body })
      })
    }
  },
}

export { electronShim, initDatabase }
