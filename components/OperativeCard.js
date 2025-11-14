import React, { useState, useEffect, useRef } from 'react'
import RichText from './RichText'
import { useTranslations } from '../lib/i18n'

function WeaponRuleTooltip({ rule, children }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const spanRef = useRef(null)
  
  useEffect(() => {
    if (showTooltip && spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect()
      setTooltipPosition({
        top: rect.top - 10,
        left: rect.left + rect.width / 2
      })
    }
  }, [showTooltip])
  
  if (!rule || typeof rule !== 'object' || !rule.description) {
    return <>{children}</>
  }
  
  return (
    <>
      <span
        ref={spanRef}
        style={{ 
          display: 'inline-block',
          textDecoration: 'underline',
          textDecorationStyle: 'dotted',
          textDecorationColor: 'rgba(154, 160, 170, 0.6)',
          textUnderlineOffset: '2px',
          cursor: 'help'
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </span>
      {showTooltip && (
        <div
          style={{
            position: 'fixed',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translate(-50%, -100%)',
            marginBottom: '0.5rem',
            padding: '0.5rem 0.75rem',
            background: '#1a1f2b',
            border: '1px solid #2a2f3f',
            borderRadius: '8px',
            color: '#e6e6e6',
            fontSize: '0.85rem',
            lineHeight: '1.4',
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            minWidth: '200px',
            maxWidth: '300px',
            zIndex: 10000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            pointerEvents: 'none'
          }}
        >
          <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#fb923c', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
            {rule.displayText}
          </div>
          <div style={{ color: '#9aa0aa', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
            {rule.description}
          </div>
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #1a1f2b'
            }}
          />
        </div>
      )}
    </>
  )
}

export default function OperativeCard({ operative }) {
  const t = useTranslations('operative')
  const anchorId = operative?.id ? `operative-${operative.id}` : undefined
  const operativeDisplayName = operative?.name || operative?.title || ''
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
  const factionKeyword = operative?.factionKeyword
  const getStatIcon = (key) => {
    const iconMap = {
      'apl': '/img/apl.svg',
      'move': '/img/move.svg',
      'save': '/img/save.svg',
      'wounds': '/img/wounds.svg'
    }
    return iconMap[key] || null
  }

  const headerStats = [
    { key: 'apl', label: t('apl'), value: operative?.apl },
    { key: 'move', label: t('move'), value: operative?.move },
    { key: 'save', label: t('save'), value: operative?.save },
    { key: 'wounds', label: t('wounds'), value: operative?.wounds }
  ].filter(stat => stat.value !== null && stat.value !== undefined && stat.value !== '')
  const handleImageSearch = () => {
    if (!operativeDisplayName) return
    const query = encodeURIComponent(`Kill Team ${operativeDisplayName}`)
    const url = `https://www.google.com/search?tbm=isch&q=${query}`
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div id={anchorId} className="operative-card">
      <div className="operative-header">
        <div className="operative-header-title">
          <h4 style={{ margin: 0 }}>{operativeDisplayName}</h4>
          {operativeDisplayName && (
            <button
              type="button"
              className="operative-photo-button"
              aria-label={`Search images for ${operativeDisplayName}`}
              onClick={handleImageSearch}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 6.5C4 5.67157 4.67157 5 5.5 5H18.5C19.3284 5 20 5.67157 20 6.5V17.5C20 18.3284 19.3284 19 18.5 19H5.5C4.67157 19 4 18.3284 4 17.5V6.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 15L8.5 10.5C8.89782 10.1022 9.53033 10.1022 9.9282 10.5L14 14.5718"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12.5 13L14.5 11C14.8876 10.6124 15.5124 10.6124 15.9 11L20 15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.5 8C9.5 8.82843 8.82843 9.5 8 9.5C7.17157 9.5 6.5 8.82843 6.5 8C6.5 7.17157 7.17157 6.5 8 6.5C8.82843 6.5 9.5 7.17157 9.5 8Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          )}
        </div>
        {headerStats.length > 0 && (
          <div className="operative-header-stats">
            {headerStats.map(stat => {
              const iconPath = getStatIcon(stat.key)
              return (
                <div key={stat.key} className="operative-header-stat">
                  <span className="label">{stat.label}</span>
                  <span className="value" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {iconPath && (
                      <img 
                        src={iconPath} 
                        alt={stat.label}
                        style={{ 
                          width: '1em', 
                          height: '1em', 
                          display: 'inline-block',
                          verticalAlign: 'middle'
                        }}
                      />
                    )}
                    {stat.value}
                  </span>
                </div>
              )
            })}
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
        
        // Determine weapon type icon
        const getWeaponIcon = (type) => {
          if (type === 'Ranged Weapon') return '/img/shoot.svg';
          if (type === 'Melee Weapon') return '/img/attack.svg';
          return null;
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
                    const weaponIcon = getWeaponIcon(weapon.type);
                    const hasProfiles = Array.isArray(weapon.profiles) && weapon.profiles.length > 0;
                    const hasMultipleProfiles = weapon.hasMultipleProfiles || (hasProfiles && weapon.profiles.length > 1);
                    
                    // If weapon has multiple profiles, show header row + profile rows
                    if (hasMultipleProfiles) {
                      return (
                        <React.Fragment key={weapon.id || weaponIdx}>
                          {/* Weapon header row */}
                          <tr className="weapon-header-row">
                            <td colSpan="5" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {weaponIcon && (
                                <img 
                                  src={weaponIcon} 
                                  alt={weapon.type}
                                  style={{ 
                                    width: '1.25em', 
                                    height: '1.25em', 
                                    display: 'block',
                                    flexShrink: 0,
                                    marginTop: '0.00em'
                                  }}
                                />
                              )}
                              {weapon.name}
                            </td>
                          </tr>
                          {/* Profile rows */}
                          {weapon.profiles.map((profile, profileIdx) => (
                            <tr key={profile.id || `${weapon.id}-${profileIdx}`} className="weapon-profile-row">
                              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {weaponIcon && (
                                  <img 
                                    src={weaponIcon} 
                                    alt={weapon.type}
                                    style={{ 
                                      width: '1.25em', 
                                      height: '1.25em', 
                                      display: 'block',
                                      flexShrink: 0,
                                      marginTop: '0.0em'
                                    }}
                                  />
                                )}
                                {profile.profileName || 'Default'}
                              </td>
                              <td>{profile.atk || '-'}</td>
                              <td>{profile.hit || '-'}</td>
                              <td>{profile.dmg || '-'}</td>
                              <td className="muted">
                                {profile.specialRules && profile.specialRules.length > 0 
                                  ? profile.specialRules.map((rule, ruleIdx) => {
                                      const displayText = typeof rule === 'object' ? rule.displayText : rule
                                      const isLast = ruleIdx === profile.specialRules.length - 1
                                      return (
                                        <React.Fragment key={ruleIdx}>
                                          <WeaponRuleTooltip rule={typeof rule === 'object' ? rule : null}>
                                            {displayText}
                                          </WeaponRuleTooltip>
                                          {!isLast && ', '}
                                        </React.Fragment>
                                      )
                                    })
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
                            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {weaponIcon && (
                                <img 
                                  src={weaponIcon} 
                                  alt={weapon.type}
                                  style={{ 
                                    width: '1.25em', 
                                    height: '1.25em', 
                                    display: 'block',
                                    flexShrink: 0,
                                    marginTop: '0.0em'
                                  }}
                                />
                              )}
                              {weapon.name}
                            </strong>
                          </td>
                          <td>{profile.atk || '-'}</td>
                          <td>{profile.hit || '-'}</td>
                          <td>{profile.dmg || '-'}</td>
                          <td className="muted">
                            {profile.specialRules && profile.specialRules.length > 0 
                              ? profile.specialRules.map((rule, ruleIdx) => {
                                  const displayText = typeof rule === 'object' ? rule.displayText : rule
                                  const isLast = ruleIdx === profile.specialRules.length - 1
                                  return (
                                    <React.Fragment key={ruleIdx}>
                                      <WeaponRuleTooltip rule={typeof rule === 'object' ? rule : null}>
                                        {displayText}
                                      </WeaponRuleTooltip>
                                      {!isLast && ', '}
                                    </React.Fragment>
                                  )
                                })
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
                            {weaponIcon && (
                              <img 
                                src={weaponIcon} 
                                alt={weapon.type}
                                style={{ 
                                  width: '1em', 
                                  height: '1em', 
                                  display: 'inline-block',
                                  verticalAlign: 'middle',
                                  marginRight: '0.25rem'
                                }}
                              />
                            )}
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
            <div className="operative-abilities-list">
              {operative.specialRules.map((ability, idx) => {
                const key = ability?.name ? `${ability.name}-${idx}` : `ability-${idx}`
                return (
                  <div key={key} className="ability-card ability-card-item">
                    <div className="ability-card-header">
                      <h5 className="ability-card-title">{ability?.name || 'Ability'}</h5>
                      {ability?.apCost && <span className="ability-card-ap">{ability.apCost}</span>}
                    </div>
                    <RichText 
                      className="ability-card-body" 
                      text={ability?.description}
                      highlightText={factionKeyword}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
        
        {Array.isArray(operative.specialActions) && operative.specialActions.length > 0 && (
          <div className="operative-actions">
            <strong className="operative-actions-title">{t('options')}</strong>
            <div className="operative-actions-list">
              {operative.specialActions.map((action, idx) => {
                const key = action?.name ? `${action.name}-${idx}` : `action-${idx}`
                return (
                  <div key={key} className="ability-card action-card">
                    <div className="ability-card-header">
                      <h5 className="ability-card-title">{action?.name || 'Option'}</h5>
                      {action?.apCost && <span className="ability-card-ap">{action.apCost}</span>}
                    </div>
                    <RichText 
                      className="ability-card-body" 
                      text={action?.description}
                      highlightText={factionKeyword}
                    />
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
                <>
                  <span key="faction-keyword" className="faction-keyword">
                    {operative.factionKeyword}
                    <span className="faction-keyword-skull">💀</span>
                  </span>
                  {keywords.length > 1 && <span>, </span>}
                </>
              )}
              {keywords.slice(1).map((keyword, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span>, </span>}
                  <span>{keyword}</span>
                </React.Fragment>
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
