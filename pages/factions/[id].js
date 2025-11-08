import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import { db } from '../../lib/db'
import { ensureIndex } from '../../lib/search'

export default function FactionPage(){
  const { query:{id} } = useRouter()
  const [faction,setFaction] = useState(null)
  const [groups,setGroups] = useState({ rules:[], operatives:[], tacops:[], ploys:[], equipment:[] })

  useEffect(()=>{ if(!id) return; (async()=>{
    await ensureIndex()
    const f = await db.articles.get(id)
    setFaction(f)
    const all = await db.articles.toArray()
    const byFaction = all.filter(a => a.factionId === id)
    setGroups({
      rules: byFaction.filter(a=> a.type==='faction_rule'),
      operatives: byFaction.filter(a=> a.type==='operative'),
      tacops: byFaction.filter(a=> a.type==='tacop'),
      ploys: byFaction.filter(a=> a.type==='ploy'),
      equipment: byFaction.filter(a=> a.type==='equipment'),
    })
  })() },[id])

  if (!faction) return <div className="container"><Header/><div className="card">Loading…</div></div>

  return (
    <div className="container">
      <Header/>
      <div className="card">
        <h2 style={{marginTop:0}}>{faction.title}</h2>
        <div className="muted">Season: {faction.season}</div>
        <p>{faction.body}</p>

        {Object.entries(groups).map(([k,arr])=> (
          <div key={k} className="card">
            <h3 style={{marginTop:0,textTransform:'capitalize'}}>{k}</h3>
            {arr.length===0 && <div className="muted">No items.</div>}
            {arr.map(it=> (
              <div key={it.id} style={{marginBottom:'.5rem'}}>
                <strong>{it.title}</strong>
                <div className="muted">{it.body}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
