// lib/search.js
import MiniSearch from 'minisearch'
import { db } from './db'

const INDEX_KEY = 'minisearch_v4'
let mini = null

function normaliseArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
}

function parseArchetypes(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean)
  return String(value)
    .split(/[\/,]/)
    .map(part => part.trim())
    .filter(Boolean)
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

  return docs
}

const UNIVERSAL_ACTIONS_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/universal_actions.json'
const MISSION_ACTIONS_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/mission_actions.json'
const WEAPON_RULES_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/weapon_rules.json'

let cachedUniversalActions = null
let cachedMissionActions = null
let cachedWeaponRules = null

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to load ${url} (${res.status})`)
  }
  return res.json()
}

async function buildSearchDocs() {
  const [articles, killteams, universalEquipment] = await Promise.all([
    db.articles.toArray(),
    db.killteams.toArray(),
    db.universalEquipment?.toArray?.() ?? []
  ])

  if (!cachedUniversalActions) {
    try {
      const json = await fetchJson(UNIVERSAL_ACTIONS_URL)
      cachedUniversalActions = Array.isArray(json?.actions) ? json.actions : []
    } catch (err) {
      console.warn('Failed to load universal actions for search index', err)
      cachedUniversalActions = []
    }
  }

  if (!cachedMissionActions) {
    try {
      const json = await fetchJson(MISSION_ACTIONS_URL)
      cachedMissionActions = Array.isArray(json?.actions) ? json.actions : []
    } catch (err) {
      console.warn('Failed to load mission actions for search index', err)
      cachedMissionActions = []
    }
  }

  if (!cachedWeaponRules) {
    try {
      const json = await fetchJson(WEAPON_RULES_URL)
      cachedWeaponRules = Array.isArray(json?.weapon_rules) ? json.weapon_rules : []
    } catch (err) {
      console.warn('Failed to load weapon rules for search index', err)
      cachedWeaponRules = []
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

  return Array.from(docsMap.values())
}

async function saveIndex(ms) {
  await db.index.put({ key: INDEX_KEY, serialized: JSON.stringify(ms.toJSON()) })
}

export async function ensureIndex() {
  if (mini) return mini

  const saved = await db.index.get(INDEX_KEY)
  if (saved?.serialized) {
    try {
      const jsonStr = typeof saved.serialized === 'string'
        ? saved.serialized
        : JSON.stringify(saved.serialized)
      mini = MiniSearch.loadJSON(jsonStr, {
        fields: ['title', 'body', 'tags', 'abbr', 'killteamName'],
        storeFields: ['id', 'title', 'type', 'tags', 'factionId', 'killteamId', 'killteamName', 'killteamDisplayName', 'anchorId']
      })
      return mini
    } catch (e) {
      console.warn('Failed to load stored index, rebuilding…', e)
      return await rebuildIndex()
    }
  }

  return await rebuildIndex()
}

export async function rebuildIndex() {
  mini = new MiniSearch({
    fields: ['title', 'body', 'tags', 'abbr', 'killteamName'],
    storeFields: ['id', 'title', 'type', 'tags', 'factionId', 'killteamId', 'killteamName', 'killteamDisplayName', 'anchorId']
  })

  const docs = await buildSearchDocs()
  if (docs.length) {
    mini.addAll(docs)
  }

  await saveIndex(mini)
  return mini
}

export async function getAllIndexedDocuments() {
  return buildSearchDocs()
}
