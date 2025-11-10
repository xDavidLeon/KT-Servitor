// components/Nav.js
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Nav(){
  const r = useRouter()
  
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
  
    const navItems = [
      { key: 'home', href: '/', label: 'Home', isActive: (path) => path === '/' },
      { key: 'sequence', href: '/sequence', label: 'Game Sequence', isActive: (path) => path === '/sequence' || path.startsWith('/sequence/') },
      { key: 'killteams', href: '/killteams', label: 'Kill Teams', isActive: (path) => path === '/killteams' || path.startsWith('/killteams/') }
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
