// components/ShareButton.js
// Share button component with Web Share API and clipboard fallback

import { useState } from 'react'
import { sharePage } from '../lib/share'
import { useHapticFeedback } from '../hooks/useHapticFeedback'

export default function ShareButton({ 
  title, 
  text, 
  url, 
  size = 'medium',
  variant = 'icon', // 'icon' or 'button'
  style = {}
}) {
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const { success, lightTap } = useHapticFeedback()

  const handleShare = async () => {
    if (sharing) return
    
    setSharing(true)
    lightTap()
    
    const result = await sharePage({ title, text, url })
    
    if (result.success) {
      success()
      if (result.method === 'clipboard') {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
    
    setSharing(false)
  }

  const sizeStyles = {
    small: {
      fontSize: '0.9rem',
      padding: '0.25rem',
      width: '1.5rem',
      height: '1.5rem'
    },
    medium: {
      fontSize: '1.1rem',
      padding: '0.35rem',
      width: '1.75rem',
      height: '1.75rem'
    },
    large: {
      fontSize: '1.3rem',
      padding: '0.5rem',
      width: '2rem',
      height: '2rem'
    }
  }

  const buttonStyle = {
    ...sizeStyles[size],
    background: 'transparent',
    border: 'none',
    cursor: sharing ? 'wait' : 'pointer',
    color: copied ? '#2ecc71' : 'var(--muted)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'all 0.2s ease',
    opacity: sharing ? 0.6 : 1,
    ...style
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleShare}
        className="pill-button"
        disabled={sharing}
        style={{
          padding: '0.5rem 1rem',
          fontSize: '0.9rem',
          whiteSpace: 'nowrap',
          ...style
        }}
        aria-label="Share"
      >
        {sharing ? 'Sharing...' : copied ? '✓ Copied!' : 'Share'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      style={buttonStyle}
      aria-label={copied ? 'Link copied!' : 'Share'}
      title={copied ? 'Link copied!' : 'Share'}
      disabled={sharing}
    >
      {copied ? '✓' : '🔗'}
    </button>
  )
}

