// Kıble sekmesi: adhan Qibla açısı (kuzeyden derece) + cihaz yön sensörü.
// Tasarım: kadran sabit, tek ok döner; ok açısı = kıble - cihaz yönü.
// İşlevsel katman: iOS izin akışı, statik mod, histerezis, landscape telafisi.
import { Coordinates, Qibla } from 'adhan'

const CHECK_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 12l5 5 11-11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'

// Kadran: ince çember + 30°'de bir tik + yön harfleri
function dialSvg() {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180
    const x1 = 100 + 88 * Math.sin(a)
    const y1 = 100 - 88 * Math.cos(a)
    const x2 = 100 + 96 * Math.sin(a)
    const y2 = 100 - 96 * Math.cos(a)
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`
  }).join('')
  return `
    <svg id="qibla-dial" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="96" fill="none" stroke="#2a3441" stroke-width="2"/>
      <g stroke="#2a3441" stroke-width="2">${ticks}</g>
      <g font-size="13" text-anchor="middle" dominant-baseline="middle" fill="#8a949f">
        <text x="100" y="22" fill="#cfd6dd" font-weight="600">K</text>
        <text x="179" y="101">D</text>
        <text x="100" y="180">G</text>
        <text x="21" y="101">B</text>
      </g>
    </svg>`
}

export function setupQibla(root, getLocation) {
  root.innerHTML = `
    <h2>Kıble</h2>
    <div id="qibla-compass" aria-hidden="true">
      ${dialSvg()}
      <div id="qibla-arrow">
        <svg viewBox="0 0 200 200">
          <line x1="100" y1="100" x2="100" y2="40" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
          <path d="M100 18 L87 44 L113 44 Z" fill="currentColor"/>
        </svg>
      </div>
      <div id="qibla-kaaba">
        <svg viewBox="0 0 16 16" width="16" height="16">
          <rect x="2.5" y="3" width="11" height="10.5" rx="1" fill="#1a222c" stroke="#2a3441"/>
          <rect x="2.5" y="6" width="11" height="1.8" fill="#d4a017"/>
        </svg>
      </div>
    </div>
    <p id="qibla-direction"></p>
    <p id="qibla-angle"></p>
    <button id="qibla-start" type="button" hidden>Pusulayı başlat</button>
    <p id="qibla-status"></p>
    <p class="footnote">Pusula cihaz sensörüne bağlıdır; metal/manyetik ortamda sapabilir.</p>
  `

  const arrow = root.querySelector('#qibla-arrow')
  const directionEl = root.querySelector('#qibla-direction')
  const statusEl = root.querySelector('#qibla-status')
  const startBtn = root.querySelector('#qibla-start')

  let qiblaAngle = 0
  let lastLocKey = ''
  let activeEventName = null
  let fallbackTimer = null
  let aligned = false
  let calibrationNoted = false
  let currentRotation = 0 // kümülatif derece: 359↔0 sarmalında kısa yol için

  const STATIC_NOTE =
    'Ok, kuzey yukarı kabulüyle kıble açısını gösterir; cihazınızın pusulası kullanılamıyor.'

  // Konum değişince açıyı ve metni tazele
  function syncAngle() {
    const loc = getLocation()
    const key = `${loc.lat},${loc.lon}`
    if (key === lastLocKey) return
    lastLocKey = key
    qiblaAngle = Qibla(new Coordinates(loc.lat, loc.lon))
    root.querySelector('#qibla-angle').textContent =
      `Kıble açısı: kuzeyden ${Math.round(qiblaAngle)}°`
  }

  function angularDiff(a, b) {
    return Math.abs((((a - b) % 360) + 540) % 360 - 180)
  }

  // Hedefe her zaman en kısa yoldan dön (uzun tur atma)
  function pointArrow(targetDeg) {
    const curMod = ((currentRotation % 360) + 360) % 360
    const delta = ((targetDeg - curMod + 540) % 360) - 180
    currentRotation += delta
    arrow.style.transform = `rotate(${currentRotation}deg)`
  }

  function updateHeading(deviceHeading) {
    // Sensör yönü cihazın FİZİKSEL üst kenarına göredir; yatay (landscape)
    // tutulan cihazda ekran çerçevesine çevirmek için ekran açısı eklenir
    const screenAngle = screen.orientation?.angle ?? window.orientation ?? 0
    const heading = (deviceHeading + screenAngle + 360) % 360
    const rotation = (qiblaAngle - heading + 360) % 360
    pointArrow(rotation)
    // Histerezis: girişte ±5°, çıkışta ±8° — sınırdaki sensör gürültüsü
    // tekrarlı titreşim/yanıp sönme üretmesin
    const diff = angularDiff(heading, qiblaAngle)
    const isAligned = aligned ? diff <= 8 : diff <= 5
    if (isAligned && !aligned && navigator.vibrate) navigator.vibrate(30)
    aligned = isAligned
    arrow.classList.toggle('aligned', isAligned)
    directionEl.classList.toggle('aligned', isAligned)
    if (isAligned) {
      directionEl.innerHTML = `${CHECK_SVG} Kıble yönündesiniz`
    } else if (rotation <= 180) {
      directionEl.textContent = `Kıbleye ${Math.round(rotation)}° sağa`
    } else {
      directionEl.textContent = `Kıbleye ${Math.round(360 - rotation)}° sola`
    }
  }

  function onOrientation(e) {
    let heading = null
    if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
      heading = e.webkitCompassHeading // iOS: kuzeyden saat yönü
    } else if (e.alpha != null) {
      heading = (360 - e.alpha) % 360 // Android: alpha saat yönünün tersidir
      if (!e.absolute && !calibrationNoted) {
        // absolute olmayan alpha keyfî bir referansa göredir
        calibrationNoted = true
        statusEl.textContent = 'Pusula kalibrasyonu gerekebilir (cihazı 8 çizer gibi hareket ettirin).'
      }
    }
    // Masaüstü Chrome tüm değerleri null tek bir olay ateşleyebilir; statik
    // moda düşüş zamanlayıcısı ancak kullanılabilir yön gelince iptal edilir
    if (heading == null) return
    if (fallbackTimer) {
      clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
    updateHeading(heading)
  }

  function stopSensor() {
    if (activeEventName) window.removeEventListener(activeEventName, onOrientation)
    activeEventName = null
    if (fallbackTimer) clearTimeout(fallbackTimer)
    fallbackTimer = null
  }

  function staticMode(message) {
    stopSensor()
    startBtn.hidden = true
    // Kuzey yukarı varsayımıyla ok sabit kıble açısını gösterir
    pointArrow(qiblaAngle)
    arrow.classList.remove('aligned')
    directionEl.classList.remove('aligned')
    directionEl.textContent = ''
    statusEl.textContent = message
  }

  function startSensor() {
    // Tekrar çağrıda önceki dinleyici/zamanlayıcı öksüz kalmasın
    stopSensor()
    // Android Chrome pusula yönünü deviceorientationabsolute ile verir
    activeEventName =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(activeEventName, onOrientation)
    // Masaüstü gibi olay hiç üretmeyen ortamlarda statik moda düş
    fallbackTimer = setTimeout(() => staticMode(STATIC_NOTE), 2000)
  }

  function activate() {
    stopSensor() // aynı sekmeye tekrar dokunuşta öksüz zamanlayıcı kalmasın
    lastLocKey = ''
    syncAngle()
    aligned = false
    calibrationNoted = false
    statusEl.textContent = ''
    directionEl.textContent = ''
    // Önceki oturumdan bayat altın/parlama durumu kalmasın
    arrow.classList.remove('aligned')
    directionEl.classList.remove('aligned')
    pointArrow(qiblaAngle)

    if (typeof DeviceOrientationEvent === 'undefined') {
      staticMode(STATIC_NOTE)
      return
    }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS: izin yalnızca kullanıcı hareketiyle istenebilir
      startBtn.hidden = false
      startBtn.onclick = async () => {
        try {
          const result = await DeviceOrientationEvent.requestPermission()
          if (result === 'granted') {
            startBtn.hidden = true
            startSensor()
          } else {
            staticMode(`Sensör izni verilmedi. ${STATIC_NOTE}`)
          }
        } catch {
          staticMode(`Sensör izni alınamadı. ${STATIC_NOTE}`)
        }
      }
    } else {
      startSensor()
    }
  }

  return {
    // Sekme görünürlüğü: açılınca sensör akışı başlar, ayrılınca durur
    setVisible(visible) {
      if (visible) activate()
      else stopSensor()
    },
    // Konum sekme açıkken çözülürse açı ve (statik modda) ok tazelensin
    locationChanged() {
      if (root.hidden) return
      syncAngle()
      if (!activeEventName) pointArrow(qiblaAngle)
    },
  }
}
