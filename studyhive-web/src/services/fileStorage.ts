const IDB_NAME = 'studyhive-files'
const STORE_NAME = 'files'

function openFileDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveFile(filename: string, data: Blob | Uint8Array): Promise<void> {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart])
  const idb = await openFileDB()
  const tx = idb.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).put(blob, filename)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('File operation was aborted'))
  })
}

export async function getFile(filename: string): Promise<Blob | null> {
  const idb = await openFileDB()
  const tx = idb.transaction(STORE_NAME, 'readonly')
  const req = tx.objectStore(STORE_NAME).get(filename)
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteFile(filename: string): Promise<boolean> {
  const idb = await openFileDB()
  const tx = idb.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).delete(filename)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('File operation was aborted'))
  })
}

export async function getFileAsDataUrl(filename: string): Promise<string | null> {
  const blob = await getFile(filename)
  if (!blob) return null
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'))
    reader.onabort = () => reject(new Error('File read was canceled'))
    reader.readAsDataURL(blob)
  })
}
