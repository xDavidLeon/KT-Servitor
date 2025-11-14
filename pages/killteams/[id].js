import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import KillteamSelector from '../../components/KillteamSelector'
import KillteamSectionNavigator, { scrollToKillteamSection } from '../../components/KillteamSectionNavigator'
import OperativeCard from '../../components/OperativeCard'
import RichText from '../../components/RichText'
import { db } from '../../lib/db'
import { ensureIndex } from '../../lib/search'
import { getLocalePath, checkForUpdates, fetchWithLocaleFallback } from '../../lib/update'
import Seo from '../../components/Seo'

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

let cachedTacOpsByArchetype = null
let cachedTacOpsActionLookup = null
let tacOpsLoadPromise = null
let cachedWeaponRules = null
let weaponRulesLoadPromise = null

function normaliseTacOpsText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map(item => normaliseTacOpsText(item)).filter(Boolean).join('\n\n')
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => {
        const text = normaliseTacOpsText(val)
        if (!text) return ''
        return key ? `${key.toUpperCase()}\n${text}` : text
      })
      .filter(Boolean)
      .join('\n\n')
  }
  return String(value)
}

function normaliseTacOpsAction(action) {
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
  const description = normaliseTacOpsText(action.description)
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

function normaliseTacOp(raw, actionLookup) {
  if (!raw || !raw.id) return null

  const archetypes = Array.isArray(raw.archetype)
    ? raw.archetype.filter(Boolean)
    : raw.archetype
      ? [raw.archetype]
      : []

  const actionRefs = Array.isArray(raw.actions) ? raw.actions.filter(Boolean) : []
  const actionIds = actionRefs.map(actionRef => {
    if (typeof actionRef === 'string') {
      return actionRef
    }
    const normalised = normaliseTacOpsAction(actionRef)
    if (normalised?.id && !actionLookup.has(normalised.id)) {
      actionLookup.set(normalised.id, normalised)
    }
    return normalised?.id || null
  }).filter(Boolean)

  return {
    id: raw.id,
    title: raw.title || 'Tac Op',
    packs: Array.isArray(raw.packs)
      ? raw.packs.filter(Boolean)
      : raw.packs
        ? [raw.packs]
        : [],
    archetypes,
    reveal: normaliseTacOpsText(raw.reveal),
    additionalRules: normaliseTacOpsText(raw.additionalRules || raw.additionalRule),
    victoryPoints: normaliseTacOpsText(raw.victoryPoints),
    objective: normaliseTacOpsText(raw.objective),
    briefing: normaliseTacOpsText(raw.briefing),
    restrictions: normaliseTacOpsText(raw.restrictions),
    actions: actionIds,
    seq: typeof raw.seq === 'number' ? raw.seq : null
  }
}

async function loadTacOpsByArchetype(locale = 'en') {
  if (cachedTacOpsByArchetype && cachedTacOpsActionLookup) {
    return {
      byArchetype: cachedTacOpsByArchetype,
      actionLookup: cachedTacOpsActionLookup
    }
  }

  if (!tacOpsLoadPromise) {
    tacOpsLoadPromise = (async () => {
      const res = await fetchWithLocaleFallback(locale, 'ops_2025.json')
      if (!res.ok) {
        throw new Error(`Failed to load tac ops dataset (${res.status})`)
      }
      const json = await res.json()
      const actionsList = Array.isArray(json?.actions) ? json.actions : []

      const actionLookup = new Map()
      const addAction = (actionDef) => {
        const normalised = normaliseTacOpsAction(actionDef)
        if (normalised?.id && !actionLookup.has(normalised.id)) {
          actionLookup.set(normalised.id, normalised)
        }
      }

      actionsList.forEach(addAction)

      // Fetch merged actions.json instead of separate universal_actions.json and mission_actions.json
      const actionsRes = await fetchWithLocaleFallback(locale, 'actions.json')
      if (actionsRes.ok) {
        const json = await actionsRes.json()
        // Handle both old format (separate arrays) and new format (merged)
        const allActions = Array.isArray(json?.actions) 
          ? json.actions 
          : [
              ...(Array.isArray(json?.universal_actions) ? json.universal_actions : []),
              ...(Array.isArray(json?.mission_actions) ? json.mission_actions : [])
            ]
        allActions.forEach(addAction)
      }

      const opsList = Array.isArray(json?.ops)
        ? json.ops
        : Array.isArray(json?.operations)
          ? json.operations
          : []

      const byArchetype = new Map()

      for (const rawOp of opsList) {
        const normalised = normaliseTacOp(rawOp, actionLookup)
        if (!normalised) continue
        const archetypes = normalised.archetypes.length ? normalised.archetypes : ['Unassigned']
        for (const arch of archetypes) {
          const key = arch || 'Unassigned'
          if (!byArchetype.has(key)) {
            byArchetype.set(key, [])
          }
          byArchetype.get(key).push(normalised)
        }
      }

      for (const [key, list] of byArchetype.entries()) {
        list.sort((a, b) => {
          const seqA = typeof a.seq === 'number' ? a.seq : Number.POSITIVE_INFINITY
          const seqB = typeof b.seq === 'number' ? b.seq : Number.POSITIVE_INFINITY
          if (seqA !== seqB) return seqA - seqB
          return a.title.localeCompare(b.title)
        })
      }

      cachedTacOpsByArchetype = byArchetype
      cachedTacOpsActionLookup = actionLookup
      return { byArchetype, actionLookup }
    })().catch(err => {
      cachedTacOpsByArchetype = null
      cachedTacOpsActionLookup = null
      throw err
    }).finally(() => {
      tacOpsLoadPromise = null
    })
  }

  await tacOpsLoadPromise
  return {
    byArchetype: cachedTacOpsByArchetype,
    actionLookup: cachedTacOpsActionLookup
  }
}

function renderTacOpActionCards(actions = [], actionLookup = new Map(), anchorPrefix = 'action') {
  if (!Array.isArray(actions) || actions.length === 0) return null

  return (
    <div className="card-section-list" style={{ marginTop: '0.75rem' }}>
      {actions.map(action => {
        const entry = typeof action === 'string'
          ? actionLookup.get(action) || normaliseTacOpsAction(action)
          : normaliseTacOpsAction(action)
        if (!entry) return null

        const rawActionId = entry.id || entry.name || ''
        const safeActionId = String(rawActionId).trim().replace(/\s+/g, '-')
        const apLabel = entry.AP !== undefined && entry.AP !== null && entry.AP !== '' ? `${entry.AP} AP` : null

        return (
          <div
            key={safeActionId || rawActionId}
            id={`${anchorPrefix}-${safeActionId || rawActionId}`}
            className="ability-card action-card"
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
function parseArchetypes(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  // Legacy support: if it's a string, treat it as a single archetype
  const trimmed = String(value).trim()
  return trimmed ? [trimmed] : []
}

function splitKeywords(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
}

function formatCost(value, defaultUnit) {
  if (value === null || value === undefined) return null
  const unit = (defaultUnit || '').toUpperCase()

  if (typeof value === 'number' && !Number.isNaN(value)) {
    return unit ? `${value} ${unit}` : String(value)
  }

  const stringValue = String(value).trim()
  if (!stringValue) return null

  const numeric = stringValue.match(/^(\d+(?:\.\d+)?)$/)
  if (numeric) {
    return unit ? `${numeric[1]} ${unit}` : numeric[1]
  }

  if (unit) {
    const labelled = stringValue.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${unit}$`, 'i'))
    if (labelled) {
      return `${labelled[1]} ${unit}`
    }
  }

  const genericLabelled = stringValue.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/)
  if (genericLabelled) {
    return `${genericLabelled[1]} ${genericLabelled[2].toUpperCase()}`
  }

  if (/[A-Za-z]/.test(stringValue)) {
    return stringValue.replace(/\s+/g, ' ')
  }

  return unit ? `${stringValue} ${unit}` : stringValue
}

function extractCostFromName(rawName, units) {
  if (!rawName || typeof rawName !== 'string') {
    return { cleanName: rawName || '', inferredCost: null }
  }

  const unitPattern = Array.isArray(units) && units.length
    ? units.map(unit => unit.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')
    : 'AP'

  const costRegex = new RegExp(`\\(([^)]*?\\b\\d+(?:\\.\\d+)?\\s*(?:${unitPattern}))\\)`, 'i')
  const match = rawName.match(costRegex)
  if (!match) {
    return { cleanName: rawName.trim(), inferredCost: null }
  }

  const cleanName = `${rawName.slice(0, match.index)}${rawName.slice(match.index + match[0].length)}`
    .replace(/\s{2,}/g, ' ')
    .trim()

  return {
    cleanName: cleanName || rawName.trim(),
    inferredCost: match[1]
  }
}

function normaliseAbility(ability) {
  if (!ability) return null

  const rawName = ability.abilityName ?? ability.name ?? ''
  const { cleanName, inferredCost } = extractCostFromName(rawName, ['AP'])

  const candidateKeys = [
    'apCost',
    'ap',
    'AP',
    'apcost',
    'ap_cost',
    'apValue',
    'ap_value',
    'actionPointCost',
    'actionPointCosts',
    'actionPoints'
  ]

  let explicitAp = null
  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(ability, key)) {
      const value = ability[key]
      if (value !== undefined && value !== null && value !== '') {
        explicitAp = value
        break
      }
    }
  }

  const apCost = formatCost(explicitAp ?? inferredCost, 'AP')

  if (!cleanName && !ability.description) {
    return null
  }

  return {
    name: cleanName || rawName,
    description: ability.description,
    apCost: apCost || null
  }
}

function normaliseOption(option) {
  if (!option) return null

  const rawName = option.optionName ?? option.name ?? ''
  const { cleanName, inferredCost } = extractCostFromName(rawName, ['AP'])

  const candidateKeys = [
    'apCost',
    'ap',
    'AP',
    'apcost',
    'ap_cost',
    'apValue',
    'ap_value',
    'actionPointCost',
    'actionPointCosts',
    'actionPoints'
  ]

  let explicitAp = null
  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(option, key)) {
      const value = option[key]
      if (value !== undefined && value !== null && value !== '') {
        explicitAp = value
        break
      }
    }
  }

  const apCost = formatCost(explicitAp ?? inferredCost, 'AP')

  if (!cleanName && !option.description) {
    return null
  }

  return {
    name: cleanName || rawName,
    description: option.description,
    apCost: apCost || null
  }
}

function normaliseTextForSignature(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function abilitySignature(ability) {
  if (!ability) return ''
  const name = normaliseTextForSignature(ability?.name)
  const description = normaliseTextForSignature(ability?.description)
  const apCost = normaliseTextForSignature(ability?.apCost)
  if (!name && !description && !apCost) {
    return ''
  }
  return `${name}||${description}||${apCost}`
}

function buildTeamAnchor(prefix, name, index) {
  const slug = normaliseTextForSignature(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const base = slug ? `${prefix}-${slug}` : prefix
  return `${base}-${index + 1}`
}

function normalisePloy(ploy) {
  if (!ploy) return null

  const rawName = ploy.ployName ?? ploy.name ?? ''
  const { cleanName, inferredCost } = extractCostFromName(rawName, ['CP'])

  const candidateKeys = [
    'cpCost',
    'cp',
    'CP',
    'cost',
    'cp_cost',
    'cpValue',
    'cp_value',
    'commandPointCost',
    'commandPoints'
  ]

  let explicitCost = null
  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(ploy, key)) {
      const value = ploy[key]
      if (value !== undefined && value !== null && value !== '') {
        explicitCost = value
        break
      }
    }
  }

  const cost = formatCost(explicitCost ?? inferredCost, 'CP')

  const identifier = ploy.ployId ?? ploy.id ?? cleanName ?? rawName ?? null

  if (!cleanName && !ploy.description) {
    return null
  }

  return {
    id: identifier,
    anchorId: identifier ? `ploy-${identifier}` : undefined,
    name: cleanName || rawName,
    description: ploy.description || '',
    cost: cost || null,
    type: ploy.ployType || null
  }
}

function normaliseEquipment(equipment) {
  if (!equipment) return null

  const rawName = equipment.eqName ?? equipment.name ?? ''
  const { cleanName, inferredCost } = extractCostFromName(rawName, ['EP'])

  const candidateKeys = [
    'epCost',
    'ep',
    'EP',
    'cost',
    'equipmentPoints',
    'points',
    'ep_value',
    'epValue'
  ]

  let explicitCost = null
  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(equipment, key)) {
      const value = equipment[key]
      if (value !== undefined && value !== null && value !== '') {
        explicitCost = value
        break
      }
    }
  }

  const cost = formatCost(explicitCost ?? inferredCost, 'EP')

  if (!cleanName && !equipment.description) {
    return null
  }

  const identifier = equipment.eqId ?? equipment.id ?? cleanName ?? rawName ?? null

  return {
    id: identifier,
    anchorId: identifier ? `equipment-${identifier}` : undefined,
    name: cleanName || rawName,
    description: equipment.description || '',
    cost: cost || null,
    killteamId: equipment.killteamId ?? null,
    isUniversal: equipment.killteamId === null
  }
}

function sortUniversalEquipmentRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.slice().sort((a, b) => {
    const seqA = typeof a?.seq === 'number' ? a.seq : Number.MAX_SAFE_INTEGER
    const seqB = typeof b?.seq === 'number' ? b.seq : Number.MAX_SAFE_INTEGER
    if (seqA !== seqB) return seqA - seqB
    return (a?.eqName || '').localeCompare(b?.eqName || '')
  })
}

async function loadWeaponRules(locale = 'en') {
  if (cachedWeaponRules) {
    return cachedWeaponRules
  }

  if (!weaponRulesLoadPromise) {
    weaponRulesLoadPromise = (async () => {
      try {
        const res = await fetchWithLocaleFallback(locale, 'weapon_rules.json')
        if (!res.ok) {
          console.warn(`Failed to load weapon rules (${res.status}) for locale ${locale}`)
          // Return empty Map instead of throwing
          cachedWeaponRules = new Map()
          return cachedWeaponRules
        }
        const json = await res.json()
        const list = Array.isArray(json?.weapon_rules) ? json.weapon_rules : []
        const weaponRulesMap = new Map()
        for (const rule of list) {
          const ruleId = rule.id || rule.name || ''
          if (ruleId) {
            weaponRulesMap.set(ruleId, {
              id: ruleId,
              name: rule.name || 'Unnamed rule',
              description: rule.description || '',
              variable: Boolean(rule.variable)
            })
          }
        }
        cachedWeaponRules = weaponRulesMap
        return weaponRulesMap
      } catch (err) {
        console.warn('Failed to load weapon rules', err)
        cachedWeaponRules = new Map()
        return cachedWeaponRules
      }
    })().finally(() => {
      weaponRulesLoadPromise = null
    })
  }

  return await weaponRulesLoadPromise
}

function formatWeaponRuleInstance(wpi, weaponRulesMap) {
  if (!wpi || typeof wpi !== 'object') return null
  
  const ruleId = wpi.id
  const rule = weaponRulesMap.get(ruleId)
  const ruleName = rule ? rule.name : (ruleId || 'Unknown Rule')
  const ruleDescription = rule ? rule.description : ''
  
  // Handle prefix_num (if present) - append '' after it
  const prefixNum = wpi.prefix_num !== undefined && wpi.prefix_num !== null ? String(wpi.prefix_num) : ''
  const number = wpi.number !== undefined && wpi.number !== null ? String(wpi.number) : ''
  const details = wpi.details || ''
  
  // Format: prefix_num + '' + rule name + details + number (with special formatting)
  const parts = []
  if (prefixNum) {
    parts.push(prefixNum + '"')
  }
  parts.push(ruleName)
  if (details) {
    parts.push(details)
  }
  if (number) {
    const ruleNameLower = ruleName.toLowerCase()
    // For Lethal rule, append '+' after the number
    if (ruleNameLower === 'lethal') {
      parts.push(number + '+')
    }
    // For Range, Blast, Torrent, append '' after the number
    else if (ruleNameLower === 'range' || ruleNameLower === 'blast' || ruleNameLower === 'torrent') {
      parts.push(number + '"')
    }
    // If prefix_num exists (and not Devastating), append '' after the number
    else if (prefixNum && ruleNameLower !== 'devastating') {
      parts.push(number + '"')
    }
    // Otherwise, just the number
    else {
      parts.push(number)
    }
  }
  
  return {
    displayText: parts.join(' '),
    description: ruleDescription,
    ruleId: ruleId
  }
}

function normaliseOperative(opType, weaponRulesMap = new Map()) {
  if (!opType) return null

  const buildWeapons = () => {
    const result = []
    for (const weapon of opType.weapons || []) {
      const type = weapon.wepType === 'R' ? 'Ranged Weapon' :
        weapon.wepType === 'M' ? 'Melee Weapon' :
        weapon.wepType === 'P' ? 'Psychic Weapon' :
        weapon.wepType === 'E' ? 'Equipment' :
        'Weapon'

      const weaponName = weapon.wepName || weapon.wepId
      const weaponId = weapon.wepId

      if (Array.isArray(weapon.profiles) && weapon.profiles.length) {
        const profiles = weapon.profiles.map(profile => {
          // Handle new WPI structure
          let specialRules = []
          if (Array.isArray(profile.WR)) {
            // New structure: array of WPI objects
            specialRules = profile.WR
              .map(wpi => formatWeaponRuleInstance(wpi, weaponRulesMap))
              .filter(Boolean)
          } else if (profile.WR) {
            // Legacy support: string or comma-separated string
            // Convert to objects for consistency
            const legacyRules = splitKeywords(profile.WR)
            specialRules = legacyRules.map(ruleText => ({
              displayText: ruleText,
              description: '',
              ruleId: null
            }))
          }
          
          return {
            id: `${weaponId}-${profile.wepprofileId || profile.seq || 0}`,
            profileName: profile.profileName || null,
            atk: profile.ATK || '-',
            hit: profile.HIT || '-',
            dmg: profile.DMG || '-',
            specialRules
          }
        })
        
        result.push({
          id: weaponId,
          name: weaponName,
          type,
          profiles,
          hasMultipleProfiles: profiles.length > 1
        })
      } else {
        result.push({
          id: weaponId,
          name: weaponName,
          type,
          profiles: [],
          hasMultipleProfiles: false
        })
      }
    }
    return result
  }

  return {
    id: opType.opTypeId,
    name: opType.opTypeName || opType.opName || opType.opId,
    apl: opType.APL ?? null,
    move: opType.MOVE || '',
    save: opType.SAVE || '',
    wounds: opType.WOUNDS ?? null,
    baseSize: opType.basesize ?? null,
    keywords: splitKeywords(opType.keywords),
    specialRules: (opType.abilities || []).map(normaliseAbility).filter(Boolean),
    specialActions: (opType.options || []).map(normaliseOption).filter(Boolean),
    weapons: buildWeapons()
  }
}

export default function KillteamPage() {
  const router = useRouter()
  const locale = router.locale || 'en'
  const { id } = router.query

  const [killteam, setKillteam] = useState(null)
  const [universalEquipmentRecords, setUniversalEquipmentRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const hasLoadedOnceRef = useRef(false)
  const [activeSectionId, setActiveSectionId] = useState(null)
  const [pendingHash, setPendingHash] = useState(null)
  const selectorCardRef = useRef(null)
  const hasSyncedInitialHashRef = useRef(false)
  const [isSelectorVisible, setIsSelectorVisible] = useState(true)
  const [tacOpsByArchetype, setTacOpsByArchetype] = useState(cachedTacOpsByArchetype ? new Map(cachedTacOpsByArchetype) : null)
  const [tacOpsActionLookup, setTacOpsActionLookup] = useState(cachedTacOpsActionLookup ? new Map(cachedTacOpsActionLookup) : new Map())
  const [tacOpsLoading, setTacOpsLoading] = useState(!cachedTacOpsByArchetype)
  const [tacOpsLoaded, setTacOpsLoaded] = useState(Boolean(cachedTacOpsByArchetype))
  const [tacOpsError, setTacOpsError] = useState(null)
  const [weaponRulesMap, setWeaponRulesMap] = useState(cachedWeaponRules || new Map())
  const [equipmentActions, setEquipmentActions] = useState([])
  const [equipmentActionsLoaded, setEquipmentActionsLoaded] = useState(false)

  const prevLocaleRef = useRef(locale)
  
  useEffect(() => {
    if (!id) return

    let cancelled = false

    ;(async () => {
      // Reset loading state when locale or id changes
      const localeChanged = prevLocaleRef.current !== locale
      if (localeChanged || !hasLoadedOnceRef.current) {
        setLoading(true)
        prevLocaleRef.current = locale
      }
      
      // Only check for updates when locale changes, not on every id change
      if (localeChanged) {
        try {
          await checkForUpdates(locale)
        } catch (err) {
          console.warn('Update check failed', err)
        }
      }
      
      await ensureIndex()

      const data = await db.killteams.get(id)
      if (!cancelled) {
        setKillteam(data || null)
        setLoading(false)
        hasLoadedOnceRef.current = true
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, locale])

  useEffect(() => {
    let cancelled = false

    const loadUniversalEquipment = async () => {
      try {
        const rows = await db.universalEquipment.toArray()
        if (cancelled) return
        // Filter for universal equipment only (killteamId === null)
        const universalRows = rows.filter(row => row.killteamId === null || row.killteamId === undefined)
        setUniversalEquipmentRecords(sortUniversalEquipmentRows(universalRows))
      } catch (err) {
        if (cancelled) return
        console.warn('Failed to load universal equipment dataset', err)
        setUniversalEquipmentRecords([])
      }
    }

    const loadEquipmentActions = async () => {
      try {
        const res = await fetchWithLocaleFallback(locale, 'universal_equipment.json')
        if (!res.ok) {
          console.warn(`Failed to load universal equipment (${res.status}) for locale ${locale}`)
          // Continue with empty array instead of throwing
          if (cancelled) return
          setEquipmentActions([])
          setEquipmentActionsLoaded(true)
          return
        }
        const json = await res.json()
        if (cancelled) return
        
        // The actions are in a root-level "actions" array in the JSON
        const rawActions = Array.isArray(json?.actions) ? json.actions : []
        const normalizedActions = rawActions
          .map(action => normaliseTacOpsAction(action))
          .filter(action => action !== null)
        
        // Store the normalized actions (they have AP, type, etc. fields)
        setEquipmentActions(normalizedActions)
        setEquipmentActionsLoaded(true)
      } catch (err) {
        if (cancelled) return
        console.warn('Failed to load equipment actions', err)
        setEquipmentActions([])
        setEquipmentActionsLoaded(true)
      }
    }

    loadUniversalEquipment()
    loadEquipmentActions()

    return () => {
      cancelled = true
    }
  }, [locale])

  useEffect(() => {
    if (tacOpsLoaded) return

    let cancelled = false
    setTacOpsLoading(true)

    loadTacOpsByArchetype(locale)
      .then(({ byArchetype, actionLookup }) => {
        if (cancelled) return
        setTacOpsByArchetype(new Map(byArchetype))
        setTacOpsActionLookup(new Map(actionLookup))
        setTacOpsLoaded(true)
        setTacOpsError(null)
      })
      .catch(err => {
        if (cancelled) return
        console.error('Failed to load tac ops dataset', err)
        setTacOpsError(err)
        setTacOpsLoaded(true)
      })
      .finally(() => {
        if (!cancelled) {
          setTacOpsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [tacOpsLoaded, locale])

  useEffect(() => {
    let cancelled = false

    loadWeaponRules(locale)
      .then(map => {
        if (cancelled) return
        setWeaponRulesMap(map)
      })
      .catch(err => {
        if (cancelled) return
        console.warn('Failed to load weapon rules', err)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleUpdate = async () => {
      try {
        const rows = await db.universalEquipment.toArray()
        // Filter for universal equipment only (killteamId === null)
        const universalRows = rows.filter(row => row.killteamId === null || row.killteamId === undefined)
        setUniversalEquipmentRecords(sortUniversalEquipmentRows(universalRows))
      } catch (err) {
        console.warn('Failed to refresh universal equipment dataset', err)
      }
    }

    window.addEventListener('kt-universal-equipment-updated', handleUpdate)
    return () => {
      window.removeEventListener('kt-universal-equipment-updated', handleUpdate)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash?.replace('#', '')
    if (!hash) return

    const attemptScroll = () => {
      const target = document.getElementById(hash)
      if (!target) return false
      target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
      return true
    }

    if (attemptScroll()) return

    let attempts = 0
    const timer = window.setInterval(() => {
      attempts += 1
      if (attemptScroll() || attempts >= 10) {
        window.clearInterval(timer)
      }
    }, 100)

    return () => window.clearInterval(timer)
  }, [killteam])

  const rawOperatives = useMemo(() => {
    if (!killteam?.opTypes) return []
    return killteam.opTypes
      .map(opType => {
        const operative = normaliseOperative(opType, weaponRulesMap)
        if (operative && Array.isArray(operative.keywords) && operative.keywords.length > 0) {
          // The first keyword is the faction/kill team keyword
          operative.factionKeyword = operative.keywords[0].toUpperCase()
        }
        return operative
      })
      .filter(Boolean)
  }, [killteam, weaponRulesMap])

  // Read teamAbilities directly from killteam JSON (new schema)
  // teamAbilities can be an array, or an object with 'abilities' and 'options' arrays
  const teamAbilities = useMemo(() => {
    if (!killteam) return []
    
    // Check if teamAbilities exists and is an array
    if (Array.isArray(killteam.teamAbilities)) {
      return killteam.teamAbilities
        .map(ability => normaliseAbility(ability))
        .filter(Boolean)
        .map((ability, index) => ({
          ...ability,
          anchorId: buildTeamAnchor('team-ability', ability?.name, index)
        }))
    }
    
    // Check if teamAbilities is an object with 'abilities' array
    if (killteam.teamAbilities && typeof killteam.teamAbilities === 'object' && Array.isArray(killteam.teamAbilities.abilities)) {
      return killteam.teamAbilities.abilities
        .map(ability => normaliseAbility(ability))
        .filter(Boolean)
        .map((ability, index) => ({
          ...ability,
          anchorId: buildTeamAnchor('team-ability', ability?.name, index)
        }))
    }
    
    return []
  }, [killteam])

  const teamOptions = useMemo(() => {
    if (!killteam) return []
    
    // Check if teamAbilities is an object with 'options' array
    if (killteam.teamAbilities && typeof killteam.teamAbilities === 'object' && Array.isArray(killteam.teamAbilities.options)) {
      return killteam.teamAbilities.options
        .map(option => normaliseOption(option))
        .filter(Boolean)
        .map((option, index) => ({
          ...option,
          anchorId: buildTeamAnchor('team-option', option?.name, index)
        }))
    }
    
    // Check for separate teamOptions field (backward compatibility)
    if (Array.isArray(killteam.teamOptions)) {
      return killteam.teamOptions
        .map(option => normaliseOption(option))
        .filter(Boolean)
        .map((option, index) => ({
          ...option,
          anchorId: buildTeamAnchor('team-option', option?.name, index)
        }))
    }
    
    return []
  }, [killteam])

  const factionRules = useMemo(() => {
    const combined = []

    if (Array.isArray(teamAbilities) && teamAbilities.length) {
      for (const ability of teamAbilities) {
        if (!ability) continue
        combined.push({
          ...ability,
          sourceType: 'ability'
        })
      }
    }

    if (Array.isArray(teamOptions) && teamOptions.length) {
      for (const option of teamOptions) {
        if (!option) continue
        combined.push({
          ...option,
          sourceType: 'option'
        })
      }
    }

    return combined.map((rule, index) => ({
      ...rule,
      anchorId: buildTeamAnchor('faction-rule', rule?.name, index)
    }))
  }, [teamAbilities, teamOptions])

  // Operatives no longer need filtering since common abilities/options are already removed from JSON
  const operatives = useMemo(() => {
    return rawOperatives
  }, [rawOperatives])

  const strategyPloys = useMemo(() => {
    return (killteam?.ploys || [])
      .filter(ploy => ploy?.ployType === 'S')
      .map(normalisePloy)
      .filter(Boolean)
  }, [killteam])

  const firefightPloys = useMemo(() => {
    return (killteam?.ploys || [])
      .filter(ploy => ploy?.ployType && ploy.ployType !== 'S')
      .map(normalisePloy)
      .filter(Boolean)
  }, [killteam])

  const factionEquipment = useMemo(() => {
    return (killteam?.equipments || [])
      .map(normaliseEquipment)
      .filter(item => item && !item.isUniversal)
  }, [killteam])

  const universalEquipment = useMemo(() => {
    return (universalEquipmentRecords || [])
      .map(normaliseEquipment)
      .filter(Boolean)
      .filter(item => item.killteamId === null || item.killteamId === undefined)
  }, [universalEquipmentRecords])

  const hasEquipment = factionEquipment.length > 0 || universalEquipment.length > 0

  const killteamTitle = useMemo(() => {
    if (!killteam) {
      return 'Kill Team'
    }
    return (
      killteam.killteamName ||
      killteam.killteamDisplayName ||
      killteam.killteamId ||
      'Kill Team'
    )
  }, [killteam])

  const archetypes = useMemo(() => parseArchetypes(killteam?.archetypes), [killteam])

  const killteamTacOps = useMemo(() => {
    if (!Array.isArray(archetypes) || archetypes.length === 0) return []
    if (!tacOpsByArchetype) return []

    const seen = new Set()
    const list = []

    archetypes.forEach(arch => {
      const key = arch || 'Unassigned'
      const ops = tacOpsByArchetype.get(key)
      if (ops) {
        ops.forEach(op => {
          if (!seen.has(op.id)) {
            list.push(op)
            seen.add(op.id)
          }
        })
      }
    })

    return list
  }, [archetypes, tacOpsByArchetype])

  const sections = useMemo(() => {
    if (!killteam) return []

    const result = []

    const overviewItems = [
      {
        id: 'killteam-overview',
        label: killteamTitle
      }
    ]

    if (killteam?.composition) {
      overviewItems.push({
        id: 'killteam-composition',
        label: 'Composition'
      })
    }

    result.push({
      id: 'killteam-overview',
      label: 'Overview',
      items: overviewItems
    })

    if (Array.isArray(factionRules) && factionRules.length > 0) {
      result.push({
        id: 'faction-rules',
        label: 'Faction Rules',
        items: factionRules.map((rule, index) => ({
          id: rule?.anchorId || (rule?.name ? `faction-rule-${index + 1}` : `faction-rule-${index + 1}`),
          label: rule?.name || `Faction Rule ${index + 1}`
        }))
      })
    }

    result.push({
      id: 'operatives',
      label: 'Operatives',
      items: operatives.map((operative, index) => ({
        id: operative?.id ? `operative-${operative.id}` : `operative-${index + 1}`,
        label: operative?.name || `Operative ${index + 1}`
      }))
    })

    const ployItems = []
    if (strategyPloys.length) {
      ployItems.push({
        id: 'strategy-ploys',
        label: 'Strategy Ploys',
        type: 'heading'
      })
      strategyPloys.forEach((ploy, index) => {
        ployItems.push({
          id: ploy?.anchorId || (ploy?.id ? `ploy-${ploy.id}` : `strategy-ploy-${index + 1}`),
          label: ploy?.name || `Strategy Ploy ${index + 1}`
        })
      })
    }
    if (firefightPloys.length) {
      ployItems.push({
        id: 'firefight-ploys',
        label: 'Firefight Ploys',
        type: 'heading'
      })
      firefightPloys.forEach((ploy, index) => {
        ployItems.push({
          id: ploy?.anchorId || (ploy?.id ? `ploy-${ploy.id}` : `firefight-ploy-${index + 1}`),
          label: ploy?.name || `Firefight Ploy ${index + 1}`
        })
      })
    }

    result.push({
      id: 'ploys',
      label: 'Ploys',
      items: ployItems
    })

    if (hasEquipment) {
      const equipmentItems = []
      if (factionEquipment.length) {
        equipmentItems.push({
          id: 'faction-equipment',
          label: 'Faction Equipment',
          type: 'heading'
        })
        factionEquipment.forEach((item, index) => {
          equipmentItems.push({
            id: item?.anchorId || (item?.id ? `equipment-${item.id}` : `faction-equipment-${index + 1}`),
            label: item?.name || `Equipment ${index + 1}`
          })
        })
      }
      if (universalEquipment.length) {
        equipmentItems.push({
          id: 'universal-equipment',
          label: 'Universal Equipment',
          type: 'heading'
        })
        universalEquipment.forEach((item, index) => {
          equipmentItems.push({
            id: item?.anchorId || (item?.id ? `equipment-${item.id}` : `universal-equipment-${index + 1}`),
            label: item?.name || `Equipment ${index + 1}`
          })
        })
      }

      result.push({
        id: 'equipment',
        label: 'Equipment',
        items: equipmentItems
      })
    }

    if (killteamTacOps.length > 0) {
      result.push({
        id: 'tac-ops',
        label: 'Tac Ops',
        items: killteamTacOps.map(op => ({
          id: `tac-op-${op.id}`,
          label: op.title
        }))
      })
    }

    return result
  }, [
    killteam,
    killteamTitle,
    factionRules,
    operatives,
    strategyPloys,
    firefightPloys,
    factionEquipment,
    universalEquipment,
    hasEquipment,
    killteamTacOps
  ])

  const findSectionForAnchor = useCallback((anchor) => {
    if (!anchor) return null
    return (
      sections.find(section => {
        if (section.id === anchor) return true
        return Array.isArray(section.items) && section.items.some(item => item?.id === anchor)
      }) || null
    )
  }, [sections])

  useEffect(() => {
    if (!sections.length) return
    if (!activeSectionId || !sections.some(section => section.id === activeSectionId)) {
      setActiveSectionId(sections[0].id)
    }
  }, [sections, activeSectionId])

  const renderTacOpsSection = () => {
    if (!Array.isArray(archetypes) || archetypes.length === 0) {
      return <div className="muted">This kill team has no assigned archetypes.</div>
    }
    if (!tacOpsLoaded) {
      if (tacOpsLoading) {
        return <div className="muted">Loading Tac Ops…</div>
      }
      return null
    }
    if (tacOpsError) {
      return (
        <div className="muted">
          Failed to load Tac Ops.
          {' '}
          <span style={{ fontSize: '0.85rem' }}>{tacOpsError.message || String(tacOpsError)}</span>
        </div>
      )
    }
    if (!killteamTacOps.length) {
      return <div className="muted">No Tac Ops available for this kill team.</div>
    }

    return (
      <div className="card-section-list">
        {killteamTacOps.map(op => (
          <div key={op.id} id={`tac-op-${op.id}`} className="card operation-card" style={{ margin: '.75rem 0', position: 'relative' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              {(() => {
                const archetypeLabel = (op.archetypes && op.archetypes[0]) ? op.archetypes[0] : 'Tac Op'
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
              <strong style={{ fontSize: '1.1rem', color: '#000000' }}>{op.title.toUpperCase()}</strong>
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

            {renderTacOpActionCards(op.actions, tacOpsActionLookup, `operation-action-${op.id}`)}

            {op.victoryPoints && (
              <div className="ability-card" style={{ marginTop: '0.75rem' }}>
                <div className="ability-card-header" style={{ justifyContent: 'flex-start' }}>
                  <h4 className="ability-card-title" style={{ margin: 0 }}>Victory Points</h4>
                </div>
                <RichText className="ability-card-body muted" text={op.victoryPoints} />
              </div>
            )}
            {op.packs && op.packs.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.35rem',
                  justifyContent: 'flex-end',
                  marginTop: '0.75rem'
                }}
              >
                {op.packs.map(pack => (
                  <span key={`${op.id}-pack-${pack}`} className="pill">{pack}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!sections.length) return

    const hash = window.location.hash?.replace('#', '')
    if (!hash) return

    const sectionForHash = findSectionForAnchor(hash)
    if (!sectionForHash) return

    if (sectionForHash.id !== activeSectionId) {
      setActiveSectionId(sectionForHash.id)
    }

    setPendingHash(prev => (prev === hash ? prev : hash))
  }, [sections, findSectionForAnchor, activeSectionId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!sections.length) return

    const handleHashChange = () => {
      const hashValue = window.location.hash?.replace('#', '')
      if (!hashValue) return

      const sectionForHash = findSectionForAnchor(hashValue)
      if (!sectionForHash) return

      if (sectionForHash.id !== activeSectionId) {
        setActiveSectionId(sectionForHash.id)
      }

      setPendingHash(prev => (prev === hashValue ? prev : hashValue))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [sections, findSectionForAnchor, activeSectionId])

  useEffect(() => {
    if (!pendingHash) return
    if (!sections.length) return

    const sectionForHash = findSectionForAnchor(pendingHash)

    if (!sectionForHash) {
      setPendingHash(null)
      return
    }

    if (sectionForHash.id !== activeSectionId) return

    let attempts = 0
    let timerId = null

    const attemptScroll = () => {
      const success = scrollToKillteamSection(pendingHash)
      if (success) {
        setPendingHash(null)
        return
      }
      attempts += 1
      if (attempts >= 10) {
        setPendingHash(null)
        return
      }
      timerId = window.setTimeout(attemptScroll, 100)
    }

    attemptScroll()

    return () => {
      if (timerId) {
        window.clearTimeout(timerId)
      }
    }
  }, [pendingHash, findSectionForAnchor, activeSectionId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const element = selectorCardRef.current
    if (!element) return

    if (typeof IntersectionObserver === 'undefined') {
      const handleScroll = () => {
        const rect = element.getBoundingClientRect()
        const isVisible = rect.bottom > 0 && rect.top < window.innerHeight
        setIsSelectorVisible(isVisible)
      }
      handleScroll()
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleScroll)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries || entries.length === 0) return
        const [entry] = entries
        setIsSelectorVisible(entry?.isIntersecting ?? false)
      },
      {
        rootMargin: '0px 0px -25% 0px',
        threshold: [0, 0.1]
      }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [killteam, sections.length])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!sections.length) return
    if (!activeSectionId) return
    if (pendingHash) return

    if (!hasSyncedInitialHashRef.current) {
      hasSyncedInitialHashRef.current = true
      return
    }

    const currentHash = window.location.hash?.replace('#', '') || ''
    if (!currentHash) return

    const mappedSection = findSectionForAnchor(currentHash)
    if (!mappedSection) return
    if (mappedSection.id === activeSectionId) return

    const { pathname, search } = window.location
    window.history.replaceState(null, '', `${pathname}${search}#${activeSectionId}`)
  }, [activeSectionId, sections, pendingHash, findSectionForAnchor])

  if (loading) {
    return (
      <>
        <Seo title="Loading Kill Team" description="Loading kill team data." />
        <div className="container">
          <Header />
          <div className="card">Loading…</div>
        </div>
      </>
    )
  }

  if (!killteam) {
    return (
      <>
        <Seo
          title="Kill Team Not Found"
          description={id ? `We couldn’t find data for ${id}. Try refreshing your data from the menu.` : 'We couldn’t find data for this kill team.'}
        />
        <div className="container">
          <Header />
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Kill Team not found</h2>
            <p className="muted">We couldn’t find data for <code>{id}</code>. Try refreshing your data from the menu.</p>
          </div>
        </div>
      </>
    )
  }

  const fallbackDescription = `Review ${killteamTitle} operatives, ploys, equipment, and abilities for Kill Team 2024.`
  const seoDescription = killteam.description || fallbackDescription

  const activeSection = sections.find(section => section.id === activeSectionId) || sections[0] || null
  const currentSectionId = activeSection?.id

  const renderActiveSection = () => {
    switch (currentSectionId) {
      case 'killteam-overview':
        return (
          <section id="killteam-overview" className="card killteam-tab-panel">
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem',
                marginBottom: '0.75rem'
              }}
            >
              <h2 style={{ margin: 0 }}>{killteamTitle}</h2>
              {archetypes.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' }}>
                  {archetypes.map(archetype => {
                    const style = getArchetypePillStyle(archetype)
                    const label = style?.label || archetype
                    return (
                      <span
                        key={archetype}
                        className="pill"
                        style={style?.backgroundColor ? style : undefined}
                      >
                        {label}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            {(killteam?.file && killteam?.version) && (
              <div
                style={{
                  marginTop: '1rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}
              >
                <a
                  href={killteam.file}
                  target="_blank"
                  rel="noreferrer"
                  className="pill-button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    justifyContent: 'center',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.95rem'
                  }}
                  aria-label="Open designer notes PDF"
                >
                  <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>🔄</span>
                  <span>{killteam.version}</span>
                </a>
              </div>
            )}
            {killteam.description && <RichText className="muted" text={killteam.description} />}
            {killteam.composition && (
              <div id="killteam-composition" style={{ marginTop: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>Composition</h3>
                <RichText className="muted" text={killteam.composition} />
              </div>
            )}
          </section>
        )
      case 'faction-rules':
        return (
          <section id="faction-rules" className="card killteam-tab-panel">
            <h3 style={{ marginTop: 0 }}>Faction Rules</h3>
            {factionRules.length > 0 ? (
              <div className="card-section-list">
                {factionRules.map((rule, idx) => (
                  <div
                    key={rule.anchorId || rule.name || idx}
                    id={rule.anchorId}
                    className="ability-card ability-card-item"
                  >
                    <div className="ability-card-header">
                      <h4 className="ability-card-title">{rule.name || 'Rule'}</h4>
                      {rule.apCost && <span className="ability-card-ap">{rule.apCost}</span>}
                    </div>
                    {rule.description && (
                      <RichText className="ability-card-body" text={rule.description} />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">No faction rules available.</div>
            )}
          </section>
        )
      case 'operatives':
        return (
          <section id="operatives" className="card killteam-tab-panel">
            <h3 style={{ marginTop: 0 }}>Operatives</h3>
            {operatives.length ? (
              <div className="operatives-grid">
                {operatives.map(operative => (
                  <OperativeCard key={operative.id} operative={operative} />
                ))}
              </div>
            ) : (
              <div className="muted">No operatives listed for this kill team.</div>
            )}
          </section>
        )
      case 'ploys':
        return (
          <section id="ploys" className="card killteam-tab-panel">
            <h3 style={{ marginTop: 0 }}>Ploys</h3>
            {strategyPloys.length || firefightPloys.length ? (
              <>
                {strategyPloys.length > 0 && (
                  <>
                    <h4
                      id="strategy-ploys"
                      className="muted"
                      style={{ margin: 0, marginBottom: '0.5rem' }}
                    >
                      Strategy Ploys
                    </h4>
                    <div className="card-section-list">
                      {strategyPloys.map((ploy, idx) => (
                        <div key={ploy.id || idx} id={ploy.anchorId} className="ability-card ploy-card">
                          <div className="ability-card-header">
                            <h4 className="ability-card-title">{ploy.name}</h4>
                            {ploy.cost && <span className="ability-card-ap">{ploy.cost}</span>}
                          </div>
                          {ploy.description && <RichText className="ability-card-body" text={ploy.description} />}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {firefightPloys.length > 0 && (
                  <>
                    <h4
                      id="firefight-ploys"
                      className="muted"
                      style={{
                        marginTop: strategyPloys.length > 0 ? '1rem' : 0,
                        marginBottom: '0.5rem'
                      }}
                    >
                      Firefight Ploys
                    </h4>
                    <div className="card-section-list">
                      {firefightPloys.map((ploy, idx) => (
                        <div key={ploy.id || idx} id={ploy.anchorId} className="ability-card ploy-card">
                          <div className="ability-card-header">
                            <h4 className="ability-card-title">{ploy.name}</h4>
                            {ploy.cost && <span className="ability-card-ap">{ploy.cost}</span>}
                          </div>
                          {ploy.description && <RichText className="ability-card-body" text={ploy.description} />}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="muted">No ploys available.</div>
            )}
          </section>
        )
      case 'equipment':
        return (
          <section id="equipment" className="card killteam-tab-panel">
            <h3 style={{ marginTop: 0 }}>Equipment</h3>
            {hasEquipment ? (
              <>
                {factionEquipment.length > 0 && (
                  <>
                    <h4 id="faction-equipment" className="muted" style={{ margin: 0, marginBottom: '0.5rem' }}>
                      Faction Equipment
                    </h4>
                    <div className="card-section-list">
                      {factionEquipment.map((item, idx) => (
                        <div key={item.id || idx} id={item.anchorId} className="ability-card equipment-card">
                          <div className="ability-card-header">
                            <h4 className="ability-card-title">{item.name}</h4>
                            {item.cost && <span className="ability-card-ap">{item.cost}</span>}
                          </div>
                          {item.description && <RichText className="ability-card-body" text={item.description} />}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {universalEquipment.length > 0 && (
                  <>
                    <h4
                      id="universal-equipment"
                      className="muted"
                      style={{ marginTop: factionEquipment.length > 0 ? '1rem' : 0, marginBottom: '0.5rem' }}
                    >
                      Universal Equipment
                    </h4>
                    <div className="card-section-list">
                      {(() => {
                        // Create a map of action IDs to action definitions for quick lookup
                        const actionsMap = new Map()
                        if (equipmentActionsLoaded && Array.isArray(equipmentActions)) {
                          for (const action of equipmentActions) {
                            if (action && action.id) {
                              actionsMap.set(action.id, action)
                            }
                          }
                        }
                        
                        return universalEquipment.map((item, idx) => {
                          // Get the original equipment record to access actions
                          const equipmentRecord = universalEquipmentRecords.find(rec => {
                            const normalized = normaliseEquipment(rec)
                            return normalized && (normalized.id === item.id || normalized.anchorId === item.anchorId)
                          })
                          
                          // Get actions for this equipment item
                          const equipmentActionIds = Array.isArray(equipmentRecord?.actions) ? equipmentRecord.actions.filter(Boolean) : []
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
                            <div key={item.id || idx} id={item.anchorId} className="ability-card equipment-card">
                              <div className="ability-card-header">
                                <h4 className="ability-card-title">{item.name}</h4>
                                {item.cost && <span className="ability-card-ap">{item.cost}</span>}
                              </div>
                              {item.description && <RichText className="ability-card-body" text={item.description} />}
                              {(() => {
                                const effectsText = Array.isArray(equipmentRecord?.effects)
                                  ? equipmentRecord.effects.filter(Boolean).join(', ')
                                  : (equipmentRecord?.effects || '')
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
                                      <div key={`${item.id}-${action.id}-${actionIndex}`} id={`equipment-action-${item.id || item.anchorId}-${action.id}${actionIndex > 0 ? `-${actionIndex}` : ''}`} className="action-card" style={{ marginBottom: actionIndex < equipmentActionsList.length - 1 ? '1rem' : 0 }}>
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
                        })
                      })()}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="muted">No equipment listed.</div>
            )}
          </section>
        )
      case 'tac-ops':
        return (
          <section id="tac-ops" className="card killteam-tab-panel">
            <h3 style={{ marginTop: 0 }}>Tac Ops</h3>
            {renderTacOpsSection()}
          </section>
        )
      default:
        return null
    }
  }

    return (
      <>
        <Seo title={killteamTitle} description={seoDescription} type="article" />
        <div className="container">
          <Header />
          <div ref={selectorCardRef} className="card killteam-selector-sticky">
            <KillteamSelector
              currentKillteamId={killteam.killteamId}
              rightControl={
                sections.length > 0 ? (
                  <KillteamSectionNavigator
                    sections={sections}
                    activeSectionId={activeSectionId}
                    onSectionChange={setActiveSectionId}
                    showTabs={false}
                    dropdownVariant="icon"
                    className="section-navigator-compact"
                  />
                ) : null
              }
            />
            {sections.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <KillteamSectionNavigator
                  sections={sections}
                  activeSectionId={activeSectionId}
                  onSectionChange={setActiveSectionId}
                  showDropdown={false}
                />
              </div>
            )}
          </div>
          {sections.length > 0 && !isSelectorVisible && (
            <div className="section-navigator-floating">
              <KillteamSectionNavigator
                sections={sections}
                activeSectionId={activeSectionId}
                onSectionChange={setActiveSectionId}
                showTabs={false}
                dropdownVariant="icon"
                className="section-navigator-compact"
              />
            </div>
          )}
          {renderActiveSection()}
        </div>
      </>
    )
}
