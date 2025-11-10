import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '../../components/Header'
import KillteamSelector from '../../components/KillteamSelector'
import RichText from '../../components/RichText'
import { db } from '../../lib/db'
import { ensureIndex } from '../../lib/search'
import { checkForUpdates } from '../../lib/update'
import { FACTION_ORDER, getFactionName } from '../../lib/factions'
import Seo from '../../components/Seo'

function parseArchetypes(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value)
    .split(/[\/,]/)
    .map(part => part.trim())
    .filter(Boolean)
}

export default function Killteams() {
  const [killteams, setKillteams] = useState([])

  useEffect(() => {
    let cancelled = false

    (async () => {
      try {
        await checkForUpdates()
      } catch (err) {
        console.warn('Update check failed', err)
      }

      await ensureIndex()
      const rows = await db.killteams.orderBy('killteamName').toArray()
      rows.sort((a, b) => (a.killteamName || '').localeCompare(b.killteamName || ''))
      if (!cancelled) {
        setKillteams(rows)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const groupedKillteams = useMemo(() => {
    const byFaction = killteams.reduce((acc, kt) => {
      const faction = getFactionName(kt.factionId)
      if (!acc[faction]) acc[faction] = []
      acc[faction].push(kt)
      return acc
    }, {})

    return FACTION_ORDER.map(label => {
      const items = byFaction[label] || []
      const sorted = items.slice().sort((a, b) => (a.killteamName || '').localeCompare(b.killteamName || ''))
      return { label, items: sorted }
    }).filter(group => group.items.length > 0)
  }, [killteams])

  return (
    <>
      <Seo
        title="Kill Teams"
        description="Browse every Kill Team faction, see their archetypes at a glance, and jump straight into detailed operative, ploy, and equipment profiles."
      />
      <div className="container">
        <Header />
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Kill Teams</h2>
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span className="muted" style={{ fontSize: '0.9rem' }}>
              Jump to a kill team:
            </span>
            <KillteamSelector />
          </div>
          {groupedKillteams.map((group, index) => (
            <div key={group.label} style={{ marginTop: index === 0 ? '0.5rem' : '1.5rem' }}>
              <div
                style={{
                  padding: '0.3rem 0',
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--muted)'
                }}
              >
                {group.label}
              </div>
              {group.items.map(kt => {
                const archetypes = parseArchetypes(kt.archetypes)
                return (
                  <div key={kt.killteamId} className="card" style={{ margin: '.5rem 0' }}>
                    <div
                      className="heading"
                      style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}
                    >
                      <strong>{kt.killteamName}</strong>
                      {archetypes.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          {archetypes.map(archetype => (
                            <span key={archetype} className="pill">{archetype}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {kt.description && <RichText className="muted" text={kt.description} />}
                    <div style={{ marginTop: '.5rem' }}>
                      <Link href={`/killteams/${kt.killteamId}`}>Open kill team →</Link>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          {groupedKillteams.length === 0 && (
            <div className="muted">No kill teams available. Try forcing an update from the menu.</div>
          )}
        </div>
      </div>
    </>
  )
}
