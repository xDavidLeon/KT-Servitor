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
          await db.articles.put({ id:r.id, title:r.title, type:'rule', tags:r.tags||[], body:r.body, abbr:r.abbr||'' })
      }
      else if (entry.name.startsWith('units')) {
        for (const u of json)
          await db.articles.put({ id:u.id, title:u.name, type:'unit', tags:u.keywords||[], body:u.summary||'', abbr:u.abbr||'' })
      }
      else if (entry.name.startsWith('sequence')) {
        for (const s of json)
          await db.articles.put({ id:s.id, title:s.title, type:'sequence_step', body:s.body, order:s.order||0 })
      }
      else if (entry.name.startsWith('factions')) {
        for (const f of json)
          await db.articles.put({ 
            id: f.id, 
            title: f.name, 
            type: 'faction', 
            tags: f.archetypes || [], 
            body: f.summary || '',
            factionKeyword: f.factionKeyword || null,
            archetypes: f.archetypes || []
          })
      }
      else if (entry.name.startsWith('faction_')) {
        // New structure: complete faction object with nested data
        if (json.operatives && Array.isArray(json.operatives)) {
          // Store the faction itself
          await db.articles.put({
            id: json.id,
            title: json.name,
            type: 'faction',
            body: json.summary || '',
            factionKeyword: json.factionKeyword || null,
            archetypes: json.archetypes || []
          })
          
          // Store operatives
          for (const op of json.operatives || []) {
            await db.articles.put({
              id: op.id,
              title: op.name,
              type: 'operative',
              factionId: json.id,
              tags: op.keywords || [],
              body: JSON.stringify(op), // Store full structured data as JSON string
              apl: op.apl,
              move: op.move,
              save: op.save,
              wounds: op.wounds
            })
          }
          
          // Store rules
          for (const rule of json.rules || []) {
            await db.articles.put({
              id: rule.id,
              title: rule.name,
              type: 'faction_rule',
              factionId: json.id,
              body: rule.description || ''
            })
          }
          
          // Store strategic ploys
          for (const ploy of json.strategicPloys || []) {
            await db.articles.put({
              id: ploy.id,
              title: ploy.name,
              type: 'strategic_ploy',
              factionId: json.id,
              body: ploy.description || ''
            })
          }
          
          // Store tactical ploys
          for (const ploy of json.tacticalPloys || []) {
            await db.articles.put({
              id: ploy.id,
              title: ploy.name,
              type: 'tactical_ploy',
              factionId: json.id,
              body: ploy.description || ''
            })
          }
          
          // Store equipment
          for (const eq of json.equipment || []) {
            await db.articles.put({
              id: eq.id,
              title: eq.name,
              type: 'equipment',
              factionId: json.id,
              body: eq.description || ''
            })
          }
          
          // Store tacops
          for (const tacop of json.tacops || []) {
            await db.articles.put({
              id: tacop.id,
              title: tacop.name || tacop.title,
              type: 'tacop',
              factionId: json.id,
              body: tacop.description || tacop.body || ''
            })
          }
        } else {
          // Old structure: array of items
          for (const it of json) {
            await db.articles.put({
              id: it.id,
              title: it.title || it.name,
              type: it.type,           // 'operative' | 'tacop' | 'ploy' | 'equipment' | 'faction_rule'
              factionId: it.factionId, // link back to faction
              tags: it.tags || [],
              body: it.body || it.summary || ''
            })
          }
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
        for (const r of json) await db.articles.put({ id: r.id, title: r.title, type:'rule', tags: r.tags||[], body: r.body, abbr: r.abbr||'' })
      } else if (entry.name.startsWith('units')) {
        for (const u of json) await db.articles.put({ id: u.id, title: u.name, type:'unit', tags: u.keywords||[], body: u.summary || '', abbr: (u.abbr||'') })
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
