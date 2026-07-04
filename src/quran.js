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

  // --- Mini oynatıcı: body'ye eklenir ki sekme değişse de görünür kalsın ---
  const player = document.createElement('div')
  player.id = 'quran-player'
  player.hidden = true
  player.innerHTML = `
    <div id="qp-info">
      <span id="qp-surah"></span>
      <span id="qp-ayah"></span>
    </div>
    <div id="qp-controls">
      <button type="button" id="qp-prev" aria-label="Önceki ayet">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5v14L8 12zM7 5v14"/></svg>
      </button>
      <button type="button" id="qp-toggle" aria-label="Oynat / duraklat">
        <svg id="qp-play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>
        <svg id="qp-pause-icon" viewBox="0 0 24 24" aria-hidden="true" style="display:none"><path d="M7 5v14M17 5v14"/></svg>
      </button>
      <button type="button" id="qp-next" aria-label="Sonraki ayet">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l9-7zM17 5v14"/></svg>
      </button>
      <button type="button" id="qp-close" aria-label="Kapat">×</button>
    </div>
  `
  document.body.appendChild(player)

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
    detail.ayahs.forEach((a, index) => {
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
      const label = document.createElement('span')
      label.textContent = `${detail.number}:${a.no}`
      meta.appendChild(label)
      if (a.ses) {
        const playBtn = document.createElement('button')
        playBtn.type = 'button'
        playBtn.className = 'ayah-play'
        playBtn.setAttribute('aria-label', `Ayet ${a.no} sesini oynat`)
        playBtn.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>'
        playBtn.addEventListener('click', () => {
          errorStreak = 0 // kullanıcı eylemi: hata serisi baştan
          playIndex(detail, index)
        })
        meta.appendChild(playBtn)
      }
      card.appendChild(meta)
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

  // --- Sesli okuma: HTML5 Audio, ayet ayet stream, otomatik ilerleme ---
  const audio = new Audio()
  audio.preload = 'auto'
  player.audioEl = audio // test/teşhis kancası (DOM dışı ses öğesine erişim)
  let playState = null // { detail, index } — çalan sure/ayet
  let isPlaying = false

  function markPlayingCard(scroll = false) {
    for (const el of ayahsEl.querySelectorAll('.ayah-card.playing')) el.classList.remove('playing')
    if (!playState || root.hidden || reader.hidden) return
    if (openSurahNo !== playState.detail.number) return
    const card = root.querySelector(`#ayah-${playState.detail.ayahs[playState.index].no}`)
    if (!card) return
    card.classList.add('playing')
    if (scroll) card.scrollIntoView({ block: 'center' })
  }

  function updatePlayerUi() {
    if (!playState) return
    const a = playState.detail.ayahs[playState.index]
    player.querySelector('#qp-surah').textContent =
      `${playState.detail.number}. ${playState.detail.name}`
    player.querySelector('#qp-ayah').textContent = `Ayet ${a.no}`
    player.querySelector('#qp-play-icon').style.display = isPlaying ? 'none' : ''
    player.querySelector('#qp-pause-icon').style.display = isPlaying ? '' : 'none'
  }

  function showPlayer() {
    const tabs = document.querySelector('#tabs')
    if (tabs) player.style.bottom = `${Math.ceil(tabs.getBoundingClientRect().height)}px`
    player.hidden = false
  }

  function playIndex(detail, index, scrollToCard = false) {
    playState = { detail, index }
    const a = detail.ayahs[index]
    savePosition(detail.number, a.no)
    isPlaying = true
    if (a.ses) {
      audio.src = a.ses
      audio.play().catch(() => {
        // otomatik oynatma engeli vb: duraklamış görün, akışı bozma
        isPlaying = false
        updatePlayerUi()
      })
    }
    showPlayer()
    updatePlayerUi()
    markPlayingCard(scrollToCard)
  }

  function stopPlayback() {
    audio.pause()
    audio.removeAttribute('src')
    playState = null
    isPlaying = false
    player.hidden = true
    markPlayingCard()
  }

  function advance(dir, auto = false) {
    if (!playState) return
    const next = playState.index + dir
    if (next < 0) return
    if (next >= playState.detail.ayahs.length) {
      // sure bitti: oynatıcı kalır, durum duraklatılmış gösterilir
      audio.pause()
      isPlaying = false
      updatePlayerUi()
      return
    }
    playIndex(playState.detail, next, auto)
  }

  // Ardışık hata sınırı: çevrimdışı gibi tüm ayetlerin ses yüklemesi başarısız
  // olduğunda zincir sure sonuna kadar koşup kayıtlı konumu sürüklemesin
  let errorStreak = 0
  audio.addEventListener('ended', () => advance(1, true))
  audio.addEventListener('error', () => {
    if (!playState) return
    errorStreak++
    if (errorStreak >= 3) {
      isPlaying = false
      updatePlayerUi()
      return
    }
    // tek ayetin sesi yüklenemezse (ör. 404) akış durmaz, sonrakine geçilir
    advance(1, true)
  })
  audio.addEventListener('playing', () => {
    errorStreak = 0 // gerçek oynatma başladı; hata serisi sıfırlanır
  })
  audio.addEventListener('play', () => {
    isPlaying = true
    updatePlayerUi()
  })
  audio.addEventListener('pause', () => {
    isPlaying = false
    updatePlayerUi()
  })

  player.querySelector('#qp-toggle').addEventListener('click', () => {
    if (!playState) return
    errorStreak = 0 // kullanıcı eylemi: hata serisi baştan
    if (isPlaying) audio.pause()
    else audio.play().catch(() => {})
  })
  player.querySelector('#qp-prev').addEventListener('click', () => {
    errorStreak = 0
    advance(-1)
  })
  player.querySelector('#qp-next').addEventListener('click', () => {
    errorStreak = 0
    advance(1)
  })
  player.querySelector('#qp-close').addEventListener('click', stopPlayback)

  // Rotasyon/pencere değişiminde oynatıcı sekme barının üstünde kalsın
  window.addEventListener('resize', () => {
    if (!player.hidden) showPlayer()
  })

  loadList()

  return {
    // Sekmeye dönüşte çalan ayetin vurgusu geri gelsin
    setVisible(visible) {
      if (visible) markPlayingCard()
    },
  }
}
