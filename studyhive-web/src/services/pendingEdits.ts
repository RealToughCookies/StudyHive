const editors = new Set<() => Promise<boolean>>()

export function registerPendingEditor(flush: () => Promise<boolean>) {
  editors.add(flush)
  return () => { editors.delete(flush) }
}

export async function savePendingEdits() {
  const results = await Promise.allSettled([...editors].map(flush => flush()))
  return results.every(result => result.status === 'fulfilled' && result.value)
}
