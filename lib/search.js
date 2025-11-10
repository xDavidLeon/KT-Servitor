// lib/search.js
import MiniSearch from 'minisearch'
import { db } from './db'

const INDEX_KEY = 'minisearch_v3'
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

async function buildSearchDocs() {
  const [articles, killteams] = await Promise.all([
    db.articles.toArray(),
    db.killteams.toArray()
  ])

  const docs = []

  docs.push(...articles.map(article => ({
    ...article,
    tags: Array.isArray(article.tags) ? article.tags : normaliseArray(article.tags),
    abbr: article.abbr || '',
    killteamId: null,
    killteamName: null,
    anchorId: null,
    killteamDisplayName: null
  })))

  for (const killteam of killteams) {
    docs.push(...mapKillteamToDocs(killteam))
  }

  return docs
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
        storeFields: ['id', 'title', 'type', 'tags', 'factionId', 'killteamId', 'killteamName', 'anchorId']
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
    storeFields: ['id', 'title', 'type', 'tags', 'factionId', 'killteamId', 'killteamName', 'anchorId']
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
