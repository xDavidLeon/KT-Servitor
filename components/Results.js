import Link from 'next/link'
export default function Results({results, loading}){
  if (loading) return <div className="card">Building index…</div>
  if (!results) return null
  if (results.length===0) return <div className="card">No results.</div>
  return (
    <div className="card">
      <table>
        <thead><tr><th>Title</th><th>Type</th><th>Season</th><th>Tags</th></tr></thead>
        <tbody>
          {results.map(r=> (
            <tr key={r.id}>
              <td><Link href={`/item/${r.id}`}>{r.title}</Link></td>
              <td className="muted">{r.type}</td>
              <td className="muted">{r.season}</td>
              <td>{(r.tags||[]).slice(0,4).map(t=> <span className="pill" key={t}>{t}</span>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
