// Minik IndexedDB anahtar-değer sarmalayıcısı (idb-keyval sadeliğinde, bağımlılıksız).
// Kur'an metinleri için: localStorage 5MB sınırı uzun surelerde yetmez.
// Tüm işlevler hata durumunda reject eder; çağıran taraf ağ akışına düşer.
const DB_NAME = 'temiz-vakit'
const STORE = 'kv'

let dbPromise = null

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error('idb blocked'))
    })
    // Başarısız açılışı önbellekleme: sonraki çağrı yeniden denesin
    dbPromise.catch(() => {
      dbPromise = null
    })
  }
  return dbPromise
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGet(key) {
  const db = await openDb()
  return requestToPromise(db.transaction(STORE).objectStore(STORE).get(key))
}

export async function idbSet(key, value) {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(value, key)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function idbKeys() {
  const db = await openDb()
  return requestToPromise(db.transaction(STORE).objectStore(STORE).getAllKeys())
}
