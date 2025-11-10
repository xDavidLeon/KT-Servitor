import { db, getMeta, setMeta } from './db'
import { rebuildIndex } from './search'

const DATA_ROOT = '/data/v1/'
const KILLTEAM_JSON_URL = 'https://raw.githubusercontent.com/vjosset/killteamjson/main/kt24_v4.json'

const META_KEYS = {
  manifestVersion: 'manifest_version',
  killteamHash: 'killteam_dataset_hash',
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

    if (name.startsWith('rules')) {
      const json = await fetchDatasetEntry(entry)
      for (const r of json || []) {
        addArticle(articles, {
          id: r.id,
          title: r.title,
          type: 'rule',
          tags: r.tags || [],
          body: r.body,
          abbr: r.abbr || ''
        })
      }
      continue
    }

    if (name.startsWith('units')) {
      const json = await fetchDatasetEntry(entry)
      for (const u of json || []) {
        addArticle(articles, {
          id: u.id,
          title: u.name,
          type: 'unit',
          tags: u.keywords || [],
          body: u.summary || '',
          abbr: u.abbr || ''
        })
      }
      continue
    }

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
  await persistKillteams(dataset)
  await setMeta(META_KEYS.killteamHash, hash)

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('kt-killteams-updated', { detail: { hash, count: dataset.length } }))
    } catch (err) {
      console.warn('Failed to dispatch kill team update event', err)
    }
  }

  return { updated: true, hash, count: dataset.length }
}

function buildVersion(manifestVersion, killteamHash) {
  const parts = []
  if (manifestVersion) parts.push(manifestVersion)
  if (killteamHash) parts.push(killteamHash.slice(0, 12))
  return parts.length ? parts.join('+') : null
}

export async function checkForUpdates() {
  const metaManifest = await getMeta(META_KEYS.manifestVersion)
  const metaKillteamHash = await getMeta(META_KEYS.killteamHash)
  let manifestVersion = metaManifest || null
  let killteamHash = metaKillteamHash || null

  let manifestUpdated = false
  let killteamUpdated = false
  let manifestError = null
  let killteamError = null

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

  const updated = manifestUpdated || killteamUpdated

  if (updated) {
    await rebuildIndex()
  }

  const version = buildVersion(manifestVersion, killteamHash)
  if (version) {
    await setMeta(META_KEYS.datasetVersion, version)
  }

  if (manifestError && killteamError) {
    return {
      updated: false,
      error: `${manifestError.message || manifestError} | ${killteamError.message || killteamError}`
    }
  }

  const response = { updated, version }

  if (manifestError || killteamError) {
    response.warning = (killteamError || manifestError)?.message || String(killteamError || manifestError)
  }

  return response
}

export async function forceUpdateAndReindex() {
  try {
    const manifestRes = await ensureManifestData(true)
    const killteamRes = await ensureKillteamData({ force: true })

    await rebuildIndex()

    const version = buildVersion(manifestRes.version, killteamRes.hash)
    if (version) {
      await setMeta(META_KEYS.datasetVersion, version)
    }

    return { ok: true, version }
  } catch (e) {
    console.error(e)
    return { ok: false, error: String(e.message || e) }
  }
}
