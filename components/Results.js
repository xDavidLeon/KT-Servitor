import { useEffect, useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ResultsTableSkeleton } from './Skeleton'
import { highlightText } from '../lib/highlight'
import { useHapticFeedback } from '../hooks/useHapticFeedback'

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

export default function Results({ results, loading, selectedIndex, onResultSelect, searchQuery = '' }) {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const resultRefs = useRef({})
  const { lightTap, navigation } = useHapticFeedback()

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

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < safeResults.length) {
      // Calculate which page the selected index is on
      const selectedPage = Math.floor(selectedIndex / PAGE_SIZE)
      if (selectedPage !== clampedPage) {
        setPage(selectedPage)
      } else {
        // Scroll the selected row into view
        const localIndex = selectedIndex % PAGE_SIZE
        if (localIndex >= 0 && localIndex < pageResults.length) {
          const result = pageResults[localIndex]
          const resultId = `${result.id}-${result.anchorId || ''}`
          const element = resultRefs.current[resultId]
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
        }
      }
    }
  }, [selectedIndex, safeResults.length, pageResults, clampedPage])

  // Handle result selection via Enter key
  // Note: This effect should not auto-navigate - navigation is handled by the parent
  // We just need to ensure the selected result is visible

  if (loading) return <ResultsTableSkeleton rowCount={8} />
  if (!results) return null
  if (safeResults.length === 0) return <div className="card">No results.</div>

  const canPrev = clampedPage > 0
  const canNext = clampedPage < totalPages - 1

  const handlePrev = () => {
    if (canPrev) {
      navigation()
      setPage(clampedPage - 1)
    }
  }

  const handleNext = () => {
    if (canNext) {
      navigation()
      setPage(clampedPage + 1)
    }
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
            {pageResults.map((r, index) => {
              const resultId = `${r.id}-${r.anchorId || ''}`
              const globalIndex = start + index
              const isSelected = selectedIndex === globalIndex
              
              return (
                <tr
                  key={resultId}
                  ref={el => { resultRefs.current[resultId] = el }}
                  className={isSelected ? 'result-selected' : ''}
                  style={{
                    backgroundColor: isSelected ? 'rgba(251, 146, 60, 0.15)' : 'transparent',
                    outline: isSelected ? '2px solid #fb923c' : 'none',
                    outlineOffset: isSelected ? '-2px' : '0'
                  }}
                >
                  <td>
                    <Link href={buildResultHref(r)}>
                      {highlightText(r.title || '', searchQuery)}
                    </Link>
                  </td>
                  <td className="muted">{formatType(r.type)}</td>
                  <td>
                    {(() => {
                      const resolvedKillteamId = r.killteamId || deriveKillteamId(r) || null
                      const teamName = r.killteamDisplayName || r.killteamName || ''
                      if (r.killteamDisplayName && resolvedKillteamId) {
                        return (
                          <Link href={`/killteams/${encodeURIComponent(resolvedKillteamId)}`}>
                            {highlightText(teamName, searchQuery)}
                          </Link>
                        )
                      }
                      if (r.killteamDisplayName) {
                        return highlightText(teamName, searchQuery)
                      }
                      return highlightText(teamName, searchQuery)
                    })()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
