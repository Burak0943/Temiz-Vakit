// Kur'an sekmesi: KİTAPLIK girişi (iki kart: Kur'an-ı Kerim + Büyük Cevşen)
// -> sure listesi -> ayet ayet okuma ekranı; Cevşen modülü de bu sekmede.
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
import { setupCevsen } from './cevsen.js'

// Birincil görünen ad Türkçe (kaynak: quran.com v4); dizi dışı kalırsa güvenli geri dönüş
const trName = (number) => SURAH_NAMES_TR[number - 1] || `Sure ${number}`

const AR_FONT_KEY = 'tv_arfontsize'
const AR_FONT_STEPS = [22, 26, 30, 34]

export function setupQuran(root, player, onNav) {
  root.innerHTML = `
    <div id="library-main">
      <h2>Kitaplık</h2>
      <button type="button" class="lib-card" id="lib-quran">
        <span class="lib-title">Kur'an-ı Kerim</span>
        <span class="lib-sub">114 sure · sesli</span>
      </button>
      <button type="button" id="lib-quran-resume" class="lib-resume" hidden></button>
      <button type="button" class="lib-card" id="lib-cevsen">
        <span class="lib-title">Büyük Cevşen</span>
        <span class="lib-sub">Hayrat hat sayfaları</span>
      </button>
      <button type="button" id="lib-cevsen-resume" class="lib-resume" hidden></button>
    </div>
    <div id="quran-main" hidden>
      <button type="button" id="quran-back">‹ Geri</button>
      <h2>Kur'an-ı Kerim</h2>
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
      <button type="button" id="qr-listen" hidden>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>
        <span>Sureyi Dinle</span>
      </button>
      <p id="qr-status" hidden></p>
      <p id="qr-offline-note" class="footnote" hidden>İndirilen sureler çevrimdışı okunabilir.</p>
      <div id="qr-ayahs"></div>
      <p class="footnote">Kaynak: AlQuran Cloud · Meal: Diyanet İşleri · Okunuş: Çeviriyazı</p>
    </div>
    <div id="cevsen-root"></div>
  `

  const libraryEl = root.querySelector('#library-main')
  const main = root.querySelector('#quran-main')
  const reader = root.querySelector('#quran-reader')
  // Cevşen aynı sekmenin ikinci kitabı: kendi alt-görünümlerini kendisi yönetir
  const cevsen = setupCevsen(root.querySelector('#cevsen-root'), onNav)
  const ayahsEl = root.querySelector('#qr-ayahs')
  const statusEl = root.querySelector('#quran-status')
  const retryBtn = root.querySelector('#quran-retry')
  const qrStatus = root.querySelector('#qr-status')
  const listenBtn = root.querySelector('#qr-listen')
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

  // --- Kitaplık: kart altı kompakt devam satırları ---
  function renderLibResumes() {
    const qbtn = root.querySelector('#lib-quran-resume')
    const pos = getPosition()
    const s = pos && surahList ? surahList.find((x) => x.number === pos.surah) : null
    if (s) {
      qbtn.hidden = false
      qbtn.textContent = `Devam — ${s.number}. ${trName(s.number)} · Ayet ${pos.ayah} ›`
      qbtn.onclick = () => openSurah(pos.surah, pos.ayah)
    } else {
      qbtn.hidden = true
    }
    const cbtn = root.querySelector('#lib-cevsen-resume')
    const info = cevsen.getResumeInfo()
    if (info) {
      cbtn.hidden = false
      cbtn.textContent = `Devam — ${info.label} ›`
      cbtn.onclick = () => {
        libraryEl.hidden = true
        cevsen.openResume()
      }
    } else {
      cbtn.hidden = true
    }
  }

  function showLibrary() {
    main.hidden = true
    reader.hidden = true
    renderLibResumes()
    libraryEl.hidden = false
    window.scrollTo(0, 0)
  }

  function openBook() {
    // sure listesi görünümü
    libraryEl.hidden = true
    reader.hidden = true
    main.hidden = false
    window.scrollTo(0, 0)
  }

  root.querySelector('#lib-quran').addEventListener('click', () => {
    openBook()
    onNav?.()
  })
  root.querySelector('#lib-cevsen').addEventListener('click', () => {
    libraryEl.hidden = true
    cevsen.openList() // onNav'ı kendisi çağırır
  })
  // Ekrandaki ‹ Geri = telefonun geri tuşu (yığın senkron kalır)
  root.querySelector('#quran-back').addEventListener('click', () => history.back())

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
    renderLibResumes()
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
    libraryEl.hidden = true // devam kartından doğrudan açılışta kitaplık kapanır
    main.hidden = true
    reader.hidden = false
    onNav?.() // görünüm geçişi history'ye yazılsın (popstate uygularken bastırılır)
    root.querySelector('#qr-title').textContent = `${number}. ${trName(number)}`
    ayahsEl.replaceChildren()
    listenBtn.hidden = true // içerik gelmeden büyük dinle butonu görünmesin
    qrStatus.hidden = false
    qrStatus.textContent = 'Yükleniyor…'
    arFont = loadArFont() // Ayarlar'dan değişmiş olabilir: her açılışta taze oku
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
    // Büyük "Sureyi Dinle": 1. ayetten başlatır (küçük kart butonları da durur)
    listenBtn.hidden = !detail.ayahs.some((a) => a.ses)
    listenBtn.onclick = () => playFrom(detail, 0)
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

  // Okuyucuyu kapatır; hangi görünümün açılacağına ÇAĞIRAN karar verir
  // (geri = kitaplık ya da sure listesi — history girdisi belirler)
  function closeReader() {
    if (openSurahNo && openDetail) savePosition(openSurahNo, topVisibleAyah())
    openSurahNo = null
    openDetail = null
    reader.hidden = true
    markStoredBadges() // yeni açılan sure cihaza inmiş olabilir
    window.scrollTo(0, 0)
  }

  // Ekrandaki ‹ Geri, telefonun geri tuşuyla AYNI yoldan gider: history.back()
  // popstate üretir, kapanış applySub üzerinden yapılır — yığın senkron kalır.
  root.querySelector('#qr-back').addEventListener('click', () => history.back())

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
    // --- Geri tuşu entegrasyonu: alt-görünüm durumu ---
    // null = kitaplık | {type:'kuran'} = sure listesi | {type:'sure',no} |
    // {type:'cevsen'} | {type:'cevsen-sayfa',k}
    getSub() {
      const c = cevsen.getSub()
      if (c) return c
      if (openSurahNo) return { type: 'sure', no: openSurahNo }
      if (!main.hidden) return { type: 'kuran' }
      return null
    },
    applySub(sub) {
      const isCevsen = sub && (sub.type === 'cevsen' || sub.type === 'cevsen-sayfa')
      if (!isCevsen) cevsen.applySub(null)
      if (!sub) {
        if (openSurahNo) closeReader()
        showLibrary()
        return
      }
      if (sub.type === 'kuran') {
        if (openSurahNo) closeReader()
        openBook()
      } else if (sub.type === 'sure') {
        if (openSurahNo !== sub.no) {
          // İleri gezinmeyle geri açılışta kayıtlı konum korunur; targetAyah'sız
          // açmak savePosition(n, 1) ile "kaldığın yer"i ezerdi (veri kaybı)
          const pos = getPosition()
          openSurah(sub.no, pos && pos.surah === sub.no ? pos.ayah : null)
        }
      } else {
        // Cevşen durumları: kitaplık/sure katmanları kapanır
        if (openSurahNo) closeReader()
        libraryEl.hidden = true
        main.hidden = true
        cevsen.applySub(sub)
      }
    },
  }
}
