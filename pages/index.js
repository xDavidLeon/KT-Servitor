import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import SearchBox from '../components/SearchBox'
import Results from '../components/Results'
import { ensureIndex, getAllIndexedDocuments, isIndexReady } from '../lib/search'
import { checkForUpdates } from '../lib/update'
import Seo from '../components/Seo'


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

  // Sort in place - results array is already a copy from search results
  return results.slice().sort((a, b) => {
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
  const router = useRouter()
  const locale = router.locale || 'en'
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(() => !isIndexReady())

  const runSearch = async (query, idx) => {
    const mini = idx || await ensureIndex()
    const trimmed = query.trim()
    if (!trimmed) {
      const allDocs = await getAllIndexedDocuments()
      return [...allDocs].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }

    const primary = mini.search(trimmed, { prefix: true, fuzzy: 0.2 })
    if (primary.length) {
      return rankResults(primary, trimmed)
    }

    const norm = trimmed.toLowerCase()
    const allDocs = await getAllIndexedDocuments()
    const fallbackCandidates = allDocs.filter(doc => {
      const fields = [
        doc.title,
        doc.killteamName,
        doc.killteamDisplayName,
        ...(Array.isArray(doc.tags) ? doc.tags : []),
        doc.body
      ]

      return fields.some(value => {
        if (!value) return false
        return value.toString().toLowerCase().includes(norm)
      })
    })

    return rankResults(fallbackCandidates, trimmed)
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        await checkForUpdates(locale)
      } catch (err) {
        console.warn('Update check failed', err)
      }

      const idx = await ensureIndex()
      if (cancelled) return
      setLoading(false)

      const results = await runSearch(q, idx)
      if (!cancelled) {
        setRes(results)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [locale])
  
  useEffect(() => {
    (async () => {
      const idx = await ensureIndex()
      const results = await runSearch(q, idx)
      setRes(results)
    })()
  }, [q])

  return (
    <>
      <Seo description="Search and browse Kill Team factions, operatives, rules, and equipment with a fast, offline-ready reference companion." />
      <div className="container">
        <Header />
        <SearchBox q={q} setQ={setQ} />
        <Results results={res} loading={loading} />
      </div>
    </>
  )
}
