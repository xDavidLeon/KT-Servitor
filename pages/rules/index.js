import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import RichText from '../../components/RichText'
import { db } from '../../lib/db'
import { checkForUpdates } from '../../lib/update'
import Seo from '../../components/Seo'

export default function Rules() {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const loadEquipment = async () => {
      setLoading(true)
      try {
        await checkForUpdates()
        const rows = await db.universalEquipment.toArray()
        if (cancelled) return
        const sorted = rows.slice().sort((a, b) => {
          const seqA = typeof a.seq === 'number' ? a.seq : Number.MAX_SAFE_INTEGER
          const seqB = typeof b.seq === 'number' ? b.seq : Number.MAX_SAFE_INTEGER
          if (seqA !== seqB) return seqA - seqB
          return (a.eqName || '').localeCompare(b.eqName || '')
        })
        setEquipment(sorted)
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load universal equipment', err)
        setError(err)
        setEquipment([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadEquipment()

    return () => {
      cancelled = true
    }
  }, [])

  const renderContent = () => {
    if (loading) {
      return <div className="muted">Loading…</div>
    }

    if (error) {
      return (
        <div className="muted">
          Failed to load universal equipment.
          {' '}
          <span style={{ fontSize: '0.85rem' }}>{error.message || String(error)}</span>
        </div>
      )
    }

    if (!equipment.length) {
      return <div className="muted">No universal equipment available.</div>
    }

    return (
      <div className="card-section-list">
        {equipment.map(item => (
          <div key={item.eqId} id={`equipment-${item.eqId}`} className="ability-card">
            <div className="ability-card-header">
              <h4 className="ability-card-title">{item.eqName || item.eqId}</h4>
            </div>
            {item.description && (
              <RichText className="ability-card-body" text={item.description} />
            )}
            {(() => {
              const effectsText = Array.isArray(item.effects)
                ? item.effects.filter(Boolean).join(', ')
                : (item.effects || '')
              const trimmed = effectsText.trim()
              if (!trimmed) return null
              return (
                <div className="muted" style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                  {trimmed}
                </div>
              )
            })()}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <Seo
        title="Game Rules"
        description="Browse every piece of universal equipment available to all Kill Teams."
      />
      <div className="container">
        <Header />
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Universal Equipment</h2>
          {renderContent()}
        </div>
      </div>
    </>
  )
}
