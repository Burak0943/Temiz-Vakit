// Zikirmatik: büyük dokunma alanı, hedef (33/99/serbest), 1 sn basılı tutmalı sıfırlama.
// Durum localStorage "tv_dhikr" -> { count, target } (target 0 = serbest)
// Altında Dualar listesi + görünüm içi okuma ekranı (Diyanet kaynaklı metinler).
import { PRAYERS_DATA } from './prayers-data.js'

const STORAGE_KEY = 'tv_dhikr'
const TARGETS = [33, 99, 0]
const FONT_KEY = 'tv_fontsize'
const FONT_STEPS = [16, 20, 24, 28]

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return {
      count: Number.isInteger(s?.count) && s.count >= 0 ? s.count : 0,
      target: TARGETS.includes(s?.target) ? s.target : 33,
    }
  } catch {
    return { count: 0, target: 33 }
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // depolama yazılamasa da sayaç çalışmaya devam etsin
  }
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern)
}

export function setupDhikr(root) {
  const state = load()

  root.innerHTML = `
    <div id="dhikr-main">
      <h2>Zikirmatik</h2>
      <div id="dhikr-targets" role="group" aria-label="Hedef seçimi">
        <button type="button" data-target="33">33</button>
        <button type="button" data-target="99">99</button>
        <button type="button" data-target="0">Serbest</button>
      </div>
      <button type="button" id="dhikr-pad" aria-label="Zikir say">
        <span id="dhikr-count">0</span>
        <span id="dhikr-goal"></span>
      </button>
      <button type="button" id="dhikr-reset">Sıfırla — 1 sn basılı tut</button>
      <h2 id="dua-heading">Dualar</h2>
      <ul id="prayer-list"></ul>
    </div>
    <div id="prayer-reader" hidden>
      <div id="reader-top">
        <button type="button" id="reader-back">‹ Geri</button>
        <div id="reader-font" role="group" aria-label="Yazı boyutu">
          <button type="button" id="font-minus" aria-label="Yazıyı küçült">A−</button>
          <button type="button" id="font-plus" aria-label="Yazıyı büyüt">A+</button>
        </div>
      </div>
      <h2 id="reader-title"></h2>
      <div id="reader-body">
        <p id="reader-okunus"></p>
        <p id="reader-not" hidden></p>
        <p id="reader-meal" hidden></p>
      </div>
      <p id="reader-source" class="footnote"></p>
    </div>
  `

  const pad = root.querySelector('#dhikr-pad')
  const countEl = root.querySelector('#dhikr-count')
  const goalEl = root.querySelector('#dhikr-goal')
  const resetBtn = root.querySelector('#dhikr-reset')
  const targetBtns = [...root.querySelectorAll('#dhikr-targets button')]

  function render() {
    countEl.textContent = state.count
    goalEl.textContent = state.target ? `Hedef: ${state.target}` : 'Serbest sayım'
    pad.classList.toggle('reached', state.target > 0 && state.count >= state.target)
    for (const b of targetBtns) {
      const active = Number(b.dataset.target) === state.target
      b.classList.toggle('active', active)
      b.setAttribute('aria-pressed', active)
    }
  }

  function increment() {
    state.count++
    save(state)
    vibrate([15])
    if (state.target > 0 && state.count === state.target) {
      vibrate([30, 80, 30, 80, 30])
      pad.classList.remove('celebrate')
      void pad.offsetWidth // animasyonu yeniden tetiklemek için reflow
      pad.classList.add('celebrate')
    }
    render()
  }

  // Sayım BIRAKIŞTA yapılır: basılan nokta MOVE_SLOP'tan fazla kayarsa dokunuş
  // değil kaydırmadır (swipe navigasyonu) — ne sayaç artar ne titreşim olur.
  // Klavye ayrı keydown yolundan sayılır; preventDefault sentezlenen click'i bastırır.
  // isPrimary KULLANILMIYOR: dokunmada isPrimary belge genelidir — ekranın başka
  // yerine yaslanan parmak/avuç pad dokunuşlarını sessizce düşürürdü. Pad'in kendi
  // aktif işaretçisi takip edilir: pad üstündeki eşzamanlı ikinci parmak sayılmaz.
  const MOVE_SLOP = 12 // px
  let activePointerId = null
  let padStartX = 0
  let padStartY = 0
  let padMoved = false

  pad.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return // sağ/orta tık sayılmaz
    if (activePointerId !== null) return // pad üstünde ikinci parmak sayılmaz
    activePointerId = e.pointerId
    padStartX = e.clientX
    padStartY = e.clientY
    padMoved = false
    try {
      pad.setPointerCapture(e.pointerId) // move/up pad dışına taşsa da yakalanır
    } catch {
      // sentetik/etkin olmayan işaretçi: yakalama şart değil
    }
  })
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId) return
    if (
      Math.abs(e.clientX - padStartX) > MOVE_SLOP ||
      Math.abs(e.clientY - padStartY) > MOVE_SLOP
    ) {
      padMoved = true
    }
  })
  pad.addEventListener('pointerup', (e) => {
    if (e.pointerId !== activePointerId) return
    activePointerId = null
    if (!padMoved) increment() // kaymadan bırakıldıysa dokunuştur
  })
  for (const ev of ['pointercancel', 'lostpointercapture']) {
    pad.addEventListener(ev, (e) => {
      if (e.pointerId === activePointerId) activePointerId = null
    })
  }
  pad.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (!e.repeat) increment() // basılı tutmanın auto-repeat'i sayılmaz
  })

  root.querySelector('#dhikr-targets').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-target]')
    if (!btn) return
    state.target = Number(btn.dataset.target)
    save(state)
    render()
  })

  // Yanlışlıkla sıfırlamaya karşı: 1 sn basılı tutma
  let holdTimer = null
  function startHold() {
    if (holdTimer) return
    resetBtn.classList.add('holding')
    holdTimer = setTimeout(() => {
      holdTimer = null
      resetBtn.classList.remove('holding')
      state.count = 0
      save(state)
      pad.classList.remove('celebrate')
      vibrate(20)
      render()
    }, 1000)
  }
  function cancelHold() {
    if (holdTimer) clearTimeout(holdTimer)
    holdTimer = null
    resetBtn.classList.remove('holding')
  }
  resetBtn.addEventListener('pointerdown', startHold)
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
    resetBtn.addEventListener(ev, cancelHold)
  }
  resetBtn.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startHold()
  })
  resetBtn.addEventListener('keyup', cancelHold)

  // ---- Dualar: liste + görünüm içi okuma ekranı ----
  const main = root.querySelector('#dhikr-main')
  const reader = root.querySelector('#prayer-reader')
  const readerBody = root.querySelector('#reader-body')
  const fontMinus = root.querySelector('#font-minus')
  const fontPlus = root.querySelector('#font-plus')

  function loadFontSize() {
    try {
      const v = Number(localStorage.getItem(FONT_KEY))
      return FONT_STEPS.includes(v) ? v : FONT_STEPS[1]
    } catch {
      return FONT_STEPS[1] // depolama engelliyse varsayılanla devam
    }
  }
  let fontSize = loadFontSize()

  function applyFont() {
    readerBody.style.fontSize = `${fontSize}px`
    // disabled yerine aria-disabled: odaklı buton sınırda devre dışı kalınca
    // klavye odağı body'ye düşmesin; sınır koruması stepFont'ta zaten var
    const atMin = fontSize === FONT_STEPS[0]
    const atMax = fontSize === FONT_STEPS[FONT_STEPS.length - 1]
    fontMinus.setAttribute('aria-disabled', atMin)
    fontMinus.classList.toggle('limit', atMin)
    fontPlus.setAttribute('aria-disabled', atMax)
    fontPlus.classList.toggle('limit', atMax)
  }

  function stepFont(dir) {
    const idx = FONT_STEPS.indexOf(fontSize) + dir
    if (idx < 0 || idx >= FONT_STEPS.length) return
    fontSize = FONT_STEPS[idx]
    try {
      localStorage.setItem(FONT_KEY, String(fontSize))
    } catch {
      // kalıcılaşmasa da bu oturumda uygulanır
    }
    applyFont()
  }
  fontMinus.addEventListener('click', () => stepFont(-1))
  fontPlus.addEventListener('click', () => stepFont(1))

  // Dua başına scroll pozisyonu (oturum içi) + listeye dönüşte eski konum.
  // Kaydetme scroll olayına değil ayrılış anına bağlı: okuyucudan çıkarken /
  // başka duaya geçerken mevcut konum doğrudan okunur.
  const scrollPos = new Map()
  let openId = null
  let mainScrollY = 0

  function saveScroll() {
    if (openId) scrollPos.set(openId, window.scrollY)
  }

  function openPrayer(p) {
    saveScroll() // başka dua açıksa önce onun konumunu sakla
    if (!openId) mainScrollY = window.scrollY // listeden geliyorsak liste konumu
    root.querySelector('#reader-title').textContent = p.baslik
    root.querySelector('#reader-okunus').textContent = p.okunus
    const notEl = root.querySelector('#reader-not')
    notEl.hidden = !p.not
    notEl.textContent = p.not || ''
    const mealEl = root.querySelector('#reader-meal')
    mealEl.hidden = !p.meal
    mealEl.textContent = p.meal || ''
    root.querySelector('#reader-source').textContent = `Kaynak: ${p.kaynak}`
    main.hidden = true
    reader.hidden = false
    applyFont()
    openId = p.id
    window.scrollTo(0, scrollPos.get(p.id) || 0)
  }

  function closeReader() {
    saveScroll()
    openId = null
    reader.hidden = true
    main.hidden = false
    window.scrollTo(0, mainScrollY)
  }
  root.querySelector('#reader-back').addEventListener('click', closeReader)

  const list = root.querySelector('#prayer-list')
  for (const p of PRAYERS_DATA) {
    const li = document.createElement('li')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = p.baslik
    btn.addEventListener('click', () => openPrayer(p))
    li.appendChild(btn)
    list.appendChild(li)
  }

  render()
}
