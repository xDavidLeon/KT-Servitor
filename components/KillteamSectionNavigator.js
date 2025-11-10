import { useEffect, useMemo, useState } from 'react'

export function scrollToKillteamSection(sectionId) {
  if (typeof document === 'undefined' || !sectionId) return false

  const element = document.getElementById(sectionId)
  if (!element) return false

  const mainHeader = document.querySelector('.header-sticky')
  const selectorCard = document.querySelector('.killteam-selector-sticky')

  let headerOffset = 16
  if (mainHeader) {
    const headerStyle = window.getComputedStyle(mainHeader).position
    if (headerStyle === 'sticky' || headerStyle === 'fixed') {
      headerOffset += mainHeader.getBoundingClientRect().height
    }
  }
  if (selectorCard) {
    const selectorStyle = window.getComputedStyle(selectorCard).position
    if (selectorStyle === 'sticky' || selectorStyle === 'fixed') {
      headerOffset += selectorCard.getBoundingClientRect().height + 20
    }
  }

  const elementPosition = element.getBoundingClientRect().top
  const offsetPosition = Math.max(elementPosition + window.pageYOffset - headerOffset, 0)

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth'
  })

  return true
}

export default function KillteamSectionNavigator({
  sections = [],
  activeSectionId,
  onSectionChange
}) {
  const [isOpen, setIsOpen] = useState(false)

  const activeSection = useMemo(() => {
    if (!Array.isArray(sections) || sections.length === 0) return null
    return sections.find(section => section.id === activeSectionId) || sections[0]
  }, [sections, activeSectionId])

  useEffect(() => {
    if (!activeSection && Array.isArray(sections) && sections.length > 0) {
      onSectionChange?.(sections[0].id)
    }
  }, [activeSection, sections, onSectionChange])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.section-navigator')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    setIsOpen(false)
  }, [activeSection?.id])

  if (!Array.isArray(sections) || sections.length === 0 || !activeSection) {
    return null
  }

  const dropdownItems = Array.isArray(activeSection.items) ? activeSection.items : []
  const hasDropdownItems = dropdownItems.length > 0

  const handleTabSelect = (sectionId) => {
    if (!sectionId || sectionId === activeSection.id) return
    onSectionChange?.(sectionId)
    requestAnimationFrame(() => {
      scrollToKillteamSection(sectionId)
    })
  }

  const handleItemSelect = (targetId) => {
    if (!targetId) return
    const didScroll = scrollToKillteamSection(targetId)
    if (!didScroll) return
    setIsOpen(false)
  }

  return (
    <div className="section-navigator" style={{ position: 'relative' }}>
      <div className="killteam-tabs" role="tablist" aria-label="Kill team sections">
        {sections.map(section => {
          const isActive = section.id === activeSection.id
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`killteam-tab${isActive ? ' active' : ''}`}
              onClick={() => handleTabSelect(section.id)}
            >
              {section.label}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="section-dropdown-trigger"
        onClick={() => hasDropdownItems && setIsOpen(!isOpen)}
        disabled={!hasDropdownItems}
      >
        <span>
          {hasDropdownItems
            ? `Jump within ${activeSection.label}...`
            : 'No subsections available'}
        </span>
        <span className="section-dropdown-caret">{hasDropdownItems ? (isOpen ? '▲' : '▼') : ''}</span>
      </button>

      {isOpen && hasDropdownItems && (
        <div className="section-dropdown">
          {dropdownItems.map(item => {
            const isHeading = item?.type === 'heading'
            const isDisabled = !item?.id

            return (
              <button
                key={`${item?.id || item?.label}`}
                type="button"
                className={`section-dropdown-item${isHeading ? ' heading' : ''}`}
                onClick={() => !isDisabled && handleItemSelect(item.id)}
                disabled={isDisabled}
              >
                {item?.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
