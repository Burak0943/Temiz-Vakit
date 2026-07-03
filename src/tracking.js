// Günlük namaz takibi: localStorage "tv_prayers" -> { "2026-07-04": ["dhuhr", ...] }
// Tarih alan fonksiyonlar parametreli ki gün sınırı davranışı sınanabilsin.

const STORAGE_KEY = 'tv_prayers'

// İmsak satırı hariç; sabah namazı işareti Güneş satırında tutulur
export const TRACKED = ['sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

export function localDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function loadPrayerData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
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
