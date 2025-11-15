import { useMemo } from 'react'
import { useHapticFeedback } from '../hooks/useHapticFeedback'

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'killteam', label: 'Kill Teams' },
  { value: 'operative', label: 'Operatives' },
  { value: 'strategic_ploy', label: 'Strategy Ploys' },
  { value: 'tactical_ploy', label: 'Firefight Ploys' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'universal_action', label: 'Universal Actions' },
  { value: 'mission_action', label: 'Mission Actions' },
  { value: 'weapon_rule', label: 'Weapon Rules' },
  { value: 'operation', label: 'Operations' }
]

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'alphabetical', label: 'Alphabetical (A-Z)' },
  { value: 'alphabetical-desc', label: 'Alphabetical (Z-A)' }
]

function deriveKillteamId(doc) {
  if (!doc) return null
  if (doc.killteamId) return doc.killteamId
  if (typeof doc.id === 'string' && doc.id.startsWith('killteam:')) {
    return doc.id.slice('killteam:'.length)
  }
  return null
}

export default function SearchFilters({ 
  results = [], 
  typeFilter, 
  setTypeFilter,
  killteamFilter,
  setKillteamFilter,
  sortBy,
  setSortBy,
  onClearFilters
}) {
  const { lightTap } = useHapticFeedback()

  // Extract unique kill teams from results
  const killteamOptions = useMemo(() => {
    const killteamsMap = new Map()
    
    results.forEach(result => {
      const killteamId = deriveKillteamId(result) || result.killteamId
      const killteamName = result.killteamDisplayName || result.killteamName
      
      if (killteamId && killteamName && !killteamsMap.has(killteamId)) {
        killteamsMap.set(killteamId, {
          id: killteamId,
          name: killteamName
        })
      }
    })
    
    const killteams = Array.from(killteamsMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
    
    return [
      { value: '', label: 'All Teams' },
      ...killteams.map(kt => ({ value: kt.id, label: kt.name }))
    ]
  }, [results])

  const hasActiveFilters = typeFilter || killteamFilter || sortBy !== 'relevance'

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '0.75rem', 
        alignItems: 'flex-end' 
      }}>
        {/* Type Filter */}
        <div style={{ flex: '1 1 200px', minWidth: '150px' }}>
          <label 
            htmlFor="filter-type" 
            style={{ 
              display: 'block', 
              marginBottom: '0.25rem', 
              fontSize: '0.85rem',
              color: 'var(--muted)'
            }}
          >
            Type
          </label>
          <select
            id="filter-type"
            value={typeFilter || ''}
            onChange={(e) => {
              lightTap()
              setTypeFilter(e.target.value || null)
            }}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text)',
              fontSize: '0.9rem'
            }}
          >
            {TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Kill Team Filter */}
        {killteamOptions.length > 1 && (
          <div style={{ flex: '1 1 200px', minWidth: '150px' }}>
            <label 
              htmlFor="filter-killteam" 
              style={{ 
                display: 'block', 
                marginBottom: '0.25rem', 
                fontSize: '0.85rem',
                color: 'var(--muted)'
              }}
            >
              Kill Team
            </label>
            <select
              id="filter-killteam"
              value={killteamFilter || ''}
              onChange={(e) => {
                lightTap()
                setKillteamFilter(e.target.value || null)
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text)',
                fontSize: '0.9rem'
              }}
            >
              {killteamOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sort Option */}
        <div style={{ flex: '1 1 150px', minWidth: '120px' }}>
          <label 
            htmlFor="filter-sort" 
            style={{ 
              display: 'block', 
              marginBottom: '0.25rem', 
              fontSize: '0.85rem',
              color: 'var(--muted)'
            }}
          >
            Sort
          </label>
          <select
            id="filter-sort"
            value={sortBy || 'relevance'}
            onChange={(e) => {
              lightTap()
              setSortBy(e.target.value)
            }}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text)',
              fontSize: '0.9rem'
            }}
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div>
            <button
              type="button"
              onClick={() => {
                lightTap()
                onClearFilters()
              }}
              className="pill-button"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                whiteSpace: 'nowrap'
              }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

