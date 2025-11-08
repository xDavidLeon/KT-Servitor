// components/Nav.js
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Nav(){
  const r = useRouter()
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
  return (
    <div className="row" style={{marginTop:'.5rem'}}>
      <Item href="/" label="Home"/>
      <Item href="/sequence" label="Game Sequence"/>
      <Item href="/factions" label="Factions"/>
      <Item href="/rules" label="Game Rules"/>
    </div>
  )
}
