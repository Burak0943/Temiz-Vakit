// Günün Ayeti: seçki YOK — tüm Kur'an'dan deterministik formülle seçilir:
//   küreselAyetNo = ((yılınGünü * 17) % 6236) + 1   (6236 = toplam ayet)
// Aynı gün herkes aynı ayeti görür. Metin+meal API'den (içerik kuralı) gelir,
// localStorage'a önbelleklenir; offline'da son çekilen gösterilir.
const KEY = 'tv_gunun_ayeti'
const BASE = 'https://api.alquran.cloud/v1'

// esma.js ile aynı DST-güvenli gün hesabı (UTC aritmetiği)
function dayOfYear(date) {
  return Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 0)) /
      86400000,
  )
}

export function gununAyetiNo(date) {
  return ((dayOfYear(date) * 17) % 6236) + 1
}

function loadCache() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY))
    return o && typeof o === 'object' ? o : null
  } catch {
    return null
  }
}

export function setupGununAyeti(container, openAyah) {
  container.innerHTML = `
    <button type="button" id="ayet-card" hidden>
      <span class="ec-top">
        <span class="ec-label">Günün Ayeti</span>
        <span class="hc-more" id="ayet-ref"></span>
      </span>
      <span id="ayet-ar" dir="rtl" lang="ar"></span>
      <span id="ayet-meal"></span>
    </button>
  `
  const card = container.querySelector('#ayet-card')

  function show(d) {
    card.hidden = false
    container.querySelector('#ayet-ref').textContent = `${d.surah}:${d.ayah} ›`
    container.querySelector('#ayet-ar').textContent = d.arapca
    container.querySelector('#ayet-meal').textContent = d.meal || ''
    card.onclick = () => openAyah(d.surah, d.ayah)
  }

  async function render() {
    const no = gununAyetiNo(new Date())
    const cached = loadCache()
    if (cached && cached.no === no) {
      show(cached)
      return
    }
    // Önce bayat önbellek gösterilir (offline'da boş kalmasın), ağ gelince tazelenir
    if (cached) show(cached)
    try {
      const [ar, meal] = await Promise.all([
        fetch(`${BASE}/ayah/${no}`).then((r) => r.json()),
        fetch(`${BASE}/ayah/${no}/tr.diyanet`).then((r) => r.json()),
      ])
      if (ar.code !== 200 || !ar.data) return
      const d = {
        no,
        arapca: ar.data.text,
        meal: meal?.data?.text ?? null,
        surah: ar.data.surah.number,
        ayah: ar.data.numberInSurah,
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(d))
      } catch {
        // önbelleklenemese de gösterilir
      }
      show(d)
    } catch {
      // ağ yok: bayat önbellek zaten ekranda; hiç yoksa kart gizli kalır
    }
  }

  render()
  return { render } // gece yarısı geçişinde tazelenebilsin
}
