// components/KillteamSelector.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { db } from '../lib/db'

const RECENT_KILLTEAMS_KEY = 'kt-servitor-recent-killteams'
const MAX_RECENT = 3
const FACTION_LABELS = {
  IMP: 'Imperium',
  CHAOS: 'Chaos',
  SPEC: 'Spec Ops',
  HBR: 'Homebrew'
}
const FACTION_ORDER = ['Imperium', 'Chaos', 'Spec Ops', 'Homebrew', 'Xenos']

function getRecentKillteams() {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(RECENT_KILLTEAMS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (err) {
    console.warn('Failed to read recent kill teams', err)
    return []
  }
}

function addRecentKillteam(killteamId) {
  if (typeof window === 'undefined' || !killteamId) return
  try {
    const recent = getRecentKillteams()
    const filtered = recent.filter(id => id !== killteamId)
    const updated = [killteamId, ...filtered].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KILLTEAMS_KEY, JSON.stringify(updated))
  } catch (err) {
    console.warn('Failed to save recent kill team', err)
  }
}

function sortKillteams(list) {
  return [...list].sort((a, b) => {
    const nameA = (a.killteamName || a.killteamId || '').toLowerCase()
    const nameB = (b.killteamName || b.killteamId || '').toLowerCase()
    return nameA.localeCompare(nameB)
  })
}

function getFactionName(factionId) {
  if (!factionId) return 'Xenos'
  const normalized = String(factionId).toUpperCase()
  return FACTION_LABELS[normalized] || 'Xenos'
}

export default function KillteamSelector({ currentKillteamId }) {
  const [killteams, setKillteams] = useState([])
  const [recentIds, setRecentIds] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadKillteams() {
      try {
        const rows = await db.killteams.orderBy('killteamName').toArray()
        if (!cancelled) setKillteams(sortKillteams(rows))
      } catch (err) {
        console.error('Error loading kill teams:', err)
      }
    }

    loadKillteams()
    setRecentIds(getRecentKillteams())

    function onUpdate() {
      loadKillteams()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('kt-killteams-updated', onUpdate)
    }

    return () => {
      cancelled = true
      if (typeof window !== 'undefined') {
        window.removeEventListener('kt-killteams-updated', onUpdate)
      }
    }
  }, [])

  useEffect(() => {
    if (!currentKillteamId) return
    addRecentKillteam(currentKillteamId)
    setRecentIds(getRecentKillteams())
  }, [currentKillteamId])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.killteam-selector')) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  const currentKillteam = killteams.find(kt => kt.killteamId === currentKillteamId)
  const filteredKillteams = killteams.filter(kt => {
    const haystack = `${kt.killteamName || ''} ${kt.killteamId || ''} ${kt.factionId || ''}`.toLowerCase()
    return haystack.includes(searchTerm.toLowerCase())
  })

  const groupedKillteams = filteredKillteams.reduce((groups, kt) => {
    const faction = getFactionName(kt.factionId)
    if (!groups[faction]) groups[faction] = []
    groups[faction].push(kt)
    return groups
  }, {})

  const orderedGroups = FACTION_ORDER.map(label => ({
    label,
    items: groupedKillteams[label] || []
  })).filter(group => group.items.length > 0)

  const recentKillteams = recentIds
    .map(id => killteams.find(kt => kt.killteamId === id))
    .filter(Boolean)
    .filter(kt => kt.killteamId !== currentKillteamId)

  const renderKillteamOption = (kt) => {
    const isActive = kt.killteamId === currentKillteamId
    return (
      <Link
        key={kt.killteamId}
        href={`/killteams/${kt.killteamId}`}
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
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span>{kt.killteamName}</span>
          <span className="muted" style={{ fontSize: '0.75rem' }}>{kt.killteamId}</span>
        </div>
      </Link>
    )
  }

  return (
    <div className="killteam-selector" style={{ position: 'relative', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
        <span>{currentKillteam ? currentKillteam.killteamName : 'Select Kill Team...'}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>
      {recentKillteams.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          {recentKillteams.map(kt => (
            <Link
              key={kt.killteamId}
              href={`/killteams/${kt.killteamId}`}
              className="pill"
              style={{
                textDecoration: 'none',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
                fontSize: '0.85rem',
                padding: '0.3rem 0.6rem'
              }}
            >
              {kt.killteamName}
            </Link>
          ))}
        </div>
      )}

      {isOpen && (
        <div
          className="killteam-dropdown"
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
            placeholder="Search kill teams..."
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
              {orderedGroups.length > 0 ? (
                orderedGroups.map(group => (
                  <div key={group.label} style={{ padding: '0.5rem 0' }}>
                    <div
                      style={{
                        padding: '0.3rem 1rem',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--muted)'
                      }}
                    >
                      {group.label}
                    </div>
                    {group.items.map(kt => renderKillteamOption(kt))}
                  </div>
                ))
            ) : (
              <div style={{ padding: '1rem', color: 'var(--muted)', textAlign: 'center' }}>
                No kill teams found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
