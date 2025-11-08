import { db, getMeta, setMeta } from './db'
import { rebuildIndex } from './search'
async function hashText(t){ const enc = new TextEncoder().encode(t); const h = await crypto.subtle.digest('SHA-256',enc); return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('') }
export async function checkForUpdates() {
  try {
    const res = await fetch('/data/v1/manifest.json', { cache: 'no-store' })
    const manifest = await res.json()
    const current = await getMeta('dataset_version') || null
    if (current === manifest.version) return { updated:false, version: current }
    // fetch each listed file
    for (const entry of manifest.files) {
      const fr = await fetch(`/data/v1/${entry.name}`, { cache: 'no-store' })
      const txt = await fr.text()
      if (entry.sha256) {
        const h = await hashText(txt)
        if (entry.sha256 && entry.sha256 !== h) console.warn('Hash mismatch for', entry.name)
      }
      const json = JSON.parse(txt)
    
      if (entry.name.startsWith('rules')) {
        for (const r of json)
          await db.articles.put({ id:r.id, title:r.title, type:'rule', season:r.season, tags:r.tags||[], body:r.body, abbr:r.abbr||'' })
      }
      else if (entry.name.startsWith('units')) {
        for (const u of json)
          await db.articles.put({ id:u.id, title:u.name, type:'unit', season:u.season, tags:u.keywords||[], body:u.summary||'', abbr:u.abbr||'' })
      }
      else if (entry.name.startsWith('sequence')) {
        for (const s of json)
          await db.articles.put({ id:s.id, title:s.title, type:'sequence_step', season:s.season||'Core', body:s.body, order:s.order||0 })
      }
      else if (entry.name.startsWith('factions')) {
        for (const f of json)
          await db.articles.put({ id:f.id, title:f.name, type:'faction', season:f.season||'Core', tags:f.tags||[], body:f.summary||'' })
      }
      else if (entry.name.startsWith('faction_')) {
        // faction-specific content: operatives, tacops, ploys, equipment, rules
        for (const it of json) {
          await db.articles.put({
            id: it.id,
            title: it.title || it.name,
            type: it.type,           // 'operative' | 'tacop' | 'ploy' | 'equipment' | 'faction_rule'
            factionId: it.factionId, // link back to faction
            season: it.season || 'Core',
            tags: it.tags || [],
            body: it.body || it.summary || ''
          })
        }
      }
    }
    
    await setMeta('dataset_version', manifest.version)
    await rebuildIndex()
    return { updated:true, version: manifest.version }
  } catch (e) {
    console.error(e)
    return { updated:false, error: String(e) }
  }
}
export async function forceUpdateAndReindex() {
  try {
    const res = await fetch('/data/v1/manifest.json', { cache: 'no-store' })
    const manifest = await res.json()

    for (const entry of manifest.files) {
      const fr = await fetch(`/data/v1/${entry.name}`, { cache: 'no-store' })
      const txt = await fr.text()
      // If sha256 present, verify; if blank, skip silently
      if (entry.sha256 && entry.sha256.length > 0) {
        const enc = new TextEncoder().encode(txt)
        const h = await crypto.subtle.digest('SHA-256', enc)
        const hex = Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('')
        if (hex !== entry.sha256) console.warn('Hash mismatch for', entry.name)
      }
      const json = JSON.parse(txt)
      if (entry.name.startsWith('rules')) {
        for (const r of json) await db.articles.put({ id: r.id, title: r.title, type:'rule', season: r.season, tags: r.tags||[], body: r.body, abbr: r.abbr||'' })
      } else if (entry.name.startsWith('units')) {
        for (const u of json) await db.articles.put({ id: u.id, title: u.name, type:'unit', season: u.season, tags: u.keywords||[], body: u.summary || '', abbr: (u.abbr||'') })
      }
    }

    await setMeta('dataset_version', `${manifest.version}`) // keep manifest version
    await (await import('./search')).rebuildIndex()
    return { ok: true, version: manifest.version }
  } catch (e) {
    console.error(e)
    return { ok: false, error: String(e) }
  }
}
