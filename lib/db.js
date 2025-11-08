// lib/db.js
import Dexie from 'dexie';
export const db = new Dexie('ktdemo');
db.version(1).stores({
  meta: 'key',
  articles: 'id,title,type,season,tags',
  index: 'key'
});
export async function getMeta(key) { return (await db.meta.get(key))?.value; }
export async function setMeta(key,value){ return db.meta.put({key,value}); }
