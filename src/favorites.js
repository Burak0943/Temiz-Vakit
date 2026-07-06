// Favori ayetler: localStorage tv_favorites -> [{ s: sureNo, a: ayetNo }]
// Yedeğe dâhildir (settings.js BACKUP_KEYS + doğrulayıcı).
const KEY = 'tv_favorites'

export function loadFavorites() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY))
    if (!Array.isArray(arr)) return []
    // Yalnız geçerli {s,a} girdileri (bozuk/dev kayıt anlamsız liste üretmesin)
    return arr
      .filter(
        (x) =>
          x &&
          Number.isInteger(x.s) &&
          x.s >= 1 &&
          x.s <= 114 &&
          Number.isInteger(x.a) &&
          x.a >= 1 &&
          x.a <= 300,
      )
      .slice(0, 1000) // makul üst sınır
  } catch {
    return []
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // yazılamasa da oturum içinde çalışır
  }
}

export function isFavorite(list, s, a) {
  return list.some((x) => x.s === s && x.a === a)
}

// Favoriyi ekler/çıkarır, GÜNCEL listeyi döndürür
export function toggleFavorite(list, s, a) {
  const i = list.findIndex((x) => x.s === s && x.a === a)
  const next = i >= 0 ? list.filter((_, j) => j !== i) : [...list, { s, a }]
  save(next)
  return next
}
