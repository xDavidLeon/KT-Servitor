import { useEffect, useState } from 'react'
import Header from '../components/Header'
import SearchBox from '../components/SearchBox'
import Results from '../components/Results'
import Disclaimer from '../components/Disclaimer'
import { ensureIndex, getAllIndexedDocuments } from '../lib/search'
import { checkForUpdates } from '../lib/update'


function rankResults(results, query) {
  if (!query) return results
  const normQuery = query.trim().toLowerCase()
  if (!normQuery) return results

  const normalize = (value) => (value || '').toString().trim().toLowerCase()

  const getRank = (item) => {
    const title = normalize(item.title)
    const abbr = normalize(item.abbr)
    const tags = Array.isArray(item.tags) ? item.tags.map(normalize) : []

    if (title === normQuery || (abbr && abbr === normQuery) || tags.includes(normQuery)) {
      return 0 // exact match
    }
    if (title.startsWith(normQuery) || (abbr && abbr.startsWith(normQuery)) || tags.some(tag => tag.startsWith(normQuery))) {
      return 1 // prefix match
    }
    if (title.includes(normQuery) || (abbr && abbr.includes(normQuery)) || tags.some(tag => tag.includes(normQuery))) {
      return 2 // partial match
    }
    return 3 // fallback to score ordering
  }

  return [...results].sort((a, b) => {
    const rankA = getRank(a)
    const rankB = getRank(b)
    if (rankA !== rankB) return rankA - rankB

    const scoreA = typeof a.score === 'number' ? a.score : 0
    const scoreB = typeof b.score === 'number' ? b.score : 0
    if (scoreA !== scoreB) return scoreB - scoreA

    return (a.title || '').localeCompare(b.title || '')
  })
}

export default function Home() {
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(null)
  const [status, setStatus] = useState('Checking for data updates…')

  useEffect(() => {
    (async () => {
      const upd = await checkForUpdates()
        if (upd.error) setStatus('Offline (using cached data)')
        else if (upd.warning) setStatus('Partial data update')
        else setStatus(upd.updated ? 'Data updated' : 'Up to date')
      if (upd.version) setVersion(upd.version)
  
      const idx = await ensureIndex()
      setLoading(false)
  
      // if no search query, show all items
        if (!q.trim()) {
          const allDocs = await getAllIndexedDocuments()
          const sorted = [...allDocs].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
          setRes(sorted)
        } else {
          setRes(rankResults(idx.search(q, { prefix: true, fuzzy: 0.2 }), q))
        }
    })()
  }, [])
  
  useEffect(() => {
    (async () => {
      const idx = await ensureIndex()
        if (!q.trim()) {
          const allDocs = await getAllIndexedDocuments()
          const sorted = [...allDocs].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
          setRes(sorted)
        } else {
          setRes(rankResults(idx.search(q, { prefix: true, fuzzy: 0.2 }), q))
        }
    })()
  }, [q])

  return (
    <div className="container">
      <Header version={version} status={status} />
      <SearchBox q={q} setQ={setQ} />
      <Results results={res} loading={loading} />
        <Disclaimer />
    </div>
  )
}
