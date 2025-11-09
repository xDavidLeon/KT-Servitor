// components/Nav.js
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'

export default function Nav(){
  const r = useRouter()
  const [firstFactionId, setFirstFactionId] = useState(null)
  
  useEffect(() => {
    // Load factions and get the first one
    fetch('/data/v1/factions.json')
      .then(res => res.json())
      .then(factions => {
        // Sort alphabetically and get the first one
        const sorted = factions.sort((a, b) => a.name.localeCompare(b.name))
        if (sorted.length > 0) {
          // Remove 'fac_' prefix if present for the URL
          const id = sorted[0].id.startsWith('fac_') ? sorted[0].id.substring(4) : sorted[0].id
          setFirstFactionId(id)
        }
      })
      .catch(err => console.error('Error loading factions:', err))
  }, [])
  
  const Item = ({href,label,isActive}) => {
    const currentPath = r.asPath?.split('?')[0] || r.pathname
    const active = typeof isActive === 'function'
      ? isActive(currentPath)
      : currentPath === href || currentPath.startsWith(`${href}/`)
    return (
      <Link href={href}
        className="pill"
        style={{
          textDecoration: 'none',
          borderColor: active ? 'var(--accent)' : '#2a2f3f',
          color: active ? 'var(--accent)' : 'var(--muted)'
        }}>
        {label}
      </Link>
    )
  }
  
  // Use first faction if available, otherwise fallback to /factions
  const factionRulesHref = firstFactionId ? `/factions/${firstFactionId}` : '/factions'
  
  const navItems = [
    { key: 'home', href: '/', label: 'Home', isActive: (path) => path === '/' },
    { key: 'sequence', href: '/sequence', label: 'Game Sequence', isActive: (path) => path === '/sequence' || path.startsWith('/sequence/') },
    { key: 'factions', href: factionRulesHref, label: 'Faction Rules', isActive: (path) => path === '/factions' || path.startsWith('/factions/') },
    { key: 'rules', href: '/rules', label: 'Game Rules', isActive: (path) => path === '/rules' || path.startsWith('/rules/') }
  ]

  return (
    <nav className="nav-links" aria-label="Primary navigation">
      <div className="nav-links-row">
        {navItems.map(({ key, href, label, isActive }) => (
          <Item key={key} href={href} label={label} isActive={isActive} />
        ))}
      </div>
    </nav>
  )
}
