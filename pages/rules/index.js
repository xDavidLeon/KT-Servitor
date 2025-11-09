import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import RichText from '../../components/RichText'
import SearchBox from '../../components/SearchBox'
import { ensureIndex } from '../../lib/search'
import { db } from '../../lib/db'

export default function Rules(){
  const [q,setQ] = useState('')
  const [rows,setRows] = useState([])
  useEffect(()=>{ (async()=>{
    const idx = await ensureIndex()
    if (!q.trim()){
      const all = await db.articles.where('type').anyOf(['rule','equipment']).toArray()
      setRows(all.sort((a,b)=> a.title.localeCompare(b.title)))
    } else {
      const r = idx.search(q, { prefix:true, fuzzy:0.2 })
        .filter(x => ['rule','equipment'].includes(x.type))
      setRows(r)
    }
  })() },[q])

  return (
    <div className="container">
      <Header/>
      <SearchBox q={q} setQ={setQ}/>
      <div className="card">
        <h2 style={{marginTop:0}}>Game Rules</h2>
        {rows.length===0 && <div className="muted">No results.</div>}
        {rows.map(x=>(
          <div key={x.id} style={{marginBottom:'.5rem'}}>
            <strong>{x.title}</strong> <span className="pill">{x.type}</span>
            <RichText className="muted" text={x.body} />
          </div>
        ))}
      </div>
    </div>
  )
}
