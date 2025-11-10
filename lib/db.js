// lib/db.js
import Dexie from 'dexie';
export const db = new Dexie('ktdemo');
db.version(1).stores({
  meta: 'key',
  articles: 'id,title,type,season,tags',
  index: 'key'
});
db.version(2).stores({
  meta: 'key',
  articles: 'id,title,type,season,tags,factionId',
  index: 'key'
});

db.version(3).stores({
  meta: 'key',
  articles: 'id,title,type,season,tags,factionId',
  index: 'key',
  killteams: 'killteamId,killteamName,factionId'
});
export async function getMeta(key) { return (await db.meta.get(key))?.value; }
export async function setMeta(key,value){ return db.meta.put({key,value}); }
