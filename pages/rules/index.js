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
const OPS_DATA_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/ops_2025.json'
const UNIVERSAL_EQUIPMENT_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/universal_equipment.json'

let cachedEquipment = null
let cachedUniversalActions = null
let cachedMissionActions = null
let cachedWeaponRules = null

const SECTION_DEFINITIONS = [
  { id: 'rules-universal-actions', label: 'Universal Actions' },
  { id: 'rules-mission-actions', label: 'Mission Actions' },
  { id: 'rules-weapon-rules', label: 'Weapon Rules' },
  { id: 'rules-universal-equipment', label: 'Universal Equipment' }
]

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

function sortActions(list) {
  return list.slice().sort((a, b) => {
    const hasPackA = Array.isArray(a.packs) && a.packs.length > 0
    const hasPackB = Array.isArray(b.packs) && b.packs.length > 0
    if (hasPackA !== hasPackB) {
      return hasPackA ? 1 : -1
    }

    const packA = hasPackA ? a.packs[0].toLowerCase() : ''
    const packB = hasPackB ? b.packs[0].toLowerCase() : ''
    const packCompare = packA.localeCompare(packB)
    if (packCompare !== 0) return packCompare

    const seqA = typeof a.seq === 'number' ? a.seq : Number.POSITIVE_INFINITY
    const seqB = typeof b.seq === 'number' ? b.seq : Number.POSITIVE_INFINITY
    if (seqA !== seqB) return seqA - seqB

    return (a.name || '').localeCompare(b.name || '')
  })
}

function sortUniversalActions(list) {
  return list.slice().sort((a, b) => {
    const fromEquipmentA = a.fromEquipment === true
    const fromEquipmentB = b.fromEquipment === true
    
    // If both are equipment or both are not equipment, compare by pack status
    if (fromEquipmentA === fromEquipmentB) {
      // Non-pack actions first (for non-equipment), then pack actions
      const hasPackA = Array.isArray(a.packs) && a.packs.length > 0
      const hasPackB = Array.isArray(b.packs) && b.packs.length > 0
      
      if (!fromEquipmentA) {
        // Non-equipment: non-pack first, then pack
        if (hasPackA !== hasPackB) {
          return hasPackA ? 1 : -1
        }
        
        // Same pack status: sort by pack name, then seq, then name
        if (hasPackA && hasPackB) {
          const packA = a.packs[0].toLowerCase()
          const packB = b.packs[0].toLowerCase()
          const packCompare = packA.localeCompare(packB)
          if (packCompare !== 0) return packCompare
        }
        
        const seqA = typeof a.seq === 'number' ? a.seq : Number.POSITIVE_INFINITY
        const seqB = typeof b.seq === 'number' ? b.seq : Number.POSITIVE_INFINITY
        if (seqA !== seqB) return seqA - seqB
      } else {
        // Equipment actions: just sort alphabetically by name
        // (equipment actions come after non-pack actions, so we don't need pack sorting here)
      }
      
      return (a.name || '').localeCompare(b.name || '')
    }
    
    // Equipment actions come after non-pack actions
    // So: non-equipment first, then equipment
    if (fromEquipmentA && !fromEquipmentB) {
      // Check if b has packs - if b has packs, a (equipment) should come after
      const hasPackB = Array.isArray(b.packs) && b.packs.length > 0
      if (hasPackB) {
        return 1 // equipment after pack actions
      }
      // If b doesn't have packs, equipment should come after
      return 1
    }
    
    if (!fromEquipmentA && fromEquipmentB) {
      // Check if a has packs - if a has packs, b (equipment) should come after
      const hasPackA = Array.isArray(a.packs) && a.packs.length > 0
      if (hasPackA) {
        return -1 // non-equipment (pack) before equipment
      }
      // If a doesn't have packs, equipment should come after
      return -1
    }
    
    return 0
  })
}

function sortMissionActions(list) {
  return list.slice().sort((a, b) => {
    const fromEquipmentA = a.fromEquipment === true
    const fromEquipmentB = b.fromEquipment === true
    
    // Equipment actions come first
    if (fromEquipmentA !== fromEquipmentB) {
      return fromEquipmentA ? -1 : 1
    }
    
    // If both are equipment, sort alphabetically
    if (fromEquipmentA && fromEquipmentB) {
      return (a.name || '').localeCompare(b.name || '')
    }
    
    // If both are non-equipment, use standard sorting (by pack, seq, name)
    const hasPackA = Array.isArray(a.packs) && a.packs.length > 0
    const hasPackB = Array.isArray(b.packs) && b.packs.length > 0
    if (hasPackA !== hasPackB) {
      return hasPackA ? 1 : -1
    }

    const packA = hasPackA ? a.packs[0].toLowerCase() : ''
    const packB = hasPackB ? b.packs[0].toLowerCase() : ''
    const packCompare = packA.localeCompare(packB)
    if (packCompare !== 0) return packCompare

    const seqA = typeof a.seq === 'number' ? a.seq : Number.POSITIVE_INFINITY
    const seqB = typeof b.seq === 'number' ? b.seq : Number.POSITIVE_INFINITY
    if (seqA !== seqB) return seqA - seqB

    return (a.name || '').localeCompare(b.name || '')
  })
}

export default function Rules() {
  const [equipment, setEquipment] = useState(cachedEquipment || [])
  const [equipmentLoading, setEquipmentLoading] = useState(!cachedEquipment)
  const [equipmentLoaded, setEquipmentLoaded] = useState(Boolean(cachedEquipment))
  const [equipmentError, setEquipmentError] = useState(null)

  const [universalActions, setUniversalActions] = useState(cachedUniversalActions || [])
  const [actionsLoading, setActionsLoading] = useState(!cachedUniversalActions)
  const [actionsLoaded, setActionsLoaded] = useState(Boolean(cachedUniversalActions))
  const [actionsError, setActionsError] = useState(null)

  const [weaponRules, setWeaponRules] = useState(cachedWeaponRules || [])
  const [weaponRulesLoading, setWeaponRulesLoading] = useState(!cachedWeaponRules)
  const [weaponRulesLoaded, setWeaponRulesLoaded] = useState(Boolean(cachedWeaponRules))
  const [weaponRulesError, setWeaponRulesError] = useState(null)
  const [killteamsMap, setKillteamsMap] = useState(new Map())

  const [missionActions, setMissionActions] = useState(cachedMissionActions || [])
  const [missionActionsLoading, setMissionActionsLoading] = useState(!cachedMissionActions)
  const [missionActionsLoaded, setMissionActionsLoaded] = useState(Boolean(cachedMissionActions))
  const [missionActionsError, setMissionActionsError] = useState(null)

  const [equipmentActions, setEquipmentActions] = useState([])
  const [equipmentActionsLoaded, setEquipmentActionsLoaded] = useState(false)

  const [activeSectionId, setActiveSectionId] = useState(SECTION_DEFINITIONS[0].id)
  const [pendingAnchor, setPendingAnchor] = useState(null)

  useEffect(() => {
    let cancelled = false

    const loadEquipment = async () => {
      if (!equipmentLoaded) setEquipmentLoading(true)
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
        cachedEquipment = sorted
        setEquipmentError(null)
        setEquipmentLoaded(true)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load universal equipment', err)
        setEquipmentError(err)
        if (!cachedEquipment) {
          setEquipment([])
        }
        setEquipmentLoaded(true)
      } finally {
        if (!cancelled) {
          setEquipmentLoading(false)
        }
      }
    }

    const loadActions = async () => {
      if (!actionsLoaded) setActionsLoading(true)
      try {
        const res = await fetch(UNIVERSAL_ACTIONS_URL, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Failed to load universal actions (${res.status})`)
        }
        const json = await res.json()
        if (cancelled) return
        const rawActions = Array.isArray(json?.actions) ? json.actions : []
        const list = rawActions.map(action => normaliseActionDefinition(action)).filter(Boolean)
        const sorted = sortActions(list)
        const mappedActions = sorted.map(action => ({
          id: action.id,
          name: action.name,
          ap: action.AP ?? null,
          description: action.description || '',
          effects: Array.isArray(action.effects) ? action.effects.filter(Boolean) : [],
          conditions: Array.isArray(action.conditions) ? action.conditions.filter(Boolean) : [],
          packs: Array.isArray(action.packs) ? action.packs.filter(Boolean) : [],
          type: (action.type || '').toLowerCase() || 'universal',
          fromEquipment: false
        }))
        setUniversalActions(mappedActions)
        cachedUniversalActions = mappedActions
        setActionsLoaded(true)
        setActionsError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load universal actions', err)
        setActionsError(err)
        if (!cachedUniversalActions) {
          setUniversalActions([])
        }
        setActionsLoaded(true)
      } finally {
        if (!cancelled) {
          setActionsLoading(false)
        }
      }
    }

    const loadMissionActions = async () => {
      if (!missionActionsLoaded) setMissionActionsLoading(true)
      try {
        const res = await fetch(MISSION_ACTIONS_URL, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Failed to load mission actions (${res.status})`)
        }
        const json = await res.json()
        if (cancelled) return
        const rawActions = Array.isArray(json?.actions) ? json.actions : []
        const actionMap = new Map()
        const addAction = (actionDef) => {
          const normalised = normaliseActionDefinition(actionDef)
          if (normalised?.id) {
            actionMap.set(normalised.id, normalised)
          }
        }

        for (const actionDef of rawActions) {
          addAction(actionDef)
        }

        try {
          const opsRes = await fetch(OPS_DATA_URL, { cache: 'no-store' })
          if (opsRes.ok) {
            const opsJson = await opsRes.json()
            const opsActions = Array.isArray(opsJson?.actions) ? opsJson.actions : []
            for (const actionDef of opsActions) {
              if ((actionDef?.type || '').toLowerCase() === 'mission') {
                addAction(actionDef)
              }
            }
          }
        } catch (opsErr) {
          console.warn('Failed to load ops actions for mission actions list', opsErr)
        }

        const finalList = Array.from(actionMap.values())
          .filter(action => (action.type ? action.type === 'mission' : true))
          .sort((a, b) => a.id.localeCompare(b.id))

        const sorted = sortActions(finalList)
        const mappedMissionActions = sorted.map(action => ({
          id: action.id,
          name: action.name,
          ap: action.AP ?? null,
          description: action.description || '',
          effects: Array.isArray(action.effects) ? action.effects.filter(Boolean) : [],
          conditions: Array.isArray(action.conditions) ? action.conditions.filter(Boolean) : [],
          packs: Array.isArray(action.packs) ? action.packs.filter(Boolean) : [],
          type: (action.type || '').toLowerCase() || 'mission',
          fromEquipment: false
        }))
        setMissionActions(mappedMissionActions)
        cachedMissionActions = mappedMissionActions
        setMissionActionsLoaded(true)
        setMissionActionsError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load mission actions', err)
        setMissionActionsError(err)
        if (!cachedMissionActions) {
          setMissionActions([])
        }
        setMissionActionsLoaded(true)
      } finally {
        if (!cancelled) {
          setMissionActionsLoading(false)
        }
      }
    }

    const loadWeaponRules = async () => {
      if (!weaponRulesLoaded) setWeaponRulesLoading(true)
      try {
        const res = await fetch(WEAPON_RULES_URL, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Failed to load weapon rules (${res.status})`)
        }
        const json = await res.json()
        if (cancelled) return
        const list = Array.isArray(json?.weapon_rules) ? json.weapon_rules : []
        const mappedWeaponRules = list.map(rule => ({
          id: rule.id || rule.name || '',
          name: rule.name || 'Unnamed rule',
          description: rule.description || '',
          variable: Boolean(rule.variable),
          team: rule.team || null
        }))
        // Sort: rules with no team first, then alphabetically by name
        const sortedWeaponRules = mappedWeaponRules.sort((a, b) => {
          // First, sort by team: null/undefined first, then by team value
          const teamA = a.team || ''
          const teamB = b.team || ''
          if (teamA !== teamB) {
            // If one is empty/null and the other isn't, empty comes first
            if (!teamA && teamB) return -1
            if (teamA && !teamB) return 1
            // Both have teams, sort alphabetically by team
            return teamA.localeCompare(teamB)
          }
          // Same team status, sort alphabetically by name
          return (a.name || '').localeCompare(b.name || '')
        })
        setWeaponRules(sortedWeaponRules)
        cachedWeaponRules = sortedWeaponRules
        setWeaponRulesLoaded(true)
        setWeaponRulesError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load weapon rules', err)
        setWeaponRulesError(err)
        if (!cachedWeaponRules) {
          setWeaponRules([])
        }
        setWeaponRulesLoaded(true)
      } finally {
        if (!cancelled) {
          setWeaponRulesLoading(false)
        }
      }
    }

    const loadKillteams = async () => {
      try {
        await checkForUpdates()
        const killteams = await db.killteams.toArray()
        if (cancelled) return
        const map = new Map()
        for (const kt of killteams) {
          if (kt.killteamId && kt.killteamName) {
            map.set(kt.killteamId, kt.killteamName)
          }
        }
        setKillteamsMap(map)
      } catch (err) {
        console.error('Failed to load killteams for weapon rules', err)
      }
    }

    const loadEquipmentActions = async () => {
      try {
        const res = await fetch(UNIVERSAL_EQUIPMENT_URL, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Failed to load universal equipment (${res.status})`)
        }
        const json = await res.json()
        if (cancelled) return
        
        // The actions are in a root-level "actions" array in the JSON
        const rawActions = Array.isArray(json?.actions) ? json.actions : []
        const normalizedActions = rawActions
          .map(action => normaliseActionDefinition(action))
          .filter(action => action !== null)
        
        // Store the normalized actions (they have AP, type, etc. fields)
        setEquipmentActions(normalizedActions)
        setEquipmentActionsLoaded(true)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load equipment actions', err)
        setEquipmentActions([])
        setEquipmentActionsLoaded(true)
      }
    }

    loadEquipment()
    loadActions()
    loadMissionActions()
    loadWeaponRules()
    loadKillteams()
    loadEquipmentActions()

    return () => {
      cancelled = true
    }
  }, [])

  const combinedUniversalActions = useMemo(() => {
    if (!equipmentActionsLoaded) return universalActions
    
    const equipmentUniversalActions = equipmentActions
      .filter(action => (action.type || '').toLowerCase() === 'universal')
      .map(action => ({
        id: action.id,
        name: action.name,
        ap: action.AP ?? null,
        description: action.description || '',
        effects: Array.isArray(action.effects) ? action.effects.filter(Boolean) : [],
        conditions: Array.isArray(action.conditions) ? action.conditions.filter(Boolean) : [],
        packs: Array.isArray(action.packs) ? action.packs.filter(Boolean) : [],
        type: (action.type || '').toLowerCase() || 'universal',
        fromEquipment: true
      }))
    
    // Merge with existing universal actions
    // Equipment actions take precedence (added last) so they overwrite existing ones
    const actionMap = new Map()
    // First add all universal actions
    for (const action of universalActions) {
      actionMap.set(action.id, action)
    }
    // Then add/overwrite with equipment actions (they get the fromEquipment flag)
    for (const action of equipmentUniversalActions) {
      actionMap.set(action.id, action)
    }
    
    const merged = Array.from(actionMap.values())
    return sortUniversalActions(merged)
  }, [universalActions, equipmentActions, equipmentActionsLoaded])

  const combinedMissionActions = useMemo(() => {
    if (!equipmentActionsLoaded) return missionActions
    
    const equipmentMissionActions = equipmentActions
      .filter(action => (action.type || '').toLowerCase() === 'mission')
      .map(action => ({
        id: action.id,
        name: action.name,
        ap: action.AP ?? null,
        description: action.description || '',
        effects: Array.isArray(action.effects) ? action.effects.filter(Boolean) : [],
        conditions: Array.isArray(action.conditions) ? action.conditions.filter(Boolean) : [],
        packs: Array.isArray(action.packs) ? action.packs.filter(Boolean) : [],
        type: (action.type || '').toLowerCase() || 'mission',
        fromEquipment: true
      }))
    
    // Merge with existing mission actions
    // Equipment actions take precedence (added last) so they overwrite existing ones
    const actionMap = new Map()
    // First add all mission actions
    for (const action of missionActions) {
      actionMap.set(action.id, action)
    }
    // Then add/overwrite with equipment actions (they get the fromEquipment flag)
    for (const action of equipmentMissionActions) {
      actionMap.set(action.id, action)
    }
    
    const merged = Array.from(actionMap.values())
    return sortMissionActions(merged)
  }, [missionActions, equipmentActions, equipmentActionsLoaded])

  const sections = useMemo(() => {
    return SECTION_DEFINITIONS.map(def => {
      if (def.id === 'rules-universal-actions') {
        return {
          ...def,
          items: combinedUniversalActions.map(action => ({
            id: `universal-action-${action.id}`,
            label: action.name
          }))
        }
      }
      if (def.id === 'rules-mission-actions') {
        return {
          ...def,
          items: combinedMissionActions.map(action => ({
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
  }, [equipment, combinedUniversalActions, combinedMissionActions, weaponRules])

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

  const renderActionCollection = ({ loading, loaded, error, actions, anchorPrefix, emptyMessage }) => {
    if (!loaded) {
      if (loading) {
        return <div className="muted">Loading…</div>
      }
      return null
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
          const showEquipmentLabel = action.fromEquipment === true
          const hasPacks = action.packs && action.packs.length > 0
          // Determine action type: use action.type if available, otherwise infer from anchorPrefix
          const actionType = action.type || (anchorPrefix === 'universal-action' ? 'universal' : anchorPrefix === 'mission-action' ? 'mission' : 'ability')
          const actionTypeLabel = (actionType === 'universal' ? 'Universal' : actionType === 'mission' ? 'Mission' : actionType === 'ability' ? 'Ability' : actionType.charAt(0).toUpperCase() + actionType.slice(1)) + ' Action'
          
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
                          <span>{typeof effect === 'string' ? effect : String(effect)}</span>
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
                          <span>{typeof condition === 'string' ? condition : String(condition)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {/* Footer: Action type centered, Packs and Equipment on right */}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: '0.75rem',
                  minHeight: '1.5rem'
                }}
              >
                {/* Action type centered */}
                <span style={{
                  color: 'var(--muted)',
                  fontSize: '0.85rem'
                }}>
                  - {actionTypeLabel} -
                </span>
                {/* Packs and Equipment on right - absolutely positioned */}
                {(hasPacks || showEquipmentLabel) && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.35rem',
                      alignItems: 'center'
                    }}
                  >
                    {hasPacks && action.packs.map(pack => (
                      <span key={`${action.id}-pack-${pack}`} className="pill">
                        {pack}
                      </span>
                    ))}
                    {showEquipmentLabel && (
                      <span key={`${action.id}-equipment`} className="pill">
                        Equipment
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderUniversalActions = () => renderActionCollection({
    loading: actionsLoading && !equipmentActionsLoaded,
    loaded: actionsLoaded && equipmentActionsLoaded,
    error: actionsError,
    actions: combinedUniversalActions,
    anchorPrefix: 'universal-action',
    emptyMessage: 'No universal actions available.'
  })

  const renderMissionActions = () => renderActionCollection({
    loading: missionActionsLoading && !equipmentActionsLoaded,
    loaded: missionActionsLoaded && equipmentActionsLoaded,
    error: missionActionsError,
    actions: combinedMissionActions,
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
        {weaponRules.map(rule => {
          const killteamName = rule.team ? killteamsMap.get(rule.team) : null
          return (
            <div key={rule.id} id={`weapon-rule-${rule.id}`} className="ability-card" style={{ position: 'relative' }}>
              <div className="ability-card-header">
                <h4 className="ability-card-title">
                  {rule.variable ? `${rule.name} (X)` : rule.name}
                </h4>
              </div>
              {rule.description && (
                <p className="ability-card-body" style={{ 
                  margin: 0,
                  paddingBottom: killteamName ? '1.75rem' : undefined
                }}>{rule.description}</p>
              )}
              {killteamName && (
                <div style={{
                  position: 'absolute',
                  bottom: '0.5rem',
                  right: '0.75rem',
                  fontSize: '0.85rem',
                  color: 'var(--muted)',
                  fontStyle: 'italic'
                }}>
                  {killteamName}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderUniversalEquipment = () => {
    if (!equipmentLoaded) {
      if (equipmentLoading) {
        return <div className="muted">Loading universal equipment…</div>
      }
      return null
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
    
    // Create a map of action IDs to action definitions for quick lookup
    const actionsMap = new Map()
    if (equipmentActionsLoaded && Array.isArray(equipmentActions)) {
      for (const action of equipmentActions) {
        if (action && action.id) {
          actionsMap.set(action.id, action)
        }
      }
    }
    
    return (
      <div className="card-section-list">
        {equipment.map(item => {
          // Get actions for this equipment item
          const equipmentActionIds = Array.isArray(item.actions) ? item.actions.filter(Boolean) : []
          const equipmentActionsList = equipmentActionIds
            .map(actionId => actionsMap.get(actionId))
            .filter(action => action !== undefined)
            .map(action => ({
              id: action.id,
              name: action.name,
              ap: action.AP ?? null,
              description: action.description || '',
              effects: Array.isArray(action.effects) ? action.effects.filter(Boolean) : [],
              conditions: Array.isArray(action.conditions) ? action.conditions.filter(Boolean) : [],
              packs: Array.isArray(action.packs) ? action.packs.filter(Boolean) : [],
              type: (action.type || '').toLowerCase() || 'ability',
              fromEquipment: true
            }))
          
          return (
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
              {/* Render actions inside the equipment card */}
              {equipmentActionsList.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid #2a2f3f', paddingTop: '1rem' }}>
                  {equipmentActionsList.map((action, actionIndex) => {
                    const apLabel = action.ap === null || action.ap === undefined ? null : `${action.ap} AP`
                    const showEquipmentLabel = action.fromEquipment === true
                    const hasPacks = action.packs && action.packs.length > 0
                    const actionType = action.type || 'ability'
                    const actionTypeLabel = (actionType === 'universal' ? 'Universal' : actionType === 'mission' ? 'Mission' : actionType === 'ability' ? 'Ability' : actionType.charAt(0).toUpperCase() + actionType.slice(1)) + ' Action'
                    
                    return (
                      <div key={`${item.eqId}-${action.id}-${actionIndex}`} id={`equipment-action-${item.eqId}-${action.id}${actionIndex > 0 ? `-${actionIndex}` : ''}`} style={{ marginBottom: actionIndex < equipmentActionsList.length - 1 ? '1rem' : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <h4 className="ability-card-title" style={{ margin: 0 }}>{action.name.toUpperCase()}</h4>
                          {apLabel && <span className="ability-card-ap">{apLabel}</span>}
                        </div>
                        {(action.description || action.effects.length > 0 || action.conditions.length > 0) && (
                          <div className="ability-card-body" style={{ marginBottom: '0.75rem' }}>
                            {action.description && (
                              <p style={{ marginTop: 0 }}>{action.description}</p>
                            )}
                            {action.effects.length > 0 && (
                              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                {action.effects.map((effect, effectIndex) => (
                                  <li
                                    key={`${action.id}-effect-${effectIndex}`}
                                    style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                                  >
                                    <span aria-hidden="true" style={{ color: '#2ecc71', fontWeight: 'bold' }}>➤</span>
                                    <span>{typeof effect === 'string' ? effect : String(effect)}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {action.conditions.length > 0 && (
                              <ul style={{ margin: action.effects.length ? '0.5rem 0 0 0' : 0, padding: 0, listStyle: 'none' }}>
                                {action.conditions.map((condition, conditionIndex) => (
                                  <li
                                    key={`${action.id}-condition-${conditionIndex}`}
                                    style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                                  >
                                    <span aria-hidden="true" style={{ color: '#e74c3c', fontWeight: 'bold' }}>◆</span>
                                    <span>{typeof condition === 'string' ? condition : String(condition)}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        {/* Footer: Action type centered, Packs and Equipment on right */}
                        <div
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: '0.75rem',
                            minHeight: '1.5rem'
                          }}
                        >
                          {/* Action type centered */}
                          <span style={{
                            color: 'var(--muted)',
                            fontSize: '0.85rem'
                          }}>
                            - {actionTypeLabel} -
                          </span>
                          {/* Packs and Equipment on right - absolutely positioned */}
                          {(hasPacks || showEquipmentLabel) && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.35rem',
                                alignItems: 'center'
                              }}
                            >
                              {hasPacks && action.packs.map(pack => (
                                <span key={`${action.id}-pack-${pack}`} className="pill">
                                  {pack}
                                </span>
                              ))}
                              {showEquipmentLabel && (
                                <span key={`${action.id}-equipment`} className="pill">
                                  Equipment
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderSection = (sectionId) => {
    switch (sectionId) {
      case 'rules-universal-actions':
        return (
          <div className="card">
            <KillteamSectionNavigator
              sections={[
                {
                  id: 'rules-universal-actions',
                  label: 'Universal Actions',
                  items: combinedUniversalActions.map(action => ({
                    id: `universal-action-${action.id}`,
                    label: action.name
                  }))
                }
              ]}
              activeSectionId="rules-universal-actions"
              onSectionChange={(targetId) => {
                if (targetId) {
                  setPendingAnchor({ id: targetId, nonce: 0 })
                }
              }}
              showTabs={false}
              showDropdown
              dropdownVariant="default"
            />
            {renderUniversalActions()}
          </div>
        )
      case 'rules-mission-actions':
        return (
          <div className="card">
            <KillteamSectionNavigator
              sections={[
                {
                  id: 'rules-mission-actions',
                  label: 'Mission Actions',
                  items: combinedMissionActions.map(action => ({
                    id: `mission-action-${action.id}`,
                    label: action.name
                  }))
                }
              ]}
              activeSectionId="rules-mission-actions"
              onSectionChange={(targetId) => {
                if (targetId) {
                  setPendingAnchor({ id: targetId, nonce: 0 })
                }
              }}
              showTabs={false}
              showDropdown
              dropdownVariant="default"
            />
            {renderMissionActions()}
          </div>
        )
      case 'rules-weapon-rules':
        return (
          <div className="card">
            <KillteamSectionNavigator
              sections={[
                {
                  id: 'rules-weapon-rules',
                  label: 'Weapon Rules',
                  items: weaponRules.map(rule => ({
                    id: `weapon-rule-${rule.id}`,
                    label: rule.variable ? `${rule.name} (X)` : rule.name
                  }))
                }
              ]}
              activeSectionId="rules-weapon-rules"
              onSectionChange={(targetId) => {
                if (targetId) {
                  setPendingAnchor({ id: targetId, nonce: 0 })
                }
              }}
              showTabs={false}
              showDropdown
              dropdownVariant="default"
            />
            {renderWeaponRules()}
          </div>
        )
      default:
        return (
          <div className="card">
            <KillteamSectionNavigator
              sections={[
                {
                  id: 'rules-universal-equipment',
                  label: 'Universal Equipment',
                  items: equipment.map(item => ({
                    id: `equipment-${item.eqId}`,
                    label: item.eqName || item.eqId
                  }))
                }
              ]}
              activeSectionId="rules-universal-equipment"
              onSectionChange={(targetId) => {
                if (targetId) {
                  setPendingAnchor({ id: targetId, nonce: 0 })
                }
              }}
              showTabs={false}
              showDropdown
              dropdownVariant="default"
            />
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
