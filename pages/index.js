import { useEffect, useState } from 'react'
import Header from '../components/Header'
import SearchBox from '../components/SearchBox'
import Results from '../components/Results'
import { ensureIndex } from '../lib/search'
import { checkForUpdates } from '../lib/update'
import { db } from '../lib/db'

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
      else setStatus(upd.updated ? 'Data updated' : 'Up to date')
      if (upd.version) setVersion(upd.version)
  
      const idx = await ensureIndex()
      setLoading(false)
  
      // if no search query, show all items
      if (!q.trim()) {
        const all = await db.articles.orderBy('title').toArray()
        setRes(all)
      } else {
        setRes(idx.search(q, { prefix: true, fuzzy: 0.2 }))
      }
    })()
  }, [])
  
  useEffect(() => {
    (async () => {
      const idx = await ensureIndex()
      if (!q.trim()) {
        const all = await db.articles.orderBy('title').toArray()
        setRes(all)
      } else {
        setRes(idx.search(q, { prefix: true, fuzzy: 0.2 }))
      }
    })()
  }, [q])

  return (
    <div className="container">
      <Header version={version} status={status} />
      <SearchBox q={q} setQ={setQ} />
      <Results results={res} loading={loading} />
      <div className="card muted">
        This free web-based app is a rules reference for Kill Team 2024 and features publicly available data; no copyrighted rule text. It is not affiliated with Games Workshop Ltd. This app is not a replacement for the official Kill Team 2024 rulebook.
      </div>
    </div>
  )
}
