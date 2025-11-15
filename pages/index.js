import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import SearchBox from '../components/SearchBox'
import Results from '../components/Results'
import { ensureIndex, getAllIndexedDocuments, isIndexReady } from '../lib/search'
import { checkForUpdates } from '../lib/update'
import Seo from '../components/Seo'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'


function rankResults(results, query) {
  if (!query) return results
  const normQuery = query.trim().toLowerCase()
  if (!normQuery) return results

  const normalize = (value) => (value || '').toString().trim().toLowerCase()

  const getRank = (item) => {
    const title = normalize(item.title)
    const abbr = normalize(item.abbr)
    const tags = Array.isArray(item.tags) ? item.tags.map(normalize) : []

    if (title === normQuery || (abbr && abbr === normQuery) || tags.includes(normQuery)) {
      return 0 // exact match
    }
    if (title.startsWith(normQuery) || (abbr && abbr.startsWith(normQuery)) || tags.some(tag => tag.startsWith(normQuery))) {
      return 1 // prefix match
    }
    if (title.includes(normQuery) || (abbr && abbr.includes(normQuery)) || tags.some(tag => tag.includes(normQuery))) {
      return 2 // partial match
    }
    return 3 // fallback to score ordering
  }

  // Sort in place - results array is already a copy from search results
  return results.slice().sort((a, b) => {
    const rankA = getRank(a)
    const rankB = getRank(b)
    if (rankA !== rankB) return rankA - rankB

    const scoreA = typeof a.score === 'number' ? a.score : 0
    const scoreB = typeof b.score === 'number' ? b.score : 0
    if (scoreA !== scoreB) return scoreB - scoreA

    return (a.title || '').localeCompare(b.title || '')
  })
}

export default function Home() {
  const router = useRouter()
  const locale = router.locale || 'en'
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(() => !isIndexReady())
  const [showHelp, setShowHelp] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef(null)

  const runSearch = async (query, idx) => {
    const mini = idx || await ensureIndex()
    const trimmed = query.trim()
    if (!trimmed) {
      const allDocs = await getAllIndexedDocuments()
      return [...allDocs].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }

    const primary = mini.search(trimmed, { prefix: true, fuzzy: 0.2 })
    if (primary.length) {
      return rankResults(primary, trimmed)
    }

    const norm = trimmed.toLowerCase()
    const allDocs = await getAllIndexedDocuments()
    const fallbackCandidates = allDocs.filter(doc => {
      const fields = [
        doc.title,
        doc.killteamName,
        doc.killteamDisplayName,
        ...(Array.isArray(doc.tags) ? doc.tags : []),
        doc.body
      ]

      return fields.some(value => {
        if (!value) return false
        return value.toString().toLowerCase().includes(norm)
      })
    })

    return rankResults(fallbackCandidates, trimmed)
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        await checkForUpdates(locale)
      } catch (err) {
        console.warn('Update check failed', err)
      }

      const idx = await ensureIndex()
      if (cancelled) return
      setLoading(false)

      const results = await runSearch(q, idx)
      if (!cancelled) {
        setRes(results)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [locale])
  
  useEffect(() => {
    let cancelled = false
    
    // Debounce: wait 300ms after user stops typing before searching
    const timeoutId = setTimeout(async () => {
      const idx = await ensureIndex()
      if (cancelled) return
      
      const results = await runSearch(q, idx)
      if (!cancelled) {
        setRes(results)
      }
    }, 300)

    // Cleanup: cancel the timeout if user types again before 300ms
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [q])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [res])

  // Keyboard shortcuts handlers
  const handleFocusSearch = useCallback(() => {
    searchInputRef.current?.focus()
  }, [])

  const handleClearSearch = useCallback(() => {
    setQ('')
    setSelectedIndex(-1)
    searchInputRef.current?.focus()
  }, [])

  const handleNavigateResults = useCallback((direction, currentIndex) => {
    const safeResults = Array.isArray(res) ? res : []
    if (safeResults.length === 0) return

    const maxIndex = safeResults.length - 1
    let newIndex

    if (currentIndex < 0) {
      newIndex = direction === 'down' ? 0 : maxIndex
    } else {
      if (direction === 'down') {
        newIndex = currentIndex < maxIndex ? currentIndex + 1 : 0
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : maxIndex
      }
    }

    setSelectedIndex(newIndex)
  }, [res])

  const handleSelectResult = useCallback((index) => {
    const safeResults = Array.isArray(res) ? res : []
    if (index >= 0 && index < safeResults.length) {
      const result = safeResults[index]
      if (result) {
        // Build href using same logic as Results component
        const deriveKillteamId = (doc) => {
          if (!doc) return null
          if (doc.killteamId) return doc.killteamId
          if (typeof doc.id === 'string' && doc.id.startsWith('killteam:')) {
            return doc.id.slice('killteam:'.length)
          }
          return null
        }

        const buildResultHref = (r) => {
          if (!r) return '/'
          if (r.type === 'operation') {
            const anchor = r.anchorId ? `#${r.anchorId}` : ''
            return `/ops${anchor}`
          }
          if (r.type === 'universal_action' || r.type === 'mission_action' || r.type === 'weapon_rule') {
            const anchor = r.anchorId ? `#${r.anchorId}` : ''
            return `/rules${anchor}`
          }
          if (r.type === 'equipment') {
            const killteamIdForEquipment = deriveKillteamId(r)
            if (!killteamIdForEquipment) {
              const anchor = r.anchorId ? `#${r.anchorId}` : ''
              return `/rules${anchor}`
            }
          }
          if (r.type === 'killteam') {
            const killteamId = deriveKillteamId(r)
            return killteamId ? `/killteams/${encodeURIComponent(killteamId)}` : '/'
          }
          const killteamId = deriveKillteamId(r)
          if (killteamId) {
            const anchor = r.anchorId ? `#${r.anchorId}` : ''
            return `/killteams/${encodeURIComponent(killteamId)}${anchor}`
          }
          return `/item/${r.id}`
        }

        const href = buildResultHref(result)
        router.push(href)
      }
    }
    setSelectedIndex(-1)
  }, [res, router])

  const handleShowHelp = useCallback(() => {
    setShowHelp(prev => !prev)
  }, [])

  // Ref to track selected index for keyboard shortcuts
  const selectedIndexRef = useRef(-1)

  // Sync selectedIndex with ref
  useEffect(() => {
    selectedIndexRef.current = selectedIndex
  }, [selectedIndex])

  // Use keyboard shortcuts hook
  useKeyboardShortcuts({
    onFocusSearch: handleFocusSearch,
    onClearSearch: handleClearSearch,
    onNavigateResults: (direction) => {
      handleNavigateResults(direction, selectedIndexRef.current)
    },
    onSelectResult: (index) => {
      handleSelectResult(index)
    },
    onShowHelp: handleShowHelp,
    enabled: !showHelp, // Disable when help modal is open
    selectedIndexRef
  })

  return (
    <>
      <Seo description="Search and browse Kill Team factions, operatives, rules, and equipment with a fast, offline-ready reference companion." />
      <div className="container">
        <Header />
        <SearchBox ref={searchInputRef} q={q} setQ={setQ} />
        <Results 
          results={res} 
          loading={loading}
          selectedIndex={selectedIndex}
          onResultSelect={handleSelectResult}
        />
        
        {/* Keyboard Shortcuts Help Modal */}
        {showHelp && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
            }}
            onClick={() => setShowHelp(false)}
          >
            <div
              className="card"
              style={{
                maxWidth: '500px',
                maxHeight: '80vh',
                overflow: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0 }}>Keyboard Shortcuts</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.5rem', width: '120px' }}><kbd>/</kbd></td>
                    <td style={{ padding: '0.5rem' }}>Focus search</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem' }}><kbd>Esc</kbd></td>
                    <td style={{ padding: '0.5rem' }}>Clear search</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem' }}><kbd>↑</kbd> / <kbd>↓</kbd></td>
                    <td style={{ padding: '0.5rem' }}>Navigate results</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem' }}><kbd>j</kbd> / <kbd>k</kbd></td>
                    <td style={{ padding: '0.5rem' }}>Navigate results (Vim-style)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem' }}><kbd>Enter</kbd></td>
                    <td style={{ padding: '0.5rem' }}>Open selected result</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem' }}><kbd>?</kbd></td>
                    <td style={{ padding: '0.5rem' }}>Show this help</td>
                  </tr>
                </tbody>
              </table>
              <button
                className="pill-button"
                onClick={() => setShowHelp(false)}
                style={{ marginTop: '1rem' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
