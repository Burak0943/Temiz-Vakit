// İlk giriş karşılaması: 3 kart, tam ekran katman. Yalnız GERÇEK yeni
// kullanıcıya gösterilir: tv_onboarded bayrağı yoksa VE mevcut kullanıcı
// verisi de yoksa (tv_prayers/tv_dhikr/tv_quran_pos'tan biri varsa eski
// kullanıcıdır — karşılama atlanır, bayrak sessizce yazılır).
// Ayarlar'dan tekrar izlenebilir; o modda konum adımı izin İSTEMEZ.
const FLAG_KEY = 'tv_onboarded'
const EXISTING_KEYS = ['tv_prayers', 'tv_dhikr', 'tv_quran_pos']

const CARD_ICONS = {
  vakit:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  kitap:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2z"/><path d="M4 20V5M9 7h6"/></svg>',
  kible:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z"/></svg>',
  zikir:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.5" r="2.5"/><circle cx="6.5" cy="15.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/></svg>',
}

function hasFlag() {
  try {
    return !!localStorage.getItem(FLAG_KEY)
  } catch {
    return true // depolama yoksa karşılamayı zorlamayalım
  }
}

function setFlag() {
  try {
    localStorage.setItem(FLAG_KEY, '1')
  } catch {
    // yazılamazsa her açılışta koşul yeniden değerlendirilir
  }
}

function hasExistingData() {
  try {
    return EXISTING_KEYS.some((k) => localStorage.getItem(k) != null)
  } catch {
    return false
  }
}

export function setupOnboarding({ requestLocation, getLocationLabel }) {
  const overlay = document.createElement('div')
  overlay.id = 'onboarding'
  overlay.hidden = true
  document.body.appendChild(overlay)

  let cardIndex = 0
  let replayMode = false

  function finish(withLocation) {
    setFlag()
    overlay.hidden = true
    if (withLocation) requestLocation()
  }

  function render() {
    const dots = [0, 1, 2]
      .map((i) => `<span class="ob-dot${i === cardIndex ? ' active' : ''}"></span>`)
      .join('')
    let body = ''
    if (cardIndex === 0) {
      body = `
        <h2>Temiz Vakit'e hoş geldiniz</h2>
        <p>Reklamsız, sade bir ibadet yol arkadaşı.</p>`
    } else if (cardIndex === 1) {
      body = `
        <h2>Neler var?</h2>
        <ul id="ob-features">
          <li>${CARD_ICONS.vakit}<span>Namaz vakitleri ve geri sayım</span></li>
          <li>${CARD_ICONS.kitap}<span>Kur'an-ı Kerim ve Büyük Cevşen</span></li>
          <li>${CARD_ICONS.kible}<span>Kıble pusulası</span></li>
          <li>${CARD_ICONS.zikir}<span>Zikirmatik ve dualar</span></li>
        </ul>`
    } else if (replayMode) {
      // Tekrar izleme: izin İSTENMEZ, yalnız bilgi verilir
      body = `
        <h2>Konum</h2>
        <p>Vakitler konumunuza göre hesaplanır. Şu anki konum: ${getLocationLabel()}.</p>
        <p class="ob-small">Konum, Ayarlar bölümünden güncellenebilir.</p>`
    } else {
      body = `
        <h2>Konum</h2>
        <p>Vakitler için konumunuza ihtiyacımız var.</p>`
    }

    const nextBtn =
      cardIndex < 2
        ? '<button type="button" id="ob-next">İleri</button>'
        : replayMode
          ? '<button type="button" id="ob-close">Kapat</button>'
          : `<button type="button" id="ob-locate">Konumumu Bul</button>
             <button type="button" id="ob-skip">Şimdilik varsayılanla devam et</button>`

    overlay.innerHTML = `
      <div class="ob-card">
        ${body}
        <div class="ob-actions">${nextBtn}</div>
        <div class="ob-dots">${dots}</div>
      </div>`

    overlay.querySelector('#ob-next')?.addEventListener('click', () => {
      cardIndex++
      render()
    })
    overlay.querySelector('#ob-close')?.addEventListener('click', () => finish(false))
    overlay.querySelector('#ob-locate')?.addEventListener('click', () => finish(true))
    overlay.querySelector('#ob-skip')?.addEventListener('click', () => finish(false)) // Aydın varsayılanı zaten etkin
  }

  // Kartlar arasında yatay kaydırma (katman body'de: sekme swipe'ına karışmaz)
  let swipeStart = null
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return
    swipeStart = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId }
  })
  overlay.addEventListener('pointerup', (e) => {
    if (!swipeStart || e.pointerId !== swipeStart.id) return
    const dx = e.clientX - swipeStart.x
    const dy = e.clientY - swipeStart.y
    const dt = Date.now() - swipeStart.t
    swipeStart = null
    if (Math.abs(dx) >= 60 && Math.abs(dx) >= 2 * Math.abs(dy) && dt <= 600) {
      if (dx < 0 && cardIndex < 2) cardIndex++
      else if (dx > 0 && cardIndex > 0) cardIndex--
      else return
      render()
    }
  })

  return {
    // Açılışta: yalnız gerçek yeni kullanıcıya göster
    maybeShowFirstRun() {
      if (hasFlag()) return
      if (hasExistingData()) {
        setFlag() // eski kullanıcı: rahatsız etme, bayrağı sessizce yaz
        return
      }
      this.show(false)
    },
    show(replay) {
      replayMode = !!replay
      cardIndex = 0
      overlay.hidden = false
      render()
    },
    isOpen() {
      return !overlay.hidden
    },
    // Geri tuşu: kart geriletir; İLK kartta hiçbir şey yapmaz (yine tüketilir —
    // karşılama açıkken geri, uygulamadan/karşılamadan atmaz)
    back() {
      if (cardIndex > 0) {
        cardIndex--
        render()
      }
      return true
    },
  }
}
