// components/FactionSelector.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

const RECENT_FACTIONS_KEY = 'kt-servitor-recent-factions'
const MAX_RECENT = 3

function getRecentFactions() {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(RECENT_FACTIONS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function addRecentFaction(factionId) {
  if (typeof window === 'undefined') return
  try {
    const recent = getRecentFactions()
    // Remove if already exists
    const filtered = recent.filter(id => id !== factionId)
    // Add to front
    const updated = [factionId, ...filtered].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_FACTIONS_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('Error saving recent faction:', err)
  }
}

export default function FactionSelector({ currentFactionId }) {
  const router = useRouter()
  const [factions, setFactions] = useState([])
  const [recentFactions, setRecentFactions] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    // Load factions list
    fetch('/data/v1/factions.json')
      .then(res => res.json())
      .then(data => {
        setFactions(data.sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(err => console.error('Error loading factions:', err))
    
    // Load recent factions
    setRecentFactions(getRecentFactions())
  }, [])

  // Add current faction to recent when it changes
  useEffect(() => {
    if (currentFactionId) {
      // Normalize the ID (remove fac_ prefix if present)
      const normalizedId = currentFactionId.startsWith('fac_') ? currentFactionId.substring(4) : currentFactionId
      addRecentFaction(normalizedId)
      // Update state to reflect the change
      setRecentFactions(getRecentFactions())
    }
  }, [currentFactionId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.faction-selector')) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  const currentFaction = factions.find(f => f.id === currentFactionId || f.id === `fac_${currentFactionId}`)
  const filteredFactions = factions.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Get recent faction details
  const recentFactionDetails = recentFactions
    .map(id => {
      // Try to find faction with or without fac_ prefix
      return factions.find(f => f.id === id || f.id === `fac_${id}` || 
        (f.id.startsWith('fac_') && f.id.substring(4) === id) ||
         (!f.id.startsWith('fac_') && `fac_${f.id}` === id))
    })
    .filter(Boolean) // Remove undefined entries
    .filter(f => f.id !== currentFactionId && f.id !== `fac_${currentFactionId}`) // Exclude current

  return (
    <div className="faction-selector" style={{ position: 'relative', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--panel)',
          border: '1px solid #2a2f3f',
          borderRadius: '8px',
          padding: '0.5rem 1rem',
          color: 'var(--text)',
          cursor: 'pointer',
          flex: 1,
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.9rem'
        }}
      >
        <span>{currentFaction ? currentFaction.name : 'Select Faction...'}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>
      {recentFactionDetails.length > 0 && (
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          flexWrap: 'wrap'
        }}>
          {recentFactionDetails.map(faction => {
            const factionId = faction.id.startsWith('fac_') ? faction.id.substring(4) : faction.id
            return (
              <Link
                key={faction.id}
                href={`/factions/${factionId}`}
                className="pill"
                style={{
                  textDecoration: 'none',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                  fontSize: '0.85rem',
                  padding: '0.3rem 0.6rem'
                }}
              >
                {faction.name}
              </Link>
            )
          })}
        </div>
      )}
      
      {isOpen && (
        <div
          className="faction-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '0.25rem',
            background: 'var(--panel)',
            border: '1px solid #2a2f3f',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
            zIndex: 200,
            maxHeight: '400px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <input
            type="text"
            placeholder="Search factions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              margin: '0.5rem',
              padding: '0.5rem',
              background: '#0e1016',
              border: '1px solid #262a36',
              borderRadius: '6px',
              color: 'var(--text)',
              fontSize: '0.9rem'
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
          <div
            style={{
              overflowY: 'auto',
              maxHeight: '350px'
            }}
          >
            {filteredFactions.length > 0 ? (
              filteredFactions.map(faction => {
                const factionId = faction.id.startsWith('fac_') ? faction.id.substring(4) : faction.id
                const isActive = faction.id === currentFactionId || faction.id === `fac_${currentFactionId}`
                return (
                  <Link
                    key={faction.id}
                    href={`/factions/${factionId}`}
                    onClick={() => setIsOpen(false)}
                    style={{
                      display: 'block',
                      padding: '0.65rem 1rem',
                      color: isActive ? 'var(--accent)' : 'var(--text)',
                      textDecoration: 'none',
                      background: isActive ? '#1a1f2b' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.target.style.background = '#0f1320'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.target.style.background = 'transparent'
                    }}
                  >
                    {faction.name}
                  </Link>
                )
              })
            ) : (
              <div style={{ padding: '1rem', color: 'var(--muted)', textAlign: 'center' }}>
                No factions found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

