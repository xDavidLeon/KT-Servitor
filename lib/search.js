// lib/search.js
import MiniSearch from 'minisearch'
import { db } from './db'
import { getLocalePath, fetchWithLocaleFallback } from './update'

const INDEX_KEY = 'minisearch_v6'
let mini = null

export function isIndexReady() {
  return !!mini
}

const MINI_SEARCH_OPTIONS = {
  fields: ['title', 'body', 'tags', 'abbr', 'killteamName'],
  storeFields: ['id', 'title', 'type', 'tags', 'factionId', 'killteamId', 'killteamName', 'killteamDisplayName', 'anchorId']
}

let ensureIndexPromise = null
let rebuildIndexPromise = null

function normaliseArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
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
  const description = normaliseTextBlock(action.description)
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

function normaliseTextBlock(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map(item => normaliseTextBlock(item))
      .filter(Boolean)
      .join('\n\n')
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => {
        const text = normaliseTextBlock(val)
        if (!text) return ''
        return key ? `${key.toUpperCase()}\n${text}` : text
      })
      .filter(Boolean)
      .join('\n\n')
  }
  return String(value)
}

function parseArchetypes(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean)
  // Legacy support: if it's a string, treat it as a single archetype
  const trimmed = String(value).trim()
  return trimmed ? [trimmed] : []
}

function buildOperativeBody(op) {
  const sections = []
  const statBits = []
  if (op.MOVE) statBits.push(`MOVE ${op.MOVE}`)
  if (op.APL !== undefined && op.APL !== null) statBits.push(`APL ${op.APL}`)
  if (op.SAVE) statBits.push(`SAVE ${op.SAVE}`)
  if (op.WOUNDS !== undefined && op.WOUNDS !== null) statBits.push(`WOUNDS ${op.WOUNDS}`)
  if (statBits.length) sections.push(statBits.join(' · '))

  if (Array.isArray(op.abilities) && op.abilities.length) {
    const abilitiesText = op.abilities
      .map(ability => `${ability.abilityName}: ${ability.description}`)
      .join('\n')
    sections.push(abilitiesText)
  }

  if (Array.isArray(op.options) && op.options.length) {
    const optionsText = op.options
      .map(option => `${option.optionName}: ${option.description}`)
      .join('\n')
    sections.push(optionsText)
  }

  if (Array.isArray(op.weapons) && op.weapons.length) {
    const weaponText = op.weapons
      .map(weapon => {
        const type = weapon.wepType === 'R' ? 'Ranged' :
          weapon.wepType === 'M' ? 'Melee' :
          weapon.wepType === 'P' ? 'Psychic' :
          weapon.wepType === 'E' ? 'Equipment' :
          (weapon.wepType || '')

        const profiles = (weapon.profiles || []).map(profile => {
          const profileBits = []
          if (profile.profileName) profileBits.push(profile.profileName)
          if (profile.ATK) profileBits.push(`ATK ${profile.ATK}`)
          if (profile.HIT) profileBits.push(`HIT ${profile.HIT}`)
          if (profile.DMG) profileBits.push(`DMG ${profile.DMG}`)
          if (profile.WR) profileBits.push(profile.WR)
          return profileBits.join(' · ')
        }).join(' | ')

        return `${weapon.wepName || weapon.wepId}${type ? ` [${type}]` : ''}${profiles ? ` — ${profiles}` : ''}`
      })
      .join('\n')
    sections.push(weaponText)
  }

  return sections.join('\n\n')
}

function mapKillteamToDocs(killteam) {
  const docs = []
  const killteamId = killteam.killteamId
  const killteamName = killteam.killteamName
  const factionId = killteam.factionId || null
  const archetypes = parseArchetypes(killteam.archetypes)

  docs.push({
    id: `killteam:${killteamId}`,
    title: killteamName,
    type: 'killteam',
    tags: archetypes,
    body: [killteam.description, killteam.composition].filter(Boolean).join('\n\n'),
    killteamId,
    killteamName,
    factionId,
    anchorId: null,
    killteamDisplayName: killteamName
  })

  for (const op of killteam.opTypes || []) {
    docs.push({
      id: `op:${killteamId}:${op.opTypeId}`,
      title: op.opTypeName,
      type: 'operative',
      tags: normaliseArray(op.keywords),
      body: buildOperativeBody(op),
      killteamId,
      killteamName,
      factionId,
      anchorId: `operative-${op.opTypeId}`,
      killteamDisplayName: killteamName
    })
  }

  for (const ploy of killteam.ploys || []) {
    const type = ploy.ployType === 'S' ? 'strategic_ploy' : 'tactical_ploy'
    const tags = [type === 'strategic_ploy' ? 'Strategic' : 'Firefight']
    docs.push({
      id: `ploy:${killteamId}:${ploy.ployId}`,
      title: ploy.ployName,
      type,
      tags,
      body: ploy.description || '',
      killteamId,
      killteamName,
      factionId,
      anchorId: `ploy-${ploy.ployId}`,
      killteamDisplayName: killteamName
    })
  }

  for (const equipment of killteam.equipments || []) {
    docs.push({
      id: `eq:${killteamId}:${equipment.eqId}`,
      title: equipment.eqName,
      type: 'equipment',
      tags: normaliseArray(equipment.effects),
      body: equipment.description || '',
      killteamId,
      killteamName,
      factionId,
      anchorId: `equipment-${equipment.eqId}`,
      killteamDisplayName: killteamName
    })
  }

  // Add team-specific weapon rules
  for (const rule of killteam.weapon_rules || []) {
    if (!rule) continue
    const ruleId = rule.id || rule.name
    if (!ruleId) continue
    const title = rule.variable ? `${rule.name} (X)` : rule.name
    docs.push({
      id: `weapon_rule:${killteamId}:${ruleId}`,
      title: title || 'Weapon Rule',
      type: 'weapon_rule',
      tags: ['Weapon Rule'],
      body: rule.description || '',
      killteamId,
      killteamName,
      factionId,
      anchorId: `weapon-rule-${ruleId}`,
      killteamDisplayName: killteamName
    })
  }

  return docs
}


let cachedUniversalActions = null
let cachedMissionActions = null
let cachedWeaponRules = null
let cachedOperations = null
let cachedEquipmentActions = null

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to load ${url} (${res.status})`)
  }
  return res.json()
}

async function buildSearchDocs(locale = 'en') {
  const [articles, killteams, universalEquipment] = await Promise.all([
    db.articles.toArray(),
    db.killteams.toArray(),
    db.universalEquipment?.toArray?.() ?? []
  ])

  if (!cachedUniversalActions || !cachedMissionActions) {
    try {
      // Fetch universal_actions.json
      const res = await fetchWithLocaleFallback(locale, 'universal_actions.json')
      if (res.ok) {
        const json = await res.json()
        const allActions = Array.isArray(json?.actions) 
          ? json.actions 
          : Array.isArray(json?.universal_actions) 
            ? json.universal_actions 
            : []
        // Universal actions are all universal type
        if (!cachedUniversalActions) {
          cachedUniversalActions = allActions
        }
      } else {
        // File might not exist yet, use empty array
        console.warn('universal_actions.json not found, using empty universal actions')
        if (!cachedUniversalActions) cachedUniversalActions = []
      }
      // Mission actions are now loaded from packs/packs_actions.json
      if (!cachedMissionActions) {
        cachedMissionActions = []
      }
    } catch (err) {
      console.warn('Failed to load actions for search index', err)
      if (!cachedUniversalActions) cachedUniversalActions = []
      if (!cachedMissionActions) cachedMissionActions = []
    }
  }

  // Load packs actions (mission actions) if not already loaded
  if (!cachedMissionActions || cachedMissionActions.length === 0) {
    try {
      const res = await fetchWithLocaleFallback(locale, 'packs/packs_actions.json')
      if (res.ok) {
        const json = await res.json()
        const allPacksActions = Array.isArray(json?.actions) 
          ? json.actions 
          : Array.isArray(json?.mission_actions) 
            ? json.mission_actions 
            : []
        // Filter to only include actions with type === "mission"
        const packsActions = allPacksActions.filter(action => {
          const actionType = (action?.type || '').toLowerCase()
          return actionType === 'mission'
        })
        cachedMissionActions = packsActions
      } else {
        // File might not exist yet, use empty array
        console.warn('packs/packs_actions.json not found, using empty mission actions')
        if (!cachedMissionActions) cachedMissionActions = []
      }
    } catch (err) {
      console.warn('Failed to load packs actions for search index', err)
      if (!cachedMissionActions) cachedMissionActions = []
    }
  }

  if (!cachedWeaponRules) {
    try {
      const res = await fetchWithLocaleFallback(locale, 'weapon_rules.json')
      if (!res.ok) throw new Error(`Failed to load weapon rules (${res.status})`)
      const json = await res.json()
      cachedWeaponRules = Array.isArray(json?.weapon_rules) ? json.weapon_rules : []
    } catch (err) {
      console.warn('Failed to load weapon rules for search index', err)
      cachedWeaponRules = []
    }
  }

  if (!cachedOperations) {
    try {
      const res = await fetchWithLocaleFallback(locale, 'packs/ops_2025.json')
      if (res.ok) {
        const json = await res.json()
        const opsList = Array.isArray(json?.ops)
          ? json.ops
          : Array.isArray(json?.operations)
            ? json.operations
            : []
        const actionsList = Array.isArray(json?.actions) ? json.actions : []
        const actionMap = new Map()
        for (const actionDef of actionsList) {
          const normalised = normaliseActionDefinition(actionDef)
          if (normalised?.id) {
            actionMap.set(normalised.id, normalised)
          }
        }
        cachedOperations = { ops: opsList, actionMap }
      } else {
        // File might not exist yet, use empty data
        console.warn('packs/ops_2025.json not found, using empty operations')
        cachedOperations = { ops: [], actionMap: new Map() }
      }
    } catch (err) {
      console.warn('Failed to load operations for search index', err)
      cachedOperations = { ops: [], actionMap: new Map() }
    }
  }

  if (!cachedEquipmentActions) {
    try {
      const res = await fetchWithLocaleFallback(locale, 'universal_equipment.json')
      if (!res.ok) throw new Error(`Failed to load universal equipment (${res.status})`)
      const json = await res.json()
      // Equipment actions are in a root-level "actions" array
      cachedEquipmentActions = Array.isArray(json?.actions) ? json.actions : []
    } catch (err) {
      console.warn('Failed to load equipment actions for search index', err)
      cachedEquipmentActions = []
    }
  }

  const docsMap = new Map()

  function pushDoc(doc) {
    if (!doc || !doc.id) return
    const key = String(doc.id)
    if (!key) return
    docsMap.set(key, doc)
  }

  for (const article of articles) {
    pushDoc({
      ...article,
      tags: Array.isArray(article.tags) ? article.tags : normaliseArray(article.tags),
      abbr: article.abbr || '',
      killteamId: null,
      killteamName: null,
      anchorId: null,
      killteamDisplayName: null
    })
  }

  for (const killteam of killteams) {
    const killteamDocs = mapKillteamToDocs(killteam)
    for (const doc of killteamDocs) {
      pushDoc(doc)
    }
  }

  if (Array.isArray(universalEquipment) && universalEquipment.length) {
    for (const item of universalEquipment) {
      if (!item || !item.eqId) continue
      pushDoc({
        id: `eq:universal:${item.eqId}`,
        title: item.eqName || item.eqId,
        type: 'equipment',
        tags: normaliseArray(item.effects),
        body: item.description || '',
        killteamId: null,
        killteamName: null,
        factionId: null,
        anchorId: `equipment-${item.eqId}`,
        killteamDisplayName: null
      })
    }
  }

  if (Array.isArray(cachedUniversalActions) && cachedUniversalActions.length) {
    for (const action of cachedUniversalActions) {
      if (!action) continue
      const actionId = action.id || action.name
      if (!actionId) continue
      const effects = Array.isArray(action.effects) ? action.effects.filter(Boolean) : []
      const conditions = Array.isArray(action.conditions) ? action.conditions.filter(Boolean) : []
      const ap = action.AP ?? action.ap ?? null
      const segments = []
      if (action.description) segments.push(action.description)
      if (effects.length) {
        segments.push(`Effects:\n${effects.join('\n')}`)
      }
      if (conditions.length) {
        segments.push(`Conditions:\n${conditions.join('\n')}`)
      }
      pushDoc({
        id: `universal_action:${actionId}`,
        title: action.name || 'Unnamed Action',
        type: 'universal_action',
        tags: ['Universal Action'],
        body: segments.join('\n\n'),
        factionId: null,
        killteamId: null,
        killteamName: null,
        killteamDisplayName: null,
        anchorId: `universal-action-${actionId}`,
        apCost: ap
      })
    }
  }

  if (Array.isArray(cachedWeaponRules) && cachedWeaponRules.length) {
    for (const rule of cachedWeaponRules) {
      if (!rule) continue
      const ruleId = rule.id || rule.name
      if (!ruleId) continue
      const title = rule.variable ? `${rule.name} (X)` : rule.name
      pushDoc({
        id: `weapon_rule:${ruleId}`,
        title: title || 'Weapon Rule',
        type: 'weapon_rule',
        tags: ['Weapon Rule'],
        body: rule.description || '',
        factionId: null,
        killteamId: null,
        killteamName: null,
        killteamDisplayName: null,
        anchorId: `weapon-rule-${ruleId}`
      })
    }
  }

  if (Array.isArray(cachedMissionActions) && cachedMissionActions.length) {
    for (const action of cachedMissionActions) {
      if (!action) continue
      const actionId = action.id || action.name
      if (!actionId) continue
      const effects = Array.isArray(action.effects) ? action.effects.filter(Boolean) : []
      const conditions = Array.isArray(action.conditions) ? action.conditions.filter(Boolean) : []
      const packs = Array.isArray(action.packs) ? action.packs.filter(Boolean) : []
      const ap = action.AP ?? action.ap ?? null
      const segments = []
      if (action.description) segments.push(action.description)
      if (effects.length) {
        segments.push(`Effects:\n${effects.join('\n')}`)
      }
      if (conditions.length) {
        segments.push(`Conditions:\n${conditions.join('\n')}`)
      }
      if (packs.length) {
        segments.push(`Packs:\n${packs.join(', ')}`)
      }

      pushDoc({
        id: `mission_action:${actionId}`,
        title: action.name || 'Unnamed Action',
        type: 'mission_action',
        tags: ['Mission Action'],
        body: segments.join('\n\n'),
        factionId: null,
        killteamId: null,
        killteamName: null,
        killteamDisplayName: null,
        anchorId: `mission-action-${actionId}`,
        apCost: ap
      })
    }
  }

  // Index equipment actions from universal_equipment.json
  if (Array.isArray(cachedEquipmentActions) && cachedEquipmentActions.length) {
    for (const action of cachedEquipmentActions) {
      if (!action) continue
      const actionId = action.id || action.name
      if (!actionId) continue
      const actionType = (action.type || '').toLowerCase()
      const effects = Array.isArray(action.effects) ? action.effects.filter(Boolean) : []
      const conditions = Array.isArray(action.conditions) ? action.conditions.filter(Boolean) : []
      const packs = Array.isArray(action.packs) ? action.packs.filter(Boolean) : []
      const ap = action.AP ?? action.ap ?? null
      const segments = []
      if (action.description) segments.push(action.description)
      if (effects.length) {
        segments.push(`Effects:\n${effects.join('\n')}`)
      }
      if (conditions.length) {
        segments.push(`Conditions:\n${conditions.join('\n')}`)
      }
      if (packs.length) {
        segments.push(`Packs:\n${packs.join(', ')}`)
      }

      // Determine the type and anchor ID based on action type
      let docType = 'action'
      let anchorId = `action-${actionId}`
      let tags = ['Equipment Action']
      
      if (actionType === 'universal') {
        docType = 'universal_action'
        anchorId = `universal-action-${actionId}`
        tags = ['Universal Action', 'Equipment']
      } else if (actionType === 'mission') {
        docType = 'mission_action'
        anchorId = `mission-action-${actionId}`
        tags = ['Mission Action', 'Equipment']
      }

      pushDoc({
        id: `${docType}:equipment:${actionId}`,
        title: action.name || 'Unnamed Action',
        type: docType,
        tags,
        body: segments.join('\n\n'),
        factionId: null,
        killteamId: null,
        killteamName: null,
        killteamDisplayName: null,
        anchorId,
        apCost: ap
      })
    }
  }

  const operationsData = cachedOperations || { ops: [], actionMap: new Map() }
  const operationsList = Array.isArray(operationsData.ops) ? operationsData.ops : []
  const operationsActionMap = operationsData.actionMap instanceof Map ? operationsData.actionMap : new Map()

  if (operationsList.length) {
    for (const operation of operationsList) {
      if (!operation || !operation.id) continue
      const opId = operation.id
      const title = operation.title || 'Operation'
      const type = (operation.type || '').toLowerCase()
      const objective = normaliseTextBlock(operation.objective)
      const briefing = normaliseTextBlock(operation.briefing)
      const restrictions = normaliseTextBlock(operation.restrictions)
      const reveal = normaliseTextBlock(operation.reveal)
      const additionalRules = normaliseTextBlock(operation.additionalRules || operation.additionalRule)
      const victoryPoints = normaliseTextBlock(operation.victoryPoints)

      const actionRefs = Array.isArray(operation.actions) ? operation.actions : []
      const resolvedActions = actionRefs
        .map(actionRef => {
          if (typeof actionRef === 'string') {
            return operationsActionMap.get(actionRef) || normaliseActionDefinition(actionRef)
          }
          return normaliseActionDefinition(actionRef)
        })
        .filter(Boolean)

      const actionSegments = resolvedActions.map(action => {
        const actionTitle = action.name || action.id || 'Action'
        const pieces = [actionTitle]
        if (action.description) pieces.push(action.description)
        if (Array.isArray(action.effects) && action.effects.length) {
          pieces.push(`Effects: ${action.effects.join('\n')}`)
        }
        if (Array.isArray(action.conditions) && action.conditions.length) {
          pieces.push(`Conditions: ${action.conditions.join('\n')}`)
        }
        return pieces.filter(Boolean).join('\n')
      })

      const archetypes = Array.isArray(operation.archetype)
        ? operation.archetype.filter(Boolean)
        : operation.archetype
          ? [operation.archetype]
          : []
      const packs = Array.isArray(operation.packs)
        ? operation.packs.filter(Boolean)
        : operation.packs
          ? [operation.packs]
          : []

      const segments = []
      if (objective) segments.push(`Objective:\n${objective}`)
      if (briefing) segments.push(`Briefing:\n${briefing}`)
      if (restrictions) segments.push(`Restrictions:\n${restrictions}`)
      if (reveal) segments.push(`Reveal:\n${reveal}`)
      if (additionalRules) segments.push(`Additional Rules:\n${additionalRules}`)
      if (victoryPoints) segments.push(`Victory Points:\n${victoryPoints}`)
      if (actionSegments.length) segments.push(`Actions:\n${actionSegments.join('\n\n')}`)

      const tags = ['Operation']
      if (type === 'crit-op') {
        tags.push('Critical Operation')
      } else if (type === 'tac-op') {
        tags.push('Tactical Operation')
      }
      tags.push(...archetypes)
      tags.push(...packs)

      pushDoc({
        id: `operation:${opId}`,
        title,
        type: 'operation',
        tags,
        body: segments.join('\n\n'),
        factionId: null,
        killteamId: null,
        killteamName: null,
        killteamDisplayName: null,
        anchorId: `operation-${opId}`
      })
    }
  }

  return Array.from(docsMap.values())
}

async function saveIndex(ms) {
  await db.index.put({ key: INDEX_KEY, serialized: JSON.stringify(ms.toJSON()) })
}

export async function ensureIndex() {
  if (mini) return mini
  if (ensureIndexPromise) return ensureIndexPromise

  ensureIndexPromise = (async () => {
    const saved = await db.index.get(INDEX_KEY)
    if (saved?.serialized) {
      try {
        const jsonStr = typeof saved.serialized === 'string'
          ? saved.serialized
          : JSON.stringify(saved.serialized)
        const instance = MiniSearch.loadJSON(jsonStr, MINI_SEARCH_OPTIONS)
        mini = instance
        return instance
      } catch (e) {
        console.warn('Failed to load stored index, rebuilding…', e)
      }
    }

    return await rebuildIndex()
  })()

  try {
    return await ensureIndexPromise
  } finally {
    ensureIndexPromise = null
  }
}

export async function rebuildIndex() {
  if (rebuildIndexPromise) return rebuildIndexPromise

  rebuildIndexPromise = (async () => {
    const instance = new MiniSearch(MINI_SEARCH_OPTIONS)

    const docs = await buildSearchDocs()
    if (docs.length) {
      instance.addAll(docs)
    }

    mini = instance
    await saveIndex(instance)
    return instance
  })()

  try {
    return await rebuildIndexPromise
  } finally {
    rebuildIndexPromise = null
  }
}

export async function getAllIndexedDocuments() {
  return buildSearchDocs()
}
