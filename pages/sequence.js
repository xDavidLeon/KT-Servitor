import { useEffect, useState } from 'react'
import Header from '../components/Header'
import RichText from '../components/RichText'
import { db } from '../lib/db'
import { ensureIndex } from '../lib/search'
import { checkForUpdates } from '../lib/update'
import Seo from '../components/Seo'

let cachedSequenceSteps = null

export default function Sequence(){
  const [steps,setSteps] = useState(cachedSequenceSteps || [])
  const [loaded, setLoaded] = useState(Boolean(cachedSequenceSteps))

  useEffect(() => { 
    let cancelled = false

    const run = async () => {
      try {
        await checkForUpdates()
      } catch (err) {
        console.warn('Update check failed', err)
      }
      await ensureIndex()
      const rows = await db.articles.where('type').equals('sequence_step').toArray()
      rows.sort((a,b)=> (a.order||0) - (b.order||0))
      if (!cancelled) {
        cachedSequenceSteps = rows
        setSteps(rows)
        setLoaded(true)
      }
    }

    run()

    return () => { cancelled = true }
  },[])

  return (
    <>
      <Seo
        title="Game Sequence"
        description="Step through every phase of the Kill Team 2024 round sequence with clear reference text for each action."
      />
      <div className="container">
        <Header />
        <div className="card">
          <h2 style={{marginTop:0}}>Game Sequence</h2>
          {!loaded && <div className="muted">Loading…</div>}
          {loaded && steps.length===0 && <div className="muted">No steps found.</div>}
          {loaded && (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {steps.map((s, index)=> {
              const iconSequence = ['⚡', '♟', '🔥', '🕒', '🏆', '🔚']
              const icon = iconSequence[index] || '●'
              return (
                <li
                  key={s.id}
                  style={{
                    marginBottom: '.6rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.4rem'
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--muted)',
                      minWidth: '2rem',
                      textAlign: 'right'
                    }}
                  >
                    {`${index + 1}.`}
                  </span>
                  <span
                    aria-hidden="true"
                    role="img"
                    style={{
                      fontSize: '1.1rem'
                    }}
                  >
                    {icon}
                  </span>
                  <div style={{ marginLeft: '0.25rem', flex: 1 }}>
                    <strong>{s.title}</strong>
                    <RichText className="muted" text={s.body} />
                  </div>
                </li>
              )
            })}
          </ol>
          )}
        </div>
      </div>
    </>
  )
}
