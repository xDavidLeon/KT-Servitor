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

    const sections = []

    const addSection = (id, children = []) => {
      const base = SECTIONS.find(s => s.id === id)
      if (!base) return
      sections.push({ ...base, children })
    }

    const buildChildren = (items = [], getId, getLabel) => {
      if (!Array.isArray(items)) return []
      return items
        .map((item, index) => {
          const id = getId(item, index)
          const label = getLabel(item, index)
          if (!id || !label) return null
          return { id, label }
        })
        .filter(Boolean)
    }

    if (factionData.operativeSelection && factionData.operatives) {
      addSection('operative-selection')
    }

    if (factionData.rules && factionData.rules.length > 0) {
      const ruleChildren = buildChildren(
        factionData.rules,
        (rule, index) => rule?.id || (rule?.name ? `rule-${index}` : null),
        (rule, index) => rule?.name || rule?.title || `Rule ${index + 1}`
      )
      addSection('faction-rules', ruleChildren)
    }

    if (factionData.operatives && factionData.operatives.length > 0) {
      const datacardChildren = buildChildren(
        factionData.operatives,
        (op, index) => (op?.id ? `operative-${op.id}` : null),
        (op, index) => op?.name || op?.title || `Datacard ${index + 1}`
      )
      addSection('datacards', datacardChildren)
    }

    if (factionData.strategicPloys && factionData.strategicPloys.length > 0) {
      const strategicChildren = buildChildren(
        factionData.strategicPloys,
        (ploy, index) => ploy?.id || (ploy?.name ? `strategic-ploy-${index}` : null),
        (ploy, index) => ploy?.name || ploy?.title || `Strategic Ploy ${index + 1}`
      )
      addSection('strategic-ploys', strategicChildren)
    }

    if (factionData.tacticalPloys && factionData.tacticalPloys.length > 0) {
      const tacticalChildren = buildChildren(
        factionData.tacticalPloys,
        (ploy, index) => ploy?.id || (ploy?.name ? `tactical-ploy-${index}` : null),
        (ploy, index) => ploy?.name || ploy?.title || `Tactical Ploy ${index + 1}`
      )
      addSection('tactical-ploys', tacticalChildren)
    }

    if (factionData.equipment && factionData.equipment.length > 0) {
      const equipmentChildren = buildChildren(
        factionData.equipment,
        (eq, index) => eq?.id || (eq?.name ? `equipment-${index}` : null),
        (eq, index) => eq?.name || eq?.title || `Equipment ${index + 1}`
      )
      addSection('equipment', equipmentChildren)
    }

    if (factionData.tacops && factionData.tacops.length > 0) {
      addSection('tac-ops')
    }

    setAvailableSections(sections)
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
            <div key={section.id}>
              <button
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

              {section.children && section.children.length > 0 && (
                <div>
                  {section.children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => {
                        scrollToSection(child.id)
                        setIsOpen(false)
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '0.45rem 1rem 0.45rem 2.5rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#12162a'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'transparent'
                      }}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

