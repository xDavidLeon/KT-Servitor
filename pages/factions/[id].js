import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import OperativeCard from '../../components/OperativeCard'
import { db } from '../../lib/db'
import { ensureIndex } from '../../lib/search'

export default function FactionPage(){
  const { query:{id} } = useRouter()
  const [faction,setFaction] = useState(null)
  const [factionData,setFactionData] = useState(null) // New structure: complete faction object

  useEffect(()=>{ if(!id) return; (async()=>{
    await ensureIndex()
    
    // Try to load new structure first (faction_*.json file)
    try {
      const res = await fetch(`/data/v1/faction_${id}.json`)
      if (res.ok) {
        const data = await res.json()
        // Check if it's the new structure (has operatives array, even if empty)
        if (data.operatives !== undefined && Array.isArray(data.operatives)) {
          setFactionData(data)
          // Also set basic faction info for header
          setFaction({
            title: data.name,
            body: data.summary
          })
          return
        }
      } else {
        console.log(`Faction file not found: faction_${id}.json (${res.status})`)
      }
    } catch (e) {
      console.log('Error loading new structure:', e.message)
    }
    
    // Fallback to old structure (database)
    const f = await db.articles.get(id)
    setFaction(f)
    const all = await db.articles.toArray()
    const byFaction = all.filter(a => a.factionId === id)
    setFactionData({
      rules: byFaction.filter(a=> a.type==='faction_rule'),
      operatives: byFaction.filter(a=> a.type==='operative'),
      tacops: byFaction.filter(a=> a.type==='tacop'),
      ploys: byFaction.filter(a=> a.type==='ploy'),
      equipment: byFaction.filter(a=> a.type==='equipment'),
    })
  })() },[id])

  if (!faction && !factionData) return <div className="container"><Header/><div className="card">Loading…</div></div>

  // New structure
  if (factionData && factionData.operatives && Array.isArray(factionData.operatives)) {
    return (
      <div className="container">
        <Header/>
        <div className="card">
          <h2 style={{marginTop:0}}>{factionData.name}</h2>
          {factionData.factionKeyword && factionData.factionKeyword !== 'UNKNOWN' && (
            <div style={{marginBottom: '0.5rem'}}>
              <span className="pill" style={{fontSize: '0.9rem', fontWeight: 'bold'}}>
                {factionData.factionKeyword}
              </span>
            </div>
          )}
          {factionData.archetypes && factionData.archetypes.length > 0 && (
            <div style={{marginBottom: '0.5rem'}}>
              <strong>Archetypes: </strong>
              {factionData.archetypes.map((arch, idx) => (
                <span key={arch} className="pill" style={{marginLeft: '0.25rem'}}>
                  {arch}
                </span>
              ))}
            </div>
          )}
          <p>{factionData.summary}</p>

          <div className="card" style={{marginTop: '1rem'}}>
            <h3 style={{marginTop:0}}>Faction Rules</h3>
            {factionData.rules && factionData.rules.length > 0 ? (
              factionData.rules.map(rule => (
                <div key={rule.id} style={{marginBottom: '0.75rem'}}>
                  <strong>{rule.name}</strong>
                  {rule.description && <div className="muted">{rule.description}</div>}
                </div>
              ))
            ) : (
              <div className="muted">No faction rules found.</div>
            )}
          </div>

          <div className="card" style={{marginTop: '1rem'}}>
            <h3 style={{marginTop:0}}>Operatives</h3>
            {factionData.operatives && factionData.operatives.length > 0 ? (
              <div className="operatives-grid">
                {factionData.operatives.map(op => (
                  <OperativeCard key={op.id} operative={op} />
                ))}
              </div>
            ) : (
              <div className="muted">No operatives found. The conversion script may need to be run, or the BattleScribe file may not contain operative data.</div>
            )}
          </div>

          <div className="card" style={{marginTop: '1rem'}}>
            <h3 style={{marginTop:0}}>Strategic Ploys</h3>
            {factionData.strategicPloys && factionData.strategicPloys.length > 0 ? (
              factionData.strategicPloys.map(ploy => (
                <div key={ploy.id} style={{marginBottom: '0.75rem'}}>
                  <strong>{ploy.name}</strong>
                  <div className="muted">{ploy.description}</div>
                </div>
              ))
            ) : (
              <div className="muted">No strategic ploys found.</div>
            )}
          </div>

          <div className="card" style={{marginTop: '1rem'}}>
            <h3 style={{marginTop:0}}>Tactical Ploys</h3>
            {factionData.tacticalPloys && factionData.tacticalPloys.length > 0 ? (
              factionData.tacticalPloys.map(ploy => (
                <div key={ploy.id} style={{marginBottom: '0.75rem'}}>
                  <strong>{ploy.name}</strong>
                  <div className="muted">{ploy.description}</div>
                </div>
              ))
            ) : (
              <div className="muted">No tactical ploys found.</div>
            )}
          </div>

          <div className="card" style={{marginTop: '1rem'}}>
            <h3 style={{marginTop:0}}>Equipment</h3>
            {factionData.equipment && factionData.equipment.length > 0 ? (
              factionData.equipment.map(eq => (
                <div key={eq.id} style={{marginBottom: '0.75rem'}}>
                  <strong>{eq.name}</strong>
                  <div className="muted">{eq.description}</div>
                </div>
              ))
            ) : (
              <div className="muted">No equipment found.</div>
            )}
          </div>

          {factionData.tacops && factionData.tacops.length > 0 && (
            <div className="card" style={{marginTop: '1rem'}}>
              <h3 style={{marginTop:0}}>Tac Ops</h3>
              {factionData.tacops.map(tacop => (
                <div key={tacop.id} style={{marginBottom: '0.75rem'}}>
                  <strong>{tacop.name || tacop.title}</strong>
                  <div className="muted">{tacop.description || tacop.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Old structure fallback
  const groups = factionData || { rules:[], operatives:[], tacops:[], ploys:[], equipment:[] }

  return (
    <div className="container">
      <Header/>
      <div className="card">
        <h2 style={{marginTop:0}}>{faction?.title}</h2>
        <p>{faction?.body}</p>

        {Object.entries(groups).map(([k,arr])=> (
          <div key={k} className="card">
            <h3 style={{marginTop:0,textTransform:'capitalize'}}>{k}</h3>
            {arr.length===0 && <div className="muted">No items.</div>}
            {k === 'operatives' ? (
              <div className="operatives-grid">
                {arr.map(it=> (
                  <OperativeCard key={it.id} operative={it} />
                ))}
              </div>
            ) : (
              arr.map(it=> (
                <div key={it.id} style={{marginBottom:'.5rem'}}>
                  <strong>{it.title}</strong>
                  <div className="muted">{it.body}</div>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
