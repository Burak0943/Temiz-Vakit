// Ayarlar: tam ekran alt-görünüm (Vakitler başlığındaki dişliden açılır,
// history'ye kayıtlı — geri tuşu çalışır). Değişiklikler ANINDA uygulanır.
// Yazı boyutu satırları, okuma ekranlarındaki yerinde A-/A+ kontrolleriyle
// AYNI localStorage anahtarlarına yazar (dhikr.js / quran.js adım dizilerinin
// aynası); okuma ekranları açılırken anahtarı yeniden okur.
import { version } from '../package.json'

const FONT_KEY = 'tv_fontsize'
const FONT_STEPS = [16, 20, 24, 28] // dhikr.js FONT_STEPS aynası
const AR_FONT_KEY = 'tv_arfontsize'
const AR_FONT_STEPS = [22, 26, 30, 34] // quran.js AR_FONT_STEPS aynası

const KAYNAKLAR = [
  'Diyanet İşleri Başkanlığı yayınları — namaz duaları',
  "AlQuran Cloud ve quran.com — Kur'an metni, meali, sesi ve Türkçe sure adları",
  'Hayrat Neşriyat — Cevşen hat sayfaları (izinli kullanım)',
  'OpenStreetMap Nominatim — konum adı',
  'suresioku.com — Esmaül Hüsna adları ve anlamları',
]

function readStep(key, steps) {
  try {
    const v = Number(localStorage.getItem(key))
    return steps.includes(v) ? v : steps[1]
  } catch {
    return steps[1]
  }
}

function writeStep(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // kalıcılaşmasa da bu oturumda uygulanır
  }
}

export function setupSettings(root, { getLocationLabel, updateLocation, showOnboarding, onBack }) {
  root.innerHTML = `
    <button type="button" id="settings-back">‹ Geri</button>
    <h2>Ayarlar</h2>

    <h3 class="set-section">Konum</h3>
    <div class="set-row">
      <span id="set-location"></span>
      <button type="button" id="set-location-update">Konumu Güncelle</button>
    </div>
    <p id="set-location-note" class="set-note" hidden></p>

    <h3 class="set-section">Görünüm</h3>
    <div class="set-row">
      <span>Dua yazı boyutu</span>
      <span class="set-stepper">
        <button type="button" id="set-font-minus" aria-label="Dua yazısını küçült">A−</button>
        <span id="set-font-value"></span>
        <button type="button" id="set-font-plus" aria-label="Dua yazısını büyüt">A+</button>
      </span>
    </div>
    <div class="set-row">
      <span>Kur'an Arapça boyutu</span>
      <span class="set-stepper">
        <button type="button" id="set-ar-minus" aria-label="Arapça yazıyı küçült">A−</button>
        <span id="set-ar-value"></span>
        <button type="button" id="set-ar-plus" aria-label="Arapça yazıyı büyüt">A+</button>
      </span>
    </div>

    <h3 class="set-section">Bildirimler</h3>
    <div class="set-row set-passive"><span>Vakit bildirimleri yakında</span></div>

    <h3 class="set-section">Hakkında ve Kaynaklar</h3>
    <div class="set-about">
      <p id="set-version"></p>
      <ul id="set-sources"></ul>
      <p class="footnote">Vakitler astronomik hesapla üretilir; Diyanet takviminden ±1 dk farkedebilir.</p>
    </div>

    <div class="set-row">
      <button type="button" id="set-onboarding" class="set-link">İlk tanıtımı tekrar göster</button>
    </div>
  `

  root.querySelector('#settings-back').addEventListener('click', () => onBack())
  root.querySelector('#set-location-update').addEventListener('click', () => {
    setLocationNote('Güncelleniyor…') // sonuç main.js geri çağrılarıyla yazılır
    updateLocation()
  })
  root.querySelector('#set-onboarding').addEventListener('click', () => showOnboarding())

  root.querySelector('#set-version').textContent = `Temiz Vakit · sürüm ${version}`
  const srcList = root.querySelector('#set-sources')
  for (const k of KAYNAKLAR) {
    const li = document.createElement('li')
    li.textContent = k
    srcList.appendChild(li)
  }

  function renderFonts() {
    const f = readStep(FONT_KEY, FONT_STEPS)
    const a = readStep(AR_FONT_KEY, AR_FONT_STEPS)
    root.querySelector('#set-font-value').textContent = f
    root.querySelector('#set-ar-value').textContent = a
    root.querySelector('#set-font-minus').classList.toggle('limit', f === FONT_STEPS[0])
    root.querySelector('#set-font-plus').classList.toggle('limit', f === FONT_STEPS[FONT_STEPS.length - 1])
    root.querySelector('#set-ar-minus').classList.toggle('limit', a === AR_FONT_STEPS[0])
    root.querySelector('#set-ar-plus').classList.toggle('limit', a === AR_FONT_STEPS[AR_FONT_STEPS.length - 1])
  }

  function step(key, steps, dir) {
    const cur = readStep(key, steps)
    const idx = steps.indexOf(cur) + dir
    if (idx < 0 || idx >= steps.length) return
    writeStep(key, steps[idx])
    renderFonts()
    // Açık okuma ekranları anında uygulasın (dhikr.js/quran.js dinler)
    window.dispatchEvent(new CustomEvent('tv-font-change'))
  }
  root.querySelector('#set-font-minus').addEventListener('click', () => step(FONT_KEY, FONT_STEPS, -1))
  root.querySelector('#set-font-plus').addEventListener('click', () => step(FONT_KEY, FONT_STEPS, 1))
  root.querySelector('#set-ar-minus').addEventListener('click', () => step(AR_FONT_KEY, AR_FONT_STEPS, -1))
  root.querySelector('#set-ar-plus').addEventListener('click', () => step(AR_FONT_KEY, AR_FONT_STEPS, 1))

  function renderLocation() {
    root.querySelector('#set-location').textContent = getLocationLabel()
  }

  function setLocationNote(text) {
    const el = root.querySelector('#set-location-note')
    el.textContent = text
    el.hidden = !text
  }

  return {
    setLocationNote, // konum güncelleme sonucu Ayarlar İÇİNDE görünsün
    // Görünüm her açıldığında canlı değerlerle tazelenir
    render() {
      renderLocation()
      renderFonts()
    },
    renderLocation, // konum çözümü asenkron bittiğinde de tazelensin
  }
}
