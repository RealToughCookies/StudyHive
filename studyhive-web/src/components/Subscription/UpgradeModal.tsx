import { useState } from 'react'
import { useStore } from '../../store'
import { Crown, Check, X } from 'lucide-react'

interface UpgradeModalProps {
  onClose: () => void
}

const UpgradeModal = ({ onClose }: UpgradeModalProps) => {
  const { currentUser, setUser } = useStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedTier, setSelectedTier] = useState<'free' | 'premium'>('premium')

  const handleUpgrade = async () => {
    if (!currentUser) return
    setIsProcessing(true)
    setTimeout(async () => {
      try {
        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + 1)
        await window.electronAPI.db.run(
          'UPDATE users SET subscription_tier = ?, subscription_expires_at = ? WHERE id = ?',
          [selectedTier, expiresAt.toISOString(), currentUser.id]
        )
        const updatedUser = await window.electronAPI.db.get(
          'SELECT * FROM users WHERE id = ?',
          [currentUser.id]
        )
        setUser(updatedUser)
        alert('Premium demo enabled. No payment was taken.')
        onClose()
      } catch (error) {
        console.error('Failed to upgrade:', error)
        alert('Failed to upgrade subscription')
      } finally {
        setIsProcessing(false)
      }
    }, 1500)
  }

  const features = {
    free: ['Pomodoro Timer', 'Notes and Attachments', 'Manual Flashcards', 'AI Tools with Your API Key'],
    premium: ['All Free Features', 'Premium Demo Account Label']
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-8">
          <Crown className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Try Premium Demo</h2>
          <p className="text-gray-600">Preview a local plan change. No payment is collected.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className={'p-6 rounded-xl border-2 transition-all cursor-pointer ' + (selectedTier === 'free' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300')}>
            <div className="text-center mb-4">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
              <p className="text-4xl font-bold text-gray-900">$0<span className="text-lg font-normal text-gray-600">/month</span></p>
            </div>
            <ul className="space-y-3 mb-6">
              {features.free.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-gray-700"><Check className="w-5 h-5 text-green-600 flex-shrink-0" />{feature}</li>
              ))}
              {features.premium.slice(1).map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-gray-400"><X className="w-5 h-5 text-red-400 flex-shrink-0" />{feature}</li>
              ))}
            </ul>
            <p className="text-center text-sm text-gray-500">Current Plan</p>
          </div>
          <div onClick={() => setSelectedTier('premium')} className={'p-6 rounded-xl border-2 transition-all cursor-pointer relative ' + (selectedTier === 'premium' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300')}>
            {selectedTier === 'premium' && (
              <div className="absolute top-4 right-4 bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-semibold">Selected</div>
            )}
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2 mb-2"><Crown className="w-6 h-6 text-amber-500" /><h3 className="text-2xl font-bold text-gray-900">Premium</h3></div>
              <p className="text-4xl font-bold text-amber-600">Demo<span className="text-lg font-normal text-gray-600"> — no charge</span></p>
            </div>
            <ul className="space-y-3 mb-6">
              {features.premium.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-gray-700"><Check className="w-5 h-5 text-green-600 flex-shrink-0" />{feature}</li>
              ))}
            </ul>
          </div>
        </div>
        {currentUser?.subscription_tier === 'premium' ? (
          <div className="bg-green-50 border-2 border-green-200 p-4 rounded-xl mb-6 text-center"><p className="text-green-800 font-medium">The Premium demo is enabled on this local account.</p></div>
        ) : (
          <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl mb-6"><p className="text-blue-900 text-sm"><strong>Note:</strong> This demo changes a local account label. It does not charge you or unlock additional features; AI tools use your own API key.</p></div>
        )}
        <div className="flex gap-3">
          {currentUser?.subscription_tier !== 'premium' && (
            <button onClick={handleUpgrade} disabled={isProcessing || selectedTier === 'free'} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-6 py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isProcessing ? (
                <><div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />Processing...</>
              ) : (
                <><Crown className="w-5 h-5" />Try Premium Demo</>
              )}
            </button>
          )}
          <button onClick={onClose} disabled={isProcessing} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-4 rounded-lg font-semibold transition-colors disabled:opacity-50">Close</button>
        </div>
      </div>
    </div>
  )
}

export default UpgradeModal
