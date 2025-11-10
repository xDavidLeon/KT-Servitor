import { useEffect, useState } from 'react'
import Header from '../components/Header'
import RichText from '../components/RichText'
import { db } from '../lib/db'
import { ensureIndex } from '../lib/search'
import { checkForUpdates } from '../lib/update'
import Seo from '../components/Seo'

export default function Sequence(){
  const [steps,setSteps] = useState([])
  const [version,setVersion] = useState(null)
  const [status,setStatus] = useState('')

    useEffect(()=>{ (async()=>{
      const upd = await checkForUpdates()
      setStatus(upd.error ? 'Offline' : (upd.warning ? 'Partial update' : 'Up to date'))
      if (upd.version) setVersion(upd.version)
      await ensureIndex()
      const rows = await db.articles.where('type').equals('sequence_step').toArray()
      rows.sort((a,b)=> (a.order||0) - (b.order||0))
      setSteps(rows)
    })() },[])

  return (
    <>
      <Seo
        title="Game Sequence"
        description="Step through every phase of the Kill Team 2024 round sequence with clear reference text for each action."
      />
      <div className="container">
        <Header version={version} status={status}/>
        <div className="card">
          <h2 style={{marginTop:0}}>Game Sequence</h2>
          {steps.length===0 && <div className="muted">No steps found.</div>}
          <ol>
            {steps.map(s=> (
              <li key={s.id} style={{marginBottom:'.6rem'}}>
                <strong>{s.title}</strong><RichText className="muted" text={s.body} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  )
}
