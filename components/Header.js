// components/Header.js
import React from 'react'
import { forceUpdateAndReindex } from '../lib/update'
import Nav from './Nav'

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

export default function Header({ version, status }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onDoc = (e) => { if (!e.target.closest?.('#hdr-gear')) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  async function handleReset() {
    if (!confirm("Reset local data and reload?")) return;
    try {
      const { db } = await import('../lib/db'); db.close();
    } catch {}
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    try { await indexedDB.deleteDatabase('ktdemo'); } catch {}
    localStorage.clear(); sessionStorage.clear();
    location.reload();
  }

  async function handleForceUpdate() {
    setOpen(false);
    const res = await forceUpdateAndReindex();
    if (!res.ok) alert(`Update failed: ${res.error}`);
    else alert(`Updated to data v${res.version}.`);
  }

  async function handleExport() {
    const { db } = await import('../lib/db');
    const all = await db.articles.toArray();
    download(`ktdata-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(all, null, 2));
    setOpen(false);
  }

  function handleAbout() {
    alert("KT Servitor is a personal project by @xdavidleon.\n\nThis free web-based app is a rules reference for Kill Team 2024 and features publicly available data; no copyrighted rule text. It is not affiliated with Games Workshop Ltd. This app is not a replacement for the official Kill Team 2024 rulebook.");
    setOpen(false);
  }

  return (
    <div
      className="card header-sticky"
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}
    >
      <div className="heading">
        <h1 style={{ margin: 0 }}>
          KT Servitor
        </h1>
        {version && <span className="pill">v{version}</span>}
      </div>

      <div
        className="muted"
        style={{ fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        {status}
        <button
          id="hdr-gear"
          onClick={() => setOpen(v => !v)}
          title="Menu"
          style={{
            background: 'none',
            border: '1px solid #333',
            borderRadius: '50%',
            width: '1.9rem',
            height: '1.9rem',
            color: 'var(--muted)',
            fontSize: '1.1rem',
            cursor: 'pointer',
            transition: '0.2s',
          }}
          onMouseOver={(e) => (e.target.style.color = 'var(--accent)')}
          onMouseOut={(e) => (e.target.style.color = 'var(--muted)')}
        >
          ⚙️
        </button>
        <Nav />
        {open && (
          <div className="menu" id="hdr-gear">
            <button onClick={handleForceUpdate}>Force update</button>
            <div className="sep"></div>
            <button onClick={handleExport}>Export data (JSON)</button>
            <div className="sep"></div>
            <button onClick={handleReset}>Reset data</button>
            <div className="sep"></div>
            <button onClick={handleAbout}>About</button>
          </div>
        )}
      </div>
    </div>
  );
}
