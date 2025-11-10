import RichText from './RichText'

export default function OperativeCard({ operative }) {
  const anchorId = operative?.id ? `operative-${operative.id}` : undefined
  const baseSizeText = (() => {
    const value = operative?.baseSize
    if (value === null || value === undefined || value === '') return null
    const stringValue = String(value).trim()
    if (!stringValue) return null
    return stringValue.toLowerCase().endsWith('mm') ? stringValue : `${stringValue}mm`
  })()
  const keywords = Array.isArray(operative?.keywords) ? operative.keywords : []
  const hasKeywords =
    (operative?.factionKeyword && operative.factionKeyword !== 'UNKNOWN') ||
    keywords.length > 0
  const showKeywordSection = hasKeywords || !!baseSizeText

  return (
    <div id={anchorId} className="operative-card">
      <div className="operative-header">
        <h4 style={{ margin: 0 }}>{operative.name || operative.title}</h4>
      </div>

      <div className="operative-stats">
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                {operative.apl !== null && operative.apl !== undefined && <th>APL</th>}
                {operative.move && <th>MOVE</th>}
                {operative.save && <th>SAVE</th>}
                {operative.wounds !== null && operative.wounds !== undefined && <th>WOUNDS</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                {operative.apl !== null && operative.apl !== undefined && <td>{operative.apl}</td>}
                {operative.move && <td>{operative.move}</td>}
                {operative.save && <td>{operative.save}</td>}
                {operative.wounds !== null && operative.wounds !== undefined && <td>{operative.wounds}</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {operative.weapons && operative.weapons.length > 0 && (() => {
        // Sort weapons: Ranged Weapons first, then Melee Weapons, then others
        const sortedWeapons = [...operative.weapons].sort((a, b) => {
          const getTypeOrder = (type) => {
            if (type === 'Ranged Weapon') return 1;
            if (type === 'Melee Weapon') return 2;
            return 3;
          };
          return getTypeOrder(a.type) - getTypeOrder(b.type);
        });
        
        return (
          <div className="operative-weapons">
            <strong>Weapons:</strong>
            <div className="table-scroll">
              <table className="weapons-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>ATK</th>
                    <th>HIT</th>
                    <th>DMG</th>
                    <th>Special Rules</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWeapons.map((weapon, idx) => {
                    // Determine weapon type symbol
                    const weaponSymbol = weapon.type === 'Ranged Weapon' ? '⌖' : 
                                        weapon.type === 'Melee Weapon' ? '⚔' : '';
                    
                    return (
                      <tr key={idx}>
                        <td>
                          <strong>
                            {weaponSymbol && <span style={{ marginRight: '0.25rem' }}>{weaponSymbol}</span>}
                            {weapon.name}
                          </strong>
                        </td>
                        <td>{weapon.atk || '-'}</td>
                        <td>{weapon.hit || '-'}</td>
                        <td>{weapon.dmg || '-'}</td>
                        <td className="muted">
                          {weapon.specialRules && weapon.specialRules.length > 0 
                            ? weapon.specialRules.join(', ')
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
      
      {operative.specialRules && operative.specialRules.length > 0 && (
        <div className="operative-special-rules">
          <strong>Special Rules:</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            {operative.specialRules.map((rule, idx) => (
              <li key={idx}>
                <strong>{rule.name}:</strong>{' '}
                <RichText as="span" className="muted" text={rule.description} inline />
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {operative.specialActions && operative.specialActions.length > 0 && (
        <div className="operative-special-actions">
          <strong>Special Actions:</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            {operative.specialActions.map((action, idx) => (
              <li key={idx}>
                <strong>{action.name}:</strong>{' '}
                <RichText as="span" className="muted" text={action.description} inline />
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Keywords section at the bottom */}
      {showKeywordSection && (
        <div className="operative-keywords">
          <div className="operative-keywords-row">
            <div className="operative-keywords-list">
              {operative.factionKeyword && operative.factionKeyword !== 'UNKNOWN' && (
                <span className="pill" key="faction-keyword">{operative.factionKeyword}</span>
              )}
              {keywords.map((keyword, idx) => (
                <span key={idx} className="pill">{keyword}</span>
              ))}
            </div>
            {baseSizeText && (
              <span className="operative-base-size">{baseSizeText}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
