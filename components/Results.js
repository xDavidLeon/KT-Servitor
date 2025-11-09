import Link from 'next/link'

function normalizeFactionId(id) {
  if (!id) return null
  return id.startsWith('fac_') ? id.slice(4) : id
}

function buildResultHref(result) {
  if (!result) return '/'

  const factionTypes = new Set([
    'operative',
    'faction_rule',
    'equipment',
    'strategic_ploy',
    'tactical_ploy',
    'tacop'
  ])

  if (result.type === 'faction') {
    const slug = normalizeFactionId(result.id)
    return slug ? `/factions/${slug}` : `/factions/${result.id}`
  }

  if (factionTypes.has(result.type)) {
    const slug = normalizeFactionId(result.factionId)
    if (slug) {
      const hash = result.id ? `#${result.id}` : ''
      return `/factions/${slug}${hash}`
    }
  }

  if (result.type === 'faction') {
    const slug = normalizeFactionId(result.id)
    const hash = result.id ? `#${result.id}` : ''
    return slug ? `/factions/${slug}${hash}` : `/factions/${result.id}${hash}`
  }

  return `/item/${result.id}`
}

export default function Results({results, loading}){
  if (loading) return <div className="card">Building index…</div>
  if (!results) return null
  if (results.length===0) return <div className="card">No results.</div>

  return (
    <div className="card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => (
              <tr key={r.id}>
                <td><Link href={buildResultHref(r)}>{r.title}</Link></td>
                <td className="muted">{r.type}</td>
                <td>{(r.tags || []).slice(0, 4).map(t => <span className="pill" key={t}>{t}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
