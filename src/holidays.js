// Dini günler: hicri sabit tarihlerden miladi karşılıkları hesaplar (24 ay ileri).
// Tarihler ezber değil: Intl'in islamic-umalqura takvimiyle gün gün taranır.

const HIJRI_HOLIDAYS = [
  { m: 1, d: 1, name: 'Hicri Yılbaşı', night: false },
  { m: 1, d: 10, name: 'Aşure Günü', night: false },
  { m: 3, d: 11, name: 'Mevlid Kandili', night: true },
  { m: 7, d: 1, name: 'Üç Ayların Başlangıcı', night: false },
  { m: 7, d: 26, name: 'Miraç Kandili', night: true },
  { m: 8, d: 14, name: 'Berat Kandili', night: true },
  { m: 9, d: 1, name: 'Ramazan Başlangıcı', night: false },
  { m: 9, d: 26, name: 'Kadir Gecesi', night: true },
  { m: 10, d: 1, name: 'Ramazan Bayramı (1. gün)', night: false },
  { m: 12, d: 9, name: 'Kurban Bayramı Arefesi', night: false },
  { m: 12, d: 10, name: 'Kurban Bayramı (1. gün)', night: false },
]

const hijriFormat = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  weekday: 'long',
})

export function toHijri(date) {
  const parts = hijriFormat.formatToParts(date)
  const num = (type) => Number(parts.find((p) => p.type === type).value)
  return { day: num('day'), month: num('month'), year: num('year') }
}

// tr locale CLDR'ı hicri ay adlarını Türkçe verir (Muharrem, Safer, ...)
const hijriDisplayFormat = new Intl.DateTimeFormat('tr-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatHijriDate(date) {
  const parts = hijriDisplayFormat.formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')} ${get('month')} ${get('year')}` // "Hicri" era öneki atlanır
}

// from gününden 24 ay ilerisine kadar dini günler, kronolojik.
// Geriye 15 günlük pay: ay başı çapaları (ör. Regaib için 1 Recep) geçmişte
// kalsa da türetilen gün bugünden sonraysa listeye girer.
export function computeEvents(from = new Date()) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const scanStart = new Date(start)
  scanStart.setDate(scanStart.getDate() - 15)
  const scanEnd = new Date(start)
  scanEnd.setMonth(scanEnd.getMonth() + 24)

  const events = []
  for (const d = new Date(scanStart); d <= scanEnd; d.setDate(d.getDate() + 1)) {
    const h = toHijri(d)
    for (const hol of HIJRI_HOLIDAYS) {
      if (h.month === hol.m && h.day === hol.d) events.push({ ...hol, date: new Date(d) })
    }
    if (h.month === 7 && h.day === 1) {
      // Regaib: Recep'in ilk Cuma gecesi = ilk Cuma'nın arifesindeki Perşembe akşamı.
      // 1 Recep Cuma'ya denk gelirse kandil 1 Recep'ten ÖNCEKİ Perşembe'dir
      // (Diyanet 2019 emsali: Regaib 7 Mart Perşembe, 1 Recep 8 Mart Cuma).
      const t = new Date(d)
      while (t.getDay() !== 5) t.setDate(t.getDate() + 1)
      t.setDate(t.getDate() - 1)
      events.push({ name: 'Regaib Kandili', night: true, date: t })
    }
  }
  return events.filter((e) => e.date >= start).sort((a, b) => a.date - b.date)
}

export function daysLeft(eventDate, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((eventDate - today) / 86400000)
}

function dateLabel(event) {
  // Kandiller bir önceki günün akşamı başlar; tarih o akşamın günü gösterilir
  return dateFormat.format(event.date) + (event.night ? ' (akşamı)' : '')
}

function leftLabel(days) {
  return days === 0 ? 'Bugün' : `${days} gün kaldı`
}

export function setupHolidays(root) {
  root.innerHTML = `
    <h2>Dini Günler</h2>
    <div id="next-holiday">
      <p id="nh-name"></p>
      <p id="nh-date"></p>
      <p id="nh-left"></p>
    </div>
    <ul id="holiday-list"></ul>
    <p class="footnote">Dini gün tarihleri hicri hesaba dayanır; Diyanet duyurusuyla 1 gün farkedebilir.</p>
  `

  function render() {
    const events = computeEvents()
    const next = events[0]
    if (next) {
      root.querySelector('#nh-name').textContent = next.name
      root.querySelector('#nh-date').textContent = dateLabel(next)
      root.querySelector('#nh-left').textContent = leftLabel(daysLeft(next.date))
    }
    const frag = document.createDocumentFragment()
    for (const e of events) {
      const li = document.createElement('li')
      const name = document.createElement('span')
      name.className = 'h-name'
      name.textContent = e.name
      const date = document.createElement('span')
      date.className = 'h-date'
      date.textContent = dateLabel(e)
      const left = document.createElement('span')
      left.className = 'h-left'
      left.textContent = leftLabel(daysLeft(e.date))
      li.append(name, date, left)
      frag.appendChild(li)
    }
    root.querySelector('#holiday-list').replaceChildren(frag)
  }

  render()
  return { render }
}
