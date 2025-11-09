import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import OperativeCard from '../../components/OperativeCard'
import FactionSelector from '../../components/FactionSelector'
import SectionNavigator from '../../components/SectionNavigator'
import { db } from '../../lib/db'
import { ensureIndex } from '../../lib/search'

function canonicalFactionId(rawId) {
  if (!rawId) return rawId
  return rawId.startsWith('fac_') ? rawId : `fac_${rawId}`
}

function parseStoredOperative(record) {
  if (!record) return null
  if (typeof record.body === 'string') {
    try {
      const parsed = JSON.parse(record.body)
      return {
        ...parsed,
        id: record.id,
        name: parsed.name || parsed.title || record.title,
        factionKeyword: parsed.factionKeyword || record.factionKeyword || null,
        keywords: parsed.keywords || record.tags || [],
        weapons: parsed.weapons || [],
        specialRules: parsed.specialRules || [],
        specialActions: parsed.specialActions || [],
        apl: parsed.apl ?? record.apl ?? null,
        move: parsed.move || record.move || '',
        save: parsed.save || record.save || '',
        wounds: parsed.wounds ?? record.wounds ?? null,
        maxSelections: parsed.maxSelections ?? record.maxSelections ?? null
      }
    } catch (err) {
      // fall through to legacy structure
    }
  }

  return {
    id: record.id,
    name: record.title,
    factionKeyword: record.factionKeyword || null,
    keywords: record.tags || [],
    weapons: record.weapons || [],
    specialRules: [],
    specialActions: [],
    apl: record.apl ?? null,
    move: record.move || '',
    save: record.save || '',
    wounds: record.wounds ?? null,
    maxSelections: record.maxSelections ?? null
  }
}

function buildFactionFromArticles(baseRecord, relatedArticles, canonicalId) {
  if (!baseRecord && (!relatedArticles || relatedArticles.length === 0)) return null

  const toRule = (item) => ({ id: item.id, name: item.title, description: item.body })
  const toGeneric = (item) => ({ id: item.id, name: item.title, description: item.body })

  const factionKeyword = baseRecord?.factionKeyword || null
  const archetypes = baseRecord?.archetypes || baseRecord?.tags || []

  const operatives = (relatedArticles || [])
    .filter(a => a.type === 'operative')
    .map(parseStoredOperative)
    .filter(Boolean)

  return {
    id: canonicalId,
    name: baseRecord?.title || baseRecord?.name || canonicalId,
    summary: baseRecord?.body || '',
    factionKeyword,
    archetypes,
    rules: (relatedArticles || []).filter(a => a.type === 'faction_rule').map(toRule),
    strategicPloys: (relatedArticles || [])
      .filter(a => a.type === 'strategic_ploy' || a.type === 'ploy')
      .map(toGeneric),
    tacticalPloys: (relatedArticles || [])
      .filter(a => a.type === 'tactical_ploy')
      .map(toGeneric),
    equipment: (relatedArticles || []).filter(a => a.type === 'equipment').map(toGeneric),
    tacops: (relatedArticles || []).filter(a => a.type === 'tacop').map(toGeneric),
    operatives
  }
}

export default function FactionPage(){
  const { query:{id} } = useRouter()
  const [faction,setFaction] = useState(null)
  const [factionData,setFactionData] = useState(null) // New structure: complete faction object

  useEffect(()=>{ if(!id) return; (async()=>{
    await ensureIndex()
    
    // Try to load new structure first (faction_*.json file)
    // Remove 'fac_' prefix from id if present for filename
    const fileId = id.startsWith('fac_') ? id.substring(4) : id;
    try {
      const res = await fetch(`/data/v1/faction_${fileId}.json`)
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
        console.log(`Faction file not found: faction_${fileId}.json (${res.status})`)
      }
    } catch (e) {
      console.log('Error loading new structure:', e.message)
    }
    
    // Fallback to stored data in IndexedDB
    const canonicalId = canonicalFactionId(id)
    const baseRecord = canonicalId ? await db.articles.get(canonicalId) : null

    let relatedArticles = []
    if (canonicalId) {
      try {
        relatedArticles = await db.articles.where('factionId').equals(canonicalId).toArray()
      } catch (err) {
        const all = await db.articles.toArray()
        relatedArticles = all.filter(a => a.factionId === canonicalId)
      }
    }

    const fallbackData = buildFactionFromArticles(baseRecord, relatedArticles, canonicalId)

    if (fallbackData) {
      setFaction({
        title: fallbackData.name,
        body: fallbackData.summary
      })
      setFactionData(fallbackData)
      return
    }

    setFaction(baseRecord)
    setFactionData(null)
  })() },[id])

  if (!faction && !factionData) return <div className="container"><Header/><div className="card">Loading…</div></div>

  // New structure
  if (factionData && factionData.operatives && Array.isArray(factionData.operatives)) {
    const factionAnchorId = factionData.id || canonicalFactionId(id)
    return (
      <div className="container">
        <Header/>
        <div className="card faction-selector-sticky">
          <FactionSelector currentFactionId={id} />
          <div style={{ marginTop: '0.5rem' }}>
            <SectionNavigator factionData={factionData} />
          </div>
        </div>
        <div className="card">
          <h2 id={factionAnchorId} style={{marginTop:0}}>{factionData.name}</h2>
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

          {factionData.operativeSelection && factionData.operatives && (
            <div id="operative-selection" className="card" style={{marginTop: '1rem'}}>
              <h3 style={{marginTop:0}}>Operative Selection</h3>
              <div style={{marginBottom: '0.5rem'}}>
                {factionData.operativeSelection.leader && (() => {
                  // Find operatives with Leader keyword
                  const leaderOperatives = factionData.operatives.filter(op => 
                    op.keywords && op.keywords.includes('Leader')
                  );
                  
                  return (
                    <div>
                      <strong>Leader:</strong> {factionData.operativeSelection.leader.min === 0 ? '' : `${factionData.operativeSelection.leader.min} - `}
                      {factionData.operativeSelection.leader.max || 1} operative{factionData.operativeSelection.leader.max !== 1 ? 's' : ''} with the <strong>Leader</strong> keyword
                      {leaderOperatives.length > 0 && (
                        <ul style={{marginTop: '0.5rem', marginLeft: '1.5rem', fontSize: '0.9rem', listStyle: 'disc'}}>
                          {leaderOperatives.map(op => (
                            <li key={op.id} className="muted">
                              {op.name || op.title}
                              {op.maxSelections !== null && op.maxSelections !== undefined && (
                                <span> (max {op.maxSelections})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}
                {factionData.operativeSelection.operatives && (() => {
                  // Find operatives without Leader keyword (or all operatives if leaders can also be selected as operatives)
                  const regularOperatives = factionData.operatives.filter(op => 
                    !op.keywords || !op.keywords.includes('Leader')
                  );
                  
                  return (
                    <div style={{marginTop: '0.5rem'}}>
                      <strong>Operatives:</strong> {factionData.operativeSelection.operatives.min || 0}
                      {factionData.operativeSelection.operatives.max !== null && 
                        factionData.operativeSelection.operatives.max !== factionData.operativeSelection.operatives.min
                        ? ` - ${factionData.operativeSelection.operatives.max}` 
                        : ''} operative{(factionData.operativeSelection.operatives.max === 1 || (factionData.operativeSelection.operatives.max === null && factionData.operativeSelection.operatives.min === 1)) ? '' : 's'}
                      {regularOperatives.length > 0 && (
                        <ul style={{marginTop: '0.5rem', marginLeft: '1.5rem', fontSize: '0.9rem', listStyle: 'disc'}}>
                          {regularOperatives.map(op => (
                            <li key={op.id} className="muted">
                              {op.name || op.title}
                              {op.maxSelections !== null && op.maxSelections !== undefined && (
                                <span> (max {op.maxSelections})</span>
                              )}
                              {op.maxSelections === null && (
                                <span> (unlimited)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <div id="faction-rules" className="card" style={{marginTop: '1rem'}}>
            <h3 style={{marginTop:0}}>Faction Rules</h3>
            {factionData.rules && factionData.rules.length > 0 ? (
              factionData.rules.map(rule => (
                <div key={rule.id} id={rule.id} style={{marginBottom: '0.75rem'}}>
                  <strong>{rule.name}</strong>
                  {rule.description && <div className="muted">{rule.description}</div>}
                </div>
              ))
            ) : (
              <div className="muted">No faction rules found.</div>
            )}
          </div>

          <div id="datacards" className="card" style={{marginTop: '1rem'}}>
            <h3 style={{marginTop:0}}>Datacards</h3>
            {factionData.operatives && factionData.operatives.length > 0 ? (
              <div className="operatives-grid">
                {factionData.operatives.map(op => (
                  <OperativeCard key={op.id} operative={op} />
                ))}
              </div>
            ) : (
              <div className="muted">No datacards found. The conversion script may need to be run, or the BattleScribe file may not contain operative data.</div>
            )}
          </div>

          <div id="strategic-ploys" className="card" style={{marginTop: '1rem'}}>
            <h3 style={{marginTop:0}}>Strategic Ploys</h3>
            {factionData.strategicPloys && factionData.strategicPloys.length > 0 ? (
              factionData.strategicPloys.map(ploy => (
                <div key={ploy.id} id={ploy.id} style={{marginBottom: '0.75rem'}}>
                  <strong>{ploy.name}</strong>
                  <div className="muted">{ploy.description}</div>
                </div>
              ))
            ) : (
              <div className="muted">No strategic ploys found.</div>
            )}
          </div>

          <div id="tactical-ploys" className="card" style={{marginTop: '1rem'}}>
            <h3 style={{marginTop:0}}>Tactical Ploys</h3>
            {factionData.tacticalPloys && factionData.tacticalPloys.length > 0 ? (
              factionData.tacticalPloys.map(ploy => (
                <div key={ploy.id} id={ploy.id} style={{marginBottom: '0.75rem'}}>
                  <strong>{ploy.name}</strong>
                  <div className="muted">{ploy.description}</div>
                </div>
              ))
            ) : (
              <div className="muted">No tactical ploys found.</div>
            )}
          </div>

          <div id="equipment" className="card" style={{marginTop: '1rem'}}>
            <h3 style={{marginTop:0}}>Equipment</h3>
            {factionData.equipment && factionData.equipment.length > 0 ? (
              factionData.equipment.map(eq => (
                <div key={eq.id} id={eq.id} style={{marginBottom: '0.75rem'}}>
                  <strong>{eq.name}</strong>
                  <div className="muted">{eq.description}</div>
                </div>
              ))
            ) : (
              <div className="muted">No equipment found.</div>
            )}
          </div>

          {factionData.tacops && factionData.tacops.length > 0 && (
            <div id="tac-ops" className="card" style={{marginTop: '1rem'}}>
              <h3 style={{marginTop:0}}>Tac Ops</h3>
              {factionData.tacops.map(tacop => (
                <div key={tacop.id} id={tacop.id} style={{marginBottom: '0.75rem'}}>
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
  const fallbackAnchorId = (factionData && factionData.id) || (faction && faction.id) || canonicalFactionId(id)

  return (
    <div className="container">
      <Header/>
      <div className="card faction-selector-sticky">
        <FactionSelector currentFactionId={id} />
      </div>
      <div className="card">
        <h2 id={fallbackAnchorId} style={{marginTop:0}}>{faction?.title}</h2>
        <p>{faction?.body}</p>

        {Object.entries(groups).map(([k,arr]) => (
          <div key={k} className="card">
            <h3 style={{marginTop:0,textTransform:'capitalize'}}>{k === 'operatives' ? 'Datacards' : k}</h3>
            {arr.length===0 && <div className="muted">No items.</div>}
            {k === 'operatives' ? (
              <div className="operatives-grid">
                {arr.map(it => (
                  <OperativeCard key={it.id} operative={it} />
                ))}
              </div>
            ) : (
              arr.map(it => (
                <div key={it.id} id={it.id} style={{marginBottom:'.5rem'}}>
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
