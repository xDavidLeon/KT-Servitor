import { useRouter } from 'next/router'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { db } from '../../lib/db'
export default function ItemPage(){
  const router = useRouter()
  const { id } = router.query
  const [item,setItem] = useState(null)
  useEffect(()=>{
    if (!id) return
    (async ()=>{
      const it = await db.articles.get(id)
      setItem(it)
    })()
  },[id])
  if (!id || !item) return <div className="container"><div className="card">Loading…</div></div>
  return (
    <div className="container">
      <div className="card">
        <div className="heading"><h2 style={{margin:0}}>{item.title}</h2><span className="pill">{item.type}</span></div>
        <p style={{whiteSpace:'pre-wrap'}}>{item.body}</p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {(item.tags||[]).map(t=> <span key={t} className="pill">{t}</span>)}
        </div>
        <div style={{marginTop:'1rem'}}><Link href="/">← Back</Link></div>
      </div>
    </div>
  )
}
