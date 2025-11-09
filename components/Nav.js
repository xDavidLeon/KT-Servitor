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
  
  const Item = ({href,label}) => {
    const active = r.pathname === href || r.pathname.startsWith(href + '/')
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
  
  return (
    <nav className="nav-links" aria-label="Primary navigation">
      <div className="nav-links-row">
        <Item href="/" label="Home"/>
        <Item href="/sequence" label="Game Sequence"/>
        <Item href={factionRulesHref} label="Faction Rules"/>
        <Item href="/rules" label="Game Rules"/>
      </div>
    </nav>
  )
}
