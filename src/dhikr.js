// Zikirmatik: büyük dokunma alanı, hedef (33/99/serbest), 1 sn basılı tutmalı sıfırlama.
// Durum localStorage "tv_dhikr" -> { count, target } (target 0 = serbest)

const STORAGE_KEY = 'tv_dhikr'
const TARGETS = [33, 99, 0]

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

  // İşaretçi için tek olay tipi: pointerdown. Klavye ayrı keydown yolundan sayılır;
  // preventDefault tarayıcının sentezleyeceği click'i bastırır, böylece hiçbir
  // girişte ikinci bir tetiklenme yolu kalmaz.
  // isPrimary KULLANILMIYOR: dokunmada isPrimary belge genelidir — ekranın başka
  // yerine yaslanan parmak/avuç pad dokunuşlarını sessizce düşürürdü. Pad'in kendi
  // aktif işaretçisi takip edilir: pad üstündeki eşzamanlı ikinci parmak sayılmaz.
  let activePointerId = null
  pad.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return // sağ/orta tık sayılmaz
    if (activePointerId !== null) return // pad üstünde ikinci parmak sayılmaz
    activePointerId = e.pointerId
    try {
      pad.setPointerCapture(e.pointerId) // up/cancel pad dışında bitse de yakalanır
    } catch {
      // sentetik/etkin olmayan işaretçi: yakalama şart değil
    }
    increment()
  })
  const releasePointer = (e) => {
    if (e.pointerId === activePointerId) activePointerId = null
  }
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    pad.addEventListener(ev, releasePointer)
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

  render()
}
