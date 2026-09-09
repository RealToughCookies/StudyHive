import { useEffect } from 'react'
import { useStore } from './store'
import Layout from './components/Layout'
import LoginScreen from './components/Auth/LoginScreen'
import SignupScreen from './components/Auth/SignupScreen'

function App() {
  const { isAuthenticated, currentPage } = useStore()

  useEffect(() => {
    // Initialize app - load user session if exists
    const initApp = async () => {
      try {
        // Try to get stored session (implement later with electron-store)
        // For now, just apply default theme
        const store = useStore.getState()
        store.applyTheme('blue')
      } catch (error) {
        console.error('Failed to initialize app:', error)
      }
    }

    initApp()
  }, [])

  // Show auth screens if not authenticated
  if (!isAuthenticated) {
    if (currentPage === 'signup') {
      return <SignupScreen />
    }
    return <LoginScreen />
  }

  // Show main app layout
  return <Layout />
}

export default App
