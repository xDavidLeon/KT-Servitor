// lib/changelog.js
// Changelog management with GitHub integration

import { getMeta, setMeta } from './db'

const CHANGELOG_CACHE_KEY = 'changelog_cache'
const CHANGELOG_CACHE_TIMESTAMP = 'changelog_cache_timestamp'
const LAST_VIEWED_VERSION_KEY = 'last_viewed_changelog_version'
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

const GITHUB_REPO = 'xDavidLeon/killteamjson'
const GITHUB_API_BASE = 'https://api.github.com'

/**
 * Fetch commits from GitHub repository
 */
async function fetchGitHubCommits(limit = 50) {
  try {
    const isClient = typeof window !== 'undefined'
    const apiUrl = isClient
      ? `/api/github-proxy?path=${encodeURIComponent(`repos/${GITHUB_REPO}/commits`)}&limit=${limit}`
      : `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/commits?per_page=${limit}`
    
    const headers = isClient ? {} : {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'KT-Servitor'
    }
    
    // Add GitHub token if available (server-side only)
    if (!isClient && typeof process !== 'undefined' && process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`
    }
    
    const res = await fetch(apiUrl, {
      cache: 'no-store',
      headers
    })
    
    if (!res.ok) {
      console.warn(`Failed to fetch GitHub commits: ${res.status}`)
      return null
    }
    
    const commits = await res.json()
    
    // Handle case where GitHub API returns an error object
    if (!Array.isArray(commits)) {
      if (commits.message) {
        console.warn(`GitHub API error: ${commits.message}`)
      }
      return null
    }
    
    return commits
  } catch (err) {
    console.warn('Error fetching GitHub commits:', err)
    return null
  }
}

/**
 * Parse commit message to extract changelog entry
 */
function parseCommitMessage(commit) {
  const message = commit.commit?.message || ''
  const author = commit.commit?.author?.name || 'Unknown'
  const date = commit.commit?.author?.date || commit.commit?.committer?.date
  const sha = commit.sha || ''
  
  // Categorize commit by message patterns
  let type = 'changed'
  let category = 'general'
  let description = message.split('\n')[0] // First line only
  
  // Remove common prefixes
  description = description
    .replace(/^(feat|feature|add|added):\s*/i, '')
    .replace(/^(fix|fixed|bugfix):\s*/i, '')
    .replace(/^(update|updated|change|changed):\s*/i, '')
    .replace(/^(remove|removed|delete|deleted):\s*/i, '')
    .replace(/^(refactor|refactored):\s*/i, '')
  
  // Determine type
  const lowerMessage = message.toLowerCase()
  if (lowerMessage.match(/^(feat|feature|add|added):/i)) {
    type = 'added'
  } else if (lowerMessage.match(/^(fix|fixed|bugfix|bug):/i)) {
    type = 'fixed'
  } else if (lowerMessage.match(/^(remove|removed|delete|deleted):/i)) {
    type = 'removed'
  } else if (lowerMessage.match(/^(update|updated|change|changed|refactor):/i)) {
    type = 'changed'
  }
  
  // Determine category
  if (lowerMessage.includes('killteam') || lowerMessage.includes('team') || lowerMessage.includes('operative')) {
    category = 'killteams'
  } else if (lowerMessage.includes('weapon') || lowerMessage.includes('rule')) {
    category = 'rules'
  } else if (lowerMessage.includes('equipment')) {
    category = 'equipment'
  } else if (lowerMessage.includes('action') || lowerMessage.includes('ability')) {
    category = 'actions'
  } else if (lowerMessage.includes('tac op') || lowerMessage.includes('tacop')) {
    category = 'tacops'
  } else if (lowerMessage.includes('locale') || lowerMessage.includes('translation') || lowerMessage.includes('i18n')) {
    category = 'localization'
  }
  
  return {
    type,
    category,
    description: description.trim() || message.split('\n')[0].trim(),
    author,
    date: date ? new Date(date) : new Date(),
    sha: sha.slice(0, 8)
  }
}

/**
 * Build changelog from GitHub commits
 */
async function buildChangelogFromCommits(commits) {
  if (!commits || !Array.isArray(commits)) return []
  
  // Group commits by date (same day)
  const grouped = new Map()
  
  for (const commit of commits) {
    const entry = parseCommitMessage(commit)
    const dateKey = entry.date.toISOString().split('T')[0] // YYYY-MM-DD
    
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, {
        date: dateKey,
        version: `commit-${entry.sha}`, // Use commit SHA as version identifier
        changes: []
      })
    }
    
    grouped.get(dateKey).changes.push(entry)
  }
  
  // Convert to array and sort by date (newest first)
  return Array.from(grouped.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30) // Keep last 30 days
}

/**
 * Fetch changelog from GitHub or cache
 */
export async function fetchChangelog(forceRefresh = false) {
  const now = Date.now()
  
  // Check cache first
  if (!forceRefresh && typeof window !== 'undefined') {
    const cached = await getMeta(CHANGELOG_CACHE_KEY)
    const cacheTime = await getMeta(CHANGELOG_CACHE_TIMESTAMP)
    
    if (cached && cacheTime && (now - cacheTime < CACHE_DURATION)) {
      return cached
    }
  }
  
  // Fetch from GitHub
  const commits = await fetchGitHubCommits(100)
  
  if (!commits || commits.length === 0) {
    // Fallback to cache even if expired
    if (typeof window !== 'undefined') {
      const cached = await getMeta(CHANGELOG_CACHE_KEY)
      if (cached) {
        return cached
      }
    }
    return []
  }
  
  // Build changelog
  const changelog = await buildChangelogFromCommits(commits)
  
  // Cache it
  if (typeof window !== 'undefined') {
    await setMeta(CHANGELOG_CACHE_KEY, changelog)
    await setMeta(CHANGELOG_CACHE_TIMESTAMP, now)
  }
  
  return changelog
}

/**
 * Get count of unread changes
 */
export async function getUnreadChangesCount() {
  const currentVersion = await getMeta('dataset_version')
  const lastViewed = await getMeta(LAST_VIEWED_VERSION_KEY)
  
  if (!currentVersion) return 0
  
  // If no last viewed version, all changes are unread
  if (!lastViewed) {
    const changelog = await fetchChangelog()
    return changelog && Array.isArray(changelog) ? changelog.length : 0
  }
  
  // If versions match, no unread changes
  if (currentVersion === lastViewed) {
    return 0
  }
  
  // Count entries since last viewed
  const changelog = await fetchChangelog()
  if (!changelog || !Array.isArray(changelog)) return 0
  
  // Simple check: if version changed, there might be new changes
  // We'll show a badge if version is different
  return 1 // Return 1 to show badge, actual count would require more sophisticated tracking
}

/**
 * Mark changelog as read
 */
export async function markChangelogAsRead(version = null) {
  if (!version) {
    version = await getMeta('dataset_version')
  }
  if (version) {
    await setMeta(LAST_VIEWED_VERSION_KEY, version)
  }
}

/**
 * Get changelog entry for a specific version
 */
export async function getChangelogForVersion(version) {
  const changelog = await fetchChangelog()
  if (!changelog || !Array.isArray(changelog)) return null
  
  return changelog.find(entry => entry.version === version) || null
}

