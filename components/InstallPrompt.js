import { useState, useEffect } from 'react'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { useHapticFeedback } from '../hooks/useHapticFeedback'

export default function InstallPrompt() {
  const { isInstallable, isInstalled, install } = usePWAInstall()
  const [dismissed, setDismissed] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const { success, lightTap } = useHapticFeedback()

  useEffect(() => {
    // Check if user has previously dismissed the prompt
    if (typeof window === 'undefined') return

    const dismissedKey = 'pwa-install-prompt-dismissed'
    const dismissedTimestamp = localStorage.getItem(dismissedKey)
    const dismissedDate = dismissedTimestamp ? new Date(dismissedTimestamp) : null
    
    // Show prompt if:
    // 1. App is installable
    // 2. Not already installed
    // 3. Not dismissed in the last 7 days
    if (isInstallable && !isInstalled) {
      if (!dismissedDate) {
        setShowPrompt(true)
      } else {
        const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceDismissed >= 7) {
          setShowPrompt(true)
        }
      }
    } else {
      setShowPrompt(false)
    }
  }, [isInstallable, isInstalled])

  const handleInstall = async () => {
    const installSuccess = await install()
    if (installSuccess) {
      success()
      setShowPrompt(false)
    }
  }

  const handleDismiss = () => {
    lightTap()
    setDismissed(true)
    setShowPrompt(false)
    
    // Store dismissal timestamp
    if (typeof window !== 'undefined') {
      localStorage.setItem('pwa-install-prompt-dismissed', new Date().toISOString())
    }
  }

  if (!showPrompt || isInstalled) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '500px',
        zIndex: 1000,
        animation: 'slideUp 0.3s ease-out'
      }}
    >
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem',
          background: 'var(--panel)',
          border: '1px solid rgba(251, 146, 60, 0.3)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text)' }}>
            Install KT Servitor
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Add to your home screen for quick access and offline use
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button
            className="pill-button"
            onClick={handleInstall}
            style={{
              background: 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1rem',
              fontWeight: 600
            }}
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: '0.5rem',
              fontSize: '1.2rem',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

