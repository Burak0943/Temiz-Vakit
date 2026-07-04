// Kıble pusulası: adhan Qibla açısı (kuzeyden derece) + cihaz yön sensörü.
// Tasarım: kadran sabit, tek ok döner; ok açısı = kıble - cihaz yönü.
import { Coordinates, Qibla } from 'adhan'

export function setupQibla(openButton, getLocation) {
  const overlay = document.createElement('div')
  overlay.id = 'qibla-overlay'
  overlay.hidden = true
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-labelledby', 'qibla-title')
  overlay.innerHTML = `
    <button id="qibla-close" type="button" aria-label="Kapat">×</button>
    <h2 id="qibla-title">Kıble Pusulası</h2>
    <p id="qibla-angle"></p>
    <div id="qibla-compass" aria-hidden="true">
      <span class="q-mark q-n">K</span><span class="q-mark q-e">D</span>
      <span class="q-mark q-s">G</span><span class="q-mark q-w">B</span>
      <div id="qibla-arrow"></div>
    </div>
    <button id="qibla-start" type="button" hidden>Pusulayı başlat</button>
    <p id="qibla-status"></p>
    <p class="footnote">Pusula cihaz sensörüne bağlıdır; metal/manyetik ortamda sapabilir.</p>
  `
  document.body.appendChild(overlay)

  const arrow = overlay.querySelector('#qibla-arrow')
  const statusEl = overlay.querySelector('#qibla-status')
  const startBtn = overlay.querySelector('#qibla-start')

  let qiblaAngle = 0
  let lastLocKey = ''
  let activeEventName = null
  let fallbackTimer = null
  let aligned = false
  let calibrationNoted = false

  // Konum değişince açıyı ve metni tazele (overlay açıkken de çağrılabilir)
  function syncAngle() {
    const loc = getLocation()
    const key = `${loc.lat},${loc.lon}`
    if (key === lastLocKey) return
    lastLocKey = key
    qiblaAngle = Qibla(new Coordinates(loc.lat, loc.lon))
    overlay.querySelector('#qibla-angle').textContent =
      `Kıble açısı: kuzeyden ${Math.round(qiblaAngle)}°`
  }

  const STATIC_NOTE =
    'Ok, kuzey yukarı kabulüyle kıble açısını gösterir; telefonunuzun pusulası kullanılamıyor.'

  function angularDiff(a, b) {
    return Math.abs((((a - b) % 360) + 540) % 360 - 180)
  }

  function updateHeading(deviceHeading) {
    // Sensör yönü cihazın FİZİKSEL üst kenarına göredir; yatay (landscape)
    // tutulan cihazda ekran çerçevesine çevirmek için ekran açısı eklenir
    const screenAngle = screen.orientation?.angle ?? window.orientation ?? 0
    const heading = (deviceHeading + screenAngle + 360) % 360
    const rotation = (qiblaAngle - heading + 360) % 360
    arrow.style.transform = `rotate(${rotation}deg)`
    // Histerezis: girişte ±5°, çıkışta ±8° — sınırdaki sensör gürültüsü
    // tekrarlı titreşim/yanıp sönme üretmesin
    const diff = angularDiff(heading, qiblaAngle)
    const isAligned = aligned ? diff <= 8 : diff <= 5
    if (isAligned && !aligned && navigator.vibrate) navigator.vibrate(30)
    aligned = isAligned
    arrow.classList.toggle('aligned', isAligned)
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
    arrow.style.transform = `rotate(${qiblaAngle}deg)`
    arrow.classList.remove('aligned')
    statusEl.textContent = message
  }

  function startSensor() {
    // Android Chrome pusula yönünü deviceorientationabsolute ile verir
    activeEventName =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(activeEventName, onOrientation)
    // Masaüstü gibi olay hiç üretmeyen ortamlarda statik moda düş
    fallbackTimer = setTimeout(() => staticMode(STATIC_NOTE), 2000)
  }

  function open() {
    lastLocKey = ''
    syncAngle()
    overlay.hidden = false
    aligned = false
    calibrationNoted = false
    statusEl.textContent = ''
    arrow.style.transform = `rotate(${qiblaAngle}deg)`
    overlay.querySelector('#qibla-close').focus()

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

  function close() {
    overlay.hidden = true
    stopSensor()
    openButton.focus()
  }

  openButton.addEventListener('click', open)
  overlay.querySelector('#qibla-close').addEventListener('click', close)
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })

  return {
    // Konum overlay açıkken çözülürse açı ve (statik modda) ok tazelensin
    locationChanged() {
      if (overlay.hidden) return
      syncAngle()
      if (!activeEventName) arrow.style.transform = `rotate(${qiblaAngle}deg)`
    },
  }
}
