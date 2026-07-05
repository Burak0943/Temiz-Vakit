import './style.css'
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan'
import {
  TRACKED,
  localDateKey,
  loadPrayerData,
  savePrayerData,
  toggleMark,
  computeStreak,
} from './tracking.js'
import { setupDhikr } from './dhikr.js'
import { setupMonthly } from './monthly.js'
import { setupHolidays, formatHijriDate, computeEvents, daysLeft } from './holidays.js'
import { setupQuran } from './quran.js'
import { setupPlayer } from './player.js'
import { setupNav } from './nav.js'
import { setupSettings } from './settings.js'
import { setupOnboarding } from './onboarding.js'
import { setupQada } from './qada.js'
import { kerahatWindows, activeKerahat } from './kerahat.js'
import { setupGununAyeti } from './ayet.js'
import { setupNotifications } from './notifications.js'
import { setupEsma, esmaForDate } from './esma.js'
import { setupServiceWorker } from './update.js'
import { setupQibla } from './qibla.js'
import { greetingText } from './greeting.js'
import { setupSwipe } from './swipe.js'

const DEFAULT_LOCATION = { lat: 37.845, lon: 27.839, label: 'Aydın (varsayılan)', isDefault: true }

const PRAYERS = [
  { key: 'fajr', label: 'İmsak / Sabah' },
  { key: 'sunrise', label: 'Güneş' },
  { key: 'dhuhr', label: 'Öğle' },
  { key: 'asr', label: 'İkindi' },
  { key: 'maghrib', label: 'Akşam' },
  { key: 'isha', label: 'Yatsı' },
]

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const longDateFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

let location = DEFAULT_LOCATION
let monthly = null // setupMonthly dönüşü; refresh monthly'den önce koşabilir
let holidays = null // setupHolidays dönüşü
let qibla = null // setupQibla dönüşü
let quran = null // setupQuran dönüşü
let dhikr = null // setupDhikr dönüşü
let nav = null // setupNav dönüşü (geri tuşu yönetimi)
let settings = null // setupSettings dönüşü
let onboarding = null // setupOnboarding dönüşü
let gununAyeti = null // setupGununAyeti dönüşü
let notifications = null // setupNotifications dönüşü
let target = null // { label, time, isTomorrow }
let renderedDay = ''
let greetingMinute = -1 // selam satırı dakikada bir, mevcut tick içinde güncellenir
let lastToday = []
let lastNext = null
let kerahatW = [] // bugünün kerahat pencereleri (refresh'te hesaplanır)
let prayerData = loadPrayerData()

document.querySelector('#app').innerHTML = `
  <section id="view-times">
    <header>
      <h1>Temiz Vakit</h1>
      <button id="settings-btn" type="button" aria-label="Ayarlar">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/></svg>
      </button>
      <p id="greeting"></p>
      <p id="hijri-line"></p>
      <p id="location-line">
        <span id="location-label"></span>
        <button id="use-location" type="button">Konumu Kullan</button>
        <span id="location-note"></span>
      </p>
    </header>
    <section id="countdown-box">
      <p id="next-label"></p>
      <p id="countdown">--:--:--</p>
      <p id="kerahat-line" hidden></p>
    </section>
    <ul id="times"></ul>
    <p id="streak"></p>
    <div id="cards-region">
      <div id="qada-root"></div>
      <button id="holiday-card" type="button" hidden>
        <span id="hc-name"></span>
        <span id="hc-when"></span>
        <span class="hc-more">Tümü ›</span>
      </button>
      <button id="esma-card" type="button">
        <span class="ec-top">
          <span class="ec-label">Günün Esması</span>
          <span class="hc-more">Tümü ›</span>
        </span>
        <span class="ec-name">
          <span id="ec-latin"></span>
          <span id="ec-arabic" dir="rtl" lang="ar"></span>
        </span>
        <span id="ec-anlam" hidden></span>
      </button>
      <div id="ayet-root"></div>
    </div>
    <p class="footnote">Vakitler astronomik hesapla üretilir; Diyanet takviminden ±1 dk farkedebilir.</p>
  </section>
  <section id="view-quran" hidden></section>
  <section id="view-monthly" hidden></section>
  <section id="view-holidays" hidden></section>
  <section id="view-esma" hidden></section>
  <section id="view-settings" hidden></section>
  <section id="view-dhikr" hidden></section>
  <section id="view-qibla" hidden></section>
  <nav id="tabs">
    <button id="tab-times" type="button" class="active" aria-current="page">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
      <span>Vakitler</span>
    </button>
    <button id="tab-quran" type="button">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2z"/><path d="M4 20V5M9 7h6"/></svg>
      <span>Kur'an</span>
    </button>
    <button id="tab-monthly" type="button">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>
      <span>Aylık</span>
    </button>
    <button id="tab-dhikr" type="button">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.5" r="2.5"/><circle cx="6.5" cy="15.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/></svg>
      <span>Zikir</span>
    </button>
    <button id="tab-qibla" type="button">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z"/></svg>
      <span>Kıble</span>
    </button>
  </nav>
`

function computeTimes(date, lat, lon) {
  const prayerTimes = new PrayerTimes(new Coordinates(lat, lon), date, CalculationMethod.Turkey())
  return PRAYERS.map((p) => ({ ...p, time: prayerTimes[p.key] }))
}

function findNext(now) {
  const today = computeTimes(now, location.lat, location.lon)
  // Tarayıcı saat dilimi konumun çok batısındaysa yarının vakitleri bile
  // geçmişte kalabilir; time > now bulunana kadar günleri tara.
  for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
    const date = new Date(now)
    date.setDate(date.getDate() + dayOffset)
    const list = dayOffset === 0 ? today : computeTimes(date, location.lat, location.lon)
    const upcoming = list.find((p) => p.time > now)
    if (upcoming) return { today, next: { ...upcoming, isTomorrow: dayOffset > 0 } }
  }
  return { today, next: { ...today[0], isTomorrow: false } }
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function renderCountdown(now) {
  const diff = Math.max(0, Math.floor((target.time - now) / 1000))
  const hours = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  const seconds = diff % 60
  document.querySelector('#countdown').textContent =
    `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

function renderTimes() {
  const now = new Date()
  const marks = prayerData[localDateKey(now)] || []
  const isFriday = now.getDay() === 5
  document.querySelector('#times').innerHTML = lastToday
    .map((p) => {
      const isNext = p.key === lastNext.key
      // Hedef yarına taştıysa vurgulu satır geri sayımın gerçek hedefini göstersin
      const shownTime = isNext && lastNext.isTomorrow ? lastNext.time : p.time
      const label = isNext && lastNext.isTomorrow ? `${p.label} (yarın)` : p.label
      const marked = marks.includes(p.key)
      const circle = TRACKED.includes(p.key)
        ? `<button type="button" class="mark${marked ? ' marked' : ''}" data-key="${p.key}"
             aria-pressed="${marked}" aria-label="${p.label} vaktini kıldım olarak işaretle"></button>`
        : '<span class="mark-space"></span>'
      const badge = isFriday && p.key === 'dhuhr' ? '<span class="fri-badge">Cuma</span>' : ''
      return `
      <li class="${isNext ? 'next' : ''}">
        ${circle}
        <span class="p-label">${label}</span>
        ${badge}
        <time>${timeFormat.format(shownTime)}</time>
      </li>`
    })
    .join('')
}

function renderStreak() {
  const now = new Date()
  const done = (prayerData[localDateKey(now)] || []).length
  const days = computeStreak(prayerData, now)
  document.querySelector('#streak').textContent =
    done === TRACKED.length
      ? `Bugün: ${done}/${TRACKED.length} ✓ · Seri: ${days} gün`
      : `Bugün: ${done}/${TRACKED.length} vakit · Seri: ${days} gün`
}

// Günün Esması kartı: yılın günü mod 99 — gün dönünce sıradakine geçer
function renderEsmaCard(now) {
  const e = esmaForDate(now)
  document.querySelector('#ec-latin').textContent = e.latin
  document.querySelector('#ec-arabic').textContent = e.arapca
  const anlamEl = document.querySelector('#ec-anlam')
  anlamEl.hidden = false
  // Kaynak listede bulunmayan tek girdi (67) için açıklayıcı not — anlam uydurulmaz
  anlamEl.textContent = e.anlam || 'Bu ismin anlamı kaynak listede bulunmuyor.'
}

// Vakitler altındaki kompakt "yaklaşan dini gün" kartı (tam liste alt-görünümde)
function renderHolidayCard(now) {
  const next = computeEvents(now)[0]
  const card = document.querySelector('#holiday-card')
  if (!next) {
    card.hidden = true
    return
  }
  card.hidden = false
  const days = daysLeft(next.date, now)
  document.querySelector('#hc-name').textContent = next.name
  document.querySelector('#hc-when').textContent =
    days === 0 ? 'Bugün' : `${next.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} · ${days} gün`
}

// Kerahat satırı: aktif pencere varsa bitiş saatiyle tek satır bilgi
function updateKerahat(now) {
  const el = document.querySelector('#kerahat-line')
  const w = activeKerahat(kerahatW, now)
  if (!w) {
    el.hidden = true
    return
  }
  el.hidden = false
  el.textContent = `Kerahat vakti (${w.etiket}) · ${timeFormat.format(w.end)}'e kadar`
}

function refresh() {
  const now = new Date()
  const { today, next } = findNext(now)
  target = next
  renderedDay = now.toDateString()
  lastToday = today
  lastNext = next
  const byKey = (k) => today.find((p) => p.key === k).time
  kerahatW = kerahatWindows({ sunrise: byKey('sunrise'), dhuhr: byKey('dhuhr'), maghrib: byKey('maghrib') })
  updateKerahat(now)

  document.querySelector('#greeting').textContent = greetingText(now, target)
  greetingMinute = Math.floor(now.getTime() / 60000)
  document.querySelector('#hijri-line').textContent =
    `${longDateFormat.format(now)} · ${formatHijriDate(now)}`
  document.querySelector('#location-label').textContent = `Konum: ${location.label}`
  document.querySelector('#use-location').hidden = !location.isDefault
  settings?.renderLocation() // Ayarlar açıksa konum satırı da tazelensin
  document.querySelector('#next-label').textContent =
    `Sıradaki vakit: ${next.label}${next.isTomorrow ? ' (yarın)' : ''}`

  renderTimes()
  renderStreak()
  renderHolidayCard(now)
  renderEsmaCard(now)
  renderCountdown(now)
  // Konum değişimi ve gece yarısı geçişinde aylık tablo da tazelensin
  monthly?.render()
  // Gece yarısı geçişinde "X gün kaldı" etiketleri tazelensin
  holidays?.render()
  // Gece yarısı geçişinde günün ayeti de değişir
  gununAyeti?.render()
  // Konum değiştiyse açık kıble overlay'inin açısı tazelensin
  qibla?.locationChanged()
}

function tick() {
  const now = new Date()
  // Bildirim kontrolü her saniye: uygulama açıkken vakit (± seçilen erken
  // hatırlatma) geldiğinde tetiklenir. lastToday bugünün 6 vaktini taşır.
  notifications?.check(now, lastToday)
  if (!target || now >= target.time || now.toDateString() !== renderedDay) {
    refresh()
  } else {
    renderCountdown(now)
    // Selam satırı dakikada bir tazelenir (45 dk istisna sınırı için yeterli)
    const minuteKey = Math.floor(now.getTime() / 60000)
    if (minuteKey !== greetingMinute) {
      greetingMinute = minuteKey
      document.querySelector('#greeting').textContent = greetingText(now, target)
      updateKerahat(now) // kerahat satırı da dakikalık tazelenir
    }
  }
}

// Konum adı (reverse geocoding, OpenStreetMap Nominatim). Konum adı süstür,
// koordinat gerçektir: istek başarısızsa koordinat gösterimi sessizce kalır.
// Tek istek/konum değişimi: son bilinen koordinata 0.01°'den yakınsa ağa çıkılmaz.
const GEO_CACHE_KEY = 'tv_geo_name'

async function fetchLocationName(lat, lon) {
  let cached = null
  try {
    cached = JSON.parse(localStorage.getItem(GEO_CACHE_KEY))
  } catch {
    cached = null
  }
  if (cached && Math.abs(cached.lat - lat) < 0.01 && Math.abs(cached.lon - lon) < 0.01) {
    return cached.name
  }
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=tr&zoom=10`,
  )
  if (!res.ok) throw new Error('geocode')
  const data = await res.json()
  const a = data.address || {}
  const il = a.province || a.state || ''
  const ilce = a.county || a.town || a.district || a.city_district || a.city || ''
  const name = il && ilce && il !== ilce ? `${il} / ${ilce}` : il || ilce
  if (!name) throw new Error('geocode-bos')
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ lat, lon, name }))
  } catch {
    // önbelleklenemese de ad bu oturumda kullanılır
  }
  return name
}

function requestLocation() {
  const note = document.querySelector('#location-note')
  if (!navigator.geolocation) {
    note.textContent = 'Tarayıcı konum desteklemiyor'
    settings?.setLocationNote('Tarayıcı konum desteklemiyor')
    return
  }
  note.textContent = ''
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords
      location = {
        lat: latitude,
        lon: longitude,
        label: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
        isDefault: false,
      }
      settings?.setLocationNote('') // başarı: eski hata/işlem notu temizlenir
      refresh() // vakitler konum adını BEKLEMEZ: önce koordinatla hesaplanır
      fetchLocationName(latitude, longitude)
        .then((name) => {
          // bu arada konum yeniden değiştiyse bayat adı yazma
          if (location.lat !== latitude || location.lon !== longitude) return
          location = { ...location, label: name }
          document.querySelector('#location-label').textContent = `Konum: ${name}`
          settings?.renderLocation()
        })
        .catch(() => {
          // sessiz geri dönüş: koordinat gösterimi zaten ekranda
        })
    },
    () => {
      // reddedildi/başarısız: eldeki konumla devam, ama sessiz kalma.
      // Metin gerçeği söylesin: önceki gerçek konum kullanımdaysa "varsayılan" deme
      const msg = location.isDefault
        ? 'Konum alınamadı, varsayılan kullanılıyor'
        : 'Konum alınamadı, mevcut konum kullanılmaya devam ediyor'
      note.textContent = msg
      settings?.setLocationNote(msg)
      refresh()
    },
    { timeout: 10000 },
  )
}

// İşaret daireleri: liste her yenilendiğinde yeniden kurulduğu için delegasyon
document.querySelector('#times').addEventListener('click', (e) => {
  const btn = e.target.closest('.mark')
  if (!btn) return
  prayerData = toggleMark(prayerData, localDateKey(new Date()), btn.dataset.key)
  savePrayerData(prayerData)
  renderTimes()
  renderStreak()
})

// Sekmeler: sayfa yenilenmeden görünüm değişimi.
// 'holidays' sekmesiz alt-görünümdür: Vakitler'deki karttan açılır.
const TABS = ['times', 'quran', 'monthly', 'dhikr', 'qibla']
const VIEWS = [...TABS, 'holidays', 'esma', 'settings']
let currentView = 'times'
function showView(name) {
  currentView = name
  const activeTab = TABS.includes(name) ? name : 'times' // holidays, Vakitler'e bağlı
  for (const v of VIEWS) {
    document.querySelector(`#view-${v}`).hidden = v !== name
  }
  for (const v of TABS) {
    const tab = document.querySelector(`#tab-${v}`)
    tab.classList.toggle('active', v === activeTab)
    if (v === activeTab) tab.setAttribute('aria-current', 'page')
    else tab.removeAttribute('aria-current')
  }
  // scrollIntoView gizli öğede çalışmadığından görünüm açıldıktan sonra
  if (name === 'monthly') monthly?.scrollToToday()
  // Kıble sekmesi: açılınca sensör akışı başlar, ayrılınca durur
  qibla?.setVisible(name === 'qibla')
  // Kur'an sekmesine dönüşte çalan ayet vurgusu tazelenir
  quran?.setVisible(name === 'quran')
  // Ayarlar her açılışta canlı değerlerle tazelenir
  if (name === 'settings') settings?.render()
}
// Kullanıcı eylemiyle görünüm geçişi: render + history kaydı bir arada.
// (showView salt render'dır; popstate geri yüklemesi de onu kullanır.)
function goView(name) {
  showView(name)
  nav?.push()
}
for (const v of TABS) {
  document.querySelector(`#tab-${v}`).addEventListener('click', () => goView(v))
}
document.querySelector('#holiday-card').addEventListener('click', () => goView('holidays'))
document.querySelector('#esma-card').addEventListener('click', () => goView('esma'))

// Yatay swipe ile sekme değişimi: sola = sonraki, sağa = önceki; uçlarda sarma yok.
// Alt-görünümlerde (holidays) swipe sekme döngüsüne karışmaz.
setupSwipe(document.querySelector('#app'), (dir) => {
  const cur = TABS.indexOf(currentView)
  if (cur === -1) return
  const idx = cur + dir
  if (idx < 0 || idx >= TABS.length) return
  goView(TABS[idx])
})

// Mini oynatıcı tekil: Kur'an sekmesi ile Nazar bölümü aynı kurulumu paylaşır
const player = setupPlayer()
setupQada(document.querySelector('#qada-root'))
dhikr = setupDhikr(document.querySelector('#view-dhikr'), player, () => nav?.push())
quran = setupQuran(document.querySelector('#view-quran'), player, () => nav?.push())
// Günün ayeti kartı: "suresinde aç" doğrudan ilgili ayete iner
gununAyeti = setupGununAyeti(document.querySelector('#ayet-root'), (s, a) => {
  showView('quran')
  quran.openAt(s, a) // onNav'ı openSurah çağırır: tek history girdisi
})
monthly = setupMonthly(document.querySelector('#view-monthly'), () => location)
// Alt-görünümlerin ‹ Geri butonları telefonun geri tuşuyla aynı yoldan gider
holidays = setupHolidays(document.querySelector('#view-holidays'), () => history.back())
setupEsma(document.querySelector('#view-esma'), () => history.back())
qibla = setupQibla(document.querySelector('#view-qibla'), () => location)

// --- Telefon geri tuşu: uygulama içi gezinme + kökte çift-geri çıkış ---
const exitToast = document.createElement('div')
exitToast.id = 'exit-toast'
exitToast.textContent = 'Çıkmak için tekrar geri basın'
exitToast.hidden = true
document.body.appendChild(exitToast)
let exitToastTimer = null

// Vakit bildirimi sayfa içi vurgusu: geri sayım kutusunda kısa süreli şerit
const prayerToast = document.createElement('div')
prayerToast.id = 'prayer-toast'
prayerToast.hidden = true
document.body.appendChild(prayerToast)
let prayerToastTimer = null
function highlightPrayer(label) {
  prayerToast.textContent = `${label} vakti`
  prayerToast.hidden = false
  const box = document.querySelector('#countdown-box')
  box.classList.remove('flash')
  void box.offsetWidth
  box.classList.add('flash')
  clearTimeout(prayerToastTimer)
  prayerToastTimer = setTimeout(() => {
    prayerToast.hidden = true
  }, 6000)
}

// Bildirimler: uygulama açıkken tick'te check(); izin verilince sunucu ayağına
// (web push) abone olur — getLocation aboneliğe koordinatı taşır
notifications = setupNotifications({
  onFire: highlightPrayer,
  getLocation: () => ({ lat: location.lat, lon: location.lon }),
})

// Karşılama ve Ayarlar (nav'dan önce: onBackIntercept karşılamayı tanısın)
onboarding = setupOnboarding({
  requestLocation,
  getLocationLabel: () => location.label,
  requestNotifications: () => notifications.requestEnable(),
})
settings = setupSettings(document.querySelector('#view-settings'), {
  getLocationLabel: () => `Konum: ${location.label}`,
  updateLocation: requestLocation,
  showOnboarding: () => onboarding.show(true),
  onBack: () => history.back(),
  notifications,
})
document.querySelector('#settings-btn').addEventListener('click', () => goView('settings'))

nav = setupNav({
  // Durum anlık görüntüsü: sekme + modül içi alt-görünümler birlikte saklanır,
  // geri dönüşte okuyucular da kaldıkları hâle döner
  getState: () => ({ view: currentView, q: quran.getSub(), d: dhikr.getSub() }),
  apply(st) {
    showView(st.view)
    quran.applySub(st.q ?? null)
    dhikr.applySub(st.d ?? null)
  },
  // Katman öncelikleri: karşılama kart geriletir (ilk kartta no-op),
  // sonra açık oynatıcı kapanır; ikisi de gezinmeyi tüketir
  onBackIntercept() {
    if (onboarding.isOpen()) return onboarding.back()
    if (player.isOpen()) {
      player.stop()
      return true
    }
    return false
  },
  showExitHint() {
    exitToast.hidden = false
    clearTimeout(exitToastTimer)
    exitToastTimer = setTimeout(() => {
      exitToast.hidden = true
    }, 2000)
  },
})
nav.init()
onboarding.maybeShowFirstRun()

// Diyanet ile karşılaştırma için: bugünün Aydın (varsayılan) vakitleri
console.table(
  computeTimes(new Date(), DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon).map((p) => ({
    Vakit: p.label,
    Saat: timeFormat.format(p.time),
  })),
)

document.querySelector('#use-location').addEventListener('click', requestLocation)
refresh()
requestLocation()
setInterval(tick, 1000)

// SW kaydı + arka plan güncelleme kontrolü (yalnızca production'da)
setupServiceWorker()
