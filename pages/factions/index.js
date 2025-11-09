import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import RichText from '../../components/RichText'
import Link from 'next/link'
import { db } from '../../lib/db'
import { ensureIndex } from '../../lib/search'
import { checkForUpdates } from '../../lib/update'

export default function Factions(){
  const [factions,setFactions] = useState([])
  const [version,setVersion] = useState(null)
  const [status,setStatus] = useState('')

  useEffect(()=>{ (async()=>{
    const upd = await checkForUpdates()
    setStatus(upd.error ? 'Offline' : 'Up to date')
    if (upd.version) setVersion(upd.version)
    await ensureIndex()
    const list = await db.articles.where('type').equals('faction').toArray()
    setFactions(list.sort((a,b)=> a.title.localeCompare(b.title)))
  })() },[])

  return (
    <div className="container">
      <Header version={version} status={status}/>
      <div className="card">
        <h2 style={{marginTop:0}}>Factions</h2>
        {factions.map(f=> (
          <div key={f.id} className="card" style={{margin:'.5rem 0'}}>
            <div className="heading"><strong>{f.title}</strong></div>
            <RichText className="muted" text={f.body} />
            <div style={{marginTop:'.5rem'}}>
              <Link href={`/factions/${f.id}`}>Open faction →</Link>
            </div>
          </div>
        ))}
        {factions.length===0 && <div className="muted">No factions found.</div>}
      </div>
    </div>
  )
}
