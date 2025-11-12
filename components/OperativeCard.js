import React from 'react'
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
  const headerStats = [
    { label: 'APL', value: operative?.apl },
    { label: 'MOVE', value: operative?.move },
    { label: 'SAVE', value: operative?.save },
    { label: 'WOUNDS', value: operative?.wounds }
  ].filter(stat => stat.value !== null && stat.value !== undefined && stat.value !== '')

  return (
    <div id={anchorId} className="operative-card">
      <div className="operative-header">
        <h4 style={{ margin: 0 }}>{operative.name || operative.title}</h4>
        {headerStats.length > 0 && (
          <div className="operative-header-stats">
            {headerStats.map(stat => (
              <div key={stat.label} className="operative-header-stat">
                <span className="label">{stat.label}</span>
                <span className="value">{stat.value}</span>
              </div>
            ))}
          </div>
        )}
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
        
        // Determine weapon type symbol
        const getWeaponSymbol = (type) => {
          if (type === 'Ranged Weapon') return '⌖';
          if (type === 'Melee Weapon') return '⚔';
          return '';
        };
        
        return (
          <div className="operative-weapons">
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
                  {sortedWeapons.map((weapon, weaponIdx) => {
                    const weaponSymbol = getWeaponSymbol(weapon.type);
                    const hasProfiles = Array.isArray(weapon.profiles) && weapon.profiles.length > 0;
                    const hasMultipleProfiles = weapon.hasMultipleProfiles || (hasProfiles && weapon.profiles.length > 1);
                    
                    // If weapon has multiple profiles, show header row + profile rows
                    if (hasMultipleProfiles) {
                      return (
                        <React.Fragment key={weapon.id || weaponIdx}>
                          {/* Weapon header row */}
                          <tr className="weapon-header-row">
                            <td colSpan="5">
                              {weaponSymbol && <span style={{ marginRight: '0.25rem' }}>{weaponSymbol}</span>}
                              {weapon.name}
                            </td>
                          </tr>
                          {/* Profile rows */}
                          {weapon.profiles.map((profile, profileIdx) => (
                            <tr key={profile.id || `${weapon.id}-${profileIdx}`} className="weapon-profile-row">
                              <td>
                                {profile.profileName || 'Default'}
                              </td>
                              <td>{profile.atk || '-'}</td>
                              <td>{profile.hit || '-'}</td>
                              <td>{profile.dmg || '-'}</td>
                              <td className="muted">
                                {profile.specialRules && profile.specialRules.length > 0 
                                  ? profile.specialRules.join(', ')
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    }
                    
                    // Single profile or no profiles - show as single row
                    if (hasProfiles && weapon.profiles.length === 1) {
                      const profile = weapon.profiles[0];
                      return (
                        <tr key={weapon.id || weaponIdx}>
                          <td>
                            <strong>
                              {weaponSymbol && <span style={{ marginRight: '0.25rem' }}>{weaponSymbol}</span>}
                              {weapon.name}
                            </strong>
                          </td>
                          <td>{profile.atk || '-'}</td>
                          <td>{profile.hit || '-'}</td>
                          <td>{profile.dmg || '-'}</td>
                          <td className="muted">
                            {profile.specialRules && profile.specialRules.length > 0 
                              ? profile.specialRules.join(', ')
                              : '-'}
                          </td>
                        </tr>
                      );
                    }
                    
                    // No profiles - show weapon name only
                    return (
                      <tr key={weapon.id || weaponIdx}>
                        <td>
                          <strong>
                            {weaponSymbol && <span style={{ marginRight: '0.25rem' }}>{weaponSymbol}</span>}
                            {weapon.name}
                          </strong>
                        </td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td className="muted">-</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
        })()}

        {Array.isArray(operative.specialRules) && operative.specialRules.length > 0 && (
          <div className="operative-abilities">
            <strong className="operative-abilities-title">Abilities</strong>
            <div className="operative-abilities-list">
              {operative.specialRules.map((ability, idx) => {
                const key = ability?.name ? `${ability.name}-${idx}` : `ability-${idx}`
                return (
                  <div key={key} className="ability-card">
                    <div className="ability-card-header">
                      <h5 className="ability-card-title">{ability?.name || 'Ability'}</h5>
                      {ability?.apCost && <span className="ability-card-ap">{ability.apCost}</span>}
                    </div>
                    <RichText className="ability-card-body" text={ability?.description} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
        
        {Array.isArray(operative.specialActions) && operative.specialActions.length > 0 && (
          <div className="operative-actions">
            <strong className="operative-actions-title">Options</strong>
            <div className="operative-actions-list">
              {operative.specialActions.map((action, idx) => {
                const key = action?.name ? `${action.name}-${idx}` : `action-${idx}`
                return (
                  <div key={key} className="ability-card">
                    <div className="ability-card-header">
                      <h5 className="ability-card-title">{action?.name || 'Option'}</h5>
                      {action?.apCost && <span className="ability-card-ap">{action.apCost}</span>}
                    </div>
                    <RichText className="ability-card-body" text={action?.description} />
                  </div>
                )
              })}
            </div>
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
