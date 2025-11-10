import { useRouter } from 'next/router'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import Seo from '../../components/Seo'
import { db } from '../../lib/db'

export default function ItemPage(){
  const router = useRouter()
  const { id } = router.query
  const [item,setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    if (!id) return
    let cancelled = false
    ;(async ()=>{
      setLoading(true)
      try {
        const it = await db.articles.get(id)
        if (!cancelled) {
          setItem(it || null)
        }
      } catch (error) {
        if (!cancelled) {
          setItem(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  },[id])

  if (!id || loading) {
    return (
      <>
        <Seo title="Loading Entry" description="Loading reference entry details." type="article" />
        <div className="container">
          <Header />
          <div className="card">Loading…</div>
        </div>
      </>
    )
  }

  if (!item) {
    return (
      <>
        <Seo
          title="Reference Not Found"
          description={id ? `We couldn’t find data for ${id}.` : 'We couldn’t find this reference entry.'}
          type="article"
        />
        <div className="container">
          <Header />
          <div className="card">
            <div className="heading">
              <h2 style={{margin:0}}>Reference not found</h2>
            </div>
            <p className="muted">We couldn’t find data for <code>{id}</code>. Try searching again or updating your data.</p>
            <div style={{marginTop:'1rem'}}><Link href="/">← Back</Link></div>
          </div>
        </div>
      </>
    )
  }

  const pageTitle = item.title || 'Reference Entry'
  const fallbackDescription = item.tags?.length
    ? `Reference entry for ${pageTitle} covering ${item.tags.join(', ')}.`
    : `Reference entry for ${pageTitle}.`

  return (
    <>
      <Seo title={pageTitle} description={item.body || fallbackDescription} type="article" />
      <div className="container">
        <Header />
        <div className="card">
          <div className="heading">
            <h2 style={{margin:0}}>{item.title}</h2>
            <span className="pill">{item.type}</span>
          </div>
          <p style={{whiteSpace:'pre-wrap'}}>{item.body}</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {(item.tags||[]).map(t=> <span key={t} className="pill">{t}</span>)}
          </div>
          <div style={{marginTop:'1rem'}}><Link href="/">← Back</Link></div>
        </div>
      </div>
    </>
  )
}
