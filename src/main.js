import './style.css'
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan'

const DEFAULT_LOCATION = { lat: 37.845, lon: 27.839, label: 'Aydın (varsayılan)', isDefault: true }

const PRAYERS = [
  { key: 'fajr', label: 'İmsak' },
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
let target = null // { label, time, isTomorrow }
let renderedDay = ''

document.querySelector('#app').innerHTML = `
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

function refresh() {
  const now = new Date()
  const { today, next } = findNext(now)
  target = next
  renderedDay = now.toDateString()

  document.querySelector('#location-label').textContent = `Konum: ${location.label}`
  document.querySelector('#use-location').hidden = !location.isDefault
  document.querySelector('#next-label').textContent =
    `Sıradaki vakit: ${next.label}${next.isTomorrow ? ' (yarın)' : ''}`

  document.querySelector('#times').innerHTML = today
    .map((p) => {
      const isNext = p.key === next.key
      // Hedef yarına taştıysa vurgulu satır geri sayımın gerçek hedefini göstersin
      const shownTime = isNext && next.isTomorrow ? next.time : p.time
      const label = isNext && next.isTomorrow ? `${p.label} (yarın)` : p.label
      return `
      <li class="${isNext ? 'next' : ''}">
        <span>${label}</span>
        <time>${timeFormat.format(shownTime)}</time>
      </li>`
    })
    .join('')

  renderCountdown(now)
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
