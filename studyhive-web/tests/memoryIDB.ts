// In-memory IndexedDB transport with commit failures. SQL still runs in real sql.js.
export function memoryIDB() {
  const databases = new Map<string, Map<string, Map<string, unknown>>>()
  const control = { failNextWrite: false, commits: 0 }
  const factory = {
    open(name: string) {
      const req: any = {}
      queueMicrotask(() => {
        const isNew = !databases.has(name)
        if (isNew) databases.set(name, new Map())
        const stores = databases.get(name)!
        req.result = {
          close() {},
          createObjectStore(store: string) { stores.set(store, new Map()) },
          transaction(store: string, mode: string) {
            const tx: any = {}
            const changes: Array<() => void> = []
            tx.objectStore = () => ({
              get(key: string) {
                const read: any = {}
                queueMicrotask(() => { read.result = stores.get(store)?.get(key); read.onsuccess?.() })
                return read
              },
              put(value: unknown, key: string) { changes.push(() => stores.get(store)!.set(key, structuredClone(value))) },
              delete(key: string) { changes.push(() => stores.get(store)!.delete(key)) },
            })
            queueMicrotask(() => {
              if (mode === 'readwrite' && control.failNextWrite) {
                control.failNextWrite = false
                tx.error = new Error('Simulated storage failure')
                tx.onabort?.()
                tx.onerror?.()
              } else {
                changes.forEach(change => change())
                if (mode === 'readwrite') control.commits++
                tx.oncomplete?.()
              }
            })
            return tx
          },
        }
        if (isNew) req.onupgradeneeded?.()
        req.onsuccess?.()
      })
      return req
    },
  }
  return { factory: factory as unknown as IDBFactory, control, databases }
}
