import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import RichText from './RichText'
import ShareButton from './ShareButton'
import { useTranslations } from '../lib/i18n'

function WeaponRuleTooltip({ rule, children }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState(null) // null means position not calculated yet
  const spanRef = useRef(null)
  const tooltipRef = useRef(null)
  
  const updateTooltipPosition = useCallback((mouseX = null, mouseY = null) => {
    if (!spanRef.current || typeof window === 'undefined') {
      return
    }
    
    try {
      // Get the element's position relative to the viewport
      // getBoundingClientRect() returns viewport coordinates
      const rect = spanRef.current.getBoundingClientRect()
      
      // Validate that we got valid coordinates
      if (!rect || rect.width === 0 || rect.height === 0) {
        return
      }
      
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      
      // Use mouse position if available and close to element, otherwise use element center
      let centerX, elementTop, elementBottom
      
      if (mouseX !== null && mouseY !== null) {
        // Check if mouse is near the element (within 50px)
        const mouseNearElement = (
          mouseX >= rect.left - 50 && 
          mouseX <= rect.right + 50 &&
          mouseY >= rect.top - 50 && 
          mouseY <= rect.bottom + 50
        )
        
        if (mouseNearElement) {
          // Use mouse X position, but clamp to element bounds
          centerX = Math.max(rect.left, Math.min(mouseX, rect.right))
          elementTop = rect.top
          elementBottom = rect.bottom
        } else {
          // Mouse is far, use element center
          centerX = rect.left + (rect.width / 2)
          elementTop = rect.top
          elementBottom = rect.bottom
        }
      } else {
        // No mouse position, use element center
        centerX = rect.left + (rect.width / 2)
        elementTop = rect.top
        elementBottom = rect.bottom
      }
      
      // Estimate tooltip dimensions
      const tooltipWidth = 300 // maxWidth
      const tooltipHeight = 150 // estimated
      
      // Default: show above
      let top = elementTop - 10
      let showBelow = false
      
      // Check if there's enough space above
      if (elementTop - tooltipHeight < 20) {
        // Not enough space above, show below instead
        top = elementBottom + 10
        showBelow = true
      }
      
      // Calculate horizontal position (centered on element)
      let left = centerX
      
      // Adjust if tooltip would overflow left edge
      if (centerX - (tooltipWidth / 2) < 10) {
        left = (tooltipWidth / 2) + 10
      }
      // Adjust if tooltip would overflow right edge
      else if (centerX + (tooltipWidth / 2) > viewportWidth - 10) {
        left = viewportWidth - (tooltipWidth / 2) - 10
      }
      
      // Ensure coordinates are valid numbers and within reasonable bounds
      if (isNaN(top) || isNaN(left)) {
        console.warn('Invalid tooltip position calculated', { top, left, rect })
        return
      }
      
      // Clamp coordinates to viewport bounds as a safety measure
      const clampedLeft = Math.max(10, Math.min(left, viewportWidth - 10))
      const clampedTop = Math.max(10, Math.min(top, viewportHeight - 10))
      
      // If we have mouse coordinates and the calculated position seems way off, use mouse position
      if (mouseX !== null && mouseY !== null) {
        const distanceFromMouse = Math.sqrt(
          Math.pow(clampedLeft - mouseX, 2) + Math.pow(clampedTop - mouseY, 2)
        )
        
        // If calculated position is more than 200px from mouse, something's wrong - use mouse position
        if (distanceFromMouse > 200) {
          // Use mouse position with offset
          const tooltipWidth = 300
          const tooltipHeight = 150
          const offsetX = 15 // Offset to the right of cursor
          const offsetY = 15 // Offset below cursor
          
          let finalLeft = mouseX + offsetX
          let finalTop = mouseY + offsetY
          let finalShowBelow = true
          
          // Adjust if would overflow
          if (finalLeft + tooltipWidth > viewportWidth) {
            finalLeft = mouseX - tooltipWidth - offsetX // Show to the left
          }
          if (finalTop + tooltipHeight > viewportHeight) {
            finalTop = mouseY - tooltipHeight - offsetY // Show above
            finalShowBelow = false
          }
          
          setTooltipPosition({ 
            top: Math.max(10, Math.min(finalTop, viewportHeight - 10)), 
            left: Math.max(10, Math.min(finalLeft, viewportWidth - 10)), 
            showBelow: finalShowBelow 
          })
          return
        }
      }
      
      // Only set position if coordinates are reasonable (not way off screen)
      if (Math.abs(clampedLeft - left) > 100 || Math.abs(clampedTop - top) > 100) {
        // If we have mouse position, use it as fallback
        if (mouseX !== null && mouseY !== null) {
          const tooltipWidth = 300
          const offsetX = 15
          const offsetY = 15
          setTooltipPosition({ 
            top: Math.max(10, Math.min(mouseY + offsetY, viewportHeight - 10)), 
            left: Math.max(10, Math.min(mouseX + offsetX, viewportWidth - 10)), 
            showBelow: true 
          })
          return
        }
        
        console.warn('Tooltip position seems incorrect, recalculating...', { 
          original: { top, left }, 
          clamped: { top: clampedTop, left: clampedLeft },
          rect,
          viewport: { width: viewportWidth, height: viewportHeight }
        })
        // Try recalculating after a brief delay
        setTimeout(() => {
          if (spanRef.current) {
            updateTooltipPosition(mouseX, mouseY)
          }
        }, 50)
        return
      }
      
      setTooltipPosition({ top: clampedTop, left: clampedLeft, showBelow })
    } catch (error) {
      console.warn('Error calculating tooltip position:', error)
    }
  }, [])
  
  // Update position when tooltip is shown
  useEffect(() => {
    if (showTooltip && spanRef.current) {
      // Calculate position immediately - use requestAnimationFrame to ensure element is in DOM
      const rafId = requestAnimationFrame(() => {
        if (spanRef.current) {
          updateTooltipPosition()
        }
      })
      
      // Also update after a short delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        if (spanRef.current) {
          updateTooltipPosition()
        }
      }, 0)
      
      // Update position on scroll/resize
      const handleScroll = () => {
        if (spanRef.current) {
          updateTooltipPosition()
        }
      }
      const handleResize = () => {
        if (spanRef.current) {
          updateTooltipPosition()
        }
      }
      
      // Use capture phase to catch all scrolls (including nested scrollable containers)
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)
      
      return () => {
        cancelAnimationFrame(rafId)
        clearTimeout(timeoutId)
        window.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleResize)
      }
    } else {
      // Reset position when tooltip is hidden
      setTooltipPosition(null)
    }
  }, [showTooltip, updateTooltipPosition])
  
  // Also update position when tooltip element is rendered
  useEffect(() => {
    if (showTooltip && tooltipRef.current && spanRef.current) {
      // Use requestAnimationFrame to ensure tooltip is rendered
      const rafId = requestAnimationFrame(() => {
        updateTooltipPosition()
      })
      return () => cancelAnimationFrame(rafId)
    }
  }, [showTooltip, updateTooltipPosition])
  
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
        onMouseEnter={(e) => {
          // Capture mouse coordinates immediately before async operations
          const mouseX = e.clientX
          const mouseY = e.clientY
          setShowTooltip(true)
          // Calculate position immediately on mouse enter using mouse coordinates
          if (spanRef.current) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
              if (spanRef.current) {
                updateTooltipPosition(mouseX, mouseY)
              }
            })
          }
        }}
        onMouseMove={(e) => {
          // Update position as mouse moves while tooltip is shown
          if (showTooltip && spanRef.current) {
            updateTooltipPosition(e.clientX, e.clientY)
          }
        }}
        onMouseLeave={() => {
          setShowTooltip(false)
          setTooltipPosition(null)
        }}
      >
        {children}
      </span>
      {showTooltip && tooltipPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: tooltipPosition.showBelow
              ? 'translate(-50%, 0)' // Show below
              : 'translate(-50%, -100%)', // Show above
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
              [tooltipPosition.showBelow ? 'top' : 'bottom']: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              [tooltipPosition.showBelow ? 'borderTop' : 'borderBottom']: '6px solid #1a1f2b'
            }}
          />
        </div>,
        document.body
      )}
    </>
  )
}

export default function OperativeCard({ operative }) {
  const router = useRouter()
  const t = useTranslations('operative')
  const anchorId = operative?.id ? `operative-${operative.id}` : undefined
  const operativeDisplayName = operative?.name || operative?.title || ''
  
  // Build share URL for this operative (client-only to avoid hydration issues)
  const [shareUrl, setShareUrl] = useState(null)
  
  useEffect(() => {
    if (typeof window === 'undefined' || !anchorId) {
      setShareUrl(null)
      return
    }
    const base = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/+$/, '')
    const path = router.asPath?.split('#')[0] || router.pathname?.replace('[id]', router.query?.id || '')
    setShareUrl(`${base}${path}#${anchorId}`)
  }, [anchorId, router.asPath, router.pathname, router.query?.id])
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0, flex: 1 }}>{operativeDisplayName}</h4>
            {shareUrl && (
              <ShareButton
                title={operativeDisplayName}
                text={`Check out ${operativeDisplayName} on KT Servitor`}
                url={shareUrl}
                size="small"
              />
            )}
          </div>
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
                    <th>WR</th>
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

        {Array.isArray(operative.actions) && operative.actions.length > 0 && (
          <div className="operative-actions">
            <div className="operative-actions-list">
              {operative.actions.map((action, idx) => {
                const key = action?.id || action?.name ? `${action.id || action.name}-${idx}` : `action-${idx}`
                const actionName = action?.name || action?.id || 'Action'
                const apValue = action?.AP ?? action?.ap ?? action?.apCost ?? null
                const apLabel = apValue !== null && apValue !== undefined && apValue !== '' ? `${apValue} AP` : null
                const description = action?.description || ''
                const effects = Array.isArray(action?.effects) ? action.effects.filter(Boolean) : []
                const conditions = Array.isArray(action?.conditions) ? action.conditions.filter(Boolean) : []
                
                return (
                  <div key={key} className="ability-card action-card">
                    <div className="ability-card-header">
                      <h5 className="ability-card-title">{actionName.toUpperCase()}</h5>
                      {apLabel && <span className="ability-card-ap">{apLabel}</span>}
                    </div>
                    {(description || effects.length > 0 || conditions.length > 0) && (
                      <div className="ability-card-body">
                        {description && (
                          <RichText 
                            text={description}
                            highlightText={factionKeyword}
                          />
                        )}
                        {effects.length > 0 && (
                          <ul style={{ margin: description ? '0.5rem 0 0 0' : 0, padding: 0, paddingLeft: '1.25rem', listStyle: 'none' }}>
                            {effects.map((effect, effectIdx) => (
                              <li
                                key={`${key}-effect-${effectIdx}`}
                                style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                              >
                                <span aria-hidden="true" style={{ color: '#2ecc71', fontWeight: 'bold', marginLeft: '-1.25rem' }}>➤</span>
                                <span>{typeof effect === 'string' ? effect : String(effect)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {conditions.length > 0 && (
                          <ul style={{ margin: (description || effects.length) ? '0.5rem 0 0 0' : 0, padding: 0, paddingLeft: '1.25rem', listStyle: 'none' }}>
                            {conditions.map((condition, conditionIdx) => (
                              <li
                                key={`${key}-condition-${conditionIdx}`}
                                style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
                              >
                                <span aria-hidden="true" style={{ color: '#e74c3c', fontWeight: 'bold', marginLeft: '-1.25rem' }}>◆</span>
                                <span>{typeof condition === 'string' ? condition : String(condition)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
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
