// Kur'an sekmesi: sure listesi + ayet ayet okuma ekranı.
// Tüm metinler quran-api.js üzerinden API'den gelir (içerik kuralı).
import { getSurahList, getSurahDetail, getPosition, savePosition } from './quran-api.js'

const AR_FONT_KEY = 'tv_arfontsize'
const AR_FONT_STEPS = [22, 26, 30, 34]

export function setupQuran(root) {
  root.innerHTML = `
    <div id="quran-main">
      <h2>Kur'an-ı Kerim</h2>
      <button type="button" id="quran-resume" hidden></button>
      <p id="quran-status" hidden></p>
      <button type="button" id="quran-retry" hidden>Tekrar dene</button>
      <ul id="surah-list"></ul>
    </div>
    <div id="quran-reader" hidden>
      <div id="qr-top">
        <button type="button" id="qr-back">‹ Geri</button>
        <div id="qr-tools">
          <input id="qr-jump" type="number" min="1" inputmode="numeric" placeholder="Ayet" aria-label="Ayet numarası" />
          <button type="button" id="qr-go">Git</button>
          <button type="button" id="qr-font-minus" aria-label="Arapça yazıyı küçült">A−</button>
          <button type="button" id="qr-font-plus" aria-label="Arapça yazıyı büyüt">A+</button>
        </div>
      </div>
      <h2 id="qr-title"></h2>
      <p id="qr-status" hidden></p>
      <div id="qr-ayahs"></div>
      <p class="footnote">Kaynak: AlQuran Cloud · Meal: Diyanet İşleri · Okunuş: Çeviriyazı</p>
    </div>
  `

  const main = root.querySelector('#quran-main')
  const reader = root.querySelector('#quran-reader')
  const ayahsEl = root.querySelector('#qr-ayahs')
  const statusEl = root.querySelector('#quran-status')
  const retryBtn = root.querySelector('#quran-retry')
  const qrStatus = root.querySelector('#qr-status')
  const jumpInput = root.querySelector('#qr-jump')
  const fontMinus = root.querySelector('#qr-font-minus')
  const fontPlus = root.querySelector('#qr-font-plus')

  let surahList = null
  let openSurahNo = null
  let openDetail = null

  // --- Arapça yazı boyutu: dualardakiyle aynı desen, ayrı anahtar ---
  function loadArFont() {
    try {
      const v = Number(localStorage.getItem(AR_FONT_KEY))
      return AR_FONT_STEPS.includes(v) ? v : AR_FONT_STEPS[1]
    } catch {
      return AR_FONT_STEPS[1]
    }
  }
  let arFont = loadArFont()

  function applyArFont() {
    ayahsEl.style.setProperty('--ar-size', `${arFont}px`)
    const atMin = arFont === AR_FONT_STEPS[0]
    const atMax = arFont === AR_FONT_STEPS[AR_FONT_STEPS.length - 1]
    fontMinus.setAttribute('aria-disabled', atMin)
    fontMinus.classList.toggle('limit', atMin)
    fontPlus.setAttribute('aria-disabled', atMax)
    fontPlus.classList.toggle('limit', atMax)
  }

  function stepArFont(dir) {
    const idx = AR_FONT_STEPS.indexOf(arFont) + dir
    if (idx < 0 || idx >= AR_FONT_STEPS.length) return
    arFont = AR_FONT_STEPS[idx]
    try {
      localStorage.setItem(AR_FONT_KEY, String(arFont))
    } catch {
      // kalıcılaşmasa da bu oturumda uygulanır
    }
    applyArFont()
  }
  fontMinus.addEventListener('click', () => stepArFont(-1))
  fontPlus.addEventListener('click', () => stepArFont(1))

  // --- Kaldığın yer kartı ---
  function renderResume() {
    const btn = root.querySelector('#quran-resume')
    const pos = getPosition()
    if (!pos || !surahList) {
      btn.hidden = true
      return
    }
    const s = surahList.find((x) => x.number === pos.surah)
    if (!s) {
      btn.hidden = true
      return
    }
    btn.hidden = false
    btn.textContent = `Kaldığın yerden devam — ${s.number}. ${s.name} · Ayet ${pos.ayah} ›`
    btn.onclick = () => openSurah(pos.surah, pos.ayah)
  }

  // --- Sure listesi ---
  async function loadList() {
    statusEl.hidden = false
    statusEl.textContent = 'Sure listesi yükleniyor…'
    retryBtn.hidden = true
    try {
      surahList = await getSurahList()
    } catch (err) {
      statusEl.textContent = err.message
      retryBtn.hidden = false
      return
    }
    statusEl.hidden = true
    const frag = document.createDocumentFragment()
    for (const s of surahList) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.innerHTML = `<span class="s-no">${s.number}</span><span class="s-name">${s.name}</span><span class="s-meta">${s.place} · ${s.ayahs} ayet</span>`
      btn.addEventListener('click', () => openSurah(s.number))
      li.appendChild(btn)
      frag.appendChild(li)
    }
    root.querySelector('#surah-list').replaceChildren(frag)
    renderResume()
  }
  retryBtn.addEventListener('click', loadList)

  // --- Okuma ekranı ---
  function scrollToAyah(no, smooth = false) {
    root.querySelector(`#ayah-${no}`)?.scrollIntoView({
      block: 'start',
      behavior: smooth ? 'smooth' : 'auto',
    })
  }

  async function openSurah(number, targetAyah = null) {
    openSurahNo = number
    main.hidden = true
    reader.hidden = false
    const s = surahList?.find((x) => x.number === number)
    root.querySelector('#qr-title').textContent = s ? `${s.number}. ${s.name}` : `Sure ${number}`
    ayahsEl.replaceChildren()
    qrStatus.hidden = false
    qrStatus.textContent = 'Yükleniyor…'
    applyArFont()
    let detail
    try {
      detail = await getSurahDetail(number)
    } catch (err) {
      qrStatus.textContent = err.message
      return
    }
    if (openSurahNo !== number) return // bu arada başka sure açıldı
    openDetail = detail
    qrStatus.hidden = true
    jumpInput.max = String(detail.ayahs.length)
    jumpInput.value = ''
    const frag = document.createDocumentFragment()
    for (const a of detail.ayahs) {
      const card = document.createElement('article')
      card.className = 'ayah-card'
      card.id = `ayah-${a.no}`
      const ar = document.createElement('p')
      ar.className = 'ayah-ar'
      ar.dir = 'rtl'
      ar.lang = 'ar'
      ar.textContent = a.arapca
      card.appendChild(ar)
      if (a.okunus) {
        const tl = document.createElement('p')
        tl.className = 'ayah-tl'
        tl.textContent = a.okunus
        card.appendChild(tl)
      }
      if (a.meal) {
        const meal = document.createElement('p')
        meal.className = 'ayah-meal'
        meal.textContent = a.meal
        card.appendChild(meal)
      }
      const meta = document.createElement('div')
      meta.className = 'ayah-meta'
      meta.textContent = `${detail.number}:${a.no}`
      card.appendChild(meta)
      frag.appendChild(card)
    }
    ayahsEl.replaceChildren(frag)
    savePosition(number, targetAyah || 1)
    if (targetAyah) scrollToAyah(targetAyah)
    else window.scrollTo(0, 0)
  }

  // Geri: en üstte görünen ayeti "kaldığın yer" olarak sakla
  function topVisibleAyah() {
    for (const card of ayahsEl.children) {
      if (card.getBoundingClientRect().bottom > 90) return Number(card.id.split('-')[1])
    }
    return 1
  }

  root.querySelector('#qr-back').addEventListener('click', () => {
    if (openSurahNo && openDetail) savePosition(openSurahNo, topVisibleAyah())
    openSurahNo = null
    openDetail = null
    reader.hidden = true
    main.hidden = false
    renderResume()
    window.scrollTo(0, 0)
  })

  // Ayete atlama
  function jump() {
    if (!openDetail) return
    const n = Math.trunc(Math.min(Math.max(1, Number(jumpInput.value) || 1), openDetail.ayahs.length))
    savePosition(openSurahNo, n)
    scrollToAyah(n) // anlık: uzun surelerde smooth yarım kalabiliyor
  }
  root.querySelector('#qr-go').addEventListener('click', jump)
  jumpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') jump()
  })

  loadList()
}
