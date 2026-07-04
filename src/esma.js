// Esmaül Hüsna: günün esması (yılın günü mod 99 — herkes aynı günü görür)
// ve 99'unun tam liste alt-görünümü. Veriler esma-data.js'ten (API kaynaklı).
import { ESMA_DATA } from './esma-data.js'

// Yılın günü (1 Ocak = 1). Tarih parametreli — gün sınırı testleri için.
// UTC aritmetiği: DST uygulayan dilimlerde yerel fark 24 saatin katı olmaz,
// yerel hesap gece yarısı-01:00 arasında önceki günü verirdi.
export function esmaIndexForDate(date) {
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 0)) /
      86400000,
  )
  return dayOfYear % 99 // 0..98 dizini
}

export function esmaForDate(date) {
  return ESMA_DATA[esmaIndexForDate(date)]
}

export function setupEsma(root, onBack) {
  root.innerHTML = `
    <button type="button" id="esma-back">‹ Geri</button>
    <h2>Esmaül Hüsna</h2>
    <ul id="esma-list"></ul>
    <p class="footnote">Adlar ve anlamlar: suresioku.com Esmaül Hüsna listesi (67. isim hariç) · Arapça ve 67. isim: AlAdhan API</p>
  `
  if (onBack) root.querySelector('#esma-back').addEventListener('click', onBack)

  const frag = document.createDocumentFragment()
  for (const e of ESMA_DATA) {
    const li = document.createElement('li')
    const no = document.createElement('span')
    no.className = 'e-no'
    no.textContent = e.no
    const latin = document.createElement('span')
    latin.className = 'e-latin'
    latin.textContent = e.latin
    const ar = document.createElement('span')
    ar.className = 'e-ar'
    ar.dir = 'rtl'
    ar.lang = 'ar'
    ar.textContent = e.arapca
    li.append(no, latin, ar)
    const anlam = document.createElement('span')
    anlam.className = 'e-anlam'
    // Kaynakta bulunmayan girdi için açıklayıcı not — anlam uydurulmaz
    anlam.textContent = e.anlam || 'Bu ismin anlamı kaynak listede bulunmuyor.'
    li.appendChild(anlam)
    frag.appendChild(li)
  }
  root.querySelector('#esma-list').replaceChildren(frag)
}
