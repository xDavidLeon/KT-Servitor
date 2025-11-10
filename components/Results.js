import Link from 'next/link'

function deriveKillteamId(doc) {
  if (!doc) return null
  if (doc.killteamId) return doc.killteamId
  if (typeof doc.id === 'string' && doc.id.startsWith('killteam:')) {
    return doc.id.slice('killteam:'.length)
  }
  return null
}

function buildResultHref(result) {
  if (!result) return '/'

  if (result.type === 'killteam') {
    const killteamId = deriveKillteamId(result)
    return killteamId ? `/killteams/${encodeURIComponent(killteamId)}` : '/'
  }

  const killteamId = deriveKillteamId(result)
  if (killteamId) {
    const anchor = result.anchorId ? `#${result.anchorId}` : ''
    return `/killteams/${encodeURIComponent(killteamId)}${anchor}`
  }

  return `/item/${result.id}`
}

const TYPE_LABELS = {
  killteam: 'Kill Team',
  operative: 'Operative Type',
  strategic_ploy: 'Strategic Ploy',
  tactical_ploy: 'Firefight Ploy',
  equipment: 'Equipment'
}

function formatType(type) {
  return TYPE_LABELS[type] || type
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
                  <td className="muted">{formatType(r.type)}</td>
                <td>{(r.tags || []).slice(0, 4).map(t => <span className="pill" key={t}>{t}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
