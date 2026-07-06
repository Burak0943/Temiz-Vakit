// Ayet kartı: Kur'an okuma ekranı ile Nazar bölümünün ORTAK bileşeni.
// API kaynaklı metinler innerHTML yerine textContent ile basılır.
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d])

export function createAyahCard(a, surahNumber, onPlay, onShare, onFav, isFav) {
  const card = document.createElement('article')
  card.className = 'ayah-card'
  const ar = document.createElement('p')
  ar.className = 'ayah-ar'
  ar.dir = 'rtl'
  ar.lang = 'ar'
  ar.textContent = a.arapca
  // Mushaf usulü ayet sonu işareti: süslü parantez içinde Arapça rakam (yalnız
  // sıra numarası — dini metin değil; textContent ile eklenir)
  const marker = document.createElement('span')
  marker.className = 'ayah-num'
  marker.textContent = ` ﴿${toArabicDigits(a.no)}﴾`
  ar.appendChild(marker)
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
  const actions = document.createElement('span')
  actions.className = 'ayah-actions'
  if (onFav) {
    const favBtn = document.createElement('button')
    favBtn.type = 'button'
    favBtn.className = `ayah-fav${isFav ? ' on' : ''}`
    favBtn.setAttribute('aria-label', `Ayet ${a.no} favori`)
    favBtn.setAttribute('aria-pressed', isFav ? 'true' : 'false')
    favBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.3l-5.4 3 1-6-4.4-4.2 6-.9L12 3.8l2.8 5.4 6 .9-4.4 4.2 1 6z"/></svg>'
    favBtn.addEventListener('click', () => {
      const nowOn = onFav() // çağıran taraf toggle eder, YENİ durumu döndürür
      favBtn.classList.toggle('on', nowOn)
      favBtn.setAttribute('aria-pressed', nowOn ? 'true' : 'false')
    })
    actions.appendChild(favBtn)
  }
  if (onShare) {
    const shareBtn = document.createElement('button')
    shareBtn.type = 'button'
    shareBtn.className = 'ayah-share-btn'
    shareBtn.setAttribute('aria-label', `Ayet ${a.no} görselini paylaş`)
    shareBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg><span class="ayah-btn-label">Paylaş</span>'
    shareBtn.addEventListener('click', onShare)
    actions.appendChild(shareBtn)
  }
  if (a.ses && onPlay) {
    const playBtn = document.createElement('button')
    playBtn.type = 'button'
    playBtn.className = 'ayah-play'
    playBtn.setAttribute('aria-label', `Ayet ${a.no} sesini oynat`)
    // Salt ikon bulunamıyordu (kullanıcı gözlemi): ikon + "Dinle" etiketi
    playBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg><span class="ayah-btn-label">Dinle</span>'
    playBtn.addEventListener('click', onPlay)
    actions.appendChild(playBtn)
  }
  meta.appendChild(actions)
  card.appendChild(meta)
  return card
}
