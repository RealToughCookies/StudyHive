// sql.js keeps a full database copy in memory. Two independent tabs must not overwrite
// each other's copies. Web Locks releases this lock automatically when the tab closes.
export function claimDatabaseTab(locks = navigator.locks): Promise<() => void> {
  if (!locks) return Promise.resolve(() => {})
  return new Promise((resolve, reject) => {
    locks.request('studyhive-database-writer', { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('StudyHive is already open in another tab. Close that tab, then reload this page.')
      await new Promise<void>(release => resolve(release))
    }).catch(reject)
  })
}
