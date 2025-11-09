import { db, getMeta, setMeta } from './db'
import { rebuildIndex } from './search'

const DATA_ROOT = '/data/v1/'

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

function mapOperativeRecord(factionId, op) {
  return {
    id: op.id,
    title: op.name,
    type: 'operative',
    factionId,
    tags: op.keywords || [],
    body: JSON.stringify(op),
    apl: op.apl,
    move: op.move,
    save: op.save,
    wounds: op.wounds,
    factionKeyword: op.factionKeyword || null,
    maxSelections: op.maxSelections ?? null
  }
}

function mapTextRecord(type, factionId, entry) {
  return {
    id: entry.id,
    title: entry.name || entry.title,
    type,
    factionId,
    body: entry.description || entry.body || '',
    tags: entry.tags || []
  }
}

async function loadArticlesFromManifest(manifest) {
  const articles = new Map()

  for (const entry of manifest.files) {
    const json = await fetchDatasetEntry(entry)

    if (entry.name.startsWith('rules')) {
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

    if (entry.name.startsWith('units')) {
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

    if (entry.name.startsWith('sequence')) {
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

    if (entry.name === 'factions.json') {
      for (const f of json || []) {
        addArticle(articles, {
          id: f.id,
          title: f.name,
          type: 'faction',
          tags: f.archetypes || [],
          body: f.summary || '',
          factionKeyword: f.factionKeyword || null,
          archetypes: f.archetypes || []
        })
      }
      continue
    }

    if (entry.name.startsWith('faction_')) {
      if (Array.isArray(json)) {
        for (const it of json) {
          addArticle(articles, {
            id: it.id,
            title: it.title || it.name,
            type: it.type,
            factionId: it.factionId,
            tags: it.tags || [],
            body: it.body || it.summary || ''
          })
        }
        continue
      }

      // New structure
      addArticle(articles, {
        id: json.id,
        title: json.name,
        type: 'faction',
        tags: json.archetypes || [],
        body: json.summary || '',
        factionKeyword: json.factionKeyword || null,
        archetypes: json.archetypes || []
      })

      for (const op of json.operatives || []) {
        addArticle(articles, mapOperativeRecord(json.id, op))
      }

      for (const rule of json.rules || []) {
        addArticle(articles, mapTextRecord('faction_rule', json.id, rule))
      }

      for (const ploy of json.strategicPloys || []) {
        addArticle(articles, mapTextRecord('strategic_ploy', json.id, ploy))
      }

      for (const ploy of json.tacticalPloys || []) {
        addArticle(articles, mapTextRecord('tactical_ploy', json.id, ploy))
      }

      for (const eq of json.equipment || []) {
        addArticle(articles, mapTextRecord('equipment', json.id, eq))
      }

      for (const tacop of json.tacops || []) {
        addArticle(articles, mapTextRecord('tacop', json.id, tacop))
      }
    }
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

async function refreshDataset(manifest) {
  const articles = await loadArticlesFromManifest(manifest)
  await persistArticles(articles)
  return articles.length
}

export async function checkForUpdates() {
  try {
    const manifest = await fetchManifest()
    const current = (await getMeta('dataset_version')) || null
    if (current === manifest.version) {
      return { updated: false, version: current }
    }

    await refreshDataset(manifest)
    await setMeta('dataset_version', manifest.version)
    await rebuildIndex()
    return { updated: true, version: manifest.version }
  } catch (e) {
    console.error(e)
    return { updated: false, error: String(e) }
  }
}

export async function forceUpdateAndReindex() {
  try {
    const manifest = await fetchManifest()
    await refreshDataset(manifest)
    await setMeta('dataset_version', `${manifest.version}`)
    await rebuildIndex()
    return { ok: true, version: manifest.version }
  } catch (e) {
    console.error(e)
    return { ok: false, error: String(e) }
  }
}
