import RichText from '../RichText'

const ARCHETYPE_PILL_MAP = {
  infiltration: { background: '#4D4D4D', color: '#f4f6ff' },
  security: { background: '#1e5dff', color: '#f4f6ff' },
  'seek & destroy': { background: '#d62d3a', color: '#fef6f6' },
  recon: { background: '#c85c11', color: '#fff5ec' }
}

function getArchetypePillStyle(archetype) {
  if (!archetype) return null
  const normalised = String(archetype)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\band\b/gi, '&')
  const key = normalised.toLowerCase()
  const style = ARCHETYPE_PILL_MAP[key]
  if (!style) return { label: normalised }
  return {
    label: normalised,
    backgroundColor: style.background,
    borderColor: style.background,
    color: style.color
  }
}

function normaliseTacOpsText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map(item => normaliseTacOpsText(item)).filter(Boolean).join('\n\n')
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => {
        const text = normaliseTacOpsText(val)
        if (!text) return ''
        return key ? `${key.toUpperCase()}\n${text}` : text
      })
      .filter(Boolean)
      .join('\n\n')
  }
  return String(value)
}

function normaliseTacOpsAction(action) {
  if (!action) return null
  if (typeof action === 'string') {
    return {
      id: action,
      name: action,
      AP: null,
      description: '',
      effects: [],
      conditions: [],
      packs: [],
      type: '',
      seq: null
    }
  }

  const id = action.id || action.name || ''
  if (!id) return null

  const name = action.name || id
  const apValue = action.AP ?? action.ap ?? null
  const description = normaliseTacOpsText(action.description)
  const effects = Array.isArray(action.effects)
    ? action.effects.filter(Boolean)
    : action.effects
      ? [action.effects]
      : []
  const conditions = Array.isArray(action.conditions)
    ? action.conditions.filter(Boolean)
    : action.conditions
      ? [action.conditions]
      : []
  const packs = Array.isArray(action.packs)
    ? action.packs.filter(Boolean)
    : action.packs
      ? [action.packs]
      : []
  const type = (action.type || '').toLowerCase()
  const seq = typeof action.seq === 'number' ? action.seq : null

  return {
    id,
    name,
    AP: apValue,
    description,
    effects,
    conditions,
    packs,
    type,
    seq
  }
}

export default function TacOpsSection({ 
  archetypes, 
  killteamTacOps, 
  tacOpsActionLookup, 
  tacOpsLoaded, 
  tacOpsLoading, 
  tacOpsError 
}) {
  if (!Array.isArray(archetypes) || archetypes.length === 0) {
    return (
      <section id="tac-ops" className="card killteam-tab-panel">
        <div className="muted">This kill team has no assigned archetypes.</div>
      </section>
    )
  }
  if (!tacOpsLoaded) {
    if (tacOpsLoading) {
      return (
        <section id="tac-ops" className="card killteam-tab-panel">
          <div className="muted">Loading Tac Ops…</div>
        </section>
      )
    }
    return (
      <section id="tac-ops" className="card killteam-tab-panel">
        {null}
      </section>
    )
  }
  if (tacOpsError) {
    return (
      <section id="tac-ops" className="card killteam-tab-panel">
        <div className="muted">
          Failed to load Tac Ops.
          {' '}
          <span style={{ fontSize: '0.85rem' }}>{tacOpsError.message || String(tacOpsError)}</span>
        </div>
      </section>
    )
  }
  if (!killteamTacOps.length) {
    return (
      <section id="tac-ops" className="card killteam-tab-panel">
        <div className="muted">No Tac Ops available for this kill team.</div>
      </section>
    )
  }

  const renderActions = (actionsArray) => {
    if (!Array.isArray(actionsArray) || actionsArray.length === 0) return null
    return (
      <div className="card-section-list" style={{ marginTop: '0.75rem' }}>
        {actionsArray.map((action, actionIndex) => {
          const entry = typeof action === 'string'
            ? tacOpsActionLookup.get(action) || normaliseTacOpsAction(action)
            : normaliseTacOpsAction(action)
          if (!entry) return null

          const rawActionId = entry.id || entry.name || ''
          const safeActionId = String(rawActionId).trim().replace(/\s+/g, '-')
          const apLabel = entry.AP !== undefined && entry.AP !== null && entry.AP !== '' ? `${entry.AP} AP` : null

          // Determine action type label
          const actionType = (entry.type || '').toLowerCase()
          let actionTypeLabel = ''
          if (actionType === 'mission') {
            actionTypeLabel = 'MISSION ACTION'
          } else if (actionType === 'universal') {
            actionTypeLabel = 'UNIVERSAL ACTION'
          } else if (actionType) {
            // Capitalize first letter of each word for other types
            actionTypeLabel = actionType.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ').toUpperCase() + ' ACTION'
          }

          return (
            <div key={safeActionId || rawActionId}>
              {actionTypeLabel && (
                <div style={{ 
                  marginTop: actionIndex === 0 ? '0' : '0.75rem', 
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#F55A07',
                  borderBottom: '1px solid #F55A07',
                  paddingBottom: '0.25rem'
                }}>
                  {actionTypeLabel}
                </div>
              )}
              <div
                id={`operation-action-${safeActionId || rawActionId}`}
                className="ability-card action-card"
              >
                <div className="ability-card-header">
                  <h4 className="ability-card-title">{entry.name.toUpperCase()}</h4>
                  {apLabel && <span className="ability-card-ap">{apLabel}</span>}
                </div>
              {(entry.description || (entry.effects && entry.effects.length) || (entry.conditions && entry.conditions.length)) && (
                <div className="ability-card-body">
                  {entry.description && <p style={{ marginTop: 0 }}>{entry.description}</p>}
                  {entry.effects && entry.effects.length > 0 && (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {entry.effects.map((effect, index) => (
                        <li
                          key={`${safeActionId}-effect-${index}`}
                          style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                        >
                          <span aria-hidden="true" style={{ color: '#2ecc71', fontWeight: 'bold' }}>➤</span>
                          <span>{effect}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {entry.conditions && entry.conditions.length > 0 && (
                    <ul style={{ margin: entry.effects && entry.effects.length ? '0.5rem 0 0 0' : 0, padding: 0, listStyle: 'none' }}>
                      {entry.conditions.map((condition, index) => (
                        <li
                          key={`${safeActionId}-condition-${index}`}
                          style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                        >
                          <span aria-hidden="true" style={{ color: '#e74c3c', fontWeight: 'bold' }}>◆</span>
                          <span>{condition}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {/* Footer: Action type and packs */}
              {(() => {
                const hasPacks = entry.packs && Array.isArray(entry.packs) && entry.packs.length > 0
                if (!actionTypeLabel && !hasPacks) return null
                return (
                  <div
                    style={{
                      background: '#333333',
                      color: '#ffffff',
                      padding: '0.5rem 0.75rem',
                      margin: '0.75rem -0.5rem -0.5rem -0.5rem',
                      borderRadius: '0 0 8px 8px',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                      textTransform: 'uppercase'
                    }}
                  >
                    {actionTypeLabel && (
                      <span style={{ color: '#F55A07' }}>{actionTypeLabel}</span>
                    )}
                    {hasPacks && entry.packs.length > 0 && (
                      <>
                        {actionTypeLabel && ', '}
                        {entry.packs.map((pack, idx) => (
                          <span key={`${safeActionId}-pack-${idx}`}>
                            {idx > 0 && ', '}
                            {pack.toUpperCase()}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                )
              })()}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <section id="tac-ops" className="card killteam-tab-panel">
      <div className="card-section-list">
        {killteamTacOps.map(op => {
          const archetypes = Array.isArray(op.archetypes) && op.archetypes.length > 0
            ? op.archetypes.filter(Boolean)
            : []
          return (
          <div key={op.id} id={`tac-op-${op.id}`} className="card operation-card" style={{ margin: '.75rem 0', position: 'relative' }}>
            <>
              <div style={{ 
                background: '#333333', 
                color: '#ffffff', 
                padding: '0.5rem 0.75rem', 
                margin: '-0.5rem -0.5rem 0 -0.5rem',
                borderRadius: '8px 8px 0 0',
                textAlign: 'center',
                fontWeight: 600
              }}>
                TAC OP
              </div>
              {(() => {
                const archetypeLabel = (archetypes && archetypes.length > 0 && archetypes[0]) ? archetypes[0] : 'Tactical Operation'
                const style = getArchetypePillStyle(archetypeLabel)
                const label = style?.label || archetypeLabel
                return (
                  <div style={{ 
                    background: style?.backgroundColor || '#2b2d33',
                    color: style?.color || '#f4f6ff',
                    padding: '0.5rem 0.75rem', 
                    margin: '0 -0.5rem 0.75rem -0.5rem',
                    textAlign: 'center',
                    fontWeight: 600
                  }}>
                    {label.toUpperCase()}
                  </div>
                )
              })()}
            </>
            <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
              {(() => {
                const archetypeLabel = (archetypes && archetypes.length > 0 && archetypes[0]) ? archetypes[0] : 'Tactical Operation'
                const style = getArchetypePillStyle(archetypeLabel)
                return (
                  <strong style={{ 
                    fontSize: '1.1rem', 
                    color: '#ffffff',
                    background: style?.backgroundColor || '#4D4D4D',
                    padding: '0.5rem 0.75rem',
                    display: 'block',
                    borderRadius: '4px'
                  }}>
                    {op.title.toUpperCase()}
                  </strong>
                )
              })()}
            </div>

            {op.briefing && (
              <div style={{ marginTop: '0.5rem' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Briefing</strong>
                <RichText className="muted" text={op.briefing} />
              </div>
            )}

            {op.objective && (
              <div style={{ marginTop: '0.5rem' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Objective</strong>
                <RichText className="muted" text={op.objective} />
              </div>
            )}

            {op.reveal && (
              <div className="ability-card" style={{ marginTop: '0.75rem' }}>
                <div className="ability-card-header" style={{ justifyContent: 'flex-start' }}>
                  <h4 className="ability-card-title" style={{ margin: 0, color: '#F55A07' }}>REVEAL</h4>
                </div>
                <RichText className="ability-card-body muted" text={op.reveal} />
              </div>
            )}

            {op.additionalRules && (
              <div className="ability-card" style={{ marginTop: '0.75rem' }}>
                <div className="ability-card-header" style={{ justifyContent: 'flex-start' }}>
                  <h4 className="ability-card-title" style={{ margin: 0, color: '#F55A07' }}>ADDITIONAL RULES</h4>
                </div>
                <RichText className="ability-card-body muted" text={op.additionalRules} />
              </div>
            )}

            {renderActions(op.actions)}

            {op.victoryPoints && (
              <div className="ability-card" style={{ marginTop: '0.75rem' }}>
                <div className="ability-card-header" style={{ justifyContent: 'flex-start' }}>
                  <h4 className="ability-card-title" style={{ margin: 0, color: '#F55A07' }}>VICTORY POINTS</h4>
                </div>
                <RichText className="ability-card-body muted" text={op.victoryPoints} />
              </div>
            )}
          </div>
          )
        })}
      </div>
    </section>
  )
}

