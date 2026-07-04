// Kur'an sekmesi: sure listesi + ayet ayet okuma ekranı.
// Tüm metinler quran-api.js üzerinden API'den gelir (içerik kuralı).
// Ayet kartı (ayah-card.js) ve mini oynatıcı (player.js) Nazar bölümüyle ortaktır.
import {
  getSurahList,
  getSurahDetail,
  getPosition,
  savePosition,
  getStoredSurahNumbers,
} from './quran-api.js'
import { SURAH_NAMES_TR } from './surah-names-tr.js'
import { createAyahCard } from './ayah-card.js'

// Birincil görünen ad Türkçe (kaynak: quran.com v4); dizi dışı kalırsa güvenli geri dönüş
const trName = (number) => SURAH_NAMES_TR[number - 1] || `Sure ${number}`

const AR_FONT_KEY = 'tv_arfontsize'
const AR_FONT_STEPS = [22, 26, 30, 34]

export function setupQuran(root, player) {
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
      <p id="qr-offline-note" class="footnote" hidden>İndirilen sureler çevrimdışı okunabilir.</p>
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
    btn.textContent = `Kaldığın yerden devam — ${s.number}. ${trName(s.number)} · Ayet ${pos.ayah} ›`
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
      // API/önbellek kaynaklı metinler innerHTML yerine textContent ile basılır
      const no = document.createElement('span')
      no.className = 's-no'
      no.textContent = s.number
      const nm = document.createElement('span')
      nm.className = 's-name'
      nm.textContent = trName(s.number)
      const secondary = document.createElement('small')
      secondary.textContent = s.name
      nm.appendChild(secondary)
      const meta = document.createElement('span')
      meta.className = 's-meta'
      meta.textContent = `${s.place} · ${s.ayahs} ayet`
      const stored = document.createElement('span')
      stored.className = 's-stored'
      stored.dataset.surah = s.number
      stored.textContent = 'cihazda'
      stored.hidden = true
      btn.append(no, nm, stored, meta)
      btn.addEventListener('click', () => openSurah(s.number))
      li.appendChild(btn)
      frag.appendChild(li)
    }
    root.querySelector('#surah-list').replaceChildren(frag)
    renderResume()
    markStoredBadges()
  }
  retryBtn.addEventListener('click', loadList)

  // Cihazda kayıtlı sureler için küçük gri rozet; okuyucudan dönüşte tazelenir
  async function markStoredBadges() {
    const numbers = new Set(await getStoredSurahNumbers())
    for (const el of root.querySelectorAll('.s-stored')) {
      el.hidden = !numbers.has(Number(el.dataset.surah))
    }
  }

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
    root.querySelector('#qr-title').textContent = `${number}. ${trName(number)}`
    ayahsEl.replaceChildren()
    qrStatus.hidden = false
    qrStatus.textContent = 'Yükleniyor…'
    applyArFont()
    let detail
    try {
      detail = await getSurahDetail(number)
    } catch (err) {
      qrStatus.textContent = err.message
      root.querySelector('#qr-offline-note').hidden = false
      return
    }
    if (openSurahNo !== number) return // bu arada başka sure açıldı
    openDetail = detail
    qrStatus.hidden = true
    root.querySelector('#qr-offline-note').hidden = true
    jumpInput.max = String(detail.ayahs.length)
    jumpInput.value = ''
    const frag = document.createDocumentFragment()
    detail.ayahs.forEach((a, index) => {
      const card = createAyahCard(a, detail.number, () => playFrom(detail, index))
      card.id = `ayah-${a.no}` // atlama/vurgu için; kart bileşeni id'siz üretir
      frag.appendChild(card)
    })
    ayahsEl.replaceChildren(frag)
    savePosition(number, targetAyah || 1)
    if (targetAyah) scrollToAyah(targetAyah)
    else window.scrollTo(0, 0)
    markPlayingCard() // çalan sure yeniden açıldıysa vurgusu geri gelsin
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
    markStoredBadges() // yeni açılan sure cihaza inmiş olabilir
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

  // --- Sesli okuma: ortak mini oynatıcı (player.js) üzerinden ---
  function markPlayingCard(scroll = false) {
    for (const el of ayahsEl.querySelectorAll('.ayah-card.playing')) el.classList.remove('playing')
    const st = player.getState()
    if (!st || root.hidden || reader.hidden) return
    // Kimlik karşılaştırması: memoize edilen detay nesnesi oturum boyunca aynı
    if (!openDetail || st.ayahs !== openDetail.ayahs) return
    const card = root.querySelector(`#ayah-${st.ayahs[st.index].no}`)
    if (!card) return
    card.classList.add('playing')
    if (scroll) card.scrollIntoView({ block: 'center' })
  }

  // Karttaki oynat butonu: bu sureyi çalma listesi olarak başlat
  function playFrom(detail, index) {
    player.play({
      title: `${detail.number}. ${trName(detail.number)}`,
      ayahs: detail.ayahs,
      index,
      onIndex: (i, auto) => {
        savePosition(detail.number, detail.ayahs[i].no)
        markPlayingCard(auto)
      },
      onStop: () => markPlayingCard(),
    })
  }

  loadList()

  return {
    // Sekmeye dönüşte çalan ayetin vurgusu geri gelsin
    setVisible(visible) {
      if (visible) markPlayingCard()
    },
  }
}
