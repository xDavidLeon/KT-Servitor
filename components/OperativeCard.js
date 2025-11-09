export default function OperativeCard({ operative }) {
  // Support both old format (with body text) and new format (structured data)
  // Also check if body contains JSON string (from database)
  let parsedOperative = operative
  if (operative.body && operative.body.startsWith('{')) {
    try {
      parsedOperative = JSON.parse(operative.body)
      // Merge with operative to preserve id, etc.
      parsedOperative = { ...operative, ...parsedOperative }
    } catch (e) {
      // Not JSON, use as-is
    }
  }
  
  const isNewFormat = parsedOperative.apl !== undefined || parsedOperative.move !== undefined || 
                      (parsedOperative.weapons && Array.isArray(parsedOperative.weapons));
  
  // If new format, use structured data directly
  if (isNewFormat) {
    return (
      <div className="operative-card">
        <div className="operative-header">
          <h4 style={{ margin: 0 }}>{parsedOperative.name || parsedOperative.title}</h4>
          <div className="operative-tags">
            {parsedOperative.factionKeyword && (
              <span className="pill">{parsedOperative.factionKeyword}</span>
            )}
            {parsedOperative.keywords && parsedOperative.keywords.map(keyword => (
              <span key={keyword} className="pill">{keyword}</span>
            ))}
          </div>
        </div>
        
        <div className="operative-stats">
          <table className="stats-table">
            <thead>
              <tr>
                {parsedOperative.apl !== null && parsedOperative.apl !== undefined && <th>APL</th>}
                {parsedOperative.move && <th>MOVE</th>}
                {parsedOperative.save && <th>SAVE</th>}
                {parsedOperative.wounds !== null && parsedOperative.wounds !== undefined && <th>WOUNDS</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                {parsedOperative.apl !== null && parsedOperative.apl !== undefined && <td>{parsedOperative.apl}</td>}
                {parsedOperative.move && <td>{parsedOperative.move}</td>}
                {parsedOperative.save && <td>{parsedOperative.save}</td>}
                {parsedOperative.wounds !== null && parsedOperative.wounds !== undefined && <td>{parsedOperative.wounds}</td>}
              </tr>
            </tbody>
          </table>
        </div>
        
        {parsedOperative.weapons && parsedOperative.weapons.length > 0 && (
          <div className="operative-weapons">
            <strong>Weapons:</strong>
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
                {parsedOperative.weapons.map((weapon, idx) => (
                  <tr key={idx}>
                    <td><strong>{weapon.name}</strong></td>
                    <td>{weapon.atk || '-'}</td>
                    <td>{weapon.hit || '-'}</td>
                    <td>{weapon.dmg || '-'}</td>
                    <td className="muted">
                      {weapon.specialRules && weapon.specialRules.length > 0 
                        ? weapon.specialRules.join(', ')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {parsedOperative.specialRules && parsedOperative.specialRules.length > 0 && (
          <div className="operative-special-rules">
            <strong>Special Rules:</strong>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
              {parsedOperative.specialRules.map((rule, idx) => (
                <li key={idx}>
                  <strong>{rule.name}:</strong>
                  <span className="muted"> {rule.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {parsedOperative.specialActions && parsedOperative.specialActions.length > 0 && (
          <div className="operative-special-actions">
            <strong>Special Actions:</strong>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
              {parsedOperative.specialActions.map((action, idx) => (
                <li key={idx}>
                  <strong>{action.name}:</strong>
                  <span className="muted"> {action.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }
  
  // Fallback to old format parsing
  const parseOperative = (body) => {
    const stats = {}
    const weapons = []
    const abilities = []
    
    // Extract stats: M6" WS3+ BS3+ A4 W15 Sv3+
    const statPattern = /(M\d+")?\s*(WS\d+\+)?\s*(BS\d+\+)?\s*(A\d+)?\s*(W\d+)?\s*(Sv\d+\+)?/i
    const statMatch = body.match(statPattern)
    
    if (statMatch) {
      if (statMatch[1]) stats.movement = statMatch[1]
      if (statMatch[2]) stats.weaponSkill = statMatch[2]
      if (statMatch[3]) stats.ballisticSkill = statMatch[3]
      if (statMatch[4]) stats.attacks = statMatch[4]
      if (statMatch[5]) stats.wounds = statMatch[5]
      if (statMatch[6]) stats.save = statMatch[6]
    }
    
    // Remove stats from body for further processing
    let remainingText = body.replace(statPattern, '').trim()
    
    // Extract weapons - look for "Weapons:" first
    const weaponsMatch = remainingText.match(/Weapons?:\s*(.+?)(?:\.|$)/i)
    if (weaponsMatch) {
      const weaponsText = weaponsMatch[1]
      // Split by "or" or comma
      const weaponList = weaponsText.split(/\s+or\s+|,\s+/)
      weaponList.forEach(w => {
        const trimmed = w.trim()
        if (trimmed) {
          // Check if it has stats in parentheses
          const weaponWithStats = trimmed.match(/(.+?)\s*\((.+?)\)/)
          if (weaponWithStats) {
            weapons.push({ name: weaponWithStats[1].trim(), stats: weaponWithStats[2].trim() })
          } else {
            weapons.push({ name: trimmed, stats: null })
          }
        }
      })
      // Remove weapons section from remaining text
      remainingText = remainingText.replace(/Weapons?:\s*.+?(?:\.|$)/i, '').trim()
    } else {
      // Look for weapon patterns like "bolt rifle (4/5, L5+)" or standalone weapon names
      const weaponPattern = /\b([A-Za-z][A-Za-z\s]+?)\s*\(([^)]+)\)/g
      let match
      const foundWeapons = []
      while ((match = weaponPattern.exec(remainingText)) !== null) {
        foundWeapons.push({ 
          name: match[1].trim(), 
          stats: match[2].trim(),
          fullMatch: match[0]
        })
      }
      
      if (foundWeapons.length > 0) {
        foundWeapons.forEach(w => {
          weapons.push({ name: w.name, stats: w.stats })
          remainingText = remainingText.replace(w.fullMatch, '').trim()
        })
      }
    }
    
    // Clean up remaining text
    remainingText = remainingText.replace(/^[.,\s]+/, '').trim()
    
    // Extract abilities
    if (remainingText && remainingText.length > 0) {
      const abilityParts = remainingText.split(/\.\s+/)
        .map(p => p.trim())
        .filter(p => p.length > 0 && !p.match(/^[.,]+$/))
      abilities.push(...abilityParts)
    }
    
    return { stats, weapons, abilities }
  }
  
  const { stats, weapons, abilities } = parseOperative(operative.body || '')
  
  return (
    <div className="operative-card">
      <div className="operative-header">
        <h4 style={{ margin: 0 }}>{operative.title}</h4>
        {operative.tags && operative.tags.length > 0 && (
          <div className="operative-tags">
            {operative.tags.map(tag => (
              <span key={tag} className="pill">{tag}</span>
            ))}
          </div>
        )}
      </div>
      
      <div className="operative-stats">
        <table className="stats-table">
          <thead>
            <tr>
              {stats.movement && <th>M</th>}
              {stats.weaponSkill && <th>WS</th>}
              {stats.ballisticSkill && <th>BS</th>}
              {stats.attacks && <th>A</th>}
              {stats.wounds && <th>W</th>}
              {stats.save && <th>Sv</th>}
            </tr>
          </thead>
          <tbody>
            <tr>
              {stats.movement && <td>{stats.movement}</td>}
              {stats.weaponSkill && <td>{stats.weaponSkill}</td>}
              {stats.ballisticSkill && <td>{stats.ballisticSkill}</td>}
              {stats.attacks && <td>{stats.attacks}</td>}
              {stats.wounds && <td>{stats.wounds}</td>}
              {stats.save && <td>{stats.save}</td>}
            </tr>
          </tbody>
        </table>
      </div>
      
      {weapons.length > 0 && (
        <div className="operative-weapons">
          <strong>Weapons:</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            {weapons.map((weapon, idx) => (
              <li key={idx}>
                <strong>{weapon.name}</strong>
                {weapon.stats && <span className="muted"> ({weapon.stats})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {abilities.length > 0 && (
        <div className="operative-abilities">
          <strong>Abilities:</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            {abilities.map((ability, idx) => (
              <li key={idx} className="muted">{ability}</li>
            ))}
          </ul>
        </div>
      )}
      
      {weapons.length === 0 && abilities.length === 0 && (
        <div className="muted" style={{ marginTop: '0.5rem' }}>{operative.body}</div>
      )}
    </div>
  )
}
