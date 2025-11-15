import { db, getMeta, setMeta } from './db'
import { rebuildIndex } from './search'
import { updateVersionInfo } from './versioning'

const DATA_ROOT = '/data/v1/'
const KILLTEAM_JSON_BASE = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main'
const DEFAULT_LOCALE = 'en'

export function getLocalePath(locale, filename) {
  const normalizedLocale = locale || DEFAULT_LOCALE
  // All JSON files now live in locale-specific subfolders (/en/, /es/, /fr/, etc)
  return `${KILLTEAM_JSON_BASE}/${normalizedLocale}/${filename}`
}

/**
 * Fetches a JSON file with locale fallback to English
 * @param {string} locale - The locale to try first
 * @param {string} filename - The filename to fetch
 * @returns {Promise<Response>} - The fetch response
 */
export async function fetchWithLocaleFallback(locale, filename) {
  const normalizedLocale = locale || DEFAULT_LOCALE
  
  // Try locale-specific path first
  const localePath = getLocalePath(normalizedLocale, filename)
  const res = await fetch(localePath, { cache: 'no-store' })
  
  // If found or not 404, return the response
  if (res.ok || res.status !== 404) {
    return res
  }
  
  // If 404 and not English, try English fallback
  if (normalizedLocale !== DEFAULT_LOCALE) {
    const enPath = getLocalePath(DEFAULT_LOCALE, filename)
    const enRes = await fetch(enPath, { cache: 'no-store' })
    return enRes
  }
  
  // Return original 404 response if already English
  return res
}

const META_KEYS = {
  manifestVersion: 'manifest_version',
  killteamHash: (locale) => `killteam_dataset_hash_${locale || DEFAULT_LOCALE}`,
  universalEquipmentHash: (locale) => `universal_equipment_hash_${locale || DEFAULT_LOCALE}`,
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

async function loadArticlesFromManifest(manifest, locale = DEFAULT_LOCALE) {
  const articles = new Map()
  const files = Array.isArray(manifest?.files) ? manifest.files : []

  for (const entry of files) {
    const name = entry?.name || ''

    if (name.startsWith('sequence')) {
      // Load sequence.json from GitHub repo with locale-aware path
      try {
        const url = getLocalePath(locale, 'sequence.json')
        const res = await fetch(url, { cache: 'no-store' })
        if (res.ok) {
          const json = await res.json()
          for (const s of json || []) {
            addArticle(articles, {
              id: s.id,
              title: s.title,
              type: 'sequence_step',
              body: s.body,
              order: s.order || 0
            })
          }
        } else {
          // Fallback to local file if GitHub version doesn't exist
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
        }
      } catch (err) {
        console.warn('Failed to load sequence.json from GitHub, falling back to local', err)
        // Fallback to local file
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

async function refreshManifestData(manifest, locale = DEFAULT_LOCALE) {
  const articles = await loadArticlesFromManifest(manifest, locale)
  await persistArticles(articles)
  return articles.length
}

async function fetchKillteamFilesList(locale = DEFAULT_LOCALE, forceRefresh = false) {
  // Use GitHub API to list files in the teams directory
  // Use API proxy on client-side to avoid CORS issues on localhost
  // Cache the result to avoid rate limiting
  const cacheKey = `team_files_list_${locale}`
  const cacheTimestampKey = `team_files_list_timestamp_${locale}`
  const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds
  
  try {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh && typeof window !== 'undefined') {
      const cached = await getMeta(cacheKey)
      const cachedTimestamp = await getMeta(cacheTimestampKey)
      const now = Date.now()
      
      if (cached && Array.isArray(cached) && cachedTimestamp && (now - cachedTimestamp < CACHE_DURATION)) {
        console.log(`Using cached team files list for locale ${locale} (${cached.length} files)`)
        return { files: cached, usedFallback: false }
      }
    }
    
    const localePath = locale === 'en' ? 'en' : locale
    const isClient = typeof window !== 'undefined'
    
    // Use API proxy route on client-side (localhost), direct API on server-side
    let apiUrl = isClient 
      ? `/api/github-proxy?path=${encodeURIComponent(`${localePath}/teams`)}`
      : `https://api.github.com/repos/xDavidLeon/killteamjson/contents/${localePath}/teams`
    
    let res = await fetch(apiUrl, { 
      cache: 'no-store',
      headers: isClient ? {} : {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'KT-Servitor'
      }
    })
    let usedFallback = false
    
    // If 404 and not English, try English fallback
    if (!res.ok && res.status === 404 && locale !== DEFAULT_LOCALE) {
      console.warn(`Team files not found for locale ${locale}, falling back to English`)
      apiUrl = isClient
        ? `/api/github-proxy?path=${encodeURIComponent(`${DEFAULT_LOCALE}/teams`)}`
        : `https://api.github.com/repos/xDavidLeon/killteamjson/contents/${DEFAULT_LOCALE}/teams`
      res = await fetch(apiUrl, { 
        cache: 'no-store',
        headers: isClient ? {} : {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'KT-Servitor'
        }
      })
      usedFallback = true
    }
    
    if (!res.ok) {
      let errorData
      try {
        errorData = await res.json()
      } catch {
        try {
          errorData = { error: await res.text() }
        } catch {
          errorData = { error: 'Unknown error' }
        }
      }
      
      // If rate limited, try to use cached data
      if (res.status === 403 && errorData.message && errorData.message.includes('rate limit')) {
        console.warn(`GitHub API rate limit exceeded, trying cached data`)
        if (typeof window !== 'undefined') {
          const cached = await getMeta(cacheKey)
          if (cached && Array.isArray(cached) && cached.length > 0) {
            console.log(`Using cached team files list due to rate limit (${cached.length} files)`)
            return { files: cached, usedFallback: false }
          }
        }
      }
      
      console.error(`Failed to list team files (${res.status}) for locale ${locale}:`, errorData)
      return { files: [], usedFallback: false } // Return empty array instead of throwing
    }
    
    const files = await res.json()
    
    // Handle case where GitHub API returns an error object instead of array
    if (!Array.isArray(files)) {
      // Check if it's an error response from the proxy
      if (files.error) {
        console.error(`GitHub API proxy returned error:`, files)
        // Try cached data on error
        if (typeof window !== 'undefined') {
          const cached = await getMeta(cacheKey)
          if (cached && Array.isArray(cached) && cached.length > 0) {
            console.log(`Using cached team files list due to error (${cached.length} files)`)
            return { files: cached, usedFallback: false }
          }
        }
        return { files: [], usedFallback: false }
      }
      console.error(`GitHub API returned non-array response:`, files)
      return { files: [], usedFallback: false }
    }
    
    // Filter for .json files only
    const fileNames = files
      .filter(file => file && file.type === 'file' && file.name && file.name.endsWith('.json'))
      .map(file => file.name)
    
    // Cache the result
    if (typeof window !== 'undefined') {
      await setMeta(cacheKey, fileNames)
      await setMeta(cacheTimestampKey, Date.now())
    }
    
    console.log(`GitHub API returned ${files.length} items, ${fileNames.length} are JSON files`)
    return { files: fileNames, usedFallback }
  } catch (err) {
    console.error(`Error listing team files for locale ${locale}:`, err)
    // Try cached data on error
    if (typeof window !== 'undefined') {
      const cached = await getMeta(cacheKey)
      if (cached && Array.isArray(cached) && cached.length > 0) {
        console.log(`Using cached team files list due to error (${cached.length} files)`)
        return { files: cached, usedFallback: false }
      }
    }
    return { files: [], usedFallback: false } // Return empty array instead of throwing
  }
}

async function fetchKillteamDatasetText(locale = DEFAULT_LOCALE, forceRefresh = false) {
  // Fetch all individual team files and combine them
  try {
    const { files: teamFiles, usedFallback } = await fetchKillteamFilesList(locale, forceRefresh)
    console.log(`Found ${teamFiles.length} team files for locale ${locale}${usedFallback ? ' (using English fallback)' : ''}`)
    
    if (teamFiles.length === 0) {
      console.warn(`No team files found for locale ${locale}`)
      return JSON.stringify([])
    }
    
    // Use English path if we fell back to English in the listing
    const localePath = usedFallback ? DEFAULT_LOCALE : (locale === 'en' ? 'en' : locale)
    
    const teams = []
    
    for (const filename of teamFiles) {
      try {
        const url = `${KILLTEAM_JSON_BASE}/${localePath}/teams/${filename}`
        const res = await fetch(url, { cache: 'no-store' })
        if (res.ok) {
          const team = await res.json()
          // Handle both single team object and array of teams
          if (Array.isArray(team)) {
            teams.push(...team)
          } else if (team && typeof team === 'object') {
            teams.push(team)
          }
        } else {
          // Try English fallback for individual file if locale-specific fails
          if (res.status === 404 && localePath !== DEFAULT_LOCALE) {
            const enUrl = `${KILLTEAM_JSON_BASE}/${DEFAULT_LOCALE}/teams/${filename}`
            const enRes = await fetch(enUrl, { cache: 'no-store' })
            if (enRes.ok) {
              const team = await enRes.json()
              if (Array.isArray(team)) {
                teams.push(...team)
              } else if (team && typeof team === 'object') {
                teams.push(team)
              }
              continue
            }
          }
          console.warn(`Failed to load team file ${filename} (${res.status})`)
        }
      } catch (err) {
        console.warn(`Failed to load team file ${filename}:`, err)
      }
    }
    
    console.log(`Loaded ${teams.length} teams for locale ${locale}`)
    // Return as JSON string to maintain compatibility with existing hash/parse logic
    return JSON.stringify(teams)
  } catch (err) {
    console.warn(`Error fetching kill team dataset for locale ${locale}:`, err)
    // Return empty array as JSON string to allow app to continue working
    return JSON.stringify([])
  }
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

async function fetchUniversalEquipmentText(locale = DEFAULT_LOCALE) {
  try {
    const url = getLocalePath(locale, 'universal_equipment.json')
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.warn(`Failed to load universal equipment dataset (${res.status}) for locale ${locale}`)
      // Return empty array as JSON string to allow app to continue working
      return JSON.stringify([])
    }
    return res.text()
  } catch (err) {
    console.warn(`Error fetching universal equipment dataset for locale ${locale}:`, err)
    // Return empty array as JSON string to allow app to continue working
    return JSON.stringify([])
  }
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

async function ensureUniversalEquipmentData({ force = false, locale = DEFAULT_LOCALE } = {}) {
  try {
    // Check if locale has changed - if so, clear and force reload
    // Use a lock to prevent race conditions with ensureKillteamData
    const storedLocale = await getMeta('current_locale')
    if (storedLocale && storedLocale !== locale) {
      await db.universalEquipment.clear()
      force = true
    }
    // Only update locale if we're actually going to load data
    // This prevents race conditions where both functions update it

    const text = await fetchUniversalEquipmentText(locale)
    const hash = await hashText(text)
    const currentHash = await getMeta(META_KEYS.universalEquipmentHash(locale))

    if (!force && currentHash && currentHash === hash) {
      return { updated: false, hash }
    }

    const dataset = parseUniversalEquipment(text)
    // Only persist if we have records - empty array is valid (no equipment loaded)
    const count = dataset.length > 0 ? await persistUniversalEquipment(dataset) : 0
    await setMeta(META_KEYS.universalEquipmentHash(locale), hash)
    // Update locale after successful load to prevent race conditions
    await setMeta('current_locale', locale)

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('kt-universal-equipment-updated', { detail: { hash, count } }))
      } catch (err) {
        console.warn('Failed to dispatch universal equipment update event', err)
      }
    }

    return { updated: true, hash, count }
  } catch (err) {
    // Log error but don't throw - allow app to continue with cached data
    console.warn('Error ensuring universal equipment data:', err)
    throw err // Re-throw so checkForUpdates can handle it
  }
}

async function ensureManifestData(force = false, locale = DEFAULT_LOCALE) {
  const manifest = await fetchManifest()
  const manifestVersion = manifest?.version || null
  const localeKey = `manifest_version_${locale}`
  const currentVersion = await getMeta(localeKey)

  if (!force && currentVersion && manifestVersion && currentVersion === manifestVersion) {
    return { updated: false, version: manifestVersion }
  }

  await refreshManifestData(manifest, locale)
  if (manifestVersion) {
    await setMeta(localeKey, manifestVersion)
  }

  return { updated: true, version: manifestVersion }
}

async function ensureKillteamData({ force = false, locale = DEFAULT_LOCALE } = {}) {
  try {
    // Check if locale has changed - if so, clear and force reload
    // Only clear the table this function is responsible for
    const storedLocale = await getMeta('current_locale')
    if (storedLocale && storedLocale !== locale) {
      await db.killteams.clear()
      force = true
    }
    // Only update locale after successful load to prevent race conditions

    const text = await fetchKillteamDatasetText(locale, force)
    const hash = await hashText(text)
    const currentHash = await getMeta(META_KEYS.killteamHash(locale))

    if (!force && currentHash && currentHash === hash) {
      return { updated: false, hash }
    }

    const dataset = parseKillteamDataset(text)
    console.log(`Parsed ${dataset.length} team records from dataset`)
    
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
    console.log(`Filtered to ${killteamRecords.length} kill team records with killteamId`)
    
    // Debug: log sample record structure if we have records but they're being filtered out
    if (dataset.length > 0 && killteamRecords.length === 0) {
      console.warn(`All ${dataset.length} records were filtered out. Sample record:`, dataset[0])
      console.warn(`Sample record keys:`, dataset[0] ? Object.keys(dataset[0]) : 'no record')
      console.warn(`Sample record killteamId:`, dataset[0]?.killteamId)
    }
    
    // Only persist if we have records - empty array is valid (no teams loaded)
    if (killteamRecords.length > 0) {
      await persistKillteams(killteamRecords)
      console.log(`Persisted ${killteamRecords.length} kill teams to database`)
    } else {
      console.warn(`No kill team records to persist (all records missing killteamId?)`)
    }
    await setMeta(META_KEYS.killteamHash(locale), hash)
    // Update locale after successful load to prevent race conditions
    await setMeta('current_locale', locale)

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('kt-killteams-updated', { detail: { hash, count: killteamRecords.length } }))
      } catch (err) {
        console.warn('Failed to dispatch kill team update event', err)
      }
    }

    return { updated: true, hash, count: killteamRecords.length }
  } catch (err) {
    // Log error but don't throw - allow app to continue with cached data
    console.warn('Error ensuring kill team data:', err)
    throw err // Re-throw so checkForUpdates can handle it
  }
}

function buildVersion(manifestVersion, killteamHash, universalHash) {
  const parts = []
  if (manifestVersion) parts.push(manifestVersion)
  if (killteamHash) parts.push(killteamHash.slice(0, 12))
  if (universalHash) parts.push(universalHash.slice(0, 12))
  return parts.length ? parts.join('+') : null
}

export async function checkForUpdates(locale = DEFAULT_LOCALE) {
  const localeKey = `manifest_version_${locale}`
  const metaManifest = await getMeta(localeKey)
  const metaKillteamHash = await getMeta(META_KEYS.killteamHash(locale))
  const metaUniversalHash = await getMeta(META_KEYS.universalEquipmentHash(locale))
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
    const res = await ensureManifestData(false, locale)
    manifestUpdated = res.updated
    if (res.version) manifestVersion = res.version
  } catch (err) {
    manifestError = err
    console.warn('Manifest update failed', err)
    // Continue even if manifest fails
  }

  try {
    const res = await ensureKillteamData({ locale })
    killteamUpdated = res.updated
    if (res.hash) killteamHash = res.hash
  } catch (err) {
    killteamError = err
    console.warn('Kill team dataset update failed', err)
    // Continue even if kill team data fails - app can use cached data
  }

  try {
    const res = await ensureUniversalEquipmentData({ locale })
    universalUpdated = res.updated
    if (res.hash) universalHash = res.hash
  } catch (err) {
    universalError = err
    console.warn('Universal equipment dataset update failed', err)
    // Continue even if universal equipment fails - app can use cached data
  }

  const updated = manifestUpdated || killteamUpdated || universalUpdated

  if (updated) {
    try {
      await rebuildIndex()
    } catch (err) {
      console.warn('Failed to rebuild index', err)
      // Continue even if index rebuild fails
    }
  }

  const version = buildVersion(manifestVersion, killteamHash, universalHash)
  if (version) {
    try {
      // Use enhanced versioning system
      await updateVersionInfo(version, null)
    } catch (err) {
      console.warn('Failed to save dataset version', err)
    }
  }

  // Always return success - errors are logged but don't prevent app from working
  const response = { updated, version }

  // Include warnings if any errors occurred, but don't treat as fatal
  const errors = [manifestError, killteamError, universalError].filter(Boolean)
  if (errors.length) {
    response.warning = errors.map(err => err.message || String(err)).join(' | ')
  }

  return response
}

export async function forceUpdateAndReindex(locale = DEFAULT_LOCALE) {
  try {
    const manifestRes = await ensureManifestData(true, locale)
    const killteamRes = await ensureKillteamData({ force: true, locale })
    const universalRes = await ensureUniversalEquipmentData({ force: true, locale })

    await rebuildIndex()

    const version = buildVersion(manifestRes.version, killteamRes.hash, universalRes.hash)
    if (version) {
      // Use enhanced versioning system
      await updateVersionInfo(version, null)
    }

    return { ok: true, version }
  } catch (e) {
    console.error(e)
    return { ok: false, error: String(e.message || e) }
  }
}
