import React from 'react'
import './styles/index.css'

async function boot() {
  const { cloudClient } = await import('./services/cloud/client')
  const { electronShim, initDatabase } = await import('./services/electronShim')
  window.electronAPI = electronShim
  if (!cloudClient) {
    const { claimDatabaseTab } = await import('./services/databaseOwnership')
    await claimDatabaseTab()
    await initDatabase()
  } else {
    // Fail closed if a forgotten legacy SQL call reaches the cloud build.
    const unavailable = async () => { throw new Error('Local SQL is unavailable in cloud mode.') }
    window.electronAPI = { ...electronShim, db: { query: unavailable, get: unavailable, run: unavailable, batch: unavailable } }
  }

  const { createRoot } = await import('react-dom/client')
  const { default: App } = await import('./App')

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

boot().catch(error => {
  console.error('StudyHive startup failed:', error)
  const root = document.getElementById('root')!
  const panel = document.createElement('div')
  panel.className = 'max-w-xl mx-auto p-8'
  const heading = document.createElement('h1')
  heading.className = 'text-2xl font-bold mb-4'
  heading.textContent = 'StudyHive could not start'
  const message = document.createElement('p')
  message.textContent = error instanceof Error ? error.message : 'Browser storage is unavailable. Please try reloading.'
  const retry = document.createElement('button')
  retry.className = 'mt-4 px-4 py-2 rounded bg-blue-600 text-white'
  retry.textContent = 'Reload StudyHive'
  retry.onclick = () => window.location.reload()
  panel.append(heading, message, retry)
  root.replaceChildren(panel)
})
