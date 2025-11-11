import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

function deriveKillteamId(doc) {
  if (!doc) return null
  if (doc.killteamId) return doc.killteamId
  if (typeof doc.id === 'string' && doc.id.startsWith('killteam:')) {
    return doc.id.slice('killteam:'.length)
  }
  return null
}

function buildResultHref(result) {
  if (!result) return '/'

  if (result.type === 'operation') {
    const anchor = result.anchorId ? `#${result.anchorId}` : ''
    return `/ops${anchor}`
  }

  if (result.type === 'universal_action' || result.type === 'mission_action' || result.type === 'weapon_rule') {
    const anchor = result.anchorId ? `#${result.anchorId}` : ''
    return `/rules${anchor}`
  }

  if (result.type === 'equipment') {
    const killteamIdForEquipment = deriveKillteamId(result)
    if (!killteamIdForEquipment) {
      const anchor = result.anchorId ? `#${result.anchorId}` : ''
      return `/rules${anchor}`
    }
  }

  if (result.type === 'killteam') {
    const killteamId = deriveKillteamId(result)
    return killteamId ? `/killteams/${encodeURIComponent(killteamId)}` : '/'
  }

  const killteamId = deriveKillteamId(result)
  if (killteamId) {
    const anchor = result.anchorId ? `#${result.anchorId}` : ''
    return `/killteams/${encodeURIComponent(killteamId)}${anchor}`
  }

  return `/item/${result.id}`
}

const TYPE_LABELS = {
  killteam: 'Kill Team',
  operative: 'Operative',
  strategic_ploy: 'Strategy Ploy',
  tactical_ploy: 'Firefight Ploy',
  equipment: 'Equipment',
  universal_action: 'Action',
  mission_action: 'Action',
  operation: 'Operation',
  weapon_rule: 'Weapon Rule'
}

function formatType(type) {
  return TYPE_LABELS[type] || type
}

const PAGE_SIZE = 25

export default function Results({ results, loading }) {
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [results])

  const safeResults = Array.isArray(results) ? results : []
  const totalPages = Math.max(1, Math.ceil(safeResults.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages - 1)
  const start = clampedPage * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, safeResults.length)

  const pageResults = useMemo(
    () => safeResults.slice(start, end),
    [safeResults, start, end]
  )

  if (loading) return <div className="card">Building index…</div>
  if (!results) return null
  if (safeResults.length === 0) return <div className="card">No results.</div>

  const canPrev = clampedPage > 0
  const canNext = clampedPage < totalPages - 1

  const handlePrev = () => {
    if (canPrev) setPage(clampedPage - 1)
  }

  const handleNext = () => {
    if (canNext) setPage(clampedPage + 1)
  }

  return (
    <div className="card">
      <div className="results-summary">
        <span>
            Showing <strong>{start + 1}</strong>–<strong>{end}</strong> of {safeResults.length} results
        </span>
        <div className="results-pagination">
          <button
            type="button"
            className="pill-button"
            onClick={handlePrev}
            disabled={!canPrev}
          >
            ‹ Prev
          </button>
          <span className="muted">
            Page {clampedPage + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="pill-button"
            onClick={handleNext}
            disabled={!canNext}
          >
            Next ›
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Team</th>
            </tr>
          </thead>
          <tbody>
            {pageResults.map(r => (
              <tr key={`${r.id}-${r.anchorId || ''}`}>
                <td><Link href={buildResultHref(r)}>{r.title}</Link></td>
                <td className="muted">{formatType(r.type)}</td>
                <td>
                  {(() => {
                    const resolvedKillteamId = r.killteamId || deriveKillteamId(r) || null
                    if (r.killteamDisplayName && resolvedKillteamId) {
                      return (
                        <Link href={`/killteams/${encodeURIComponent(resolvedKillteamId)}`}>
                          {r.killteamDisplayName}
                        </Link>
                      )
                    }
                    if (r.killteamDisplayName) {
                      return r.killteamDisplayName
                    }
                    return r.killteamName || ''
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
