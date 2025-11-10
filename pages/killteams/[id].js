import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import KillteamSelector from '../../components/KillteamSelector'
import KillteamSectionNavigator from '../../components/KillteamSectionNavigator'
import OperativeCard from '../../components/OperativeCard'
import RichText from '../../components/RichText'
import { db } from '../../lib/db'
import { ensureIndex } from '../../lib/search'

function parseArchetypes(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value)
    .split(/[\/,]/)
    .map(part => part.trim())
    .filter(Boolean)
}

function splitKeywords(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
}

function normaliseOperative(opType) {
  if (!opType) return null

  const buildWeapons = () => {
    const result = []
    for (const weapon of opType.weapons || []) {
      const type = weapon.wepType === 'R' ? 'Ranged Weapon' :
        weapon.wepType === 'M' ? 'Melee Weapon' :
        weapon.wepType === 'P' ? 'Psychic Weapon' :
        weapon.wepType === 'E' ? 'Equipment' :
        'Weapon'

      if (Array.isArray(weapon.profiles) && weapon.profiles.length) {
        for (const profile of weapon.profiles) {
          result.push({
            id: `${weapon.wepId}-${profile.wepprofileId || profile.seq || 0}`,
            name: profile.profileName ? `${weapon.wepName} (${profile.profileName})` : (weapon.wepName || weapon.wepId),
            type,
            atk: profile.ATK || '-',
            hit: profile.HIT || '-',
            dmg: profile.DMG || '-',
            specialRules: splitKeywords(profile.WR)
          })
        }
      } else {
        result.push({
          id: weapon.wepId,
          name: weapon.wepName || weapon.wepId,
          type,
          atk: '-',
          hit: '-',
          dmg: '-',
          specialRules: []
        })
      }
    }
    return result
  }

  return {
    id: opType.opTypeId,
    name: opType.opTypeName || opType.opName || opType.opId,
    apl: opType.APL ?? null,
    move: opType.MOVE || '',
    save: opType.SAVE || '',
    wounds: opType.WOUNDS ?? null,
    keywords: splitKeywords(opType.keywords),
    specialRules: (opType.abilities || []).map(ability => ({
      name: ability.abilityName,
      description: ability.description
    })),
    specialActions: (opType.options || []).map(option => ({
      name: option.optionName,
      description: option.description
    })),
    weapons: buildWeapons()
  }
}

export default function KillteamPage() {
  const router = useRouter()
  const { id } = router.query

  const [killteam, setKillteam] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    let cancelled = false

    ;(async () => {
      setLoading(true)
      await ensureIndex()

      const data = await db.killteams.get(id)
      if (!cancelled) {
        setKillteam(data || null)
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (typeof window === 'undefined' || !id) return

    const handleUpdate = async () => {
      const data = await db.killteams.get(id)
      setKillteam(data || null)
    }

    window.addEventListener('kt-killteams-updated', handleUpdate)
    return () => {
      window.removeEventListener('kt-killteams-updated', handleUpdate)
    }
  }, [id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash?.replace('#', '')
    if (!hash) return

    const attemptScroll = () => {
      const target = document.getElementById(hash)
      if (!target) return false
      target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
      return true
    }

    if (attemptScroll()) return

    let attempts = 0
    const timer = window.setInterval(() => {
      attempts += 1
      if (attemptScroll() || attempts >= 10) {
        window.clearInterval(timer)
      }
    }, 100)

    return () => window.clearInterval(timer)
  }, [killteam])

  const operatives = useMemo(() => {
    if (!killteam?.opTypes) return []
    return killteam.opTypes
      .map(normaliseOperative)
      .filter(Boolean)
  }, [killteam])

  const strategicPloys = useMemo(() => {
    return (killteam?.ploys || []).filter(ploy => ploy?.ployType === 'S')
  }, [killteam])

  const firefightPloys = useMemo(() => {
    return (killteam?.ploys || []).filter(ploy => ploy?.ployType && ploy.ployType !== 'S')
  }, [killteam])

  if (loading) {
    return (
      <div className="container">
        <Header />
        <div className="card">Loading…</div>
      </div>
    )
  }

  if (!killteam) {
    return (
      <div className="container">
        <Header />
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Kill Team not found</h2>
          <p className="muted">We couldn’t find data for <code>{id}</code>. Try refreshing your data from the menu.</p>
        </div>
      </div>
    )
  }

  const archetypes = parseArchetypes(killteam.archetypes)

  return (
    <div className="container">
      <Header />
      <div className="card killteam-selector-sticky">
        <KillteamSelector currentKillteamId={killteam.killteamId} />
        <div style={{ marginTop: '0.5rem' }}>
          <KillteamSectionNavigator killteam={killteam} />
        </div>
      </div>

      <div className="card">
        <section id="killteam-overview">
          <h2 style={{ marginTop: 0 }}>{killteam.killteamName}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
            <span className="pill">{killteam.killteamId}</span>
            {killteam.factionId && <span className="pill muted">Faction: {killteam.factionId}</span>}
            {archetypes.map(archetype => (
              <span key={archetype} className="pill">{archetype}</span>
            ))}
          </div>
          {killteam.description && <RichText className="muted" text={killteam.description} />}
        </section>

        {killteam.composition && (
          <section id="killteam-composition" className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Composition</h3>
            <RichText className="muted" text={killteam.composition} />
          </section>
        )}

        <section id="operative-types" className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Operative Types</h3>
          {operatives.length ? (
            <div className="operatives-grid">
              {operatives.map(operative => (
                <OperativeCard key={operative.id} operative={operative} />
              ))}
            </div>
          ) : (
            <div className="muted">No operatives listed for this kill team.</div>
          )}
        </section>

        <section id="strategic-ploys" className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Strategic Ploys</h3>
          {strategicPloys.length ? strategicPloys.map(ploy => (
            <div key={ploy.ployId} id={`ploy-${ploy.ployId}`} style={{ marginBottom: '0.75rem' }}>
              <strong>{ploy.ployName}</strong>
              {ploy.description && <RichText className="muted" text={ploy.description} />}
            </div>
          )) : <div className="muted">No strategic ploys available.</div>}
        </section>

        <section id="firefight-ploys" className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Firefight Ploys</h3>
          {firefightPloys.length ? firefightPloys.map(ploy => (
            <div key={ploy.ployId} id={`ploy-${ploy.ployId}`} style={{ marginBottom: '0.75rem' }}>
              <strong>{ploy.ployName}</strong>
              {ploy.description && <RichText className="muted" text={ploy.description} />}
            </div>
          )) : <div className="muted">No firefight ploys available.</div>}
        </section>

        <section id="equipment" className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Equipment</h3>
          {Array.isArray(killteam.equipments) && killteam.equipments.length ? killteam.equipments.map(eq => (
            <div key={eq.eqId} id={`equipment-${eq.eqId}`} style={{ marginBottom: '0.75rem' }}>
              <strong>{eq.eqName}</strong>
              {eq.description && <RichText className="muted" text={eq.description} />}
            </div>
          )) : <div className="muted">No equipment listed.</div>}
        </section>

        {killteam.defaultRoster && (
          <section id="default-roster" className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Default Roster</h3>
            <div className="heading" style={{ marginBottom: '0.5rem' }}>
              <strong>{killteam.defaultRoster.rosterName}</strong>
              <span className="pill muted">CP: {killteam.defaultRoster.CP ?? 0}</span>
              <span className="pill muted">Turn: {killteam.defaultRoster.turn ?? 1}</span>
            </div>
            {killteam.defaultRoster.description && <RichText className="muted" text={killteam.defaultRoster.description} />}
          </section>
        )}
      </div>
    </div>
  )
}
