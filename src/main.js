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
import { setupHolidays } from './holidays.js'

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

let location = DEFAULT_LOCATION
let monthly = null // setupMonthly dönüşü; refresh monthly'den önce koşabilir
let holidays = null // setupHolidays dönüşü
let target = null // { label, time, isTomorrow }
let renderedDay = ''
let lastToday = []
let lastNext = null
let prayerData = loadPrayerData()

document.querySelector('#app').innerHTML = `
  <section id="view-times">
    <header>
      <h1>Temiz Vakit</h1>
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
    <p class="footnote">Vakitler astronomik hesapla üretilir; Diyanet takviminden ±1 dk farkedebilir.</p>
  </section>
  <section id="view-monthly" hidden></section>
  <section id="view-holidays" hidden></section>
  <section id="view-dhikr" hidden></section>
  <nav id="tabs">
    <button id="tab-times" type="button" class="active" aria-current="page">Vakitler</button>
    <button id="tab-monthly" type="button">Aylık</button>
    <button id="tab-holidays" type="button">Günler</button>
    <button id="tab-dhikr" type="button">Zikir</button>
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
  const marks = prayerData[localDateKey(new Date())] || []
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
      return `
      <li class="${isNext ? 'next' : ''}">
        ${circle}
        <span class="p-label">${label}</span>
        <time>${timeFormat.format(shownTime)}</time>
      </li>`
    })
    .join('')
}

function renderStreak() {
  const days = computeStreak(prayerData, new Date())
  document.querySelector('#streak').textContent = `Seri: ${days} gün`
}

function refresh() {
  const now = new Date()
  const { today, next } = findNext(now)
  target = next
  renderedDay = now.toDateString()
  lastToday = today
  lastNext = next

  document.querySelector('#location-label').textContent = `Konum: ${location.label}`
  document.querySelector('#use-location').hidden = !location.isDefault
  document.querySelector('#next-label').textContent =
    `Sıradaki vakit: ${next.label}${next.isTomorrow ? ' (yarın)' : ''}`

  renderTimes()
  renderStreak()
  renderCountdown(now)
  // Konum değişimi ve gece yarısı geçişinde aylık tablo da tazelensin
  monthly?.render()
  // Gece yarısı geçişinde "X gün kaldı" etiketleri tazelensin
  holidays?.render()
}

function tick() {
  const now = new Date()
  if (!target || now >= target.time || now.toDateString() !== renderedDay) {
    refresh()
  } else {
    renderCountdown(now)
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

// Sekmeler: sayfa yenilenmeden görünüm değişimi
const VIEWS = ['times', 'monthly', 'holidays', 'dhikr']
function showView(name) {
  for (const v of VIEWS) {
    document.querySelector(`#view-${v}`).hidden = v !== name
    const tab = document.querySelector(`#tab-${v}`)
    tab.classList.toggle('active', v === name)
    if (v === name) tab.setAttribute('aria-current', 'page')
    else tab.removeAttribute('aria-current')
  }
  // scrollIntoView gizli öğede çalışmadığından görünüm açıldıktan sonra
  if (name === 'monthly') monthly?.scrollToToday()
}
for (const v of VIEWS) {
  document.querySelector(`#tab-${v}`).addEventListener('click', () => showView(v))
}

setupDhikr(document.querySelector('#view-dhikr'))
monthly = setupMonthly(document.querySelector('#view-monthly'), () => location)
holidays = setupHolidays(document.querySelector('#view-holidays'))

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

// Cache-first SW dev'de HMR modüllerini bayatlatacağından kayıt yalnızca production'da
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
