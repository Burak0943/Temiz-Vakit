// Kaza takibi: kullanıcı mevcut borç SAYISINI kendisi girer — uygulama hesap
// veya tavsiye ÜRETMEZ (fetva sınırı); bilmeyene müftülüğe danışma notu düşülür.
// Veri: localStorage tv_qada -> { kalan: {sabah..vitir}, dusulen: n }
const KEY = 'tv_qada'
const ITEMS = [
  { k: 'sabah', ad: 'Sabah' },
  { k: 'ogle', ad: 'Öğle' },
  { k: 'ikindi', ad: 'İkindi' },
  { k: 'aksam', ad: 'Akşam' },
  { k: 'yatsi', ad: 'Yatsı' },
  { k: 'vitir', ad: 'Vitir' },
]

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY))
    if (!d || typeof d.kalan !== 'object' || d.kalan === null) return null
    const kalan = {}
    for (const it of ITEMS) {
      const v = Number(d.kalan[it.k])
      kalan[it.k] = Number.isInteger(v) && v >= 0 ? v : 0
    }
    const dusulen = Number.isInteger(d.dusulen) && d.dusulen >= 0 ? d.dusulen : 0
    return { kalan, dusulen }
  } catch {
    return null
  }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // yazılamasa da oturum içinde çalışır
  }
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern)
}

export function setupQada(container) {
  let data = load()
  let mode = data ? 'track' : 'empty' // 'empty' | 'setup' | 'track'

  function totalLeft() {
    return ITEMS.reduce((a, it) => a + data.kalan[it.k], 0)
  }

  function render(celebrateKey = null) {
    if (mode === 'empty') {
      container.innerHTML = `
        <div id="qada-card">
          <span class="qc-label">Kaza Takibi</span>
          <button type="button" id="qada-start">Kaza takibine başla ›</button>
        </div>`
      container.querySelector('#qada-start').addEventListener('click', () => {
        mode = 'setup'
        render()
      })
      return
    }
    if (mode === 'setup') {
      const rows = ITEMS.map(
        (it) => `
        <label class="qs-row">
          <span>${it.ad}</span>
          <input type="number" min="0" inputmode="numeric" data-k="${it.k}"
            value="${data ? data.kalan[it.k] : ''}" placeholder="0" />
        </label>`,
      ).join('')
      container.innerHTML = `
        <div id="qada-card">
          <span class="qc-label">Kaza Takibi — mevcut borcunuzu girin</span>
          <div id="qada-setup">${rows}</div>
          <p class="qc-note">Kaç kaza borcunuz olduğunu bilmiyorsanız müftülüğünüze danışın.</p>
          <div class="qs-actions">
            <button type="button" id="qada-save">Kaydet</button>
            ${data ? '<button type="button" id="qada-cancel">Vazgeç</button>' : ''}
          </div>
        </div>`
      container.querySelector('#qada-save').addEventListener('click', () => {
        const kalan = {}
        for (const inp of container.querySelectorAll('#qada-setup input')) {
          const v = Math.trunc(Number(inp.value))
          kalan[inp.dataset.k] = Number.isInteger(v) && v >= 0 ? v : 0
        }
        data = { kalan, dusulen: data ? data.dusulen : 0 }
        save(data)
        mode = 'track'
        render()
      })
      container.querySelector('#qada-cancel')?.addEventListener('click', () => {
        mode = 'track'
        render()
      })
      return
    }
    // track
    const left = totalLeft()
    const done = data.dusulen
    const pct = done + left > 0 ? Math.round((done / (done + left)) * 100) : 0
    const rows = ITEMS.map((it) => {
      const n = data.kalan[it.k]
      return `
      <div class="qt-item${n === 0 ? ' done' : ''}${celebrateKey === it.k ? ' celebrate' : ''}" data-k="${it.k}">
        <span class="qt-ad">${it.ad}</span>
        <span class="qt-n">${n}</span>
        <button type="button" class="qt-minus${n === 0 ? ' spent' : ''}" data-k="${it.k}"
          aria-label="${it.ad} kazası kıldım (geri almak için 1 sn basılı tutun)"
          aria-disabled="${n === 0}">−</button>
      </div>`
    }).join('')
    container.innerHTML = `
      <div id="qada-card">
        <span class="qc-top">
          <span class="qc-label">Kaza Takibi</span>
          <button type="button" id="qada-edit">Düzenle</button>
        </span>
        <div id="qada-items">${rows}</div>
        <div class="qc-progress"><div class="qc-bar" style="width:${pct}%"></div></div>
        <span class="qc-total">${left === 0 ? 'Tüm kaza borcu tamamlandı' : `Kalan toplam: ${left} · düşülen: ${done}`}</span>
      </div>`
    container.querySelector('#qada-edit').addEventListener('click', () => {
      mode = 'setup'
      render()
    })

    // − butonu: dokunuş = 1 düş; 1 sn basılı tutma = geri al (yalnız düşülen
    // varsa — kullanıcının girdiği borç merakla basılı tutunca ŞİŞMEZ).
    // 0'a inen kalemde buton disabled DEĞİL (bazı motorlar disabled'da pointer
    // olayı üretmez, geri alma erişilmez olurdu) — dokunuş zaten korumalı.
    // Tek aktif işaretçi izlenir: çoklu dokunuşta ikinci parmak yutulmuş ilk
    // zamanlayıcıyı sızdırıp hayalet geri-alma üretmesin.
    let active = null // { id, key, timer, fired }
    const itemsEl = container.querySelector('#qada-items')
    itemsEl.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.qt-minus')
      if (!btn || active) return
      const entry = { id: e.pointerId, key: btn.dataset.k, timer: null, fired: false }
      active = entry
      entry.timer = setTimeout(() => {
        entry.fired = true
        if (data.dusulen > 0) {
          // Geri alma: yanlışlıkla düşülen iade edilir
          data.kalan[entry.key]++
          data.dusulen--
          save(data)
          vibrate(20)
          render()
        }
      }, 1000)
    })
    itemsEl.addEventListener('pointerup', (e) => {
      if (!active || e.pointerId !== active.id) return
      const entry = active
      active = null
      clearTimeout(entry.timer)
      const btn = e.target.closest('.qt-minus')
      if (!btn || entry.fired || btn.dataset.k !== entry.key) return
      const k = entry.key
      if (data.kalan[k] <= 0) return
      data.kalan[k]--
      data.dusulen++
      save(data)
      if (data.kalan[k] === 0) {
        vibrate([30, 80, 30]) // kalem tamamlandı: abartısız kutlama
        render(k)
      } else {
        vibrate([15])
        render()
      }
    })
    for (const ev of ['pointercancel', 'pointerleave']) {
      itemsEl.addEventListener(ev, (e) => {
        if (active && e.pointerId === active.id) {
          clearTimeout(active.timer)
          active = null
        }
      })
    }
  }

  render()
}
