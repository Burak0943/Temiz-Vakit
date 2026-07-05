// Bildirimler — İSTEMCİ fazı (v2.3). Yalnız uygulama AÇIKKEN çalışır: sekme/PWA
// açık ve bir vakit (seçilen erken hatırlatma dahil) geldiğinde Notification API
// ile bildirim + sayfa içi vurgu. Uygulama KAPALIYKEN bildirim için web push
// sunucu ayağı (VAPID + KV + cron) gerekir; o faz kullanıcının Vercel kurulumunu
// bekliyor — burada KURULMADI, ayarlarda dürüst sınır notu gösterilir.
const KEY = 'tv_notify'

export const NOTIFY_PRAYERS = [
  { key: 'fajr', ad: 'İmsak / Sabah' },
  { key: 'dhuhr', ad: 'Öğle' },
  { key: 'asr', ad: 'İkindi' },
  { key: 'maghrib', ad: 'Akşam' },
  { key: 'isha', ad: 'Yatsı' },
]
export const NOTIFY_OFFSETS = [0, 15, 30] // dakika: vaktinde / 15dk / 30dk önce

const DEFAULT = {
  enabled: false,
  offset: 0,
  prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
}

function loadPrefs() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY))
    if (!o || typeof o !== 'object') return { ...DEFAULT, prayers: { ...DEFAULT.prayers } }
    const prayers = {}
    for (const p of NOTIFY_PRAYERS) prayers[p.key] = o.prayers?.[p.key] !== false
    return {
      enabled: o.enabled === true,
      offset: NOTIFY_OFFSETS.includes(o.offset) ? o.offset : 0,
      prayers,
    }
  } catch {
    return { ...DEFAULT, prayers: { ...DEFAULT.prayers } }
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // yazılamasa da oturum içinde çalışır
  }
}

export function notifySupported() {
  return typeof Notification !== 'undefined'
}

export function setupNotifications({ onFire }) {
  let prefs = loadPrefs()
  const fired = new Set() // "YYYY-MM-DD-key" — gün+vakit başına tek bildirim

  function permission() {
    if (!notifySupported()) return 'unsupported'
    return Notification.permission // 'default' | 'granted' | 'denied'
  }

  async function requestEnable() {
    if (!notifySupported()) return 'unsupported'
    let perm = Notification.permission
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission()
      } catch {
        perm = Notification.permission
      }
    }
    prefs.enabled = perm === 'granted'
    savePrefs(prefs)
    return perm
  }

  function disable() {
    prefs.enabled = false
    savePrefs(prefs)
  }

  function setPrayer(key, on) {
    prefs.prayers[key] = !!on
    savePrefs(prefs)
  }

  function setOffset(n) {
    if (NOTIFY_OFFSETS.includes(n)) {
      prefs.offset = n
      savePrefs(prefs)
    }
  }

  function fire(label) {
    if (notifySupported() && Notification.permission === 'granted') {
      try {
        new Notification('Temiz Vakit', {
          body: prefs.offset > 0 ? `${label} vaktine ${prefs.offset} dakika` : `${label} vakti girdi`,
          tag: 'tv-prayer', // üst üste yığılmasın
        })
      } catch {
        // bazı ortamlar yapıcıyı engeller (SW gerekir) — sessiz geç, sayfa içi vurgu kalır
      }
    }
    onFire?.(label)
  }

  // main.js her tick'te çağırır: bugünün vakit listesi (key/label/time) verilir.
  // Bildirim zamanı = vakit − offset; o ana ulaşılınca (±60 sn pencere) tetiklenir.
  function check(now, todayTimes) {
    if (!prefs.enabled || !todayTimes?.length) return
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dateKey = `${y}-${m}-${d}`
    for (const p of todayTimes) {
      if (!prefs.prayers[p.key]) continue // takip edilmeyen (Güneş) veya kapalı vakit
      const notifyTime = p.time.getTime() - prefs.offset * 60000
      const id = `${dateKey}-${p.key}`
      // Zaman geldi, henüz tetiklenmedi ve GEÇMİŞTE kalmadı (app sonradan açıldıysa
      // bir dakikadan eski bildirim atlanır — bayat uyarı gösterme)
      if (now.getTime() >= notifyTime && now.getTime() < notifyTime + 60000 && !fired.has(id)) {
        fired.add(id)
        fire(p.label)
      }
    }
    // Hafıza sınırı: gün değişince eski işaretler temizlenir
    if (fired.size > 40) {
      for (const k of fired) if (!k.startsWith(dateKey)) fired.delete(k)
    }
  }

  return {
    getPrefs: () => ({ enabled: prefs.enabled, offset: prefs.offset, prayers: { ...prefs.prayers } }),
    permission,
    requestEnable,
    disable,
    setPrayer,
    setOffset,
    check,
  }
}
