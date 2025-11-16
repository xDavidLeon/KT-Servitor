// lib/tierlist.js
const TIER_LIST_EMPTY_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/extra/tier_list.json'
const TIER_LIST_MERC_URL = 'https://raw.githubusercontent.com/xDavidLeon/killteamjson/main/extra/tier_list_merc.json'
const TIER_LIST_FALLBACK_URL = '/data/v1/tierlist.json'
const STORAGE_KEY_TIERLISTS = 'kt-servitor-tierlists'
const STORAGE_KEY_ACTIVE = 'kt-servitor-active-tierlist'

/**
 * Convert GitHub format (arrays of killteamIds) to internal format (arrays of killteamIds)
 * The new simplified format already matches internal format, but we handle legacy formats too
 */
export function convertGitHubFormatToInternal(githubData) {
  if (!githubData || !githubData.tiers) {
    return { version: '1.0.0', lastUpdated: new Date().toISOString(), source: 'Unknown', title: 'Untitled', tiers: {} }
  }

  const converted = {
    version: githubData.version || '1.0.0',
    lastUpdated: githubData.lastUpdated || new Date().toISOString(),
    source: githubData.source || 'Unknown',
    title: githubData.title || githubData.name || 'Untitled',
    tiers: {}
  }

  // Convert each tier - new format is already arrays of strings, but handle legacy formats
  for (const [tierName, tierData] of Object.entries(githubData.tiers)) {
    if (Array.isArray(tierData)) {
      // Check if it's legacy GitHub format (objects) or new simplified format (strings)
      if (tierData.length > 0 && typeof tierData[0] === 'object' && tierData[0].killteamId) {
        // Legacy format: array of objects with killteamId
        converted.tiers[tierName] = tierData.map(item => item.killteamId)
      } else {
        // New simplified format: already array of killteamId strings
        converted.tiers[tierName] = tierData
      }
    } else {
      converted.tiers[tierName] = []
    }
  }

  return converted
}

/**
 * Convert internal format to GitHub format (for export)
 * New simplified format: just arrays of killteamId strings
 */
export function convertInternalFormatToGitHub(internalData) {
  if (!internalData || !internalData.tiers) {
    return { version: '1.0.0', lastUpdated: new Date().toISOString(), source: 'Unknown', title: 'Untitled', tiers: {} }
  }

  const converted = {
    version: internalData.version || '1.0.0',
    lastUpdated: internalData.lastUpdated || new Date().toISOString(),
    source: internalData.source || 'Unknown',
    title: internalData.title || internalData.name || 'Untitled',
    tiers: {}
  }

  // Use tierOrder if available to maintain order, otherwise use Object.keys
  const tierOrder = internalData.tierOrder || Object.keys(internalData.tiers)
  
  // New simplified format: just arrays of killteamId strings
  // Iterate in order to preserve tier order in exported JSON
  for (const tierName of tierOrder) {
    const killteamIds = internalData.tiers[tierName]
    if (killteamIds !== undefined) {
      if (Array.isArray(killteamIds)) {
        converted.tiers[tierName] = killteamIds
      } else {
        converted.tiers[tierName] = []
      }
    }
  }
  
  // Also include any tiers that might not be in tierOrder (for backward compatibility)
  for (const [tierName, killteamIds] of Object.entries(internalData.tiers)) {
    if (!converted.tiers.hasOwnProperty(tierName)) {
      if (Array.isArray(killteamIds)) {
        converted.tiers[tierName] = killteamIds
      } else {
        converted.tiers[tierName] = []
      }
    }
  }

  return converted
}

/**
 * Load default (empty) tier list from GitHub or fallback
 */
export async function loadDefaultTierList() {
  try {
    // Try GitHub first
    const response = await fetch(TIER_LIST_EMPTY_URL, { cache: 'no-store' })
    if (response.ok) {
      const data = await response.json()
      return convertGitHubFormatToInternal(data)
    }
  } catch (err) {
    console.warn('Failed to load tier list from GitHub, trying fallback', err)
  }

  // Fallback to local file
  try {
    const response = await fetch(TIER_LIST_FALLBACK_URL, { cache: 'no-store' })
    if (response.ok) {
      const data = await response.json()
      return convertGitHubFormatToInternal(data)
    }
  } catch (err) {
    console.warn('Failed to load tier list from fallback', err)
  }

  // Return empty tier list if both fail
  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    source: 'Empty',
    title: 'Empty Tier List',
    tiers: {
      S: [],
      A: [],
      B: [],
      C: [],
      D: []
    }
  }
}

/**
 * Load Mercenarios tier list from GitHub
 */
export async function loadMercTierList() {
  try {
    const response = await fetch(TIER_LIST_MERC_URL, { cache: 'no-store' })
    if (response.ok) {
      const data = await response.json()
      return convertGitHubFormatToInternal(data)
    }
  } catch (err) {
    console.warn('Failed to load merc tier list from GitHub', err)
  }

  // Return null if failed
  return null
}

/**
 * Get all saved tier lists from localStorage
 */
export function getSavedTierLists() {
  if (typeof window === 'undefined') return { tierLists: {}, activeTierListId: null }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TIERLISTS)
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE)
    
    if (stored) {
      const parsed = JSON.parse(stored)
      const tierLists = parsed.tierLists || {}
      
      // Clean up duplicate "Untitled" tier lists (keep only the most recent one)
      const untitledLists = Object.entries(tierLists).filter(([id, list]) => 
        (list.title === 'Untitled' || list.name === 'Untitled') && id !== 'default'
      )
      
      if (untitledLists.length > 1) {
        // Sort by createdAt (newest first) and keep only the first one
        untitledLists.sort((a, b) => {
          const dateA = new Date(a[1].createdAt || 0).getTime()
          const dateB = new Date(b[1].createdAt || 0).getTime()
          return dateB - dateA
        })
        
        // Remove all but the first untitled list
        for (let i = 1; i < untitledLists.length; i++) {
          delete tierLists[untitledLists[i][0]]
        }
        
        // Save cleaned up tier lists
        saveTierLists(tierLists, activeId || 'default')
      }
      
      return {
        tierLists,
        activeTierListId: activeId || 'default'
      }
    }
  } catch (err) {
    console.warn('Failed to load saved tier lists', err)
  }

  return { tierLists: {}, activeTierListId: null }
}

/**
 * Save tier lists to localStorage
 */
export function saveTierLists(tierLists, activeTierListId) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY_TIERLISTS, JSON.stringify({ tierLists }))
    if (activeTierListId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, activeTierListId)
    }
  } catch (err) {
    console.warn('Failed to save tier lists', err)
  }
}

/**
 * Get a specific tier list by ID
 */
export function getTierList(tierListId) {
  const { tierLists } = getSavedTierLists()
  return tierLists[tierListId] || null
}

/**
 * Save a tier list
 */
export function saveTierList(tierListId, tierListData) {
  const { tierLists, activeTierListId } = getSavedTierLists()
  
  // Don't allow saving changes to read-only tier lists
  if (tierLists[tierListId]?.isReadOnly) {
    return false
  }
  
  tierLists[tierListId] = {
    ...tierListData,
    updatedAt: new Date().toISOString()
  }

  saveTierLists(tierLists, activeTierListId)
  return true
}

/**
 * Create a new tier list
 */
export function createTierList(name, baseTierList = null, useDefaultId = false, isReadOnly = false, fixedId = null) {
  const { tierLists } = getSavedTierLists()
  const newId = fixedId || (useDefaultId ? 'default' : `custom-${Date.now()}`)
  
  // If using a fixed ID and it already exists, return it instead of creating a new one
  if ((useDefaultId || fixedId) && tierLists[newId]) {
    return newId
  }
  
  const newTierList = baseTierList || {
    name,
    title: name,
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    source: 'User Created',
    tiers: {
      S: [],
      A: [],
      B: [],
      C: [],
      D: []
    },
    createdAt: new Date().toISOString()
  }

  tierLists[newId] = {
    ...newTierList,
    name,
    title: newTierList.title || newTierList.name || name,
    createdAt: newTierList.createdAt || new Date().toISOString(),
    isReadOnly: isReadOnly || false
  }

  saveTierLists(tierLists, newId)
  return newId
}

/**
 * Delete a tier list
 */
export function deleteTierList(tierListId) {
  const { tierLists, activeTierListId } = getSavedTierLists()
  
  if (tierListId === 'default' || tierListId === 'merc') {
    // Don't allow deleting default or merc (read-only lists)
    return false
  }

  // Don't allow deleting read-only lists
  if (tierLists[tierListId]?.isReadOnly) {
    return false
  }

  delete tierLists[tierListId]
  
  // If deleting active tier list, switch to default
  const newActiveId = activeTierListId === tierListId ? 'default' : activeTierListId
  
  saveTierLists(tierLists, newActiveId)
  return true
}

/**
 * Rename a tier list
 */
export function renameTierList(tierListId, newName) {
  const { tierLists } = getSavedTierLists()
  
  if (tierLists[tierListId]) {
    tierLists[tierListId].name = newName
    tierLists[tierListId].title = newName
    tierLists[tierListId].updatedAt = new Date().toISOString()
    saveTierLists(tierLists, getSavedTierLists().activeTierListId)
    return true
  }
  
  return false
}

/**
 * Set active tier list
 */
export function setActiveTierList(tierListId) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_ACTIVE, tierListId)
}

/**
 * Get active tier list
 */
export function getActiveTierList() {
  const { tierLists, activeTierListId } = getSavedTierLists()
  const id = activeTierListId || 'default'
  return tierLists[id] || null
}

/**
 * Validate tier list JSON structure
 */
export function validateTierListJson(json) {
  if (!json || typeof json !== 'object') {
    return { valid: false, error: 'Invalid JSON structure' }
  }

  // Check if it's GitHub format or internal format
  if (json.tiers && typeof json.tiers === 'object') {
    // Validate that tiers is an object with arrays
    for (const [tierName, tierData] of Object.entries(json.tiers)) {
      if (!Array.isArray(tierData)) {
        return { valid: false, error: `Tier "${tierName}" must be an array` }
      }
      
      // Check format - new simplified format is arrays of strings
      if (tierData.length > 0) {
        const firstItem = tierData[0]
        if (typeof firstItem === 'object' && firstItem.killteamId) {
          // Legacy GitHub format - validate all items are objects with killteamId
          for (const item of tierData) {
            if (!item || typeof item !== 'object' || !item.killteamId) {
              return { valid: false, error: 'Invalid tier list item structure (legacy format)' }
            }
          }
        } else if (typeof firstItem === 'string') {
          // New simplified format: all items should be strings
          for (const item of tierData) {
            if (typeof item !== 'string') {
              return { valid: false, error: 'All tier items must be killteamId strings' }
            }
          }
        } else {
          return { valid: false, error: 'Tier items must be killteamId strings (or objects in legacy format)' }
        }
      }
    }
    
    return { valid: true }
  }

  return { valid: false, error: 'Missing "tiers" property' }
}

/**
 * Import tier list from JSON string
 */
export function importTierListFromJson(jsonString, name = 'Imported Tier List') {
  try {
    const json = JSON.parse(jsonString)
    const validation = validateTierListJson(json)
    
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Convert to internal format if needed
    const internalFormat = convertGitHubFormatToInternal(json)
    
    // Create new tier list
    const tierListId = createTierList(name, {
      ...internalFormat,
      name,
      source: json.source || 'Imported'
    })

    return { success: true, tierListId }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Export tier list to JSON string (GitHub format)
 */
export function exportTierListToJson(tierListId) {
  const tierList = getTierList(tierListId)
  
  if (!tierList) {
    return null
  }

  // Convert to GitHub format for export
  const githubFormat = convertInternalFormatToGitHub(tierList)
  return JSON.stringify(githubFormat, null, 2)
}

