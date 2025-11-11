import { useCallback, useEffect, useMemo, useState } from 'react'
import Header from '../../components/Header'
import Seo from '../../components/Seo'
import KillteamSectionNavigator from '../../components/KillteamSectionNavigator'
import RichText from '../../components/RichText'

const OPS_DATA_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/ops_2025.json'

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
      packs: []
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

  return {
    id,
    name,
    AP: apValue,
    description,
    effects,
    conditions,
    packs
  }
}

function renderActionCards(actions = [], anchorPrefix = 'action') {
  if (!Array.isArray(actions) || actions.length === 0) return null

  return (
    <div className="card-section-list" style={{ marginTop: '0.75rem' }}>
      {actions.map(action => {
        const normalised = normaliseActionDefinition(action)
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
  const [critOps, setCritOps] = useState([])
  const [tacOps, setTacOps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activeSectionId, setActiveSectionId] = useState('ops-critical')
  const [pendingAnchor, setPendingAnchor] = useState(null)

  useEffect(() => {
    let cancelled = false

    const fetchOps = async () => {
      setLoading(true)
      try {
        const res = await fetch(OPS_DATA_URL, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Failed to load operations (${res.status})`)
        }
        const json = await res.json()
        if (cancelled) return

        const actionsList = Array.isArray(json?.actions) ? json.actions : []
        const actionMap = new Map()
        for (const actionDef of actionsList) {
          const normalisedAction = normaliseActionDefinition(actionDef)
          if (normalisedAction?.id) {
            actionMap.set(normalisedAction.id, normalisedAction)
          }
        }

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
                    return normaliseActionDefinition(actionRef)
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

        setCritOps(crit)
        setTacOps(tac)
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load operations', err)
        setError(err)
        setCritOps([])
        setTacOps([])
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
  }, [])

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
    .map(groupLabel => ({
      id: `tac-group-${groupLabel}`,
      label: groupLabel,
      type: 'heading'
    }))
    .concat(
      tacOps.map(op => ({
        id: `operation-${op.id}`,
        label: op.title
      }))
    )

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
    }
  ]
}, [critOps, tacOps])

  useEffect(() => {
    if (!sections.length) return
    if (!sections.some(section => section.id === activeSectionId)) {
      setActiveSectionId(sections[0]?.id || 'ops-critical')
    }
  }, [sections, activeSectionId])

  const findSectionForAnchor = useCallback((anchor) => {
    if (!anchor) return null
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleHashChange = () => {
      const hash = window.location.hash?.replace('#', '')
      if (!hash) return
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
    if (loading) {
      return <div className="muted">Loading operations…</div>
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

    const renderOpCard = (op) => {
      const archetypes = Array.isArray(op.archetype)
        ? op.archetype.filter(Boolean)
        : op.archetype
          ? [op.archetype]
          : []
      const packs = Array.isArray(op.packs) ? op.packs.filter(Boolean) : []

      return (
        <div key={op.id} id={`operation-${op.id}`} className="card" style={{ margin: '.75rem 0' }}>
          <div
            className="heading"
            style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}
          >
            <strong>{op.title.toUpperCase()}</strong>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span className="pill">{type === 'crit-op' ? 'Critical Operation' : 'Tactical Operation'}</span>
              {packs.map(pack => (
                <span key={`${op.id}-pack-${pack}`} className="pill">{pack}</span>
              ))}
              {archetypes.map(arch => (
                <span key={`${op.id}-arch-${arch}`} className="pill">{arch}</span>
              ))}
            </div>
          </div>

          {op.objective && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Objective</strong>
              <RichText className="muted" text={op.objective} />
            </div>
          )}

          {op.briefing && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Briefing</strong>
              <RichText className="muted" text={op.briefing} />
            </div>
          )}

          {op.restrictions && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Restrictions</strong>
              <RichText className="muted" text={op.restrictions} />
            </div>
          )}

          {op.reveal && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Reveal</strong>
              <RichText className="muted" text={op.reveal} />
            </div>
          )}

          {op.additionalRules && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Additional Rules</strong>
              <RichText className="muted" text={op.additionalRules} />
            </div>
          )}

          {renderActionCards(op.actions, `operation-action-${op.id}`)}

          {op.victoryPoints && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Victory Points</strong>
              <RichText className="muted" text={op.victoryPoints} />
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
            <section key={`group-${groupLabel}`} style={{ marginBottom: '1.5rem' }}>
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
        {ops.map(op => renderOpCard(op))}
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
            showTabs
            showDropdown
            dropdownVariant="default"
          />
        </div>

        <section
          id="ops-critical"
          style={{ display: activeSectionId === 'ops-critical' ? 'block' : 'none' }}
        >
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Critical Operations</h2>
            {renderOperationsList(critOps, 'crit-op')}
          </div>
        </section>

        <section
          id="ops-tactical"
          style={{ display: activeSectionId === 'ops-tactical' ? 'block' : 'none' }}
        >
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Tactical Operations</h2>
            {renderOperationsList(tacOps, 'tac-op')}
          </div>
        </section>
      </div>
    </>
  )
}

