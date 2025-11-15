// components/UpdateNotification.js
// Toast notification for service worker updates

import { useState, useEffect } from 'react'
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate'
import { useHapticFeedback } from '../hooks/useHapticFeedback'

export default function UpdateNotification() {
  const [isMounted, setIsMounted] = useState(false)
  const { updateAvailable, isUpdating, skipWaiting, dismissUpdate } = useServiceWorkerUpdate()
  const { success, lightTap } = useHapticFeedback()

  // Only render on client to avoid hydration issues
  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted || !updateAvailable) {
    return null
  }

  const handleUpdate = () => {
    success()
    skipWaiting()
  }

  const handleDismiss = () => {
    lightTap()
    dismissUpdate()
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
        zIndex: 1001,
        animation: 'slideUp 0.3s ease-out'
      }}
    >
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '1rem',
          margin: '0 1rem',
          backgroundColor: '#1a1f2b',
          border: '2px solid #F55A07',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div style={{ flexGrow: 1 }}>
          <h4 style={{ margin: 0, color: '#f4f6ff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span aria-hidden="true">🔄</span>
            <span>Update Available</span>
          </h4>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#9aa0aa' }}>
            A new version of KT Servitor is available. Update now to get the latest features and improvements.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button
            className="pill-button"
            onClick={handleDismiss}
            disabled={isUpdating}
            style={{
              backgroundColor: 'transparent',
              borderColor: '#9aa0aa',
              color: '#9aa0aa',
              flex: 1
            }}
          >
            Later
          </button>
          <button
            className="pill-button"
            onClick={handleUpdate}
            disabled={isUpdating}
            style={{
              backgroundColor: '#F55A07',
              borderColor: '#F55A07',
              color: '#ffffff',
              flex: 1
            }}
          >
            {isUpdating ? 'Updating...' : 'Update Now'}
          </button>
        </div>
      </div>
      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

