// components/KillteamSectionNavigator.js
import { useState, useEffect } from 'react'

const SECTIONS = [
  { id: 'killteam-overview', label: 'Overview' },
  { id: 'killteam-composition', label: 'Composition' },
  { id: 'operative-types', label: 'Operative Types' },
  { id: 'strategic-ploys', label: 'Strategic Ploys' },
  { id: 'firefight-ploys', label: 'Firefight Ploys' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'default-roster', label: 'Default Roster' }
]

function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId)
  if (!element) return

  const mainHeader = document.querySelector('.header-sticky')
  const selectorCard = document.querySelector('.killteam-selector-sticky')

  let headerOffset = 200
  if (mainHeader && selectorCard) {
    const mainHeaderHeight = mainHeader.getBoundingClientRect().height
    const selectorHeight = selectorCard.getBoundingClientRect().height
    headerOffset = mainHeaderHeight + selectorHeight + 20
  }

  const elementPosition = element.getBoundingClientRect().top
  const offsetPosition = elementPosition + window.pageYOffset - headerOffset

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth'
  })
}

export default function KillteamSectionNavigator({ killteam }) {
  const [isOpen, setIsOpen] = useState(false)
  const [availableSections, setAvailableSections] = useState([])

  useEffect(() => {
    if (!killteam) return

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

    addSection('killteam-overview')

    if (killteam.composition) {
      addSection('killteam-composition')
    }

    if (Array.isArray(killteam.opTypes) && killteam.opTypes.length) {
      const operativeChildren = buildChildren(
        killteam.opTypes,
        (op) => op?.opTypeId ? `operative-${op.opTypeId}` : null,
        (op, index) => op?.opTypeName || op?.opName || `Operative ${index + 1}`
      )
      addSection('operative-types', operativeChildren)
    }

    const strategicPloys = (killteam.ploys || []).filter(ploy => ploy?.ployType === 'S')
    if (strategicPloys.length) {
      const strategicChildren = buildChildren(
        strategicPloys,
        (ploy) => ploy?.ployId ? `ploy-${ploy.ployId}` : null,
        (ploy, index) => ploy?.ployName || `Strategic Ploy ${index + 1}`
      )
      addSection('strategic-ploys', strategicChildren)
    }

    const firefightPloys = (killteam.ploys || []).filter(ploy => ploy?.ployType && ploy.ployType !== 'S')
    if (firefightPloys.length) {
      const firefightChildren = buildChildren(
        firefightPloys,
        (ploy) => ploy?.ployId ? `ploy-${ploy.ployId}` : null,
        (ploy, index) => ploy?.ployName || `Firefight Ploy ${index + 1}`
      )
      addSection('firefight-ploys', firefightChildren)
    }

    if (Array.isArray(killteam.equipments) && killteam.equipments.length) {
      const equipmentChildren = buildChildren(
        killteam.equipments,
        (eq) => eq?.eqId ? `equipment-${eq.eqId}` : null,
        (eq, index) => eq?.eqName || `Equipment ${index + 1}`
      )
      addSection('equipment', equipmentChildren)
    }

    if (killteam.defaultRoster) {
      addSection('default-roster')
    }

    setAvailableSections(sections)
  }, [killteam])

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
              maxHeight: '70vh',
              overflowY: 'auto'
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
