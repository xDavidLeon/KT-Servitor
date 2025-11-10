import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import KillteamSelector from '../../components/KillteamSelector'
import KillteamSectionNavigator from '../../components/KillteamSectionNavigator'
import OperativeCard from '../../components/OperativeCard'
import RichText from '../../components/RichText'
import { db } from '../../lib/db'
import { ensureIndex } from '../../lib/search'
import Seo from '../../components/Seo'

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

function formatCost(value, defaultUnit) {
  if (value === null || value === undefined) return null
  const unit = (defaultUnit || '').toUpperCase()

  if (typeof value === 'number' && !Number.isNaN(value)) {
    return unit ? `${value} ${unit}` : String(value)
  }

  const stringValue = String(value).trim()
  if (!stringValue) return null

  const numeric = stringValue.match(/^(\d+(?:\.\d+)?)$/)
  if (numeric) {
    return unit ? `${numeric[1]} ${unit}` : numeric[1]
  }

  if (unit) {
    const labelled = stringValue.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${unit}$`, 'i'))
    if (labelled) {
      return `${labelled[1]} ${unit}`
    }
  }

  const genericLabelled = stringValue.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/)
  if (genericLabelled) {
    return `${genericLabelled[1]} ${genericLabelled[2].toUpperCase()}`
  }

  if (/[A-Za-z]/.test(stringValue)) {
    return stringValue.replace(/\s+/g, ' ')
  }

  return unit ? `${stringValue} ${unit}` : stringValue
}

function extractCostFromName(rawName, units) {
  if (!rawName || typeof rawName !== 'string') {
    return { cleanName: rawName || '', inferredCost: null }
  }

  const unitPattern = Array.isArray(units) && units.length
    ? units.map(unit => unit.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')
    : 'AP'

  const costRegex = new RegExp(`\\(([^)]*?\\b\\d+(?:\\.\\d+)?\\s*(?:${unitPattern}))\\)`, 'i')
  const match = rawName.match(costRegex)
  if (!match) {
    return { cleanName: rawName.trim(), inferredCost: null }
  }

  const cleanName = `${rawName.slice(0, match.index)}${rawName.slice(match.index + match[0].length)}`
    .replace(/\s{2,}/g, ' ')
    .trim()

  return {
    cleanName: cleanName || rawName.trim(),
    inferredCost: match[1]
  }
}

function normaliseAbility(ability) {
  if (!ability) return null

  const rawName = ability.abilityName ?? ability.name ?? ''
  const { cleanName, inferredCost } = extractCostFromName(rawName, ['AP'])

  const candidateKeys = [
    'apCost',
    'ap',
    'AP',
    'apcost',
    'ap_cost',
    'apValue',
    'ap_value',
    'actionPointCost',
    'actionPointCosts',
    'actionPoints'
  ]

  let explicitAp = null
  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(ability, key)) {
      const value = ability[key]
      if (value !== undefined && value !== null && value !== '') {
        explicitAp = value
        break
      }
    }
  }

  const apCost = formatCost(explicitAp ?? inferredCost, 'AP')

  if (!cleanName && !ability.description) {
    return null
  }

  return {
    name: cleanName || rawName,
    description: ability.description,
    apCost: apCost || null
  }
}

function normaliseOption(option) {
  if (!option) return null

  const rawName = option.optionName ?? option.name ?? ''
  const { cleanName, inferredCost } = extractCostFromName(rawName, ['AP'])

  const candidateKeys = [
    'apCost',
    'ap',
    'AP',
    'apcost',
    'ap_cost',
    'apValue',
    'ap_value',
    'actionPointCost',
    'actionPointCosts',
    'actionPoints'
  ]

  let explicitAp = null
  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(option, key)) {
      const value = option[key]
      if (value !== undefined && value !== null && value !== '') {
        explicitAp = value
        break
      }
    }
  }

  const apCost = formatCost(explicitAp ?? inferredCost, 'AP')

  if (!cleanName && !option.description) {
    return null
  }

  return {
    name: cleanName || rawName,
    description: option.description,
    apCost: apCost || null
  }
}

function normaliseTextForSignature(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function abilitySignature(ability) {
  if (!ability) return ''
  const name = normaliseTextForSignature(ability?.name)
  const description = normaliseTextForSignature(ability?.description)
  const apCost = normaliseTextForSignature(ability?.apCost)
  if (!name && !description && !apCost) {
    return ''
  }
  return `${name}||${description}||${apCost}`
}

function buildTeamAnchor(prefix, name, index) {
  const slug = normaliseTextForSignature(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const base = slug ? `${prefix}-${slug}` : prefix
  return `${base}-${index + 1}`
}

function normalisePloy(ploy) {
  if (!ploy) return null

  const rawName = ploy.ployName ?? ploy.name ?? ''
  const { cleanName, inferredCost } = extractCostFromName(rawName, ['CP'])

  const candidateKeys = [
    'cpCost',
    'cp',
    'CP',
    'cost',
    'cp_cost',
    'cpValue',
    'cp_value',
    'commandPointCost',
    'commandPoints'
  ]

  let explicitCost = null
  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(ploy, key)) {
      const value = ploy[key]
      if (value !== undefined && value !== null && value !== '') {
        explicitCost = value
        break
      }
    }
  }

  const cost = formatCost(explicitCost ?? inferredCost, 'CP')

  const identifier = ploy.ployId ?? ploy.id ?? cleanName ?? rawName ?? null

  if (!cleanName && !ploy.description) {
    return null
  }

  return {
    id: identifier,
    anchorId: identifier ? `ploy-${identifier}` : undefined,
    name: cleanName || rawName,
    description: ploy.description || '',
    cost: cost || null,
    type: ploy.ployType || null
  }
}

function normaliseEquipment(equipment) {
  if (!equipment) return null

  const rawName = equipment.eqName ?? equipment.name ?? ''
  const { cleanName, inferredCost } = extractCostFromName(rawName, ['EP'])

  const candidateKeys = [
    'epCost',
    'ep',
    'EP',
    'cost',
    'equipmentPoints',
    'points',
    'ep_value',
    'epValue'
  ]

  let explicitCost = null
  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(equipment, key)) {
      const value = equipment[key]
      if (value !== undefined && value !== null && value !== '') {
        explicitCost = value
        break
      }
    }
  }

  const cost = formatCost(explicitCost ?? inferredCost, 'EP')

  if (!cleanName && !equipment.description) {
    return null
  }

  const identifier = equipment.eqId ?? equipment.id ?? cleanName ?? rawName ?? null

  return {
    id: identifier,
    anchorId: identifier ? `equipment-${identifier}` : undefined,
    name: cleanName || rawName,
    description: equipment.description || '',
    cost: cost || null,
    killteamId: equipment.killteamId ?? null,
    isUniversal: equipment.killteamId === null
  }
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
    baseSize: opType.basesize ?? null,
    keywords: splitKeywords(opType.keywords),
    specialRules: (opType.abilities || []).map(normaliseAbility).filter(Boolean),
    specialActions: (opType.options || []).map(normaliseOption).filter(Boolean),
    weapons: buildWeapons()
  }
}

export default function KillteamPage() {
  const router = useRouter()
  const { id } = router.query

  const [killteam, setKillteam] = useState(null)
  const [loading, setLoading] = useState(true)

  const setHeaderOffset = useCallback(() => {
    if (typeof window === 'undefined') return
    const header = document.querySelector('.header-sticky')
    if (!header) return
    const offset = Math.ceil(header.getBoundingClientRect().height) + 16
    document.documentElement.style.setProperty('--kt-header-offset', `${offset}px`)
  }, [])

  useEffect(() => {
    setHeaderOffset()
    if (typeof window === 'undefined') return

    window.addEventListener('resize', setHeaderOffset)
    window.addEventListener('orientationchange', setHeaderOffset)

    return () => {
      window.removeEventListener('resize', setHeaderOffset)
      window.removeEventListener('orientationchange', setHeaderOffset)
      document.documentElement.style.removeProperty('--kt-header-offset')
    }
  }, [setHeaderOffset])

  useEffect(() => {
    setHeaderOffset()
  }, [setHeaderOffset, killteam])

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

  const rawOperatives = useMemo(() => {
    if (!killteam?.opTypes) return []
    return killteam.opTypes
      .map(normaliseOperative)
      .filter(Boolean)
  }, [killteam])

  const teamAbilities = useMemo(() => {
    if (!rawOperatives.length) return []

    const abilityLists = rawOperatives.map(op => {
      if (!Array.isArray(op.specialRules)) return []
      return op.specialRules.filter(Boolean)
    })

    if (!abilityLists.length) return []

    const [firstList, ...otherLists] = abilityLists
    if (!firstList.length) return []

    const commonMap = new Map()

    for (const ability of firstList) {
      const signature = abilitySignature(ability)
      if (!signature || commonMap.has(signature)) continue

      const isCommon = otherLists.every(list =>
        list.some(item => abilitySignature(item) === signature)
      )

      if (isCommon) {
        commonMap.set(signature, ability)
      }
    }

    if (!commonMap.size) return []

    return Array.from(commonMap.values()).map((ability, index) => ({
      ...ability,
      anchorId: buildTeamAnchor('team-ability', ability?.name, index)
    }))
  }, [rawOperatives])

  const teamAbilitySignatures = useMemo(() => {
    if (!teamAbilities.length) return null
    const signatures = teamAbilities
      .map(abilitySignature)
      .filter(Boolean)
    return signatures.length ? new Set(signatures) : null
  }, [teamAbilities])

  const teamOptions = useMemo(() => {
    if (!rawOperatives.length) return []

    const optionLists = rawOperatives.map(op => {
      if (!Array.isArray(op.specialActions)) return []
      return op.specialActions.filter(Boolean)
    })

    if (!optionLists.length) return []

    const [firstList, ...otherLists] = optionLists
    if (!firstList.length) return []

    const commonMap = new Map()

    for (const option of firstList) {
      const signature = abilitySignature(option)
      if (!signature || commonMap.has(signature)) continue

      const isCommon = otherLists.every(list =>
        list.some(item => abilitySignature(item) === signature)
      )

      if (isCommon) {
        commonMap.set(signature, option)
      }
    }

    if (!commonMap.size) return []

    return Array.from(commonMap.values()).map((option, index) => ({
      ...option,
      anchorId: buildTeamAnchor('team-option', option?.name, index)
    }))
  }, [rawOperatives])

  const teamOptionSignatures = useMemo(() => {
    if (!teamOptions.length) return null
    const signatures = teamOptions
      .map(abilitySignature)
      .filter(Boolean)
    return signatures.length ? new Set(signatures) : null
  }, [teamOptions])

  const factionRules = useMemo(() => {
    const combined = []

    if (Array.isArray(teamAbilities) && teamAbilities.length) {
      for (const ability of teamAbilities) {
        if (!ability) continue
        combined.push({
          ...ability,
          sourceType: 'ability'
        })
      }
    }

    if (Array.isArray(teamOptions) && teamOptions.length) {
      for (const option of teamOptions) {
        if (!option) continue
        combined.push({
          ...option,
          sourceType: 'option'
        })
      }
    }

    return combined.map((rule, index) => ({
      ...rule,
      anchorId: buildTeamAnchor('faction-rule', rule?.name, index)
    }))
  }, [teamAbilities, teamOptions])

  const operatives = useMemo(() => {
    if (!rawOperatives.length) return []
    if (
      (!teamAbilitySignatures || teamAbilitySignatures.size === 0) &&
      (!teamOptionSignatures || teamOptionSignatures.size === 0)
    ) {
      return rawOperatives
    }

    return rawOperatives.map(operative => {
      const abilities = Array.isArray(operative.specialRules) ? operative.specialRules : []
      const options = Array.isArray(operative.specialActions) ? operative.specialActions : []

      const filteredAbilities = !abilities.length || !teamAbilitySignatures
        ? abilities
        : abilities.filter(ability => !teamAbilitySignatures.has(abilitySignature(ability)))

      const filteredOptions = !options.length || !teamOptionSignatures
        ? options
        : options.filter(option => !teamOptionSignatures.has(abilitySignature(option)))

      if (filteredAbilities.length === abilities.length && filteredOptions.length === options.length) {
        return operative
      }

      return {
        ...operative,
        specialRules: filteredAbilities,
        specialActions: filteredOptions
      }
    })
  }, [rawOperatives, teamAbilitySignatures, teamOptionSignatures])

  const strategicPloys = useMemo(() => {
    return (killteam?.ploys || [])
      .filter(ploy => ploy?.ployType === 'S')
      .map(normalisePloy)
      .filter(Boolean)
  }, [killteam])

  const firefightPloys = useMemo(() => {
    return (killteam?.ploys || [])
      .filter(ploy => ploy?.ployType && ploy.ployType !== 'S')
      .map(normalisePloy)
      .filter(Boolean)
  }, [killteam])

  const equipment = useMemo(() => {
    return (killteam?.equipments || []).map(normaliseEquipment).filter(Boolean)
  }, [killteam])

  const factionEquipment = useMemo(() => {
    return equipment.filter(item => !item.isUniversal)
  }, [equipment])

  const universalEquipment = useMemo(() => {
    return equipment.filter(item => item.isUniversal)
  }, [equipment])

  if (loading) {
    return (
      <>
        <Seo title="Loading Kill Team" description="Loading kill team data." />
        <div className="container">
          <Header />
          <div className="card">Loading…</div>
        </div>
      </>
    )
  }

  if (!killteam) {
    return (
      <>
        <Seo
          title="Kill Team Not Found"
          description={id ? `We couldn’t find data for ${id}. Try refreshing your data from the menu.` : 'We couldn’t find data for this kill team.'}
        />
        <div className="container">
          <Header />
            <div className="card">
            <h2 style={{ marginTop: 0 }}>Kill Team not found</h2>
            <p className="muted">We couldn’t find data for <code>{id}</code>. Try refreshing your data from the menu.</p>
          </div>
        </div>
      </>
    )
  }

  const archetypes = parseArchetypes(killteam.archetypes)
  const killteamTitle =
    killteam.killteamName ||
    killteam.killteamDisplayName ||
    killteam.killteamId ||
    'Kill Team'
  const fallbackDescription = `Review ${killteamTitle} operatives, ploys, equipment, and abilities for Kill Team 2024.`
  const seoDescription = killteam.description || fallbackDescription

  return (
    <>
      <Seo title={killteamTitle} description={seoDescription} type="article" />
      <div className="container">
        <Header />
        <div className="card killteam-selector-sticky">
          <KillteamSelector currentKillteamId={killteam.killteamId} />
          <div style={{ marginTop: '0.5rem' }}>
            <KillteamSectionNavigator
              killteam={killteam}
              factionRules={factionRules}
            />
          </div>
        </div>

        <div className="card">
          <section id="killteam-overview">
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem',
                marginBottom: '0.75rem'
              }}
            >
              <h2 style={{ margin: 0 }}>{killteam.killteamName}</h2>
              {archetypes.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' }}>
                  {archetypes.map(archetype => (
                    <span key={archetype} className="pill">{archetype}</span>
                  ))}
                </div>
              )}
            </div>
            {killteam.description && <RichText className="muted" text={killteam.description} />}
          </section>

          {killteam.composition && (
            <section id="killteam-composition" className="card" style={{ marginTop: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Composition</h3>
              <RichText className="muted" text={killteam.composition} />
            </section>
          )}

          {factionRules.length > 0 && (
            <section id="faction-rules" className="card" style={{ marginTop: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Faction Rules</h3>
              <div className="card-section-list">
                {factionRules.map((rule, idx) => (
                  <div
                    key={rule.anchorId || rule.name || idx}
                    id={rule.anchorId}
                    className="ability-card"
                  >
                    <div className="ability-card-header">
                      <h4 className="ability-card-title">{rule.name || 'Rule'}</h4>
                      {rule.apCost && <span className="ability-card-ap">{rule.apCost}</span>}
                    </div>
                    {rule.description && (
                      <RichText className="ability-card-body" text={rule.description} />
                    )}
                  </div>
                ))}
              </div>
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
            {strategicPloys.length ? (
              <div className="card-section-list">
                {strategicPloys.map((ploy, idx) => (
                  <div key={ploy.id || idx} id={ploy.anchorId} className="ability-card">
                    <div className="ability-card-header">
                      <h4 className="ability-card-title">{ploy.name}</h4>
                      {ploy.cost && <span className="ability-card-ap">{ploy.cost}</span>}
                    </div>
                    {ploy.description && <RichText className="ability-card-body" text={ploy.description} />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">No strategic ploys available.</div>
            )}
          </section>

          <section id="firefight-ploys" className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Firefight Ploys</h3>
            {firefightPloys.length ? (
              <div className="card-section-list">
                {firefightPloys.map((ploy, idx) => (
                  <div key={ploy.id || idx} id={ploy.anchorId} className="ability-card">
                    <div className="ability-card-header">
                      <h4 className="ability-card-title">{ploy.name}</h4>
                      {ploy.cost && <span className="ability-card-ap">{ploy.cost}</span>}
                    </div>
                    {ploy.description && <RichText className="ability-card-body" text={ploy.description} />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">No firefight ploys available.</div>
            )}
          </section>

          <section id="equipment" className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Equipment</h3>
            {equipment.length ? (
              <>
                {factionEquipment.length > 0 && (
                  <>
                    <h4 className="muted" style={{ margin: 0, marginBottom: '0.5rem' }}>
                      Faction Equipment
                    </h4>
                    <div className="card-section-list">
                      {factionEquipment.map((item, idx) => (
                        <div key={item.id || idx} id={item.anchorId} className="ability-card">
                          <div className="ability-card-header">
                            <h4 className="ability-card-title">{item.name}</h4>
                            {item.cost && <span className="ability-card-ap">{item.cost}</span>}
                          </div>
                          {item.description && <RichText className="ability-card-body" text={item.description} />}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {universalEquipment.length > 0 && (
                  <>
                    <h4
                      className="muted"
                      style={{ marginTop: factionEquipment.length > 0 ? '1rem' : 0, marginBottom: '0.5rem' }}
                    >
                      Universal Equipment
                    </h4>
                    <div className="card-section-list">
                      {universalEquipment.map((item, idx) => (
                        <div key={item.id || idx} id={item.anchorId} className="ability-card">
                          <div className="ability-card-header">
                            <h4 className="ability-card-title">{item.name}</h4>
                            {item.cost && <span className="ability-card-ap">{item.cost}</span>}
                          </div>
                          {item.description && <RichText className="ability-card-body" text={item.description} />}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="muted">No equipment listed.</div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
