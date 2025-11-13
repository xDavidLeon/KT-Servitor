import { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import Seo from '../components/Seo'
import { db } from '../lib/db'

const TURNING_POINTS = [1, 2, 3, 4]
const MAX_OP_SCORE_PER_TP = 2
const SCOREBOARD_STORAGE_KEY = 'kt-servitor-scoreboard-v1'
const PLAYER_COLORS = ['#be123c', '#1d4ed8']

const PRIMARY_OPTIONS = [
  { value: 'crit', label: 'Crit Op' },
  { value: 'tac', label: 'Tac Op' },
  { value: 'kill', label: 'Kill Op' }
]

const KILL_GRADE_TABLE = {
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 4, 5, 6],
  7: [1, 3, 4, 6, 7],
  8: [2, 3, 5, 6, 8],
  9: [2, 4, 5, 7, 9],
  10: [2, 4, 6, 8, 10],
  11: [2, 4, 7, 9, 11],
  12: [2, 5, 7, 10, 12],
  13: [3, 5, 8, 10, 13],
  14: [3, 6, 8, 11, 14]
}

const MIN_KILL_OPERATIVES = Math.min(...Object.keys(KILL_GRADE_TABLE).map(Number))
const MAX_KILL_OPERATIVES = Math.max(...Object.keys(KILL_GRADE_TABLE).map(Number))

function clamp(value, min, max) {
  if (typeof value !== 'number' || Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

function createPlayerState(name) {
  return {
    name,
    killteamId: '',
    customKillteam: '',
    crit: Array(TURNING_POINTS.length).fill(0),
    tac: Array(TURNING_POINTS.length).fill(0),
    enemyOperatives: 10,
    enemyKilled: 0,
    primaryOp: 'crit',
    revealPrimary: false
  }
}

function resolveKillThresholds(enemyOperatives) {
  if (typeof enemyOperatives !== 'number' || Number.isNaN(enemyOperatives)) {
    return { thresholds: null, usedValue: null, isExact: false }
  }
  const rounded = Math.round(enemyOperatives)
  if (KILL_GRADE_TABLE[rounded]) {
    return { thresholds: KILL_GRADE_TABLE[rounded], usedValue: rounded, isExact: rounded === enemyOperatives }
  }

  const values = Object.keys(KILL_GRADE_TABLE).map(Number)
  const nearest = values.reduce((closest, current) => {
    if (closest === null) return current
    const diffCurrent = Math.abs(current - rounded)
    const diffClosest = Math.abs(closest - rounded)
    if (diffCurrent < diffClosest) return current
    if (diffCurrent === diffClosest && current > closest) return current
    return closest
  }, null)

  if (!nearest) {
    return { thresholds: null, usedValue: null, isExact: false }
  }

  return { thresholds: KILL_GRADE_TABLE[nearest], usedValue: nearest, isExact: nearest === enemyOperatives }
}

function computeKillScore(enemyOperatives, kills) {
  const { thresholds } = resolveKillThresholds(enemyOperatives)
  if (!thresholds) return 0
  return thresholds.reduce((total, threshold) => (kills >= threshold ? total + 1 : total), 0)
}

function sanitizePlayer(player, fallbackName) {
  const base = createPlayerState(fallbackName)
  if (!player || typeof player !== 'object') return base

  const next = { ...base }

  const name = typeof player.name === 'string' ? player.name.trim() : ''
  next.name = name || base.name

  next.killteamId = typeof player.killteamId === 'string' ? player.killteamId : ''
  next.customKillteam = typeof player.customKillteam === 'string' ? player.customKillteam : ''

  next.crit = TURNING_POINTS.map((_, index) => {
    if (index === 0) return 0
    const value = Array.isArray(player.crit) ? Number(player.crit[index]) : Number.NaN
    return clamp(Math.round(value), 0, MAX_OP_SCORE_PER_TP)
  })

  next.tac = TURNING_POINTS.map((_, index) => {
    if (index === 0) return 0
    const value = Array.isArray(player.tac) ? Number(player.tac[index]) : Number.NaN
    return clamp(Math.round(value), 0, MAX_OP_SCORE_PER_TP)
  })

  const enemyOperatives = clamp(
    Math.round(Number(player.enemyOperatives)),
    1,
    30
  )
  next.enemyOperatives = enemyOperatives
  next.enemyKilled = clamp(Math.round(Number(player.enemyKilled)), 0, enemyOperatives)

  next.primaryOp = PRIMARY_OPTIONS.some(option => option.value === player.primaryOp)
    ? player.primaryOp
    : base.primaryOp
  next.revealPrimary = Boolean(player.revealPrimary)

  return next
}

function computePlayerTotals(player) {
  const critTotal = player.crit.reduce((sum, value) => sum + value, 0)
  const tacTotal = player.tac.reduce((sum, value) => sum + value, 0)
  const killTotal = computeKillScore(player.enemyOperatives, player.enemyKilled)

  const primarySource = player.primaryOp === 'crit'
    ? critTotal
    : player.primaryOp === 'tac'
      ? tacTotal
      : killTotal

  const primaryBonus = player.revealPrimary ? Math.floor(primarySource / 2) : 0
  const total = critTotal + tacTotal + killTotal + primaryBonus

  return { critTotal, tacTotal, killTotal, primarySource, primaryBonus, total }
}

function loadStoredPlayers() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SCOREBOARD_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const players = parsed.map((item, index) => sanitizePlayer(item, `Player ${index + 1}`))
    if (players.length === 1) {
      players.push(sanitizePlayer(null, 'Player 2'))
    }
    return players.slice(0, 2)
  } catch (err) {
    console.warn('Failed to load scoreboard state', err)
    return null
  }
}

function useIsCompact(breakpoint = 640) {
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const query = window.matchMedia(`(max-width: ${breakpoint}px)`)

    const handleChange = (event) => {
      setIsCompact(event.matches)
    }

    setIsCompact(query.matches)

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleChange)
      return () => query.removeEventListener('change', handleChange)
    }

    query.addListener(handleChange)
    return () => query.removeListener(handleChange)
  }, [breakpoint])

  return isCompact
}

function Stepper({
  value,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  onChange,
  ariaLabel,
  size = 'md',
  disabled = false
}) {
  const sizeMap = {
    sm: { height: '1.8rem', fontSize: '0.85rem', buttonWidth: '1.8rem', labelMinWidth: '1.6rem', gap: '0.3rem' },
    md: { height: '2rem', fontSize: '0.95rem', buttonWidth: '2rem', labelMinWidth: '1.75rem', gap: '0.4rem' },
    lg: { height: '2.4rem', fontSize: '1.1rem', buttonWidth: '2.4rem', labelMinWidth: '2.2rem', gap: '0.45rem' }
  }

  const { height, fontSize, buttonWidth, labelMinWidth, gap } = sizeMap[size] || sizeMap.md

  const handleAdjust = (delta) => {
    if (disabled) return
    const next = clamp(value + delta, min, max)
    if (next !== value) onChange(next)
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap
      }}
    >
      <button
        type="button"
        onClick={() => handleAdjust(-1)}
        disabled={disabled || value <= min}
        aria-label={ariaLabel ? `${ariaLabel} decrease` : undefined}
        style={{
          background: disabled ? '#141828' : '#0e1016',
          border: '1px solid #2a2f3f',
          color: disabled ? 'var(--muted)' : 'var(--text)',
          borderRadius: '8px',
          width: buttonWidth,
          height,
          fontSize,
          cursor: disabled || value <= min ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1
        }}
      >
        –
      </button>
      <div
        style={{
          minWidth: labelMinWidth,
          textAlign: 'center',
          fontWeight: 600,
          fontSize,
          color: disabled ? 'var(--muted)' : 'var(--text)'
        }}
      >
        {value}
      </div>
      <button
        type="button"
        onClick={() => handleAdjust(1)}
        disabled={disabled || value >= max}
        aria-label={ariaLabel ? `${ariaLabel} increase` : undefined}
        style={{
          background: disabled ? '#141828' : '#0e1016',
          border: '1px solid #2a2f3f',
          color: disabled ? 'var(--muted)' : 'var(--text)',
          borderRadius: '8px',
          width: buttonWidth,
          height,
          fontSize,
          cursor: disabled || value >= max ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1
        }}
      >
        +
      </button>
    </div>
  )
}

function KillThresholdTrack({ thresholds, kills }) {
  if (!Array.isArray(thresholds) || thresholds.length === 0) return null
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}
    >
      {thresholds.map((threshold, index) => {
        const achieved = kills >= threshold
        return (
          <div
            key={threshold}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '0.4rem 0.55rem',
              minWidth: '3.25rem',
              borderRadius: '10px',
              border: `1px solid ${achieved ? 'var(--accent)' : '#2a2f3f'}`,
              background: achieved ? 'rgba(251, 146, 60, 0.1)' : '#10131a',
              color: achieved ? 'var(--accent)' : 'var(--muted)',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              VP {index + 1}
            </span>
            <span>{threshold}</span>
          </div>
        )
      })}
    </div>
  )
}

function PlayerCard({ index, player, killteams, onChange, isCompact }) {
  const totals = useMemo(() => computePlayerTotals(player), [player])
  const { thresholds, usedValue, isExact } = useMemo(
    () => resolveKillThresholds(player.enemyOperatives),
    [player.enemyOperatives]
  )
  const selectedKillteam = useMemo(
    () => killteams.find(kt => kt.killteamId === player.killteamId),
    [killteams, player.killteamId]
  )
  const killteamLabel = player.customKillteam?.trim() || selectedKillteam?.killteamName || 'Kill team not set'

  const updatePlayer = (updater) => {
    onChange(prev => {
      const result = typeof updater === 'function' ? updater(prev) : updater
      return sanitizePlayer(result, `Player ${index + 1}`)
    })
  }

  const handleVpChange = (rowKey, tpIndex, nextValue) => {
    updatePlayer(prev => {
      const updated = { ...prev }
      const nextArray = [...updated[rowKey]]
      nextArray[tpIndex] = nextValue
      updated[rowKey] = nextArray
      return updated
    })
  }

  const renderVpControl = (rowKey, tpIndex, controlSize = isCompact ? 'md' : 'sm') => (
    <Stepper
      value={player[rowKey][tpIndex]}
      min={0}
      max={MAX_OP_SCORE_PER_TP}
      ariaLabel={`${rowKey === 'crit' ? 'Crit op' : 'Tac op'} TP${tpIndex + 1}`}
      onChange={(nextValue) => handleVpChange(rowKey, tpIndex, nextValue)}
      disabled={tpIndex === 0}
      size={controlSize}
    />
  )

  return (
    <section
      className="card"
      style={{
        background: '#131722',
        border: `1px solid rgba(255, 255, 255, 0.08)`,
        flex: '1 1 320px',
        display: 'flex',
        flexDirection: 'column',
        gap: isCompact ? '1rem' : '1.25rem'
      }}
    >
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <h2 style={{ margin: 0 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span
                style={{
                  width: '0.65rem',
                  height: '2.2rem',
                  background: PLAYER_COLORS[index] || 'var(--accent)',
                  borderRadius: '999px'
                }}
              />
              Player {index + 1}
            </span>
          </h2>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{killteamLabel}</div>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Player Name
          </span>
          <input
            type="text"
            value={player.name}
            onChange={(event) => {
              const value = event.target.value
              updatePlayer(prev => ({ ...prev, name: value }))
            }}
            placeholder="Player name"
            style={{ width: '100%' }}
          />
        </label>
        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Kill Team
            </span>
            <select
              value={player.killteamId}
              onChange={(event) => {
                const value = event.target.value
                updatePlayer(prev => ({ ...prev, killteamId: value }))
              }}
            >
              <option value="">Select kill team…</option>
              {killteams.map(team => (
                <option key={team.killteamId} value={team.killteamId}>
                  {team.killteamName}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Display Name (optional)
            </span>
            <input
              type="text"
              value={player.customKillteam}
              onChange={(event) => {
                const value = event.target.value
                updatePlayer(prev => ({ ...prev, customKillteam: value }))
              }}
              placeholder="Custom label shown on the card"
            />
          </label>
        </div>
      </header>

      <section>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Turning Point VP</h3>
        {isCompact ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {TURNING_POINTS.map((tp, tpIndex) => {
              const locked = tpIndex === 0
              return (
                <div
                  key={tp}
                  style={{
                    padding: '0.75rem',
                    background: '#10131a',
                    borderRadius: '12px',
                    border: '1px solid #1f2433',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <strong style={{ fontSize: '0.95rem' }}>TP{tp}</strong>
                    {locked && (
                      <span
                        className="pill"
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.5rem',
                          borderColor: '#2a2f3f',
                          color: 'var(--muted)'
                        }}
                      >
                        Primary selection
                      </span>
                    )}
                  </div>
                  {['crit', 'tac'].map((rowKey) => (
                    <div
                      key={`${rowKey}-${tp}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.65rem'
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', color: 'var(--muted)', flexShrink: 0 }}>
                        {rowKey === 'crit' ? 'Crit Op' : 'Tac Op'}
                      </span>
                      {renderVpControl(rowKey, tpIndex)}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ overflowX: 'hidden' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed'
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.45rem', fontSize: '0.8rem', color: 'var(--muted)' }} />
                  {TURNING_POINTS.map(tp => (
                    <th
                      key={tp}
                      style={{
                        textAlign: 'center',
                        padding: '0.45rem',
                        fontSize: '0.8rem',
                        color: 'var(--muted)'
                      }}
                    >
                      TP{tp}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['crit', 'tac'].map((rowKey) => (
                  <tr key={rowKey}>
                    <th
                      scope="row"
                      style={{
                        textAlign: 'left',
                        padding: '0.55rem 0.45rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text)',
                        background: '#10131a'
                      }}
                    >
                      {rowKey === 'crit' ? 'Crit Op' : 'Tac Op'}
                    </th>
                    {TURNING_POINTS.map((_, tpIndex) => (
                      <td
                        key={tpIndex}
                        style={{
                          textAlign: 'center',
                          padding: '0.55rem 0.35rem',
                          borderBottom: '1px solid #1f2433',
                          minWidth: '3.4rem'
                        }}
                      >
                        {renderVpControl(rowKey, tpIndex)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1rem',
            background: '#10131a',
            borderRadius: '12px',
            border: '1px solid #1f2433'
          }}
        >
          <h4 style={{ margin: 0 }}>Kill Op Tracker</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
            <Stepper
              value={player.enemyOperatives}
              min={1}
              max={30}
              ariaLabel="Enemy operatives at start"
              onChange={(nextValue) => {
                updatePlayer(prev => {
                  const updated = { ...prev }
                  updated.enemyOperatives = nextValue
                  if (updated.enemyKilled > nextValue) {
                    updated.enemyKilled = nextValue
                  }
                  return updated
                })
              }}
              size="lg"
            />
            <Stepper
              value={player.enemyKilled}
              min={0}
              max={player.enemyOperatives}
              ariaLabel="Enemy operatives incapacitated"
              onChange={(nextValue) => {
                updatePlayer(prev => ({ ...prev, enemyKilled: nextValue }))
              }}
              size="lg"
            />
          </div>
          <KillThresholdTrack thresholds={thresholds} kills={player.enemyKilled} />
          {player.enemyOperatives < MIN_KILL_OPERATIVES || player.enemyOperatives > MAX_KILL_OPERATIVES ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              Kill grade chart covers {MIN_KILL_OPERATIVES}–{MAX_KILL_OPERATIVES} operatives. Using closest value ({usedValue}) for scoring.
            </p>
          ) : !isExact ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              Rounded to {usedValue} operatives for kill grade thresholds.
            </p>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1rem',
            background: '#10131a',
            borderRadius: '12px',
            border: '1px solid #1f2433'
          }}
        >
          <h4 style={{ margin: 0 }}>Primary Op Selection</h4>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Chosen primary
            </span>
            <select
              value={player.primaryOp}
              onChange={(event) => {
                const value = event.target.value
                updatePlayer(prev => ({ ...prev, primaryOp: value }))
              }}
            >
              {PRIMARY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={player.revealPrimary}
              onChange={(event) => {
                const checked = event.target.checked
                updatePlayer(prev => ({ ...prev, revealPrimary: checked }))
              }}
            />
            <span>Primary OP revealed</span>
          </label>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              fontSize: '0.9rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>Primary op VP</span>
              <strong>{totals.primarySource}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>Primary bonus</span>
              <strong>∑ {totals.primaryBonus}</strong>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'
        }}
      >
        {[
          { label: 'Crit Op VP', value: totals.critTotal },
          { label: 'Tac Op VP', value: totals.tacTotal },
          { label: 'Kill Op VP', value: totals.killTotal },
          { label: 'Primary Bonus', value: `∑ ${totals.primaryBonus}` },
          { label: 'Total VP', value: totals.total }
        ].map(item => (
          <div
            key={item.label}
            style={{
              padding: '0.9rem',
              background: '#10131a',
              borderRadius: '12px',
              border: '1px solid #1f2433',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              alignItems: 'center',
              textAlign: 'center'
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {item.label}
            </span>
            <strong style={{ fontSize: '1.4rem', color: item.label === 'Total VP' ? 'var(--accent)' : 'var(--text)' }}>
              {item.value}
            </strong>
          </div>
        ))}
      </section>
    </section>
  )
}

export default function Scoreboard() {
  const [players, setPlayers] = useState(() => [createPlayerState('Player 1'), createPlayerState('Player 2')])
  const [killteams, setKillteams] = useState([])
  const isCompact = useIsCompact()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = loadStoredPlayers()
    if (stored) {
      setPlayers(stored)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(SCOREBOARD_STORAGE_KEY, JSON.stringify(players))
    } catch (err) {
      console.warn('Failed to persist scoreboard state', err)
    }
  }, [players])

  useEffect(() => {
    let cancelled = false
    async function loadKillteams() {
      try {
        const rows = await db.killteams.orderBy('killteamName').toArray()
        if (!cancelled) {
          setKillteams(rows)
        }
      } catch (err) {
        console.warn('Failed to load kill teams', err)
      }
    }
    loadKillteams()
    return () => {
      cancelled = true
    }
  }, [])

  const getKillteamName = (player) => {
    const found = killteams.find(team => team.killteamId === player.killteamId)
    return player.customKillteam?.trim() || found?.killteamName || 'Kill team not set'
  }

  const playerSummaries = useMemo(() => players.map((player, index) => {
    const totals = computePlayerTotals(player)
    return {
      name: player.name,
      killteam: getKillteamName(player),
      color: PLAYER_COLORS[index] || 'var(--accent)',
      ...totals
    }
  }), [players, killteams])

  const scoreDelta = Math.abs(playerSummaries[0]?.total - playerSummaries[1]?.total || 0)
  const leader =
    playerSummaries[0]?.total === playerSummaries[1]?.total
      ? null
      : playerSummaries[0]?.total > playerSummaries[1]?.total
        ? playerSummaries[0]
        : playerSummaries[1]

  const resetScoreboard = () => {
    setPlayers([createPlayerState('Player 1'), createPlayerState('Player 2')])
  }

  return (
    <>
      <Seo
        title="Scoreboard"
        description="Track turning point scoring, kill progress, and primary op bonuses for both players across a full Kill Team battle."
      />
      <div className="container">
        <Header />
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'center'
              }}
            >
              <div>
                <h1 style={{ margin: 0 }}>Scoreboard</h1>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>
                  Record Crit, Tac, and Kill Op VP each turning point, then reveal primaries to add the bonus at the end of the battle.
                </p>
              </div>
              <button
                type="button"
                onClick={resetScoreboard}
                style={{
                  background: 'transparent',
                  border: '1px solid #2a2f3f',
                  color: 'var(--muted)',
                  borderRadius: '10px',
                  padding: '0.6rem 1rem',
                  cursor: 'pointer'
                }}
              >
                Reset scoreboard
              </button>
            </div>

            <div
              style={{
                background: '#10131a',
                border: '1px solid #1f2433',
                borderRadius: '14px',
                padding: '1rem',
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
              }}
            >
              {playerSummaries.map((summary, summaryIndex) => (
                <div
                  key={summaryIndex}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '0.5rem',
                        height: '2rem',
                        borderRadius: '999px',
                        background: summary.color
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: '1.05rem' }}>{summary.name}</strong>
                      <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{summary.killteam}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Total</span>
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{summary.total}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--muted)' }}>
                    <span>Crit {summary.critTotal}</span>
                    <span>• Tac {summary.tacTotal}</span>
                    <span>• Kill {summary.killTotal}</span>
                    {summary.primaryBonus > 0 && <span>• Bonus {summary.primaryBonus}</span>}
                  </div>
                </div>
              ))}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.75rem 0',
                  borderTop: '1px solid #1f2433'
                }}
              >
                {leader ? (
                  <>
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Leader</span>
                    <strong style={{ fontSize: '1.1rem' }}>
                      {leader.name} ahead by {scoreDelta} VP
                    </strong>
                  </>
                ) : (
                  <strong style={{ fontSize: '1.1rem' }}>The game is tied</strong>
                )}
              </div>
            </div>
          </div>

            <div
              style={{
                display: 'grid',
                gap: '1.5rem',
                gridTemplateColumns: '1fr'
              }}
            >
              {players.map((player, index) => (
                <PlayerCard
                  key={index}
                  index={index}
                  player={player}
                  killteams={killteams}
                  isCompact={isCompact}
                  onChange={(updater) => {
                    setPlayers(prev =>
                      prev.map((current, idx) =>
                        idx === index
                          ? sanitizePlayer(
                            typeof updater === 'function' ? updater(current) : updater,
                            `Player ${idx + 1}`
                          )
                          : current
                      )
                    )
                  }}
                />
              ))}
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #1f2433',
                background: '#10131a',
                color: 'var(--muted)',
                fontSize: '0.85rem',
                lineHeight: 1.6
              }}
            >
              <strong style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text)' }}>Quick reference</strong>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <li>Score up to 2 VP each turning point for both Crit and Tac ops (starting at TP2).</li>
                <li>Kill Op VP unlock as enemy operatives are incapacitated following the kill grade chart.</li>
                <li>When primaries are revealed, add half of the total VP from the chosen op (rounded down).</li>
                <li>Use the reset button at any time to clear both cards and begin a new match.</li>
              </ul>
            </div>
          </div>
        </div>
      </>
    )
  }
