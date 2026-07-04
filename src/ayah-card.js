// Ayet kartı: Kur'an okuma ekranı ile Nazar bölümünün ORTAK bileşeni.
// API kaynaklı metinler innerHTML yerine textContent ile basılır.
export function createAyahCard(a, surahNumber, onPlay) {
  const card = document.createElement('article')
  card.className = 'ayah-card'
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
  label.textContent = `${surahNumber}:${a.no}`
  meta.appendChild(label)
  if (a.ses && onPlay) {
    const playBtn = document.createElement('button')
    playBtn.type = 'button'
    playBtn.className = 'ayah-play'
    playBtn.setAttribute('aria-label', `Ayet ${a.no} sesini oynat`)
    // Salt ikon bulunamıyordu (kullanıcı gözlemi): ikon + "Dinle" etiketi
    playBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg><span class="ayah-play-label">Dinle</span>'
    playBtn.addEventListener('click', onPlay)
    meta.appendChild(playBtn)
  }
  card.appendChild(meta)
  return card
}
