const DB_NAME = 'securechat'
const DB_VERSION = 1
const STORE = 'keys'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function withStore(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const keyStore = {
  get(id) {
    return withStore('readonly', (s) => s.get(id)).then((row) => (row ? row.value : undefined))
  },
  put(id, value) {
    return withStore('readwrite', (s) => s.put({ id, value }))
  },
  delete(id) {
    return withStore('readwrite', (s) => s.delete(id))
  },
}