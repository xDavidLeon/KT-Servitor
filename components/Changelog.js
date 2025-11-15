// components/Changelog.js
// Display changelog/release notes

import { useState, useEffect } from 'react'
import { fetchChangelog, markChangelogAsRead } from '../lib/changelog'
import { getVersionInfo } from '../lib/versioning'

const CHANGE_TYPE_LABELS = {
  added: { label: 'Added', icon: '➕', color: '#2ecc71' },
  fixed: { label: 'Fixed', icon: '🔧', color: '#3498db' },
  changed: { label: 'Changed', icon: '🔄', color: '#f39c12' },
  removed: { label: 'Removed', icon: '➖', color: '#e74c3c' }
}

export default function Changelog({ onClose }) {
  const [changelog, setChangelog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState(null)
  
  useEffect(() => {
    async function load() {
      try {
        const data = await fetchChangelog()
        setChangelog(data)
        
        // Mark as read when opened
        if (data && data.length > 0) {
          const versionInfo = await getVersionInfo()
          if (versionInfo.version) {
            await markChangelogAsRead(versionInfo.version)
          }
        }
      } catch (err) {
        console.error('Failed to load changelog:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])
  
  if (loading) {
    return (
      <div className="card">
        <p className="muted">Loading changelog...</p>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="card">
        <p className="muted">Failed to load changelog: {error}</p>
      </div>
    )
  }
  
  if (!changelog || !Array.isArray(changelog) || changelog.length === 0) {
    return (
      <div className="card">
        <p className="muted">No changelog available</p>
      </div>
    )
  }
  
  // Filter changelog entries
  const filtered = filter === 'all' 
    ? changelog 
    : changelog.map(entry => ({
        ...entry,
        changes: entry.changes?.filter(c => c.type === filter) || []
      })).filter(entry => entry.changes.length > 0)
  
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>What's New</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="pill-button"
            style={{ padding: '0.4rem 0.8rem' }}
          >
            Close
          </button>
        )}
      </div>
      
      {/* Filter buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1rem', 
        flexWrap: 'wrap' 
      }}>
        <button
          onClick={() => setFilter('all')}
          className="pill-button"
          style={{
            backgroundColor: filter === 'all' ? '#F55A07' : 'transparent',
            borderColor: filter === 'all' ? '#F55A07' : '#2a2f3f',
            color: filter === 'all' ? '#ffffff' : 'var(--text)',
            padding: '0.4rem 0.8rem',
            fontSize: '0.85rem'
          }}
        >
          All
        </button>
        {Object.entries(CHANGE_TYPE_LABELS).map(([type, { label }]) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className="pill-button"
            style={{
              backgroundColor: filter === type ? CHANGE_TYPE_LABELS[type].color : 'transparent',
              borderColor: filter === type ? CHANGE_TYPE_LABELS[type].color : '#2a2f3f',
              color: filter === type ? '#ffffff' : 'var(--text)',
              padding: '0.4rem 0.8rem',
              fontSize: '0.85rem'
            }}
          >
            {label}
          </button>
        ))}
      </div>
      
      {/* Changelog entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {filtered.map((entry, idx) => {
          if (!entry.changes || entry.changes.length === 0) return null
          
          return (
            <div 
              key={idx} 
              style={{
                padding: '1rem',
                background: '#1a1f2b',
                borderRadius: '8px',
                border: '1px solid #2a2f3f'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent)' }}>
                  {entry.date ? new Date(entry.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'Recent Changes'}
                </h3>
                {entry.version && (
                  <code style={{ 
                    background: '#2a2f3f', 
                    padding: '0.2rem 0.4rem', 
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    color: 'var(--muted)'
                  }}>
                    {entry.version}
                  </code>
                )}
              </div>
              
              <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {entry.changes.map((change, cIdx) => {
                  const typeInfo = CHANGE_TYPE_LABELS[change.type] || CHANGE_TYPE_LABELS.changed
                  return (
                    <li 
                      key={cIdx} 
                      style={{ 
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        fontSize: '0.9rem',
                        lineHeight: '1.5'
                      }}
                    >
                      <span style={{ color: typeInfo.color, fontSize: '1rem' }}>
                        {typeInfo.icon}
                      </span>
                      <span style={{ flex: 1 }}>
                        <strong style={{ color: typeInfo.color }}>
                          {typeInfo.label}:
                        </strong>{' '}
                        {change.description}
                        {change.category && (
                          <span className="muted" style={{ marginLeft: '0.5rem' }}>
                            ({change.category})
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
      
      {filtered.length === 0 && (
        <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
          No changes found for the selected filter.
        </p>
      )}
    </div>
  )
}

