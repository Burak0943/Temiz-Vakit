// Kur'an verisi: api.alquran.cloud (AlQuran Cloud). İçerik kuralı gereği tüm
// metinler API'den gelir; hiçbir ayet/okunuş/meal elle yazılmaz. Edition'lar:
//   Arapça: quran-uthmani (varsayılan /surah/{n})
//   Meal:   tr.diyanet (Diyanet İşleri çevirisi)
//   Okunuş: tr.transliteration (Çeviriyazı)
//   Ses:    ar.alafasy (Mişari Raşid el-Afâsî, ayet ayet mp3)
// localStorage'da YALNIZ sure listesi ve son okunan konum tutulur; ayet
// metinleri oturum içi bellekte + KALICI olarak IndexedDB'de önbellenir:
// açılan sure cihazda birikir, internetsiz yeniden açılabilir (ses hariç).
import { idbGet, idbSet, idbKeys } from './idb.js'

const BASE = 'https://api.alquran.cloud/v1'
const LIST_KEY = 'tv_quran_surahs'
const POS_KEY = 'tv_quran_pos'
const FRIENDLY = "Kur'an verisi yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin."

const memory = new Map() // oturum içi sure detayları (çözülmüş değer)
const inflight = new Map() // süren istekler: eşzamanlı çağrılar tek nesneyi paylaşır

async function getJson(url) {
  let res
  try {
    res = await fetch(url)
  } catch {
    throw new Error(FRIENDLY)
  }
  if (!res.ok) throw new Error(FRIENDLY)
  let body
  try {
    body = await res.json()
  } catch {
    throw new Error(FRIENDLY)
  }
  if (body.code !== 200 || !body.data) throw new Error(FRIENDLY)
  return body.data
}

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // depolama yazılamasa da akış devam eder
  }
}

export async function getSurahList() {
  const cached = readStore(LIST_KEY)
  if (Array.isArray(cached) && cached.length === 114) return cached
  const data = await getJson(`${BASE}/surah`)
  const list = data.map((s) => ({
    number: s.number,
    name: s.englishName,
    ayahs: s.numberOfAyahs,
    place: s.revelationType === 'Meccan' ? 'Mekkî' : 'Medenî',
  }))
  writeStore(LIST_KEY, list)
  return list
}

const SURAH_PREFIX = 'surah-'

// Süren istek de memoize edilir: aynı sureyi eşzamanlı isteyen iki çağıran
// (ör. Kur'an sekmesi + Nazar bölümü) TEK detay nesnesini paylaşır — çalan
// kart vurgusu ayahs dizi KİMLİĞİNE dayandığından kopya nesne vurguyu bozar.
export function getSurahDetail(number) {
  if (memory.has(number)) return Promise.resolve(memory.get(number))
  if (inflight.has(number)) return inflight.get(number)
  const promise = (async () => {
    // Önce cihaz deposu: Kur'an metni değişmez, tazelik kontrolü gereksiz —
    // kayıt varsa ağa hiç çıkılmaz (offline'ın temeli).
    try {
      const stored = await idbGet(`${SURAH_PREFIX}${number}`)
      if (stored && Array.isArray(stored.ayahs) && stored.ayahs.length) {
        memory.set(number, stored)
        return stored
      }
    } catch {
      // IndexedDB kullanılamıyorsa (özel mod vb.) ağ akışıyla devam
    }
    const [ar, meal, translit, audio] = await Promise.all([
      getJson(`${BASE}/surah/${number}`),
      getJson(`${BASE}/surah/${number}/tr.diyanet`),
      getJson(`${BASE}/surah/${number}/tr.transliteration`),
      getJson(`${BASE}/surah/${number}/ar.alafasy`),
    ])
    const detail = {
      number: ar.number,
      name: ar.englishName,
      ayahs: ar.ayahs.map((a, i) => ({
        no: a.numberInSurah,
        arapca: a.text,
        okunus: translit.ayahs[i]?.text ?? null,
        meal: meal.ayahs[i]?.text ?? null,
        ses: audio.ayahs[i]?.audio ?? null,
      })),
    }
    memory.set(number, detail)
    // Kalıcı depoya arka planda yaz; yazılamasa da akış sürer
    idbSet(`${SURAH_PREFIX}${number}`, detail).catch(() => {})
    return detail
  })()
  // Başarısız istek memoize edilmez: sonraki çağrı yeniden dener
  inflight.set(number, promise)
  promise.finally(() => inflight.delete(number)).catch(() => {})
  return promise
}

// Cihazda kayıtlı sure numaraları (sure listesindeki "cihazda" rozeti için)
export async function getStoredSurahNumbers() {
  try {
    const keys = await idbKeys()
    return keys
      .filter((k) => typeof k === 'string' && k.startsWith(SURAH_PREFIX))
      .map((k) => Number(k.slice(SURAH_PREFIX.length)))
      .filter(Number.isInteger)
  } catch {
    return []
  }
}

export function getPosition() {
  const p = readStore(POS_KEY)
  return p && Number.isInteger(p.surah) && Number.isInteger(p.ayah) ? p : null
}

export function savePosition(surah, ayah) {
  writeStore(POS_KEY, { surah, ayah })
}
