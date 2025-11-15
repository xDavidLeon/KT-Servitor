// lib/versioning.js
// Enhanced version tracking system

import { getMeta, setMeta } from './db'

export const VERSION_META_KEYS = {
  datasetVersion: 'dataset_version',
  lastUpdateCheck: 'last_update_check',
  lastUpdateTime: 'last_update_time',
  dataSourceCommit: 'data_source_commit',
  appVersion: 'app_version', // For app code version
  versionHistory: 'version_history' // Array of previous versions
}

/**
 * Get comprehensive version information
 */
export async function getVersionInfo() {
  const version = await getMeta(VERSION_META_KEYS.datasetVersion)
  const lastUpdate = await getMeta(VERSION_META_KEYS.lastUpdateTime)
  const commit = await getMeta(VERSION_META_KEYS.dataSourceCommit)
  const lastCheck = await getMeta(VERSION_META_KEYS.lastUpdateCheck)
  const history = await getMeta(VERSION_META_KEYS.versionHistory) || []
  
  return {
    version,
    lastUpdate: lastUpdate ? new Date(lastUpdate) : null,
    lastCheck: lastCheck ? new Date(lastCheck) : null,
    commit,
    history,
    formatted: formatVersion(version)
  }
}

/**
 * Format version string for display
 */
export function formatVersion(version) {
  if (!version) return 'Unknown'
  const [manifestPart, hashPart] = String(version).split('+')
  if (manifestPart && hashPart) {
    return `v${manifestPart} (${hashPart.slice(0, 8)})`
  }
  return `v${manifestPart || version}`
}

/**
 * Update version information
 */
export async function updateVersionInfo(version, commit = null) {
  const now = Date.now()
  
  // Get current version before updating
  const currentVersion = await getMeta(VERSION_META_KEYS.datasetVersion)
  
  // Store new version
  await setMeta(VERSION_META_KEYS.datasetVersion, version)
  await setMeta(VERSION_META_KEYS.lastUpdateTime, now)
  await setMeta(VERSION_META_KEYS.lastUpdateCheck, now)
  
  if (commit) {
    await setMeta(VERSION_META_KEYS.dataSourceCommit, commit)
  }
  
  // Add to history (keep last 10)
  const history = await getMeta(VERSION_META_KEYS.versionHistory) || []
  if (currentVersion && currentVersion !== version) {
    history.unshift({ 
      version: currentVersion, 
      timestamp: now,
      commit: await getMeta(VERSION_META_KEYS.dataSourceCommit)
    })
    await setMeta(VERSION_META_KEYS.versionHistory, history.slice(0, 10))
  }
  
  return {
    version,
    commit,
    timestamp: now,
    previousVersion: currentVersion
  }
}

/**
 * Get app version (from package.json or environment)
 */
export function getAppVersion() {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_VERSION) {
    return process.env.NEXT_PUBLIC_APP_VERSION
  }
  return '1.0.0' // Default fallback
}

/**
 * Compare two version strings
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0
  
  // Extract manifest version part (before +)
  const getManifestVersion = (v) => {
    const parts = String(v).split('+')
    return parts[0] || v
  }
  
  const m1 = getManifestVersion(v1)
  const m2 = getManifestVersion(v2)
  
  // Simple string comparison (can be enhanced for semantic versioning)
  if (m1 < m2) return -1
  if (m1 > m2) return 1
  return 0
}

