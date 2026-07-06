// Mushaf okuyucu: Hayrat'ın Ahmed Husrev Hattı taranmış sayfalarını gösterir.
// Cevşen görüntüleyicisiyle AYNI mimari (sayfa görüntüsü + nav + swipe + SW
// önbellek + kaldığın yer). Metin YOK; sayfalar olduğu gibi sunulur.
// Offline: CORS başlığı olmadığından blob/IndexedDB yerine SW opak önbelleği
// (public/sw.js 'tv-mushaf-sayfa').
import {
  MUSHAF_PAGE_COUNT,
  MUSHAF_SURAHS,
  MUSHAF_JUZ,
  mushafPageUrl,
  secdeForPage,
} from './mushaf-pages.js'
import { wakeRef, wakeUnref } from './wakelock.js'

const POS_KEY = 'tv_mushaf_pos'
const KAYNAK = 'Kaynak: Hayrat Neşriyat — Ahmed Husrev Hattı (izinli kullanım)'
const MAX = MUSHAF_PAGE_COUNT - 1 // sayfa 0..MAX

function loadPos() {
  try {
    const p = Number(JSON.parse(localStorage.getItem(POS_KEY))?.p)
    return Number.isInteger(p) && p >= 0 && p <= MAX ? p : null
  } catch {
    return null
  }
}

function savePos(page) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify({ p: page }))
  } catch {
    // kalıcılaşmasa da oturum içinde çalışır
  }
}

export function setupMushaf(container, onNav) {
  container.innerHTML = `
    <div id="mushaf-main" hidden>
      <button type="button" id="mushaf-back">‹ Geri</button>
      <h2>Mushaf</h2>
      <button type="button" id="mushaf-resume" hidden></button>
      <div id="mushaf-seg" role="group" aria-label="Atlama türü">
        <button type="button" id="mseg-sure" class="active" aria-pressed="true">Sureler</button>
        <button type="button" id="mseg-cuz" aria-pressed="false">Cüzler</button>
      </div>
      <ul id="mushaf-list"></ul>
      <p class="footnote">${KAYNAK}</p>
    </div>
    <div id="mushaf-viewer" hidden>
      <div id="mv-top">
        <button type="button" id="mv-back">‹ Geri</button>
        <p id="mv-title"></p>
      </div>
      <p id="mv-secde" hidden></p>
      <div id="mv-stage">
        <img id="mv-img" alt="" hidden />
        <p id="mv-status" hidden></p>
        <button type="button" id="mv-retry" hidden>Tekrar dene</button>
      </div>
      <div id="mv-nav">
        <button type="button" id="mv-prev" aria-label="Önceki sayfa">‹</button>
        <input id="mv-jump" type="number" min="1" inputmode="numeric" aria-label="Sayfa numarası" placeholder="Sayfa" />
        <button type="button" id="mv-go">Git</button>
        <button type="button" id="mv-next" aria-label="Sonraki sayfa">›</button>
      </div>
      <p class="footnote">${KAYNAK}</p>
    </div>
  `

  const mainEl = container.querySelector('#mushaf-main')
  const viewerEl = container.querySelector('#mushaf-viewer')
  const img = container.querySelector('#mv-img')
  const statusEl = container.querySelector('#mv-status')
  const retryBtn = container.querySelector('#mv-retry')
  const titleEl = container.querySelector('#mv-title')
  const secdeEl = container.querySelector('#mv-secde')
  const prevBtn = container.querySelector('#mv-prev')
  const nextBtn = container.querySelector('#mv-next')
  const jumpInput = container.querySelector('#mv-jump')
  const listEl = container.querySelector('#mushaf-list')

  let openPage = -1 // -1: görüntüleyici kapalı
  const preloaded = new Set()
  let viewerLock = false

  function setViewerLock(on) {
    if (on === viewerLock) return
    viewerLock = on
    if (on) wakeRef()
    else wakeUnref()
  }

  // --- Ana ekran: kaldığın yer + Sureler/Cüzler atlama listesi ---
  function renderResume() {
    const btn = container.querySelector('#mushaf-resume')
    const pos = loadPos()
    if (pos == null) {
      btn.hidden = true
      return
    }
    btn.hidden = false
    btn.textContent = `Mushafta kaldığın yer — Sayfa ${pos + 1} ›`
    btn.onclick = () => openViewer(pos)
  }

  function renderList(items) {
    const frag = document.createDocumentFragment()
    for (const it of items) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 's-open'
      const nm = document.createElement('span')
      nm.className = 's-name'
      nm.textContent = it.label
      const meta = document.createElement('span')
      meta.className = 's-meta'
      meta.textContent = `Sayfa ${it.page + 1}`
      btn.append(nm, meta)
      btn.addEventListener('click', () => openViewer(it.page))
      li.appendChild(btn)
      frag.appendChild(li)
    }
    listEl.replaceChildren(frag)
  }

  const segSure = container.querySelector('#mseg-sure')
  const segCuz = container.querySelector('#mseg-cuz')
  function setSegment(cuz) {
    segSure.classList.toggle('active', !cuz)
    segSure.setAttribute('aria-pressed', !cuz)
    segCuz.classList.toggle('active', cuz)
    segCuz.setAttribute('aria-pressed', cuz)
    renderList(cuz ? MUSHAF_JUZ : MUSHAF_SURAHS)
  }
  segSure.addEventListener('click', () => setSegment(false))
  segCuz.addEventListener('click', () => setSegment(true))

  // --- Sayfa görüntüleyici ---
  function preloadNext(page) {
    if (page + 1 > MAX) return
    const url = mushafPageUrl(page + 1)
    if (preloaded.has(url)) return
    preloaded.add(url)
    new Image().src = url // SW kayıtlıysa önbelleğe de iner
  }

  function loadPage(page) {
    openPage = page
    savePos(page)
    titleEl.textContent = `Sayfa ${page + 1} / ${MUSHAF_PAGE_COUNT}`
    prevBtn.disabled = page <= 0
    nextBtn.disabled = page >= MAX
    jumpInput.max = String(MUSHAF_PAGE_COUNT)
    jumpInput.value = ''
    // Secde uyarısı (Hayrat verisinden — sabit liste)
    const secde = secdeForPage(page)
    secdeEl.hidden = !secde
    if (secde) secdeEl.textContent = `Bu sayfada secde ayeti var: ${secde.surah} suresi ${secde.ayah}. ayet`
    statusEl.hidden = false
    statusEl.textContent = 'Yükleniyor…'
    retryBtn.hidden = true
    img.hidden = true
    const url = mushafPageUrl(page)
    img.alt = `Mushaf sayfa ${page + 1} (hat sayfası görüntüsü)`
    img.onload = () => {
      if (openPage !== page) return
      statusEl.hidden = true
      img.hidden = false
      preloadNext(page)
    }
    img.onerror = () => {
      if (openPage !== page) return
      statusEl.textContent = 'Sayfa yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.'
      retryBtn.hidden = false
      // Zehirli opak önbellek onarımı (Cevşen emsali)
      if ('caches' in window) {
        caches
          .open('tv-mushaf-sayfa')
          .then((c) => c.delete(url))
          .catch(() => {})
      }
    }
    img.src = url
  }
  retryBtn.addEventListener('click', () => loadPage(openPage))

  function turnPage(delta) {
    const next = openPage + delta
    if (openPage < 0 || next < 0 || next > MAX) return
    loadPage(next) // sayfa çevirme history'ye YAZILMAZ (Cevşen emsali)
  }
  prevBtn.addEventListener('click', () => turnPage(-1))
  nextBtn.addEventListener('click', () => turnPage(1))

  function jump() {
    if (openPage < 0) return
    // Kullanıcı 1-tabanlı girer; içerde 0-tabanlı
    const n = Math.trunc(Math.min(Math.max(1, Number(jumpInput.value) || 1), MUSHAF_PAGE_COUNT)) - 1
    loadPage(n)
  }
  container.querySelector('#mv-go').addEventListener('click', jump)
  jumpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') jump()
  })

  // Görüntüleyici içi yatay swipe = sayfa çevirme (Cevşen deseni)
  let swipeStart = null
  viewerEl.addEventListener('pointerdown', (e) => {
    if (swipeStart !== null) return
    if (e.pointerType === 'mouse') return
    if (e.target.closest('button, input')) return
    swipeStart = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId }
  })
  viewerEl.addEventListener('pointerup', (e) => {
    if (!swipeStart || e.pointerId !== swipeStart.id) return
    const dx = e.clientX - swipeStart.x
    const dy = e.clientY - swipeStart.y
    const dt = Date.now() - swipeStart.t
    swipeStart = null
    if (Math.abs(dx) >= 60 && Math.abs(dx) >= 2 * Math.abs(dy) && dt <= 600) {
      turnPage(dx < 0 ? 1 : -1)
    }
  })
  for (const ev of ['pointercancel', 'lostpointercapture', 'pointerleave']) {
    viewerEl.addEventListener(ev, (e) => {
      if (swipeStart && e.pointerId === swipeStart.id) swipeStart = null
    })
  }

  function openList() {
    viewerEl.hidden = true
    openPage = -1
    setViewerLock(false)
    renderResume()
    setSegment(false)
    mainEl.hidden = false
    window.scrollTo(0, 0)
    onNav?.()
  }

  function openViewer(page) {
    mainEl.hidden = true
    viewerEl.hidden = false
    setViewerLock(true)
    loadPage(page)
    window.scrollTo(0, 0)
    onNav?.()
  }

  function closeAll() {
    mainEl.hidden = true
    viewerEl.hidden = true
    openPage = -1
    setViewerLock(false)
  }

  container.querySelector('#mushaf-back').addEventListener('click', () => history.back())
  container.querySelector('#mv-back').addEventListener('click', () => history.back())

  return {
    openList,
    getResumeInfo() {
      const pos = loadPos()
      return pos == null ? null : { page: pos, label: `Sayfa ${pos + 1}` }
    },
    openResume() {
      const pos = loadPos()
      if (pos == null) openList()
      else openViewer(pos)
    },
    // --- Geri tuşu entegrasyonu ---
    // NOT: sayfa no state'te taşınmaz (Cevşen emsali): tek gerçek tv_mushaf_pos
    getSub() {
      if (openPage !== -1) return { type: 'mushaf-sayfa' }
      if (!mainEl.hidden) return { type: 'mushaf' }
      return null
    },
    applySub(sub) {
      if (!sub) {
        closeAll()
        return
      }
      if (sub.type === 'mushaf') {
        viewerEl.hidden = true
        openPage = -1
        setViewerLock(false)
        renderResume()
        setSegment(false)
        mainEl.hidden = false
        return
      }
      // mushaf-sayfa: kayıtlı sayfadan aç
      if (openPage === -1 || viewerEl.hidden) {
        mainEl.hidden = true
        viewerEl.hidden = false
        setViewerLock(true)
        loadPage(loadPos() ?? 0)
      }
    },
  }
}
