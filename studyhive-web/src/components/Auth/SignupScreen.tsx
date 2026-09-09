import { useState } from 'react'
import { useStore } from '../../store'
import { Mail, Lock, User, ArrowRight, CheckCircle } from 'lucide-react'
import bcrypt from 'bcryptjs'

const SignupScreen = () => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { setUser, setCurrentPage, setSettings } = useStore()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      // Check if user exists
      const existingUser = await window.electronAPI.db.get(
        'SELECT * FROM users WHERE email = ? OR username = ?',
        [email, username]
      )

      if (existingUser) {
        setError('Email or username already exists')
        setLoading(false)
        return
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10)

      const [result] = await window.electronAPI.db.batch([
        { sql: 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
          params: [username.trim(), email.trim(), passwordHash] },
        { sql: 'INSERT INTO settings (user_id) VALUES (?)', params: [{ insertIdFrom: 0 }] },
      ])
      const userId = result.lastInsertRowid

      // Get the new user and settings
      const newUser = await window.electronAPI.db.get(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      )

      const settings = await window.electronAPI.db.get(
        'SELECT * FROM settings WHERE user_id = ?',
        [userId]
      )

      // Set user and settings
      setUser(newUser)
      setSettings(settings)
      setCurrentPage('dashboard')
    } catch (err) {
      console.error('Signup error:', err)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    'Create unlimited notes with markdown support',
    'AI-powered flashcard and quiz generation',
    'Pomodoro timer with focus mode',
    'Track your study streaks and progress',
  ]

  return (
    <div className="min-h-screen flex flex-col">

      <div className="flex-1 flex">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-secondary via-primary-dark to-primary relative overflow-hidden">
        {/* Animated background shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse-soft" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-primary-light/20 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '2s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-lg overflow-hidden">
              <img src="./assets/StudyHiveLogo.png" alt="StudyHive" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">StudyHive</h1>
              <p className="text-white/70 font-medium">Your Study Companion</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold mt-8 mb-6">Start studying smarter today</h2>

          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-3 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <p className="text-white/80">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Signup Form */}
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
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
              <p className="text-gray-500 mt-2">Join thousands of successful students</p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-gray-900 placeholder-gray-400"
                    placeholder="johndoe"
                  />
                </div>
              </div>

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

              <div className="grid grid-cols-2 gap-4">
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
                      placeholder="6+ chars"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirm
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-gray-900 placeholder-gray-400"
                      placeholder="Repeat"
                    />
                  </div>
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
                <span>{loading ? 'Creating account...' : 'Create Account'}</span>
                {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-500">
                Already have an account?{' '}
                <button
                  onClick={() => setCurrentPage('login')}
                  className="text-primary hover:text-primary-dark font-semibold transition-colors"
                >
                  Sign in
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

export default SignupScreen
