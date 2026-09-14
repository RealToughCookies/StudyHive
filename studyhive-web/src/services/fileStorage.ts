import { cloudClient } from './cloud/client'
import { useStore } from '../store'

function fileOwner(filename: string) {
  const id = useStore.getState().currentUser?.id
  if (!id || !filename.startsWith(`${id}/`)) throw new Error('This file is not in your workspace.')
  return id
}

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
  if (cloudClient) {
    const owner = fileOwner(filename)
    if (blob.size > 10 * 1024 * 1024) throw new Error('Files must be 10 MB or smaller.')
    const { error } = await cloudClient.storage.from('study-files').upload(filename, blob, { upsert: false })
    if (error) throw error
    if (useStore.getState().currentUser?.id !== owner) throw new Error('Your account changed during upload.')
    return
  }
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
  if (cloudClient) {
    const owner = fileOwner(filename)
    const { data, error } = await cloudClient.storage.from('study-files').download(filename)
    if (error) throw error
    if (useStore.getState().currentUser?.id !== owner) throw new Error('Your account changed during download.')
    return data
  }
  const idb = await openFileDB()
  const tx = idb.transaction(STORE_NAME, 'readonly')
  const req = tx.objectStore(STORE_NAME).get(filename)
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteFile(filename: string): Promise<boolean> {
  if (cloudClient) {
    fileOwner(filename)
    const { error } = await cloudClient.storage.from('study-files').remove([filename])
    if (error) throw error
    return true
  }
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
