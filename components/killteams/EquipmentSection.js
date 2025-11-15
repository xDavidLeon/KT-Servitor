import ErrorBoundary from '../ErrorBoundary'
import RichText from '../RichText'

// Helper function to normalize equipment (extracted from main file)
function extractCostFromName(rawName, units) {
  if (!rawName || typeof rawName !== 'string') {
    return { cleanName: rawName || '', inferredCost: null }
  }

  const unitPattern = Array.isArray(units) && units.length
    ? units.map(unit => unit.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')
    : 'EP'

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
    isUniversal: equipment.killteamId === null,
    amount: equipment.amount ?? equipment.amountValue ?? null
  }
}

export default function EquipmentSection({ 
  killteam, 
  factionEquipment, 
  universalEquipment, 
  universalEquipmentRecords,
  equipmentActions,
  equipmentActionsLoaded,
  hasEquipment,
  factionKeyword 
}) {
  return (
    <section id="equipment" className="card killteam-tab-panel">
      <ErrorBoundary 
        fallbackMessage="Failed to load equipment"
        showDetails={process.env.NODE_ENV === 'development'}
      >
        {hasEquipment ? (
          <>
            {factionEquipment.length > 0 && (
              <div className="card-section-list">
                  {factionEquipment.map((item, idx) => {
                    // Get the original equipment record to access amount
                    const equipmentRecord = killteam?.equipments?.find(rec => {
                      const normalized = normaliseEquipment(rec)
                      return normalized && (normalized.id === item.id || normalized.anchorId === item.anchorId)
                    })
                    return (
                      <ErrorBoundary 
                        key={item.id || idx}
                        fallbackMessage={`Failed to load equipment: ${item.name || 'Unknown'}`}
                        showDetails={false}
                      >
                        <div id={item.anchorId} className="ability-card equipment-card">
                      <div style={{ 
                        background: '#333333', 
                        color: '#ffffff', 
                        padding: '0.5rem 0.75rem', 
                        margin: '-0.5rem -0.5rem 0.5rem -0.5rem',
                        borderRadius: '8px 8px 0 0',
                        textAlign: 'center',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}>
                        FACTION EQUIPMENT
                      </div>
                      <div className="ability-card-header">
                        <h4 className="ability-card-title" style={{ 
                          textTransform: 'uppercase',
                          border: '1px solid #333333',
                          padding: '0.25rem 0.5rem',
                          display: 'block',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}>
                          {(() => {
                            const amount = item.amount ?? (equipmentRecord?.amount ?? equipmentRecord?.amountValue) ?? null
                            const name = item.name || ''
                            return amount ? `${amount} x ${name}` : name
                          })()}
                        </h4>
                        {item.cost && <span className="ability-card-ap">{item.cost}</span>}
                      </div>
                      {item.description && <RichText className="ability-card-body" text={item.description} highlightText={factionKeyword} />}
                        </div>
                      </ErrorBoundary>
                    )
                  })}
              </div>
            )}

            {universalEquipment.length > 0 && (
              <div className="card-section-list" style={{ marginTop: factionEquipment.length > 0 ? '0.75rem' : 0 }}>
                  {(() => {
                    // Create a map of action IDs to action definitions for quick lookup
                    const actionsMap = new Map()
                    if (equipmentActionsLoaded && Array.isArray(equipmentActions)) {
                      for (const action of equipmentActions) {
                        if (action && action.id) {
                          actionsMap.set(action.id, action)
                        }
                      }
                    }
                    
                    return universalEquipment.map((item, idx) => {
                      // Get the original equipment record to access actions
                      const equipmentRecord = universalEquipmentRecords.find(rec => {
                        const normalized = normaliseEquipment(rec)
                        return normalized && (normalized.id === item.id || normalized.anchorId === item.anchorId)
                      })
                      
                      // Get actions for this equipment item
                      const equipmentActionIds = Array.isArray(equipmentRecord?.actions) ? equipmentRecord.actions.filter(Boolean) : []
                      const equipmentActionsList = equipmentActionIds
                        .map(actionId => actionsMap.get(actionId))
                        .filter(action => action !== undefined)
                        .map(action => ({
                          id: action.id,
                          name: action.name,
                          ap: action.AP ?? null,
                          description: action.description || '',
                          effects: Array.isArray(action.effects) ? action.effects.filter(Boolean) : [],
                          conditions: Array.isArray(action.conditions) ? action.conditions.filter(Boolean) : [],
                          packs: Array.isArray(action.packs) ? action.packs.filter(Boolean) : [],
                          type: (action.type || '').toLowerCase() || 'ability',
                          fromEquipment: true
                        }))
                      
                      return (
                        <ErrorBoundary 
                          key={item.id || idx}
                          fallbackMessage={`Failed to load equipment: ${item.name || 'Unknown'}`}
                          showDetails={false}
                        >
                          <div id={item.anchorId} className="ability-card equipment-card">
                            <div style={{ 
                              background: '#333333', 
                              color: '#ffffff', 
                              padding: '0.5rem 0.75rem', 
                              margin: '-0.5rem -0.5rem 0.5rem -0.5rem',
                              borderRadius: '8px 8px 0 0',
                              textAlign: 'center',
                              fontWeight: 600,
                              textTransform: 'uppercase'
                            }}>
                              UNIVERSAL EQUIPMENT
                            </div>
                            <div className="ability-card-header">
                              <h4 className="ability-card-title" style={{ 
                                textTransform: 'uppercase',
                                border: '1px solid #333333',
                                padding: '0.25rem 0.5rem',
                                display: 'block',
                                width: '100%',
                                boxSizing: 'border-box'
                              }}>
                                {(() => {
                                  const amount = item.amount ?? (equipmentRecord?.amount) ?? null
                                  const name = item.name || ''
                                  return amount ? `${amount} x ${name}` : name
                                })()}
                              </h4>
                              {item.cost && <span className="ability-card-ap">{item.cost}</span>}
                            </div>
                            {item.description && <RichText className="ability-card-body" text={item.description} />}
                            {(() => {
                              const effectsText = Array.isArray(equipmentRecord?.effects)
                                ? equipmentRecord.effects.filter(Boolean).join(', ')
                                : (equipmentRecord?.effects || '')
                              const trimmed = effectsText.trim()
                              if (!trimmed) return null
                              return (
                                <div className="muted" style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                                  {trimmed}
                                </div>
                              )
                            })()}
                            {/* Render actions inside the equipment card */}
                            {equipmentActionsList.length > 0 && (
                              <div style={{ marginTop: '1rem', borderTop: '1px solid #2a2f3f', paddingTop: '1rem' }}>
                                {equipmentActionsList.map((action, actionIndex) => {
                                  const apLabel = action.ap === null || action.ap === undefined ? null : `${action.ap} AP`
                                  const showEquipmentLabel = action.fromEquipment === true
                                  const hasPacks = action.packs && action.packs.length > 0
                                  const actionType = action.type || 'ability'
                                  const actionTypeLabel = (actionType === 'universal' ? 'Universal' : actionType === 'mission' ? 'Mission' : actionType === 'ability' ? 'Ability' : actionType.charAt(0).toUpperCase() + actionType.slice(1)) + ' Action'
                                  
                                  return (
                                    <div key={`${item.id}-${action.id}-${actionIndex}`} id={`equipment-action-${item.id || item.anchorId}-${action.id}${actionIndex > 0 ? `-${actionIndex}` : ''}`} className="action-card" style={{ marginBottom: actionIndex < equipmentActionsList.length - 1 ? '1rem' : 0 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <h4 className="ability-card-title" style={{ margin: 0 }}>{action.name.toUpperCase()}</h4>
                                        {apLabel && <span className="ability-card-ap">{apLabel}</span>}
                                      </div>
                                      {(action.description || action.effects.length > 0 || action.conditions.length > 0) && (
                                        <div className="ability-card-body" style={{ marginBottom: '0.75rem' }}>
                                          {action.description && (
                                            <p style={{ marginTop: 0 }}>{action.description}</p>
                                          )}
                                          {action.effects.length > 0 && (
                                            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                              {action.effects.map((effect, effectIndex) => (
                                                <li
                                                  key={`${action.id}-effect-${effectIndex}`}
                                                  style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                                                >
                                                  <span aria-hidden="true" style={{ color: '#2ecc71', fontWeight: 'bold' }}>➤</span>
                                                  <span>{typeof effect === 'string' ? effect : String(effect)}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                          {action.conditions.length > 0 && (
                                            <ul style={{ margin: action.effects.length ? '0.5rem 0 0 0' : 0, padding: 0, listStyle: 'none' }}>
                                              {action.conditions.map((condition, conditionIndex) => (
                                                <li
                                                  key={`${action.id}-condition-${conditionIndex}`}
                                                  style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                                                >
                                                  <span aria-hidden="true" style={{ color: '#e74c3c', fontWeight: 'bold' }}>◆</span>
                                                  <span>{typeof condition === 'string' ? condition : String(condition)}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      )}
                                      {/* Footer: Action type and packs */}
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
                                        <span style={{ color: '#F55A07' }}>{actionTypeLabel.toUpperCase()}</span>
                                        {hasPacks && action.packs.length > 0 && (
                                          <>
                                            {', '}
                                            {action.packs.map((pack, idx) => (
                                              <span key={`${action.id}-pack-${idx}`}>
                                                {idx > 0 && ', '}
                                                {pack.toUpperCase()}
                                              </span>
                                            ))}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </ErrorBoundary>
                      )
                    })
                  })()}
              </div>
            )}
          </>
        ) : (
          <div className="muted">No equipment listed.</div>
        )}
      </ErrorBoundary>
    </section>
  )
}

