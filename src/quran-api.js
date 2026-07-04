// Kur'an verisi: api.alquran.cloud (AlQuran Cloud). İçerik kuralı gereği tüm
// metinler API'den gelir; hiçbir ayet/okunuş/meal elle yazılmaz. Edition'lar:
//   Arapça: quran-uthmani (varsayılan /surah/{n})
//   Meal:   tr.diyanet (Diyanet İşleri çevirisi)
//   Okunuş: tr.transliteration (Çeviriyazı)
//   Ses:    ar.alafasy (Mişari Raşid el-Afâsî, ayet ayet mp3)
// localStorage'da YALNIZ sure listesi ve son okunan konum tutulur; ayet
// metinleri oturum içi bellekte önbellenir.
const BASE = 'https://api.alquran.cloud/v1'
const LIST_KEY = 'tv_quran_surahs'
const POS_KEY = 'tv_quran_pos'
const FRIENDLY = "Kur'an verisi yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin."

const memory = new Map() // oturum içi sure detayları

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

export async function getSurahDetail(number) {
  if (memory.has(number)) return memory.get(number)
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
  return detail
}

export function getPosition() {
  const p = readStore(POS_KEY)
  return p && Number.isInteger(p.surah) && Number.isInteger(p.ayah) ? p : null
}

export function savePosition(surah, ayah) {
  writeStore(POS_KEY, { surah, ayah })
}
