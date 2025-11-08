// lib/search.js
import MiniSearch from 'minisearch'
import { db } from './db'

const INDEX_KEY = 'minisearch_v1'
let mini = null

async function saveIndex(ms) {
  // Always store as a JSON string
  await db.index.put({ key: INDEX_KEY, serialized: JSON.stringify(ms.toJSON()) })
}

export async function ensureIndex() {
  if (mini) return mini

  const saved = await db.index.get(INDEX_KEY) // get by primary key directly
  if (saved?.serialized) {
    try {
      const jsonStr = typeof saved.serialized === 'string'
        ? saved.serialized
        : JSON.stringify(saved.serialized)
      mini = MiniSearch.loadJSON(jsonStr, {
        fields: ['title','body','tags','abbr'],
        storeFields: ['id','title','type','season','tags']
      })
      return mini
    } catch (e) {
      console.warn('Failed to load stored index, rebuilding…', e)
      return await rebuildIndex()
    }
  }

  // No saved index yet → build
  return await rebuildIndex()
}

export async function rebuildIndex() {
  mini = new MiniSearch({
    fields: ['title','body','tags','abbr'],
    storeFields: ['id','title','type','season','tags']
  })
  const docs = await db.articles.toArray()
  mini.addAll(docs.map(d => ({ ...d, abbr: (d.abbr || '') })))
  await saveIndex(mini)
  return mini
}
