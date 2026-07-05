// Günlük namaz takibi: localStorage "tv_prayers" -> { "2026-07-04": ["dhuhr", ...] }
// Tarih alan fonksiyonlar parametreli ki gün sınırı davranışı sınanabilsin.

const STORAGE_KEY = 'tv_prayers'

// 5 farz: sabah namazı İmsak satırında "fajr" anahtarıyla tutulur; Güneş bilgi amaçlı
export const TRACKED = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

export function localDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function loadPrayerData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    const data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    // Gün değerleri dizi olmak zorunda: bozuk/elle düzenlenmiş kayıt (ör. hatalı
    // yedek dosyası) açılışta renderTimes'ı çökertmesin — dizi olmayan atılır
    for (const [day, marks] of Object.entries(data)) {
      if (!Array.isArray(marks)) delete data[day]
      else data[day] = marks.filter((k) => typeof k === 'string')
    }
    return migrateSunrise(data)
  } catch {
    return {}
  }
}

// v0.2'de sabah namazı "sunrise" anahtarıyla kaydediliyordu; "fajr"a taşı
function migrateSunrise(data) {
  let migratedDays = 0
  for (const [day, marks] of Object.entries(data)) {
    if (Array.isArray(marks) && marks.includes('sunrise')) {
      const set = new Set(marks.map((k) => (k === 'sunrise' ? 'fajr' : k)))
      data[day] = TRACKED.filter((k) => set.has(k))
      migratedDays++
    }
  }
  if (migratedDays > 0) {
    console.log(`tv_prayers migrasyonu: ${migratedDays} gündeki "sunrise" kaydı "fajr" anahtarına taşındı`)
    savePrayerData(data)
  }
  return data
}

export function savePrayerData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // depolama yazılamasa da işaretleme akışı kesilmesin
  }
}

export function isDayComplete(marks) {
  return TRACKED.every((k) => Array.isArray(marks) && marks.includes(k))
}

export function toggleMark(data, dateKey, prayerKey) {
  const marks = new Set(data[dateKey] || [])
  if (marks.has(prayerKey)) marks.delete(prayerKey)
  else marks.add(prayerKey)
  data[dateKey] = TRACKED.filter((k) => marks.has(k))
  return data
}

// Art arda 5 vakti tam işaretlenen gün sayısı.
// Bugün henüz tamamlanmadıysa seri kırılmaz, dünden geriye sayılır.
export function computeStreak(data, today = new Date()) {
  let streak = 0
  const day = new Date(today)
  if (isDayComplete(data[localDateKey(day)])) streak++
  day.setDate(day.getDate() - 1)
  while (isDayComplete(data[localDateKey(day)])) {
    streak++
    day.setDate(day.getDate() - 1)
  }
  return streak
}
