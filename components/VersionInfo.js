// components/VersionInfo.js
// Display version information in a modal

import { useState, useEffect } from 'react'
import { getVersionInfo, formatVersion, getAppVersion } from '../lib/versioning'

export default function VersionInfo({ onClose }) {
  const [versionInfo, setVersionInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const appVersion = getAppVersion()
  
  useEffect(() => {
    async function load() {
      try {
        const info = await getVersionInfo()
        setVersionInfo(info)
      } catch (err) {
        console.warn('Failed to load version info:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])
  
  if (loading) {
    return (
      <div className="card">
        <p className="muted">Loading version information...</p>
      </div>
    )
  }
  
  if (!versionInfo) {
    return (
      <div className="card">
        <p className="muted">Version information not available</p>
      </div>
    )
  }
  
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Version Information</h2>
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
      
      <dl style={{ display: 'grid', gap: '0.75rem', margin: 0 }}>
        <div>
          <dt style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--accent)' }}>
            App Version
          </dt>
          <dd style={{ margin: 0, color: 'var(--text)' }}>
            {appVersion}
          </dd>
        </div>
        
        <div>
          <dt style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--accent)' }}>
            Data Version
          </dt>
          <dd style={{ margin: 0, color: 'var(--text)' }}>
            {versionInfo.formatted || 'Unknown'}
          </dd>
        </div>
        
        {versionInfo.lastUpdate && (
          <div>
            <dt style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--accent)' }}>
              Last Updated
            </dt>
            <dd style={{ margin: 0, color: 'var(--text)' }}>
              {versionInfo.lastUpdate.toLocaleString()}
            </dd>
          </div>
        )}
        
        {versionInfo.lastCheck && (
          <div>
            <dt style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--accent)' }}>
              Last Checked
            </dt>
            <dd style={{ margin: 0, color: 'var(--text)' }}>
              {versionInfo.lastCheck.toLocaleString()}
            </dd>
          </div>
        )}
        
        {versionInfo.commit && (
          <div>
            <dt style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--accent)' }}>
              Data Source Commit
            </dt>
            <dd style={{ margin: 0, color: 'var(--text)' }}>
              <code style={{ 
                background: '#2a2f3f', 
                padding: '0.2rem 0.4rem', 
                borderRadius: '4px',
                fontSize: '0.9em'
              }}>
                {versionInfo.commit.slice(0, 8)}
              </code>
            </dd>
          </div>
        )}
      </dl>
      
      {versionInfo.history && versionInfo.history.length > 0 && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #2a2f3f' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Version History</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {versionInfo.history.slice(0, 5).map((entry, idx) => (
              <li key={idx} style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                {formatVersion(entry.version)} - {new Date(entry.timestamp).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

