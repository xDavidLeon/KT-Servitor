// pages/api/sitemap.xml.js
// Dynamic sitemap generation for all kill teams and pages

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ktservitor.app'
const LOCALES = ['en', 'fr', 'es']
const DEFAULT_LOCALE = 'en'
const GITHUB_REPO = 'xDavidLeon/killteamjson'
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}/contents`

// Static pages configuration
const STATIC_PAGES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/killteams', changefreq: 'weekly', priority: '0.8' },
  { path: '/rules', changefreq: 'weekly', priority: '0.8' },
  { path: '/ops', changefreq: 'weekly', priority: '0.7' },
  { path: '/sequence', changefreq: 'weekly', priority: '0.7' },
  { path: '/scoreboard', changefreq: 'weekly', priority: '0.6' }
]

/**
 * Fetches kill team files from GitHub API
 */
async function fetchKillteamFiles(locale) {
  try {
    const localePath = locale === 'en' ? 'en' : locale
    const url = `${GITHUB_API_BASE}/${localePath}/teams`
    
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'KT-Servitor-Sitemap'
    }
    
    // Add GitHub token if available (for higher rate limits)
    const githubToken = process.env.GITHUB_TOKEN
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`
    }
    
    const response = await fetch(url, { headers })

    if (!response.ok) {
      // If 404 and not English, try English fallback
      if (response.status === 404 && locale !== DEFAULT_LOCALE) {
        return fetchKillteamFiles(DEFAULT_LOCALE)
      }
      return []
    }

    const files = await response.json()
    
    // Filter for JSON files and extract kill team IDs
    return files
      .filter(file => file.type === 'file' && file.name.endsWith('.json'))
      .map(file => {
        // Extract kill team ID from filename (e.g., "intercession-squad.json" -> "intercession-squad")
        const killteamId = file.name.replace(/\.json$/, '')
        return killteamId
      })
  } catch (error) {
    console.error(`Error fetching kill teams for locale ${locale}:`, error)
    return []
  }
}

/**
 * Generates URL entry for sitemap
 */
function generateUrlEntry(loc, changefreq = 'weekly', priority = '0.5', lastmod = null, alternateLocs = []) {
  let xml = `  <url>\n    <loc>${loc}</loc>\n`
  
  if (lastmod) {
    xml += `    <lastmod>${lastmod}</lastmod>\n`
  }
  
  xml += `    <changefreq>${changefreq}</changefreq>\n`
  xml += `    <priority>${priority}</priority>\n`
  
  // Add alternate language links (hreflang)
  if (alternateLocs.length > 0) {
    alternateLocs.forEach(alt => {
      xml += `    <xhtml:link rel="alternate" hreflang="${alt.locale}" href="${alt.url}" />\n`
    })
    // Add self-reference and x-default
    const currentLocale = alternateLocs.find(alt => alt.url === loc)?.locale || DEFAULT_LOCALE
    const defaultUrl = alternateLocs.find(alt => alt.locale === DEFAULT_LOCALE)?.url || loc
    xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}" />\n`
  }
  
  xml += `  </url>\n`
  return xml
}

/**
 * Generates the complete sitemap XML
 */
async function generateSitemap() {
  const now = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`

  // Fetch kill teams for all locales
  const killteamsByLocale = {}
  for (const locale of LOCALES) {
    killteamsByLocale[locale] = await fetchKillteamFiles(locale)
  }

  // Get unique kill team IDs (union of all locales)
  const allKillteamIds = new Set()
  Object.values(killteamsByLocale).forEach(ids => {
    ids.forEach(id => allKillteamIds.add(id))
  })

  // Add static pages with locale variants
  for (const page of STATIC_PAGES) {
    const alternateLocs = LOCALES.map(locale => ({
      locale,
      url: locale === DEFAULT_LOCALE 
        ? `${SITE_URL}${page.path}`
        : `${SITE_URL}/${locale}${page.path}`
    }))

    // Add default locale version
    xml += generateUrlEntry(
      `${SITE_URL}${page.path}`,
      page.changefreq,
      page.priority,
      now,
      alternateLocs
    )

    // Add other locale versions
    for (const locale of LOCALES) {
      if (locale === DEFAULT_LOCALE) continue
      xml += generateUrlEntry(
        `${SITE_URL}/${locale}${page.path}`,
        page.changefreq,
        page.priority,
        now,
        alternateLocs
      )
    }
  }

  // Add kill team pages
  for (const killteamId of allKillteamIds) {
    const alternateLocs = LOCALES
      .filter(locale => killteamsByLocale[locale].includes(killteamId))
      .map(locale => ({
        locale,
        url: locale === DEFAULT_LOCALE
          ? `${SITE_URL}/killteams/${encodeURIComponent(killteamId)}`
          : `${SITE_URL}/${locale}/killteams/${encodeURIComponent(killteamId)}`
      }))

    if (alternateLocs.length === 0) continue

    // Add default locale version
    const defaultUrl = `${SITE_URL}/killteams/${encodeURIComponent(killteamId)}`
    xml += generateUrlEntry(
      defaultUrl,
      'weekly',
      '0.7',
      now,
      alternateLocs
    )

    // Add other locale versions
    for (const alt of alternateLocs) {
      if (alt.locale === DEFAULT_LOCALE) continue
      xml += generateUrlEntry(
        alt.url,
        'weekly',
        '0.7',
        now,
        alternateLocs
      )
    }
  }

  xml += `</urlset>`
  return xml
}

export default async function handler(req, res) {
  try {
    const sitemap = await generateSitemap()
    
    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    res.status(200).send(sitemap)
  } catch (error) {
    console.error('Error generating sitemap:', error)
    res.status(500).send('Error generating sitemap')
  }
}

