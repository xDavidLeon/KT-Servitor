import { useCallback, useEffect, useMemo, useState } from 'react'
import Header from '../../components/Header'
import RichText from '../../components/RichText'
import { db } from '../../lib/db'
import { checkForUpdates } from '../../lib/update'
import Seo from '../../components/Seo'
import KillteamSectionNavigator from '../../components/KillteamSectionNavigator'

const UNIVERSAL_ACTIONS_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/universal_actions.json'
const MISSION_ACTIONS_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/mission_actions.json'
const WEAPON_RULES_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/weapon_rules.json'

const SECTION_DEFINITIONS = [
  { id: 'rules-universal-actions', label: 'Universal Actions' },
  { id: 'rules-mission-actions', label: 'Mission Actions' },
  { id: 'rules-weapon-rules', label: 'Weapon Rules' },
  { id: 'rules-universal-equipment', label: 'Universal Equipment' }
]

export default function Rules() {
  const [equipment, setEquipment] = useState([])
  const [equipmentLoading, setEquipmentLoading] = useState(true)
  const [equipmentError, setEquipmentError] = useState(null)

  const [universalActions, setUniversalActions] = useState([])
  const [actionsLoading, setActionsLoading] = useState(true)
  const [actionsError, setActionsError] = useState(null)

  const [weaponRules, setWeaponRules] = useState([])
  const [weaponRulesLoading, setWeaponRulesLoading] = useState(true)
  const [weaponRulesError, setWeaponRulesError] = useState(null)

  const [missionActions, setMissionActions] = useState([])
  const [missionActionsLoading, setMissionActionsLoading] = useState(true)
  const [missionActionsError, setMissionActionsError] = useState(null)

  const [activeSectionId, setActiveSectionId] = useState(SECTION_DEFINITIONS[0].id)
  const [pendingAnchor, setPendingAnchor] = useState(null)

  useEffect(() => {
    let cancelled = false

    const loadEquipment = async () => {
      setEquipmentLoading(true)
      try {
        await checkForUpdates()
        const rows = await db.universalEquipment.toArray()
        if (cancelled) return
        const sorted = rows.slice().sort((a, b) => {
          const seqA = typeof a.seq === 'number' ? a.seq : Number.MAX_SAFE_INTEGER
          const seqB = typeof b.seq === 'number' ? b.seq : Number.MAX_SAFE_INTEGER
          if (seqA !== seqB) return seqA - seqB
          return (a.eqName || '').localeCompare(b.eqName || '')
        })
        setEquipment(sorted)
        setEquipmentError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load universal equipment', err)
        setEquipmentError(err)
        setEquipment([])
      } finally {
        if (!cancelled) {
          setEquipmentLoading(false)
        }
      }
    }

    const loadActions = async () => {
      setActionsLoading(true)
      try {
        const res = await fetch(UNIVERSAL_ACTIONS_URL, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Failed to load universal actions (${res.status})`)
        }
        const json = await res.json()
        if (cancelled) return
        const list = Array.isArray(json?.actions) ? json.actions : []
        setUniversalActions(
          list.map(action => ({
            id: action.id || action.name || '',
            name: action.name || 'Unnamed action',
            ap: action.AP ?? action.ap ?? null,
            description: action.description || '',
            effects: Array.isArray(action.effects) ? action.effects.filter(Boolean) : [],
            conditions: Array.isArray(action.conditions) ? action.conditions.filter(Boolean) : [],
            packs: Array.isArray(action.packs) ? action.packs.filter(Boolean) : []
          }))
        )
        setActionsError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load universal actions', err)
        setActionsError(err)
        setUniversalActions([])
      } finally {
        if (!cancelled) {
          setActionsLoading(false)
        }
      }
    }

    const loadMissionActions = async () => {
      setMissionActionsLoading(true)
      try {
        const res = await fetch(MISSION_ACTIONS_URL, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Failed to load mission actions (${res.status})`)
        }
        const json = await res.json()
        if (cancelled) return
        const list = Array.isArray(json?.actions) ? json.actions : []
        setMissionActions(
          list.map(action => ({
            id: action.id || action.name || '',
            name: action.name || 'Unnamed action',
            ap: action.AP ?? action.ap ?? null,
            description: action.description || '',
            effects: Array.isArray(action.effects) ? action.effects.filter(Boolean) : [],
            conditions: Array.isArray(action.conditions) ? action.conditions.filter(Boolean) : [],
            packs: Array.isArray(action.packs) ? action.packs.filter(Boolean) : []
          }))
        )
        setMissionActionsError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load mission actions', err)
        setMissionActionsError(err)
        setMissionActions([])
      } finally {
        if (!cancelled) {
          setMissionActionsLoading(false)
        }
      }
    }

    const loadWeaponRules = async () => {
      setWeaponRulesLoading(true)
      try {
        const res = await fetch(WEAPON_RULES_URL, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Failed to load weapon rules (${res.status})`)
        }
        const json = await res.json()
        if (cancelled) return
        const list = Array.isArray(json?.weapon_rules) ? json.weapon_rules : []
        setWeaponRules(
          list.map(rule => ({
            id: rule.id || rule.name || '',
            name: rule.name || 'Unnamed rule',
            description: rule.description || '',
            variable: Boolean(rule.variable)
          }))
        )
        setWeaponRulesError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load weapon rules', err)
        setWeaponRulesError(err)
        setWeaponRules([])
      } finally {
        if (!cancelled) {
          setWeaponRulesLoading(false)
        }
      }
    }

    loadEquipment()
    loadActions()
    loadMissionActions()
    loadWeaponRules()

    return () => {
      cancelled = true
    }
  }, [])

  const sections = useMemo(() => {
    return SECTION_DEFINITIONS.map(def => {
      if (def.id === 'rules-universal-actions') {
        return {
          ...def,
          items: universalActions.map(action => ({
            id: `universal-action-${action.id}`,
            label: action.name
          }))
        }
      }
      if (def.id === 'rules-mission-actions') {
        return {
          ...def,
          items: missionActions.map(action => ({
            id: `mission-action-${action.id}`,
            label: action.name
          }))
        }
      }
      if (def.id === 'rules-weapon-rules') {
        return {
          ...def,
          items: weaponRules.map(rule => ({
            id: `weapon-rule-${rule.id}`,
            label: rule.variable ? `${rule.name} (X)` : rule.name
          }))
        }
      }
      return {
        ...def,
        items: equipment.map(item => ({
          id: `equipment-${item.eqId}`,
          label: item.eqName || item.eqId
        }))
      }
    })
  }, [equipment, universalActions, missionActions, weaponRules])

  const findSectionForAnchor = useCallback((anchor) => {
    if (!anchor) return null
    const section = sections.find(section => {
      if (section.id === anchor) return true
      return Array.isArray(section.items) && section.items.some(item => item?.id === anchor)
    })
    return section ? section.id : null
  }, [sections])

  const scrollToRulesAnchor = useCallback((anchor) => {
    if (typeof document === 'undefined' || !anchor) return false
    const element = document.getElementById(anchor)
    if (!element) return false

    let offset = 16
    const header = document.querySelector('.header-sticky')
    if (header) {
      const position = window.getComputedStyle(header).position
      if (position === 'sticky' || position === 'fixed') {
        offset += header.getBoundingClientRect().height
      }
    }

    const rect = element.getBoundingClientRect()
    const top = Math.max(rect.top + window.pageYOffset - offset, 0)
    window.scrollTo({
      top,
      behavior: 'smooth'
    })
    return true
  }, [])

  const renderActionCollection = ({ loading, error, actions, anchorPrefix, emptyMessage }) => {
    if (loading) {
      return <div className="muted">Loading actions…</div>
    }
    if (error) {
      return (
        <div className="muted">
          Failed to load actions.
          {' '}
          <span style={{ fontSize: '0.85rem' }}>{error.message || String(error)}</span>
        </div>
      )
    }
    if (!actions.length) {
      return <div className="muted">{emptyMessage}</div>
    }
    return (
      <div className="card-section-list">
        {actions.map(action => {
          const apLabel = action.ap === null || action.ap === undefined ? null : `${action.ap} AP`
          return (
            <div key={action.id} id={`${anchorPrefix}-${action.id}`} className="ability-card">
              <div className="ability-card-header">
                <h4 className="ability-card-title">{action.name.toUpperCase()}</h4>
                {apLabel && <span className="ability-card-ap">{apLabel}</span>}
              </div>
              {(action.description || action.effects.length > 0 || action.conditions.length > 0) && (
                <div className="ability-card-body">
                  {action.description && (
                    <p style={{ marginTop: 0 }}>{action.description}</p>
                  )}
                  {action.effects.length > 0 && (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {action.effects.map((effect, index) => (
                        <li
                          key={`${action.id}-effect-${index}`}
                          style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                        >
                          <span aria-hidden="true" style={{ color: '#2ecc71', fontWeight: 'bold' }}>➤</span>
                          <span>{effect}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {action.conditions.length > 0 && (
                    <ul style={{ margin: action.effects.length ? '0.5rem 0 0 0' : 0, padding: 0, listStyle: 'none' }}>
                      {action.conditions.map((condition, index) => (
                        <li
                          key={`${action.id}-condition-${index}`}
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
              {action.packs.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.35rem',
                    marginTop: '0.75rem',
                    justifyContent: 'flex-end'
                  }}
                >
                  {action.packs.map(pack => (
                    <span key={`${action.id}-pack-${pack}`} className="pill">
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

  const renderUniversalActions = () => renderActionCollection({
    loading: actionsLoading,
    error: actionsError,
    actions: universalActions,
    anchorPrefix: 'universal-action',
    emptyMessage: 'No universal actions available.'
  })

  const renderMissionActions = () => renderActionCollection({
    loading: missionActionsLoading,
    error: missionActionsError,
    actions: missionActions,
    anchorPrefix: 'mission-action',
    emptyMessage: 'No mission actions available.'
  })

  const renderWeaponRules = () => {
    if (weaponRulesLoading) {
      return <div className="muted">Loading weapon rules…</div>
    }
    if (weaponRulesError) {
      return (
        <div className="muted">
          Failed to load weapon rules.
          {' '}
          <span style={{ fontSize: '0.85rem' }}>{weaponRulesError.message || String(weaponRulesError)}</span>
        </div>
      )
    }
    if (!weaponRules.length) {
      return <div className="muted">No weapon rules available.</div>
    }
    return (
      <div className="card-section-list">
        {weaponRules.map(rule => (
          <div key={rule.id} id={`weapon-rule-${rule.id}`} className="ability-card">
            <div className="ability-card-header">
              <h4 className="ability-card-title">
                {rule.variable ? `${rule.name} (X)` : rule.name}
              </h4>
            </div>
            {rule.description && (
              <p className="ability-card-body" style={{ margin: 0 }}>{rule.description}</p>
            )}
          </div>
        ))}
      </div>
    )
  }

  const renderUniversalEquipment = () => {
    if (equipmentLoading) {
      return <div className="muted">Loading universal equipment…</div>
    }
    if (equipmentError) {
      return (
        <div className="muted">
          Failed to load universal equipment.
          {' '}
          <span style={{ fontSize: '0.85rem' }}>{equipmentError.message || String(equipmentError)}</span>
        </div>
      )
    }
    if (!equipment.length) {
      return <div className="muted">No universal equipment available.</div>
    }
    return (
      <div className="card-section-list">
        {equipment.map(item => (
          <div key={item.eqId} id={`equipment-${item.eqId}`} className="ability-card">
            <div className="ability-card-header">
              <h4 className="ability-card-title">{item.eqName || item.eqId}</h4>
            </div>
            {item.description && (
              <RichText className="ability-card-body" text={item.description} />
            )}
            {(() => {
              const effectsText = Array.isArray(item.effects)
                ? item.effects.filter(Boolean).join(', ')
                : (item.effects || '')
              const trimmed = effectsText.trim()
              if (!trimmed) return null
              return (
                <div className="muted" style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                  {trimmed}
                </div>
              )
            })()}
          </div>
        ))}
      </div>
    )
  }

  const renderSection = (sectionId) => {
    switch (sectionId) {
      case 'rules-universal-actions':
        return (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Universal Actions</h2>
            {renderUniversalActions()}
          </div>
        )
      case 'rules-mission-actions':
        return (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Mission Actions</h2>
            {renderMissionActions()}
          </div>
        )
      case 'rules-weapon-rules':
        return (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Weapon Rules</h2>
            {renderWeaponRules()}
          </div>
        )
      default:
        return (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Universal Equipment</h2>
            {renderUniversalEquipment()}
          </div>
        )
    }
  }

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

    const attemptScroll = () => {
      if (cancelled) return
      const success = scrollToRulesAnchor(pendingAnchor.id)
      if (success) {
        setPendingAnchor(null)
        return
      }
      attempts += 1
      if (attempts >= 10) {
        setPendingAnchor(null)
        return
      }
      timerId = window.setTimeout(attemptScroll, 100)
    }

    attemptScroll()

    return () => {
      cancelled = true
      if (timerId) {
        window.clearTimeout(timerId)
      }
    }
  }, [pendingAnchor, scrollToRulesAnchor])

  return (
    <>
      <Seo
        title="Game Rules"
        description="Browse every piece of universal equipment available to all Kill Teams."
      />
      <div className="container">
        <Header />
        <div className="card" style={{ marginBottom: '1rem' }}>
          <KillteamSectionNavigator
            sections={sections}
            activeSectionId={activeSectionId}
            onSectionChange={setActiveSectionId}
            showDropdown={false}
          />
        </div>
        {SECTION_DEFINITIONS.map(section => (
          <section
            key={section.id}
            id={section.id}
            style={{ display: activeSectionId === section.id ? 'block' : 'none' }}
          >
            {renderSection(section.id)}
          </section>
        ))}
      </div>
    </>
  )
}
