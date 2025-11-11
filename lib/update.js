import { db, getMeta, setMeta } from './db'
import { rebuildIndex } from './search'

const DATA_ROOT = '/data/v1/'
const KILLTEAM_JSON_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/teams.json'
const UNIVERSAL_EQUIPMENT_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/universal_equipment.json'

const META_KEYS = {
  manifestVersion: 'manifest_version',
  killteamHash: 'killteam_dataset_hash',
  universalEquipmentHash: 'universal_equipment_hash',
  datasetVersion: 'dataset_version'
}

async function hashText(text) {
  const enc = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function fetchManifest() {
  const res = await fetch(`${DATA_ROOT}manifest.json`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to load manifest (${res.status})`)
  }
  return res.json()
}

async function fetchDatasetEntry(entry) {
  const res = await fetch(`${DATA_ROOT}${entry.name}`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to load ${entry.name} (${res.status})`)
  }
  const txt = await res.text()

  const expected = (entry.sha256 || '').trim()
  if (expected) {
    const actual = await hashText(txt)
    if (actual !== expected) {
      console.warn('Hash mismatch for', entry.name)
    }
  }

  try {
    return JSON.parse(txt)
  } catch (err) {
    throw new Error(`Failed to parse ${entry.name}: ${err.message}`)
  }
}

function addArticle(articlesMap, record) {
  if (!record || !record.id) return

  const normalised = { ...record }
  if (!Array.isArray(normalised.tags)) {
    normalised.tags = normalised.tags ? [].concat(normalised.tags) : []
  }
  if (normalised.body === undefined || normalised.body === null) {
    normalised.body = ''
  }
  if (typeof normalised.body !== 'string') {
    normalised.body = String(normalised.body)
  }
  articlesMap.set(normalised.id, normalised)
}

async function loadArticlesFromManifest(manifest) {
  const articles = new Map()
  const files = Array.isArray(manifest?.files) ? manifest.files : []

  for (const entry of files) {
    const name = entry?.name || ''

    if (name.startsWith('sequence')) {
      const json = await fetchDatasetEntry(entry)
      for (const s of json || []) {
        addArticle(articles, {
          id: s.id,
          title: s.title,
          type: 'sequence_step',
          body: s.body,
          order: s.order || 0
        })
      }
      continue
    }

    // Explicitly ignore legacy faction-based data; superseded by killteamjson dataset.
  }

  return Array.from(articles.values())
}

async function persistArticles(articles) {
  await db.transaction('rw', db.articles, db.index, async () => {
    await db.articles.clear()
    await db.index.clear()
    if (articles.length) {
      await db.articles.bulkPut(articles)
    }
  })
}

async function refreshManifestData(manifest) {
  const articles = await loadArticlesFromManifest(manifest)
  await persistArticles(articles)
  return articles.length
}

async function fetchKillteamDatasetText() {
  const res = await fetch(KILLTEAM_JSON_URL, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to load kill team dataset (${res.status})`)
  }
  return res.text()
}

function parseKillteamDataset(text) {
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) {
      throw new Error('Unexpected dataset shape (expected array)')
    }
    return parsed
  } catch (err) {
    throw new Error(`Failed to parse kill team dataset: ${err.message}`)
  }
}

async function persistKillteams(records) {
  await db.transaction('rw', db.killteams, async () => {
    await db.killteams.clear()
    if (records.length) {
      await db.killteams.bulkPut(records.map(rec => ({
        ...rec,
        killteamId: rec.killteamId,
        killteamName: rec.killteamName
      })))
    }
  })
}

async function fetchUniversalEquipmentText() {
  const res = await fetch(UNIVERSAL_EQUIPMENT_URL, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to load universal equipment dataset (${res.status})`)
  }
  return res.text()
}

function parseUniversalEquipment(text) {
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      if (parsed.length === 1 && parsed[0] && Array.isArray(parsed[0].equipments)) {
        return parsed[0].equipments
      }
      if (parsed.every(item => item && typeof item === 'object')) {
        return parsed
      }
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.equipments)) {
      return parsed.equipments
    }
    throw new Error('Unexpected universal equipment dataset shape (expected array or object with equipments)')
  } catch (err) {
    throw new Error(`Failed to parse universal equipment dataset: ${err.message}`)
  }
}

async function persistUniversalEquipment(records) {
  const normalised = (records || [])
    .map(record => {
      if (!record || (!record.eqId && !record.id)) return null
      const eqId = record.eqId || record.id
      return {
        ...record,
        eqId,
        killteamId: record.killteamId ?? null
      }
    })
    .filter(Boolean)

  await db.transaction('rw', db.universalEquipment, async () => {
    await db.universalEquipment.clear()
    if (normalised.length) {
      await db.universalEquipment.bulkPut(normalised)
    }
  })

  return normalised.length
}

async function ensureUniversalEquipmentData({ force = false } = {}) {
  const text = await fetchUniversalEquipmentText()
  const hash = await hashText(text)
  const currentHash = await getMeta(META_KEYS.universalEquipmentHash)

  if (!force && currentHash && currentHash === hash) {
    return { updated: false, hash }
  }

  const dataset = parseUniversalEquipment(text)
  const count = await persistUniversalEquipment(dataset)
  await setMeta(META_KEYS.universalEquipmentHash, hash)

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('kt-universal-equipment-updated', { detail: { hash, count } }))
    } catch (err) {
      console.warn('Failed to dispatch universal equipment update event', err)
    }
  }

  return { updated: true, hash, count }
}

async function ensureManifestData(force = false) {
  const manifest = await fetchManifest()
  const manifestVersion = manifest?.version || null
  const currentVersion = await getMeta(META_KEYS.manifestVersion)

  if (!force && currentVersion && manifestVersion && currentVersion === manifestVersion) {
    return { updated: false, version: manifestVersion }
  }

  await refreshManifestData(manifest)
  if (manifestVersion) {
    await setMeta(META_KEYS.manifestVersion, manifestVersion)
  }

  return { updated: true, version: manifestVersion }
}

async function ensureKillteamData({ force = false } = {}) {
  const text = await fetchKillteamDatasetText()
  const hash = await hashText(text)
  const currentHash = await getMeta(META_KEYS.killteamHash)

  if (!force && currentHash && currentHash === hash) {
    return { updated: false, hash }
  }

  const dataset = parseKillteamDataset(text)
  const filteredDataset = dataset.map(record => {
    if (!Array.isArray(record?.equipments)) {
      return record
    }
    const filteredEquipments = record.equipments.filter(eq => eq && eq.killteamId !== null)
    if (filteredEquipments.length === record.equipments.length) {
      return record
    }
    return {
      ...record,
      equipments: filteredEquipments
    }
  })
  const killteamRecords = filteredDataset.filter(record => record && record.killteamId)
  await persistKillteams(killteamRecords)
  await setMeta(META_KEYS.killteamHash, hash)

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('kt-killteams-updated', { detail: { hash, count: killteamRecords.length } }))
    } catch (err) {
      console.warn('Failed to dispatch kill team update event', err)
    }
  }

  return { updated: true, hash, count: killteamRecords.length }
}

function buildVersion(manifestVersion, killteamHash, universalHash) {
  const parts = []
  if (manifestVersion) parts.push(manifestVersion)
  if (killteamHash) parts.push(killteamHash.slice(0, 12))
  if (universalHash) parts.push(universalHash.slice(0, 12))
  return parts.length ? parts.join('+') : null
}

export async function checkForUpdates() {
  const metaManifest = await getMeta(META_KEYS.manifestVersion)
  const metaKillteamHash = await getMeta(META_KEYS.killteamHash)
  const metaUniversalHash = await getMeta(META_KEYS.universalEquipmentHash)
  let manifestVersion = metaManifest || null
  let killteamHash = metaKillteamHash || null
  let universalHash = metaUniversalHash || null

  let manifestUpdated = false
  let killteamUpdated = false
  let universalUpdated = false
  let manifestError = null
  let killteamError = null
  let universalError = null

  try {
    const res = await ensureManifestData()
    manifestUpdated = res.updated
    if (res.version) manifestVersion = res.version
  } catch (err) {
    manifestError = err
    console.error('Manifest update failed', err)
  }

  try {
    const res = await ensureKillteamData()
    killteamUpdated = res.updated
    if (res.hash) killteamHash = res.hash
  } catch (err) {
    killteamError = err
    console.error('Kill team dataset update failed', err)
  }

  try {
    const res = await ensureUniversalEquipmentData()
    universalUpdated = res.updated
    if (res.hash) universalHash = res.hash
  } catch (err) {
    universalError = err
    console.error('Universal equipment dataset update failed', err)
  }

  const updated = manifestUpdated || killteamUpdated || universalUpdated

  if (updated) {
    await rebuildIndex()
  }

  const version = buildVersion(manifestVersion, killteamHash, universalHash)
  if (version) {
    await setMeta(META_KEYS.datasetVersion, version)
  }

  const errors = [manifestError, killteamError, universalError].filter(Boolean)

  if (errors.length === 3) {
    return {
      updated: false,
      error: errors.map(err => err.message || String(err)).join(' | ')
    }
  }

  const response = { updated, version }

  if (errors.length) {
    response.warning = errors.map(err => err.message || String(err)).join(' | ')
  }

  return response
}

export async function forceUpdateAndReindex() {
  try {
    const manifestRes = await ensureManifestData(true)
    const killteamRes = await ensureKillteamData({ force: true })
    const universalRes = await ensureUniversalEquipmentData({ force: true })

    await rebuildIndex()

    const version = buildVersion(manifestRes.version, killteamRes.hash, universalRes.hash)
    if (version) {
      await setMeta(META_KEYS.datasetVersion, version)
    }

    return { ok: true, version }
  } catch (e) {
    console.error(e)
    return { ok: false, error: String(e.message || e) }
  }
}
