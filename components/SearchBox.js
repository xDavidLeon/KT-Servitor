export default function SearchBox({q,setQ}){
  return (
    <div className="card">
      <input placeholder="Search rules, units, keywords…" value={q} onChange={e=>setQ(e.target.value)} style={{width:'100%'}}/>
    </div>
  )
}
