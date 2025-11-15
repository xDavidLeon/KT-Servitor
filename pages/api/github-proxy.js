// API route to proxy GitHub API requests to avoid CORS issues on localhost
export default async function handler(req, res) {
  // Enable CORS for localhost
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { path, limit } = req.query

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Path parameter is required' })
  }

  try {
    // Handle different GitHub API endpoints
    let url
    if (path.startsWith('repos/')) {
      // Direct API path (e.g., repos/owner/repo/commits)
      url = `https://api.github.com/${path}`
      if (limit) {
        url += `${url.includes('?') ? '&' : '?'}per_page=${limit}`
      }
    } else {
      // Legacy: contents path
      url = `https://api.github.com/repos/xDavidLeon/killteamjson/contents/${path}`
    }
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'KT-Servitor'
    }
    
    // Add GitHub token if available (for higher rate limits)
    const githubToken = process.env.GITHUB_TOKEN
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`
    }
    
    const response = await fetch(url, { headers })

    // Always return the response status and body, even for errors
    // This allows the client to handle 404s and other errors properly
    const data = await response.json().catch(() => ({ error: 'Failed to parse response' }))
    
    // Return the same status code from GitHub API
    res.status(response.status).json(data)
  } catch (error) {
    console.error('GitHub API proxy error:', error)
    res.status(500).json({ error: error.message })
  }
}

