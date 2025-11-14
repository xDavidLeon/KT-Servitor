// API route to proxy GitHub API requests to avoid CORS issues on localhost
export default async function handler(req, res) {
  const { path } = req.query

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Path parameter is required' })
  }

  try {
    const url = `https://api.github.com/repos/xDavidLeon/killteamjson/contents/${path}`
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'KT-Servitor'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({ 
        error: errorText,
        status: response.status 
      })
    }

    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    console.error('GitHub API proxy error:', error)
    res.status(500).json({ error: error.message })
  }
}

