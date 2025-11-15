// components/Nav.js
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslations } from '../lib/i18n'

export default function Nav(){
  const r = useRouter()
  const t = useTranslations('nav')
  
  const Item = ({href,label,isActive}) => {
    const currentPath = r.asPath?.split('?')[0] || r.pathname
    const active = typeof isActive === 'function'
      ? isActive(currentPath)
      : currentPath === href || currentPath.startsWith(`${href}/`)
    return (
      <Link href={href}
        className={`pill ${active ? 'active' : ''}`}
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
      { key: 'home', href: '/', labelKey: 'home', isActive: (path) => path === '/' },
      { key: 'killteams', href: '/killteams', labelKey: 'killTeams', isActive: (path) => path === '/killteams' || path.startsWith('/killteams/') },
      { key: 'sequence', href: '/sequence', labelKey: 'gameSequence', isActive: (path) => path === '/sequence' || path.startsWith('/sequence/') },
      { key: 'rules', href: '/rules', labelKey: 'gameRules', isActive: (path) => path === '/rules' || path.startsWith('/rules/') },
      { key: 'ops', href: '/ops', labelKey: 'ops', isActive: (path) => path === '/ops' || path.startsWith('/ops/') },
      { key: 'scoreboard', href: '/scoreboard', labelKey: 'scoreboard', isActive: (path) => path === '/scoreboard' }
    ]

  return (
    <nav className="nav-links" aria-label="Primary navigation">
      <div className="nav-links-row">
        {navItems.map(({ key, href, labelKey, isActive }) => (
          <Item key={key} href={href} label={t(labelKey)} isActive={isActive} />
        ))}
      </div>
    </nav>
  )
}
