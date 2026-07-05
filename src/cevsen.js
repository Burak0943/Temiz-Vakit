// Cevşen okuyucu: Hayrat'ın resmî servisindeki taranmış hat sayfalarını
// gösterir (bölüm listesi -> sayfa görüntüleyici). Metin YOK — içerik kuralı
// gereği görüntüden metin türetilmez; sayfalar olduğu gibi sunulur.
// Offline: CORS başlığı olmadığından blob/IndexedDB İMKÂNSIZ; ziyaret edilen
// sayfalar service worker'ın kalıcı önbelleğiyle saklanır (bkz. public/sw.js).
import { CEVSEN_SECTIONS, cevsenPageUrl } from './cevsen-pages.js'
import { wakeRef, wakeUnref } from './wakelock.js'

const POS_KEY = 'tv_cevsen_pos'
const KAYNAK = 'Kaynak: Hayrat Neşriyat — kulliyat.risale.online (izinli kullanım)'

function loadPos() {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY))
    const si = CEVSEN_SECTIONS.findIndex((s) => s.klasor === p?.k)
    if (si === -1) return null
    const page = Number(p.p)
    if (!Number.isInteger(page) || page < 1 || page > CEVSEN_SECTIONS[si].sayfa) return null
    return { si, page }
  } catch {
    return null
  }
}

function savePos(si, page) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify({ k: CEVSEN_SECTIONS[si].klasor, p: page }))
  } catch {
    // kalıcılaşmasa da oturum içinde çalışır
  }
}

// container: dhikr görünümü içindeki boş sarmalayıcı; onNav: history kaydı
export function setupCevsen(container, onNav) {
  container.innerHTML = `
    <div id="cevsen-main" hidden>
      <button type="button" id="cevsen-back">‹ Geri</button>
      <h2>Cevşen (Büyük Cevşen)</h2>
      <button type="button" id="cevsen-resume" hidden></button>
      <ul id="cevsen-sections"></ul>
      <p class="footnote">${KAYNAK}</p>
    </div>
    <div id="cevsen-viewer" hidden>
      <div id="cv-top">
        <button type="button" id="cv-back">‹ Geri</button>
        <p id="cv-title"></p>
      </div>
      <div id="cv-stage">
        <img id="cv-img" alt="" hidden />
        <p id="cv-status" hidden></p>
        <button type="button" id="cv-retry" hidden>Tekrar dene</button>
      </div>
      <div id="cv-nav">
        <button type="button" id="cv-prev" aria-label="Önceki sayfa">‹</button>
        <input id="cv-jump" type="number" min="1" inputmode="numeric" aria-label="Sayfa numarası" placeholder="Sayfa" />
        <button type="button" id="cv-go">Git</button>
        <button type="button" id="cv-next" aria-label="Sonraki sayfa">›</button>
      </div>
      <p class="footnote">${KAYNAK}</p>
    </div>
  `

  const mainEl = container.querySelector('#cevsen-main')
  const viewerEl = container.querySelector('#cevsen-viewer')
  const img = container.querySelector('#cv-img')
  const statusEl = container.querySelector('#cv-status')
  const retryBtn = container.querySelector('#cv-retry')
  const titleEl = container.querySelector('#cv-title')
  const prevBtn = container.querySelector('#cv-prev')
  const nextBtn = container.querySelector('#cv-next')
  const jumpInput = container.querySelector('#cv-jump')

  let openSection = -1 // -1: görüntüleyici kapalı
  let openPage = 1
  const preloaded = new Set() // aynı sayfaya iki preload Image nesnesi kurulmasın
  let viewerLock = false // görüntüleyici açıkken ekran uyanık

  function setViewerLock(on) {
    if (on === viewerLock) return
    viewerLock = on
    if (on) wakeRef()
    else wakeUnref()
  }

  // --- Bölüm listesi ---
  function renderResume() {
    const btn = container.querySelector('#cevsen-resume')
    const pos = loadPos()
    if (!pos) {
      btn.hidden = true
      return
    }
    btn.hidden = false
    btn.textContent = `Kaldığın yerden devam — ${CEVSEN_SECTIONS[pos.si].ad} · Sayfa ${pos.page} ›`
    btn.onclick = () => openViewer(pos.si, pos.page)
  }

  const listFrag = document.createDocumentFragment()
  CEVSEN_SECTIONS.forEach((s, si) => {
    const li = document.createElement('li')
    const btn = document.createElement('button')
    btn.type = 'button'
    const ad = document.createElement('span')
    ad.className = 's-name'
    ad.textContent = s.ad
    const meta = document.createElement('span')
    meta.className = 's-meta'
    meta.textContent = `${s.sayfa} sayfa`
    btn.append(ad, meta)
    btn.addEventListener('click', () => openViewer(si, null))
    li.appendChild(btn)
    listFrag.appendChild(li)
  })
  container.querySelector('#cevsen-sections').appendChild(listFrag)

  // --- Sayfa görüntüleyici ---
  function preloadNext(si, page) {
    if (page + 1 > CEVSEN_SECTIONS[si].sayfa) return
    const url = cevsenPageUrl(CEVSEN_SECTIONS[si], page + 1)
    if (preloaded.has(url)) return
    preloaded.add(url)
    new Image().src = url // SW kayıtlıysa önbelleğe de iner
  }

  function loadPage(page) {
    const s = CEVSEN_SECTIONS[openSection]
    openPage = page
    savePos(openSection, page)
    titleEl.textContent = `${s.ad} · Sayfa ${page}/${s.sayfa}`
    prevBtn.disabled = page <= 1
    nextBtn.disabled = page >= s.sayfa
    jumpInput.max = String(s.sayfa)
    jumpInput.value = ''
    statusEl.hidden = false
    statusEl.textContent = 'Yükleniyor…'
    retryBtn.hidden = true
    img.hidden = true
    const url = cevsenPageUrl(s, page)
    img.alt = `${s.ad}, sayfa ${page} (hat sayfası görüntüsü)`
    img.onload = () => {
      if (openSection === -1 || cevsenPageUrl(CEVSEN_SECTIONS[openSection], openPage) !== url) return
      statusEl.hidden = true
      img.hidden = false
      preloadNext(openSection, openPage)
    }
    img.onerror = () => {
      if (openSection === -1 || cevsenPageUrl(CEVSEN_SECTIONS[openSection], openPage) !== url) return
      statusEl.textContent = 'Sayfa yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.'
      retryBtn.hidden = false
      // Zehirli önbellek onarımı: opak yanıtlar HTTP hatasını gizler — SW geçici
      // bir hata gövdesini 'tv-cevsen-sayfa'ya koymuş olabilir. Bozuk girdi
      // silinir ki "Tekrar dene" gerçekten ağa çıksın (girdi yoksa no-op).
      if ('caches' in window) {
        caches
          .open('tv-cevsen-sayfa')
          .then((c) => c.delete(url))
          .catch(() => {})
      }
    }
    img.src = url
  }
  retryBtn.addEventListener('click', () => loadPage(openPage))

  function turnPage(delta) {
    const next = openPage + delta
    if (openSection === -1 || next < 1 || next > CEVSEN_SECTIONS[openSection].sayfa) return
    loadPage(next) // sayfa çevirme history'ye YAZILMAZ: geri = bölüm listesi
  }
  prevBtn.addEventListener('click', () => turnPage(-1))
  nextBtn.addEventListener('click', () => turnPage(1))

  function jump() {
    if (openSection === -1) return
    const max = CEVSEN_SECTIONS[openSection].sayfa
    const n = Math.trunc(Math.min(Math.max(1, Number(jumpInput.value) || 1), max))
    loadPage(n)
  }
  container.querySelector('#cv-go').addEventListener('click', jump)
  jumpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') jump()
  })

  // Görüntüleyici içinde yatay swipe SAYFA çevirir (sekme değil; global swipe
  // için #cevsen-viewer istisna bölgesidir). Eşikler swipe.js ile aynı.
  let swipeStart = null
  viewerEl.addEventListener('pointerdown', (e) => {
    if (swipeStart !== null) return
    if (e.pointerType === 'mouse') return // masaüstünde butonlar var; sürükleme/seçim karışmasın (swipe.js ile aynı karar)
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
      turnPage(dx < 0 ? 1 : -1) // sola kaydır = sonraki sayfa
    }
  })
  for (const ev of ['pointercancel', 'lostpointercapture', 'pointerleave']) {
    viewerEl.addEventListener(ev, (e) => {
      if (swipeStart && e.pointerId === swipeStart.id) swipeStart = null
    })
  }

  // --- Açılış/kapanış (dhikr ana görünümünü dhikr.js yönetir) ---
  function openList() {
    viewerEl.hidden = true
    openSection = -1
    setViewerLock(false)
    renderResume()
    mainEl.hidden = false
    window.scrollTo(0, 0)
    onNav?.()
  }

  function openViewer(si, page) {
    mainEl.hidden = true
    viewerEl.hidden = false
    setViewerLock(true)
    openSection = si
    const pos = loadPos()
    loadPage(page || (pos && pos.si === si ? pos.page : 1))
    window.scrollTo(0, 0)
    onNav?.()
  }

  function closeAll() {
    mainEl.hidden = true
    viewerEl.hidden = true
    openSection = -1
    setViewerLock(false)
  }

  container.querySelector('#cevsen-back').addEventListener('click', () => history.back())
  container.querySelector('#cv-back').addEventListener('click', () => history.back())

  return {
    openList, // Kitaplık kartından çağrılır
    // Kitaplık kartı altındaki kompakt devam satırı için
    getResumeInfo() {
      const pos = loadPos()
      if (!pos) return null
      return { label: `${CEVSEN_SECTIONS[pos.si].ad} · Sayfa ${pos.page}`, si: pos.si, page: pos.page }
    },
    openResume() {
      const pos = loadPos()
      if (pos) openViewer(pos.si, pos.page)
      else openList()
    },
    // --- Geri tuşu entegrasyonu (dhikr.getSub/applySub üzerinden) ---
    // NOT: p bilinçli taşınmaz — sayfa numarası her çevirmede değiştiğinden
    // nav.push tekilleştirmesini kırar (aynı görünüme yinelenen girdi) ve
    // ileri gezinmede bayat p, kayıtlı "kaldığın yer"i ezerdi. Konumun tek
    // gerçeği localStorage'daki tv_cevsen_pos'tur.
    getSub() {
      if (openSection !== -1)
        return { type: 'cevsen-sayfa', k: CEVSEN_SECTIONS[openSection].klasor }
      if (!mainEl.hidden) return { type: 'cevsen' }
      return null
    },
    applySub(sub) {
      if (!sub) {
        closeAll()
        return
      }
      if (sub.type === 'cevsen') {
        viewerEl.hidden = true
        openSection = -1
        setViewerLock(false)
        renderResume()
        mainEl.hidden = false
        return
      }
      // cevsen-sayfa: klasörden bölüm çöz; tanınmazsa listeye düş
      const si = CEVSEN_SECTIONS.findIndex((s) => s.klasor === sub.k)
      if (si === -1) {
        viewerEl.hidden = true
        setViewerLock(false)
        renderResume()
        mainEl.hidden = false
        return
      }
      if (openSection !== si || viewerEl.hidden) {
        mainEl.hidden = true
        viewerEl.hidden = false
        setViewerLock(true)
        openSection = si
        // Girdiden sayfa değil, kayıtlı konumdan açılır (quran.js emsali):
        // ileri gezinme "kaldığın yer"i ezmesin
        const pos = loadPos()
        loadPage(pos && pos.si === si ? pos.page : 1)
      }
    },
  }
}
