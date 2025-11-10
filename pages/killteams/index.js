import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Header from '../../components/Header'
import RichText from '../../components/RichText'
import Disclaimer from '../../components/Disclaimer'
import { db } from '../../lib/db'
import { ensureIndex } from '../../lib/search'
import { checkForUpdates } from '../../lib/update'

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
  const [version, setVersion] = useState(null)
  const [status, setStatus] = useState('')
  const [selectedKillteamId, setSelectedKillteamId] = useState('')
  const router = useRouter()

  useEffect(() => {
    (async () => {
      const upd = await checkForUpdates()
      setStatus(upd.error ? 'Offline' : (upd.warning ? 'Partial update' : 'Up to date'))
      if (upd.version) setVersion(upd.version)

      await ensureIndex()
      const rows = await db.killteams.orderBy('killteamName').toArray()
      rows.sort((a, b) => (a.killteamName || '').localeCompare(b.killteamName || ''))
      setKillteams(rows)
    })()
  }, [])

  return (
    <div className="container">
      <Header version={version} status={status}/>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Kill Teams</h2>
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label htmlFor="killteam-jump" className="muted" style={{ fontSize: '0.9rem' }}>
            Jump to a kill team:
          </label>
          <select
            id="killteam-jump"
            value={selectedKillteamId}
            onChange={(e) => {
              const value = e.target.value
              setSelectedKillteamId(value)
              if (value) {
                router.push(`/killteams/${value}`)
              }
            }}
          >
            <option value="">Select a kill team…</option>
            {killteams.map(kt => (
              <option key={kt.killteamId} value={kt.killteamId}>
                {kt.killteamName} ({kt.killteamId})
              </option>
            ))}
          </select>
        </div>
        {killteams.map(kt => (
          <div key={kt.killteamId} className="card" style={{ margin: '.5rem 0' }}>
            <div className="heading" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong>{kt.killteamName}</strong>
              <span className="pill">{kt.killteamId}</span>
            </div>
            {kt.archetypes && (
              <div style={{ marginBottom: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {parseArchetypes(kt.archetypes).map(archetype => (
                  <span key={archetype} className="pill">{archetype}</span>
                ))}
              </div>
            )}
            {kt.description && <RichText className="muted" text={kt.description} />}
            <div style={{ marginTop: '.5rem' }}>
              <Link href={`/killteams/${kt.killteamId}`}>Open kill team →</Link>
            </div>
          </div>
        ))}
        {killteams.length === 0 && (
          <div className="muted">No kill teams available. Try forcing an update from the menu.</div>
        )}
      </div>
      <Disclaimer />
    </div>
  )
}
