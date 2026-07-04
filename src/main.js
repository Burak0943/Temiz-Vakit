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
let target = null // { label, time, isTomorrow }
let renderedDay = ''
let greetingMinute = -1 // selam satırı dakikada bir, mevcut tick içinde güncellenir
let lastToday = []
let lastNext = null
let prayerData = loadPrayerData()

document.querySelector('#app').innerHTML = `
  <section id="view-times">
    <header>
      <h1>Temiz Vakit</h1>
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
    </section>
    <ul id="times"></ul>
    <p id="streak"></p>
    <button id="holiday-card" type="button" hidden>
      <span id="hc-name"></span>
      <span id="hc-when"></span>
      <span class="hc-more">Tümü ›</span>
    </button>
    <p class="footnote">Vakitler astronomik hesapla üretilir; Diyanet takviminden ±1 dk farkedebilir.</p>
  </section>
  <section id="view-quran" hidden></section>
  <section id="view-monthly" hidden></section>
  <section id="view-holidays" hidden></section>
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

function refresh() {
  const now = new Date()
  const { today, next } = findNext(now)
  target = next
  renderedDay = now.toDateString()
  lastToday = today
  lastNext = next

  document.querySelector('#greeting').textContent = greetingText(now, target)
  greetingMinute = Math.floor(now.getTime() / 60000)
  document.querySelector('#hijri-line').textContent =
    `${longDateFormat.format(now)} · ${formatHijriDate(now)}`
  document.querySelector('#location-label').textContent = `Konum: ${location.label}`
  document.querySelector('#use-location').hidden = !location.isDefault
  document.querySelector('#next-label').textContent =
    `Sıradaki vakit: ${next.label}${next.isTomorrow ? ' (yarın)' : ''}`

  renderTimes()
  renderStreak()
  renderHolidayCard(now)
  renderCountdown(now)
  // Konum değişimi ve gece yarısı geçişinde aylık tablo da tazelensin
  monthly?.render()
  // Gece yarısı geçişinde "X gün kaldı" etiketleri tazelensin
  holidays?.render()
  // Konum değiştiyse açık kıble overlay'inin açısı tazelensin
  qibla?.locationChanged()
}

function tick() {
  const now = new Date()
  if (!target || now >= target.time || now.toDateString() !== renderedDay) {
    refresh()
  } else {
    renderCountdown(now)
    // Selam satırı dakikada bir tazelenir (45 dk istisna sınırı için yeterli)
    const minuteKey = Math.floor(now.getTime() / 60000)
    if (minuteKey !== greetingMinute) {
      greetingMinute = minuteKey
      document.querySelector('#greeting').textContent = greetingText(now, target)
    }
  }
}

function requestLocation() {
  const note = document.querySelector('#location-note')
  if (!navigator.geolocation) {
    note.textContent = 'Tarayıcı konum desteklemiyor'
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
      refresh()
    },
    () => {
      // reddedildi/başarısız: varsayılan Aydın ile devam, ama sessiz kalma
      note.textContent = 'Konum alınamadı, varsayılan kullanılıyor'
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
const VIEWS = [...TABS, 'holidays']
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
}
for (const v of TABS) {
  document.querySelector(`#tab-${v}`).addEventListener('click', () => showView(v))
}
document.querySelector('#holiday-card').addEventListener('click', () => showView('holidays'))

// Yatay swipe ile sekme değişimi: sola = sonraki, sağa = önceki; uçlarda sarma yok.
// Alt-görünümlerde (holidays) swipe sekme döngüsüne karışmaz.
setupSwipe(document.querySelector('#app'), (dir) => {
  const cur = TABS.indexOf(currentView)
  if (cur === -1) return
  const idx = cur + dir
  if (idx < 0 || idx >= TABS.length) return
  showView(TABS[idx])
})

setupDhikr(document.querySelector('#view-dhikr'))
setupQuran(document.querySelector('#view-quran'))
monthly = setupMonthly(document.querySelector('#view-monthly'), () => location)
holidays = setupHolidays(document.querySelector('#view-holidays'), () => showView('times'))
qibla = setupQibla(document.querySelector('#view-qibla'), () => location)

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
