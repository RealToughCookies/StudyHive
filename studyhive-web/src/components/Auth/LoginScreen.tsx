import { useState } from 'react'
import { useStore } from '../../store'
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react'
import bcrypt from 'bcryptjs'

const LoginScreen = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { setUser, setCurrentPage, setSettings } = useStore()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Query user from database
      const user = await window.electronAPI.db.get(
        'SELECT * FROM users WHERE email = ?',
        [email]
      )

      if (!user) {
        setError('Invalid email or password')
        setLoading(false)
        return
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash)

      if (!isValid) {
        setError('Invalid email or password')
        setLoading(false)
        return
      }

      // Load user settings
      let settings = await window.electronAPI.db.get(
        'SELECT * FROM settings WHERE user_id = ?',
        [user.id]
      )

      // Create default settings if none exist
      if (!settings) {
        await window.electronAPI.db.run(
          'INSERT INTO settings (user_id) VALUES (?)',
          [user.id]
        )
        settings = await window.electronAPI.db.get(
          'SELECT * FROM settings WHERE user_id = ?',
          [user.id]
        )
      }

      // Set user and settings
      setUser(user)
      setSettings(settings)
      setCurrentPage('dashboard')
    } catch (err) {
      console.error('Login error:', err)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">

      <div className="flex-1 flex">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary-dark to-secondary relative overflow-hidden">
        {/* Animated background shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse-soft" />
          <div className="absolute bottom-40 right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-primary-light/20 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '2s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-lg overflow-hidden">
              <img src="./assets/StudyHiveLogo.png" alt="StudyHive" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">StudyHive</h1>
              <p className="text-white/70 font-medium">Study Smarter, Not Harder</p>
            </div>
          </div>

          <div className="space-y-6 mt-8">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI-Powered Learning</h3>
                <p className="text-white/60 text-sm mt-1">Generate flashcards, quizzes, and study guides from your notes instantly</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Focus Mode</h3>
                <p className="text-white/60 text-sm mt-1">Distraction-free studying with Pomodoro timer integration</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Track Progress</h3>
                <p className="text-white/60 text-sm mt-1">Monitor your study streaks and review your learning history</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center space-x-3 mb-8">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg shadow-primary/30 bg-amber-50">
              <img src="./assets/StudyHiveLogo.png" alt="StudyHive" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">StudyHive</h1>
              <p className="text-xs text-gray-500">Study Smarter</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="text-gray-500 mt-2">Sign in to continue your learning journey</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-gray-900 placeholder-gray-400"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-gray-900 placeholder-gray-400"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl animate-fade-in">
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-secondary text-white font-semibold py-4 rounded-xl transition-all duration-300 disabled:opacity-50 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 flex items-center justify-center space-x-2 group"
              >
                <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-500">
                Don't have an account?{' '}
                <button
                  onClick={() => setCurrentPage('signup')}
                  className="text-primary hover:text-primary-dark font-semibold transition-colors"
                >
                  Create one
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default LoginScreen
