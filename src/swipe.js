// Sekmeler arası yatay swipe algılama (dokunmatik hedefli).
// Eşikler: yatay hareket ≥ 60px, yatay/dikey oran ≥ 2, süre ≤ 600ms.
// İstisna bölgeleri: üzerinde başlayan hareketler swipe sayılmaz.
const EXCLUDE_ZONES =
  '#dhikr-pad, #qibla-compass, #month-nav, #prayer-reader, #quran-reader, #quran-player'

export function setupSwipe(container, onSwipe) {
  let start = null // { x, y, t, id }

  container.addEventListener('pointerdown', (e) => {
    if (start !== null) return // ikinci parmak izlenen swipe'ı ezmesin
    if (e.pointerType === 'mouse') return // masaüstü sürükleme/seçim karışmasın
    if (e.target.closest(EXCLUDE_ZONES)) return
    start = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId }
  })

  container.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const dt = Date.now() - start.t
    start = null
    if (dt > 600) return
    if (Math.abs(dx) < 60) return
    if (Math.abs(dx) < 2 * Math.abs(dy)) return // dikey scroll ile çakışma koruması
    onSwipe(dx < 0 ? 1 : -1) // sola kaydır = sonraki, sağa = önceki
  })

  container.addEventListener('pointercancel', () => {
    start = null
  })
}
