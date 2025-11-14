import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import Seo from '../../components/Seo'
import KillteamSectionNavigator from '../../components/KillteamSectionNavigator'
import RichText from '../../components/RichText'
import { getLocalePath } from '../../lib/update'

// Map group definitions
const MAP_GROUPS = [
  { id: 'generic', label: 'Non-Specific', folder: 'generic' },
  { id: 'volkus', label: 'Volkus', folder: 'volkus' },
  { id: 'gallowdark', label: 'Gallowdark', folder: 'gallowdark' },
  { id: 'bheta-decima', label: 'Bheta-Decima', folder: 'bheta-decima' },
  { id: 'tomb-world', label: 'Tomb World', folder: 'tomb-world' }
]

// Static list of images for each group
const MAP_IMAGES = {
  'generic': [
    'map-op-1-min.png',
    'map-op-2-min.png',
    'map-op-3-min.png',
    'map-op-4-min.png',
    'map-op-5-min.png',
    'map-op-6-min.png'
  ],
  'volkus': [
    'map-vk-1-min.png',
    'map-vk-2-min.png',
    'map-vk-3-min.png',
    'map-vk-4-min.png',
    'map-vk-5-min.png',
    'map-vk-6-min.png',
    'map-vk-7-min.png',
    'map-vk-8-min.png',
    'map-vk-9-min.png',
    'map-vk-10-min.png',
    'map-vk-11-min.png',
    'map-vk-12-min.png'
  ],
  'gallowdark': [
    'map-itd-1-min.png',
    'map-itd-2-min.png',
    'map-itd-3-min.png',
    'map-itd-4-min.png',
    'map-itd-5-min.png',
    'map-itd-6-min.png'
  ],
  'bheta-decima': [
    'map-bd-1-min.png',
    'map-bd-2-min.png',
    'map-bd-3-min.png',
    'map-bd-4-min.png',
    'map-bd-5-min.png',
    'map-bd-6-min.png',
    'map-bd-7-min.png',
    'map-bd-8-min.png',
    'map-bd-9-min.png',
    'map-bd-10-min.png',
    'map-bd-11-min.png',
    'map-bd-12-min.png'
  ],
  'tomb-world': [
    'map-tw-1-min.png',
    'map-tw-2-min.png',
    'map-tw-3-min.png',
    'map-tw-4-min.png',
    'map-tw-5-min.png',
    'map-tw-6-min.png'
  ]
}

const ARCHETYPE_PILL_MAP = {
  infiltration: { background: '#2b2d33', color: '#f4f6ff' },
  security: { background: '#1e5dff', color: '#f4f6ff' },
  'seek & destroy': { background: '#d62d3a', color: '#fef6f6' },
  recon: { background: '#c85c11', color: '#fff5ec' }
}

function getArchetypePillStyle(archetype) {
  if (!archetype) return null
  const normalised = String(archetype)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\band\b/gi, '&')
  const key = normalised.toLowerCase()
  const style = ARCHETYPE_PILL_MAP[key]
  if (!style) return { label: normalised }
  return {
    label: normalised,
    backgroundColor: style.background,
    borderColor: style.background,
    color: style.color
  }
}

let cachedCritOps = null
let cachedTacOps = null
let cachedOpsActionMap = null

function normaliseToText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map(item => normaliseToText(item))
      .filter(Boolean)
      .join('\n\n')
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => {
        const text = normaliseToText(val)
        if (!text) return ''
        return key ? `${key.toUpperCase()}\n${text}` : text
      })
      .filter(Boolean)
      .join('\n\n')
  }
  return String(value)
}

function normaliseActionDefinition(action) {
  if (!action) return null
  if (typeof action === 'string') {
    return {
      id: action,
      name: action,
      AP: null,
      description: '',
      effects: [],
      conditions: [],
      packs: [],
      type: '',
      seq: null
    }
  }

  const id = action.id || action.name || ''
  if (!id) return null
  const name = action.name || id
  const apValue = action.AP ?? action.ap ?? null
  const description = normaliseToText(action.description)
  const effects = Array.isArray(action.effects)
    ? action.effects.filter(Boolean)
    : action.effects
      ? [action.effects]
      : []
  const conditions = Array.isArray(action.conditions)
    ? action.conditions.filter(Boolean)
    : action.conditions
      ? [action.conditions]
      : []
  const packs = Array.isArray(action.packs)
    ? action.packs.filter(Boolean)
    : action.packs
      ? [action.packs]
      : []
  const type = (action.type || '').toLowerCase()
  const seq = typeof action.seq === 'number' ? action.seq : null

  return {
    id,
    name,
    AP: apValue,
    description,
    effects,
    conditions,
    packs,
    type,
    seq
  }
}

function renderActionCards(actions = [], actionLookup = new Map(), anchorPrefix = 'action') {
  if (!Array.isArray(actions) || actions.length === 0) return null

  return (
    <div className="card-section-list" style={{ marginTop: '0.75rem' }}>
      {actions.map(action => {
        const normalised = typeof action === 'string'
          ? (actionLookup.get(action) || normaliseActionDefinition(action))
          : normaliseActionDefinition(action)
        if (!normalised) return null

        const rawActionId = normalised.id || normalised.name || ''
        const safeActionId = String(rawActionId).trim().replace(/\s+/g, '-')
        const apLabel = normalised.AP !== undefined && normalised.AP !== null && normalised.AP !== '' ? `${normalised.AP} AP` : null
        const description = normalised.description
        const effects = normalised.effects || []
        const conditions = normalised.conditions || []
        const packs = normalised.packs || []

        return (
          <div
            key={safeActionId || rawActionId}
            id={`${anchorPrefix}-${safeActionId || rawActionId}`}
            className="ability-card"
          >
            <div className="ability-card-header">
              <h4 className="ability-card-title">{(normalised.name || rawActionId || '').toUpperCase()}</h4>
              {apLabel && <span className="ability-card-ap">{apLabel}</span>}
            </div>
            {(description || effects.length > 0 || conditions.length > 0) && (
              <div className="ability-card-body">
                {description && <p style={{ marginTop: 0 }}>{description}</p>}
                {effects.length > 0 && (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {effects.map((effect, index) => (
                      <li
                        key={`${safeActionId}-effect-${index}`}
                        style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                      >
                        <span aria-hidden="true" style={{ color: '#2ecc71', fontWeight: 'bold' }}>➤</span>
                        <span>{effect}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {conditions.length > 0 && (
                  <ul style={{ margin: effects.length ? '0.5rem 0 0 0' : 0, padding: 0, listStyle: 'none' }}>
                    {conditions.map((condition, index) => (
                      <li
                        key={`${safeActionId}-condition-${index}`}
                        style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                      >
                        <span aria-hidden="true" style={{ color: '#e74c3c', fontWeight: 'bold' }}>◆</span>
                        <span>{condition}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {packs.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.35rem',
                  marginTop: '0.75rem',
                  justifyContent: 'flex-end'
                }}
              >
                {packs.map(pack => (
                  <span key={`${safeActionId}-pack-${pack}`} className="pill">
                    {pack}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function OpsPage() {
  const router = useRouter()
  const locale = router.locale || 'en'
  const prevLocaleRef = useRef(locale)
  const [critOps, setCritOps] = useState(cachedCritOps || [])
  const [tacOps, setTacOps] = useState(cachedTacOps || [])
  const [actionLookup, setActionLookup] = useState(() => cachedOpsActionMap ? new Map(cachedOpsActionMap) : new Map())
  const [loading, setLoading] = useState(!(cachedCritOps && cachedTacOps))
  const [loaded, setLoaded] = useState(Boolean(cachedCritOps && cachedTacOps))
  const [error, setError] = useState(null)

  const [activeSectionId, setActiveSectionId] = useState('ops-critical')
  const [pendingAnchor, setPendingAnchor] = useState(null)
  const [selectedMapCategory, setSelectedMapCategory] = useState(MAP_GROUPS[0]?.id || 'generic')

  useEffect(() => {
    let cancelled = false

    const fetchOps = async () => {
      // Clear cached data only when locale actually changes
      const localeChanged = prevLocaleRef.current !== locale
      if (localeChanged) {
        cachedCritOps = null
        cachedTacOps = null
        cachedOpsActionMap = null
        setCritOps([])
        setTacOps([])
        setActionLookup(new Map())
        setLoaded(false)
        setLoading(true)
        prevLocaleRef.current = locale
      } else if (!loaded) {
        setLoading(true)
      }
      try {
        const res = await fetch(getLocalePath(locale, 'ops_2025.json'), { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Failed to load operations (${res.status})`)
        }
        const json = await res.json()
        if (cancelled) return

        const actionsList = Array.isArray(json?.actions) ? json.actions : []

        const actionMap = new Map()
        const addAction = (actionDef) => {
          const normalised = normaliseActionDefinition(actionDef)
          if (normalised?.id && !actionMap.has(normalised.id)) {
            actionMap.set(normalised.id, normalised)
          }
        }

        for (const actionDef of actionsList) {
          addAction(actionDef)
        }

        await Promise.allSettled([
          fetch(getLocalePath(locale, 'universal_actions.json'), { cache: 'no-store' }).then(async res => {
            if (!res.ok) return
            const json = await res.json()
            const universalActions = Array.isArray(json?.actions) ? json.actions : []
            for (const actionDef of universalActions) {
              addAction(actionDef)
            }
          }),
          fetch(getLocalePath(locale, 'mission_actions.json'), { cache: 'no-store' }).then(async res => {
            if (!res.ok) return
            const json = await res.json()
            const missionActions = Array.isArray(json?.actions) ? json.actions : []
            for (const actionDef of missionActions) {
              addAction(actionDef)
            }
          })
        ])

        const list = Array.isArray(json?.ops)
          ? json.ops
          : Array.isArray(json?.operations)
            ? json.operations
            : []

        const crit = []
        const tac = []

        for (const op of list) {
          if (!op || !op.id) continue
          const normalised = {
            id: op.id,
            title: op.title || 'Untitled Operation',
            type: (op.type || '').toLowerCase(),
            packs: Array.isArray(op.packs)
              ? op.packs.filter(Boolean)
              : op.packs
                ? [op.packs]
                : [],
            reveal: normaliseToText(op.reveal),
            additionalRules: normaliseToText(op.additionalRules || op.additionalRule),
            victoryPoints: normaliseToText(op.victoryPoints),
            actions: Array.isArray(op.actions)
              ? op.actions
                  .map(actionRef => {
                    if (typeof actionRef === 'string') {
                      return actionMap.get(actionRef) || normaliseActionDefinition(actionRef)
                    }
                    const normalisedAction = normaliseActionDefinition(actionRef)
                    if (normalisedAction?.id && !actionMap.has(normalisedAction.id)) {
                      actionMap.set(normalisedAction.id, normalisedAction)
                    }
                    return normalisedAction
                  })
                  .filter(Boolean)
              : [],
            archetype: op.archetype ?? op.archetypes ?? null,
            objective: normaliseToText(op.objective),
            briefing: normaliseToText(op.briefing),
            restrictions: normaliseToText(op.restrictions)
          }

          if (normalised.type === 'tac-op') {
            tac.push(normalised)
          } else {
            crit.push(normalised)
          }
        }

        const sortById = (arr) => {
          arr.sort((a, b) => a.id.localeCompare(b.id))
        }

        sortById(crit)
        sortById(tac)

        cachedCritOps = crit
        cachedTacOps = tac
        cachedOpsActionMap = new Map(actionMap)

        setCritOps(crit)
        setTacOps(tac)
        setActionLookup(new Map(actionMap))
        setError(null)
        setLoaded(true)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load operations', err)
        setError(err)
        if (!cachedCritOps && !cachedTacOps) {
          setLoaded(true)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchOps()

    return () => {
      cancelled = true
    }
  }, [locale])

const sections = useMemo(() => {
  const groupedTacOps = tacOps.reduce((acc, op) => {
    const archetypes = Array.isArray(op.archetype)
      ? op.archetype.filter(Boolean)
      : op.archetype
        ? [op.archetype]
        : ['Unassigned']
    const key = archetypes[0] || 'Unassigned'
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(op)
    return acc
  }, {})

  const tacSectionItems = Object.keys(groupedTacOps)
    .sort((a, b) => a.localeCompare(b))
    .flatMap(groupLabel => {
      const groupOps = groupedTacOps[groupLabel].slice().sort((a, b) => a.id.localeCompare(b.id))
      return [
        {
          id: `section-${groupLabel}`,
          label: groupLabel,
          type: 'heading'
        },
        ...groupOps.map(op => ({
          id: `operation-${op.id}`,
          label: op.title
        }))
      ]
    })

  const mapCategoryItems = MAP_GROUPS.map(group => ({
    id: `map-category-${group.id}`,
    label: group.label
  }))
  
  const selectedMapGroup = MAP_GROUPS.find(group => group.id === selectedMapCategory) || MAP_GROUPS[0]

  return [
    {
      id: 'ops-critical',
      label: 'Crit Ops',
      items: critOps.map(op => ({
        id: `operation-${op.id}`,
        label: op.title
      }))
    },
    {
      id: 'ops-tactical',
      label: 'Tac Ops',
      items: tacSectionItems
    },
    {
      id: 'ops-maps',
      label: 'Maps',
      dropdownLabel: selectedMapGroup.label,
      items: mapCategoryItems
    }
  ]
}, [critOps, tacOps, selectedMapCategory])

  useEffect(() => {
    if (!sections.length) return
    if (!sections.some(section => section.id === activeSectionId)) {
      setActiveSectionId(sections[0]?.id || 'ops-critical')
    }
  }, [sections, activeSectionId])

  const findSectionForAnchor = useCallback((anchor) => {
    if (!anchor) return null
    // Handle map category anchors
    if (anchor.startsWith('map-category-')) {
      return 'ops-maps'
    }
    const section = sections.find(section => {
      if (section.id === anchor) return true
      return Array.isArray(section.items) && section.items.some(item => item?.id === anchor)
    })
    return section ? section.id : null
  }, [sections])
  

  const scrollToAnchor = useCallback((anchorId) => {
    if (typeof document === 'undefined' || !anchorId) return false
    
    const element = document.getElementById(anchorId)
    if (!element) return false

    let offset = 16
    const header = document.querySelector('.header-sticky')
    if (header) {
      const style = window.getComputedStyle(header)
      if (style.position === 'sticky' || style.position === 'fixed') {
        offset += header.getBoundingClientRect().height
      }
    }

    const rect = element.getBoundingClientRect()
    const top = Math.max(rect.top + window.pageYOffset - offset, 0)
    window.scrollTo({ top, behavior: 'smooth' })
    return true
  }, [])

  const navigateToRandom = useCallback(() => {
    if (!sections.length) return
    
    const activeSection = sections.find(s => s.id === activeSectionId)
    if (!activeSection || !activeSection.items || activeSection.items.length === 0) return

    // Filter out heading items (type === 'heading') and get only navigable items
    const navigableItems = activeSection.items.filter(item => item.id && item.type !== 'heading')
    if (navigableItems.length === 0) return

    // Select a random item
    const randomIndex = Math.floor(Math.random() * navigableItems.length)
    const randomItem = navigableItems[randomIndex]
    
    if (randomItem.id) {
      // Handle special cases
      if (randomItem.id.startsWith('map-category-')) {
        // For map categories, change the category instead of scrolling
        const categoryId = randomItem.id.replace('map-category-', '')
        if (MAP_GROUPS.some(group => group.id === categoryId)) {
          setSelectedMapCategory(categoryId)
          if (typeof window !== 'undefined') {
            window.location.hash = randomItem.id
          }
        }
      } else {
        // Scroll to the element
        scrollToAnchor(randomItem.id)
        if (typeof window !== 'undefined') {
          window.location.hash = randomItem.id
        }
      }
    }
  }, [sections, activeSectionId, scrollToAnchor])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleHashChange = () => {
      const hash = window.location.hash?.replace('#', '') || ''
      if (!hash) return
      
      // Check if it's a map category selection
      if (hash.startsWith('map-category-')) {
        const categoryId = hash.replace('map-category-', '')
        if (MAP_GROUPS.some(group => group.id === categoryId)) {
          setActiveSectionId('ops-maps')
          setSelectedMapCategory(categoryId)
          return
        }
      }
      
      const sectionId = findSectionForAnchor(hash)
      if (sectionId) {
        setActiveSectionId(prev => (prev === sectionId ? prev : sectionId))
        setPendingAnchor(prev => {
          if (prev?.id === hash) {
            return { id: hash, nonce: (prev.nonce || 0) + 1 }
          }
          return { id: hash, nonce: 0 }
        })
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [findSectionForAnchor])

  useEffect(() => {
    if (!pendingAnchor?.id) return undefined
    
    // Don't scroll for map category selections
    if (pendingAnchor.id.startsWith('map-category-')) {
      setPendingAnchor(null)
      return undefined
    }
    
    let cancelled = false
    let attempts = 0
    let timerId = null

    const attempt = () => {
      if (cancelled) return
      const success = scrollToAnchor(pendingAnchor.id)
      if (success) {
        setPendingAnchor(null)
        return
      }
      attempts += 1
      if (attempts >= 10) {
        setPendingAnchor(null)
        return
      }
      timerId = window.setTimeout(attempt, 100)
    }

    attempt()

    return () => {
      cancelled = true
      if (timerId) {
        window.clearTimeout(timerId)
      }
    }
  }, [pendingAnchor, scrollToAnchor])

  const renderOperationsList = (ops, type) => {
    if (!loaded) {
      if (loading) {
        return <div className="muted">Loading operations…</div>
      }
      return null
    }
    if (error) {
      return (
        <div className="muted">
          Failed to load operations.
          {' '}
          <span style={{ fontSize: '0.85rem' }}>{error.message || String(error)}</span>
        </div>
      )
    }
    if (!ops.length) {
      return (
        <div className="muted">
          {type === 'crit-op' ? 'No critical operations available.' : 'No tactical operations available.'}
        </div>
      )
    }

  const renderOpCard = (op, index) => {
    const archetypes = Array.isArray(op.archetype)
      ? op.archetype.filter(Boolean)
      : op.archetype
        ? [op.archetype]
        : []
    const packs = Array.isArray(op.packs) ? op.packs.filter(Boolean) : []

    const renderActions = (actionsArray) => {
      if (!Array.isArray(actionsArray) || actionsArray.length === 0) return null
      return (
        <div className="card-section-list" style={{ marginTop: '0.75rem' }}>
          {actionsArray.map(action => {
            const entry = typeof action === 'string'
              ? actionLookup.get(action) || normaliseActionDefinition(action)
              : normaliseActionDefinition(action)
            if (!entry) return null

            const rawActionId = entry.id || entry.name || ''
            const safeActionId = String(rawActionId).trim().replace(/\s+/g, '-')
            const apLabel = entry.AP !== undefined && entry.AP !== null && entry.AP !== '' ? `${entry.AP} AP` : null

            return (
              <div
                key={safeActionId || rawActionId}
                id={`operation-action-${safeActionId || rawActionId}`}
                className="ability-card"
              >
                <div className="ability-card-header">
                  <h4 className="ability-card-title">{entry.name.toUpperCase()}</h4>
                  {apLabel && <span className="ability-card-ap">{apLabel}</span>}
                </div>
                {(entry.description || (entry.effects && entry.effects.length) || (entry.conditions && entry.conditions.length)) && (
                  <div className="ability-card-body">
                    {entry.description && <p style={{ marginTop: 0 }}>{entry.description}</p>}
                    {entry.effects && entry.effects.length > 0 && (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {entry.effects.map((effect, index) => (
                          <li
                            key={`${safeActionId}-effect-${index}`}
                            style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                          >
                            <span aria-hidden="true" style={{ color: '#2ecc71', fontWeight: 'bold' }}>➤</span>
                            <span>{effect}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {entry.conditions && entry.conditions.length > 0 && (
                      <ul style={{ margin: entry.effects && entry.effects.length ? '0.5rem 0 0 0' : 0, padding: 0, listStyle: 'none' }}>
                        {entry.conditions.map((condition, index) => (
                          <li
                            key={`${safeActionId}-condition-${index}`}
                            style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                          >
                            <span aria-hidden="true" style={{ color: '#e74c3c', fontWeight: 'bold' }}>◆</span>
                            <span>{condition}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {entry.packs && entry.packs.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.35rem',
                      marginTop: '0.75rem',
                      justifyContent: 'flex-end'
                    }}
                  >
                    {entry.packs.map(pack => (
                      <span key={`${safeActionId}-pack-${pack}`} className="pill">
                        {pack}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <div key={op.id} id={`operation-${op.id}`} className="card" style={{ margin: '.75rem 0', position: 'relative' }}>
        {type === 'crit-op' && (
          <div
            style={{
              position: 'absolute',
              top: '1.1rem',
              left: '1.1rem',
              width: '2.4rem',
              height: '2.4rem',
              borderRadius: '999px',
              background: 'var(--accent)',
              color: '#0f1115',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.15rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.35)'
            }}
          >
            {index + 1}
          </div>
        )}
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          {(() => {
            const archetypeLabel = (archetypes && archetypes[0]) ? archetypes[0] : (type === 'crit-op' ? 'Critical Operation' : 'Tactical Operation')
            const style = getArchetypePillStyle(archetypeLabel)
            const label = style?.label || archetypeLabel
            return (
              <span
                className="pill"
                style={{
                  margin: '0 auto',
                  ...(style?.backgroundColor ? style : {})
                }}
              >
                {label.toUpperCase()}
              </span>
            )
          })()}
        </div>
        <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
          <strong style={{ fontSize: '1.1rem' }}>{op.title.toUpperCase()}</strong>
        </div>

        {op.briefing && (
          <div style={{ marginTop: '0.5rem' }}>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Briefing</strong>
            <RichText className="muted" text={op.briefing} />
          </div>
        )}

        {op.objective && (
          <div style={{ marginTop: '0.5rem' }}>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Objective</strong>
            <RichText className="muted" text={op.objective} />
          </div>
        )}

        {op.reveal && (
          <div className="ability-card" style={{ marginTop: '0.75rem' }}>
            <div className="ability-card-header" style={{ justifyContent: 'flex-start' }}>
              <h4 className="ability-card-title" style={{ margin: 0 }}>Reveal</h4>
            </div>
            <RichText className="ability-card-body muted" text={op.reveal} />
          </div>
        )}

        {op.additionalRules && (
          <div className="ability-card" style={{ marginTop: '0.75rem' }}>
            <div className="ability-card-header" style={{ justifyContent: 'flex-start' }}>
              <h4 className="ability-card-title" style={{ margin: 0 }}>Additional Rules</h4>
            </div>
            <RichText className="ability-card-body muted" text={op.additionalRules} />
          </div>
        )}

        {renderActions(op.actions)}

        {op.victoryPoints && (
          <div className="ability-card" style={{ marginTop: '0.75rem' }}>
            <div className="ability-card-header" style={{ justifyContent: 'flex-start' }}>
              <h4 className="ability-card-title" style={{ margin: 0 }}>Victory Points</h4>
            </div>
            <RichText className="ability-card-body muted" text={op.victoryPoints} />
          </div>
        )}
        {packs.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.35rem',
              justifyContent: 'flex-end',
              marginTop: '0.75rem'
            }}
          >
            {packs.map(pack => (
              <span key={`${op.id}-pack-${pack}`} className="pill">{pack}</span>
            ))}
          </div>
        )}
      </div>
    )
  }

    if (type === 'tac-op') {
      const grouped = ops.reduce((acc, op) => {
        const archetypes = Array.isArray(op.archetype)
          ? op.archetype.filter(Boolean)
          : op.archetype
            ? [op.archetype]
            : ['Unassigned']
        const key = archetypes[0] || 'Unassigned'
        if (!acc[key]) acc[key] = []
        acc[key].push(op)
        return acc
      }, {})

      const sortedGroups = Object.keys(grouped).sort((a, b) => a.localeCompare(b))

      return (
        <div className="card-section-list">
          {sortedGroups.map(groupLabel => (
            <section key={`group-${groupLabel}`} id={`section-${groupLabel}`} style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{groupLabel}</h3>
              <div className="card-section-list">
                {grouped[groupLabel].map(op => renderOpCard(op))}
              </div>
            </section>
          ))}
        </div>
      )
    }

    return (
      <div className="card-section-list">
        {ops.map((op, index) => renderOpCard(op, index))}
      </div>
    )
  }

  // Create map navigation items for the dropdown
  const mapNavItems = useMemo(() => {
    if (activeSectionId !== 'ops-maps') return []
    const selectedGroup = MAP_GROUPS.find(group => group.id === selectedMapCategory) || MAP_GROUPS[0]
    const images = MAP_IMAGES[selectedMapCategory] || []
    const groupLabel = selectedGroup.label
    
    return images.map((imageName, index) => {
      const mapIndex = index + 1
      return {
        id: `map-${selectedMapCategory}-${mapIndex}`,
        label: `${groupLabel} - Map ${mapIndex}`
      }
    })
  }, [activeSectionId, selectedMapCategory])

  const renderMaps = () => {
    const selectedGroup = MAP_GROUPS.find(group => group.id === selectedMapCategory) || MAP_GROUPS[0]
    const images = MAP_IMAGES[selectedMapCategory] || []
    const groupLabel = selectedGroup.label

    if (images.length === 0) {
      return <div className="muted">No maps available for this category.</div>
    }

    return (
      <div style={{ display: 'grid', gap: '2rem', marginTop: '1rem' }}>
        {images.map((imageName, index) => {
          const imagePath = `/data/v1/maps/${selectedGroup.folder}/${imageName}`
          const mapIndex = index + 1
          const mapId = `map-${selectedMapCategory}-${mapIndex}`
          
          return (
            <div key={imageName} id={mapId} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', scrollMarginTop: '80px' }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '1.1rem', 
                fontWeight: 600,
                color: 'var(--text)',
                textAlign: 'center'
              }}>
                {groupLabel} - Map {mapIndex}
              </h3>
              <div style={{
                width: '100%',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #262a36',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)'
              }}>
                <img
                  src={imagePath}
                  alt={`${groupLabel} - Map ${mapIndex}`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block'
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <Seo
        title="Ops"
        description="Browse every Critical and Tactical Operation, complete with reveal conditions, special rules, actions, and victory point rewards."
      />
      <div className="container">
        <Header />
        <div className="card" style={{ marginBottom: '1rem' }}>
          <KillteamSectionNavigator
            sections={sections}
            activeSectionId={activeSectionId}
            onSectionChange={setActiveSectionId}
            onItemSelect={(targetId) => {
              // Handle map category selection
              if (targetId && targetId.startsWith('map-category-')) {
                const categoryId = targetId.replace('map-category-', '')
                if (MAP_GROUPS.some(group => group.id === categoryId)) {
                  setSelectedMapCategory(categoryId)
                  if (typeof window !== 'undefined') {
                    window.location.hash = targetId
                  }
                  return true // Indicate that we handled it
                }
              }
              return false // Let the default scrolling handle it
            }}
            showTabs
            showDropdown
            dropdownVariant="default"
            rightButton={(() => {
              const activeSection = sections.find(s => s.id === activeSectionId)
              const hasNavigableItems = activeSection?.items?.some(item => item.id && item.type !== 'heading')
              if (!hasNavigableItems && activeSectionId === 'ops-maps' && mapNavItems.length === 0) {
                return null
              }
              return (
                <button
                  type="button"
                  onClick={navigateToRandom}
                  className="section-dropdown-trigger icon"
                  style={{
                    marginTop: 0
                  }}
                  aria-label="Go to random section"
                  title="Go to random section"
                >
                  <span aria-hidden="true">🎲</span>
                </button>
              )
            })()}
          />
          {activeSectionId === 'ops-maps' && mapNavItems.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <KillteamSectionNavigator
                sections={[{
                  id: 'maps-navigation',
                  label: 'Maps',
                  dropdownLabel: `Navigate to map...`,
                  items: mapNavItems
                }]}
                activeSectionId="maps-navigation"
                onSectionChange={() => {}}
                onItemSelect={(targetId) => {
                  if (targetId) {
                    scrollToAnchor(targetId)
                    return true
                  }
                  return false
                }}
                showTabs={false}
                showDropdown
                dropdownVariant="default"
                rightButton={(
                  <button
                    type="button"
                    onClick={() => {
                      if (mapNavItems.length === 0) return
                      const randomIndex = Math.floor(Math.random() * mapNavItems.length)
                      const randomItem = mapNavItems[randomIndex]
                      if (randomItem.id) {
                        scrollToAnchor(randomItem.id)
                        if (typeof window !== 'undefined') {
                          window.location.hash = randomItem.id
                        }
                      }
                    }}
                    className="section-dropdown-trigger icon"
                    style={{
                      marginTop: 0
                    }}
                    aria-label="Go to random map"
                    title="Go to random map"
                  >
                    <span aria-hidden="true">🎲</span>
                  </button>
                )}
              />
            </div>
          )}
        </div>

        <section
          id="ops-critical"
          style={{ display: activeSectionId === 'ops-critical' ? 'block' : 'none' }}
        >
          <div className="card">
            {renderOperationsList(critOps, 'crit-op')}
          </div>
        </section>

        <section
          id="ops-tactical"
          style={{ display: activeSectionId === 'ops-tactical' ? 'block' : 'none' }}
        >
          <div className="card">
            {renderOperationsList(tacOps, 'tac-op')}
          </div>
        </section>

        <section
          id="ops-maps"
          style={{ display: activeSectionId === 'ops-maps' ? 'block' : 'none' }}
        >
          <div className="card">
            {renderMaps()}
          </div>
        </section>
      </div>
    </>
  )
}

