// components/ChangelogBadge.js
// Badge showing unread changelog count

import { useState, useEffect } from 'react'
import { getUnreadChangesCount } from '../lib/changelog'

export default function ChangelogBadge({ onClick, style = {} }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function check() {
      try {
        const count = await getUnreadChangesCount()
        setUnreadCount(count)
      } catch (err) {
        console.warn('Failed to check unread changes:', err)
      } finally {
        setLoading(false)
      }
    }
    
    check()
    
    // Check periodically (every 5 minutes)
    const interval = setInterval(check, 5 * 60 * 1000)
    
    // Also listen for version update events
    const handleVersionUpdate = () => {
      check()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('kt-version-updated', handleVersionUpdate)
    }
    
    return () => {
      clearInterval(interval)
      if (typeof window !== 'undefined') {
        window.removeEventListener('kt-version-updated', handleVersionUpdate)
      }
    }
  }, [])
  
  if (loading || unreadCount === 0) {
    return null
  }
  
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        ...style
      }}
      aria-label={`${unreadCount} new changes available`}
      title="View changelog"
    >
      <span style={{ fontSize: '1.2rem' }}>📋</span>
      <span
        style={{
          position: 'absolute',
          top: '-0.25rem',
          right: '-0.25rem',
          background: '#F55A07',
          color: '#ffffff',
          borderRadius: '50%',
          width: '1.2rem',
          height: '1.2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          fontWeight: 'bold',
          border: '2px solid #1a1f2b'
        }}
      >
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    </button>
  )
}

