// components/SectionNavigator.js
import { useState, useEffect } from 'react'

const SECTIONS = [
  { id: 'operative-selection', label: 'Operative Selection' },
  { id: 'faction-rules', label: 'Faction Rules' },
  { id: 'datacards', label: 'Datacards' },
  { id: 'strategic-ploys', label: 'Strategic Ploys' },
  { id: 'tactical-ploys', label: 'Tactical Ploys' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'tac-ops', label: 'Tac Ops' }
]

function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId)
  if (element) {
    // Calculate the height of sticky headers
    // Main header + faction selector card (which contains both dropdowns)
    const mainHeader = document.querySelector('.header-sticky')
    const factionSelectorCard = document.querySelector('.faction-selector-sticky')
    
    let headerOffset = 200 // Default offset
    if (mainHeader && factionSelectorCard) {
      const mainHeaderHeight = mainHeader.getBoundingClientRect().height
      const selectorCardHeight = factionSelectorCard.getBoundingClientRect().height
      headerOffset = mainHeaderHeight + selectorCardHeight + 20 // Add some extra padding
    }
    
    const elementPosition = element.getBoundingClientRect().top
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    })
  }
}

export default function SectionNavigator({ factionData }) {
  const [isOpen, setIsOpen] = useState(false)
  const [availableSections, setAvailableSections] = useState([])

  useEffect(() => {
    if (!factionData) return

    // Determine which sections are available based on faction data
    const available = []
    
    if (factionData.operativeSelection && factionData.operatives) {
      available.push(SECTIONS.find(s => s.id === 'operative-selection'))
    }
    if (factionData.rules && factionData.rules.length > 0) {
      available.push(SECTIONS.find(s => s.id === 'faction-rules'))
    }
    if (factionData.operatives && factionData.operatives.length > 0) {
      available.push(SECTIONS.find(s => s.id === 'datacards'))
    }
    if (factionData.strategicPloys && factionData.strategicPloys.length > 0) {
      available.push(SECTIONS.find(s => s.id === 'strategic-ploys'))
    }
    if (factionData.tacticalPloys && factionData.tacticalPloys.length > 0) {
      available.push(SECTIONS.find(s => s.id === 'tactical-ploys'))
    }
    if (factionData.equipment && factionData.equipment.length > 0) {
      available.push(SECTIONS.find(s => s.id === 'equipment'))
    }
    if (factionData.tacops && factionData.tacops.length > 0) {
      available.push(SECTIONS.find(s => s.id === 'tac-ops'))
    }

    setAvailableSections(available.filter(Boolean))
  }, [factionData])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.section-navigator')) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  if (availableSections.length === 0) return null

  return (
    <div className="section-navigator" style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--panel)',
          border: '1px solid #2a2f3f',
          borderRadius: '8px',
          padding: '0.5rem 1rem',
          color: 'var(--text)',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.9rem'
        }}
      >
        <span>Jump to Section...</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>
      
      {isOpen && (
        <div
          className="section-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '0.25rem',
            background: 'var(--panel)',
            border: '1px solid #2a2f3f',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
            zIndex: 200,
            overflow: 'hidden'
          }}
        >
          {availableSections.map(section => (
            <button
              key={section.id}
              onClick={() => {
                scrollToSection(section.id)
                setIsOpen(false)
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.65rem 1rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text)',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#0f1320'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent'
              }}
            >
              {section.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

