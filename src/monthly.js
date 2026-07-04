// Aylık vakit tablosu: seçili ayın her günü için 6 vakit, ay gezintisi, bugün vurgusu.
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan'

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] // Date.getDay(): 0 = Pazar
const COLS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function setupMonthly(root, getLocation) {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() // 0-11
  let navigated = false // kullanıcı ‹/› kullanmadıysa görünüm takvimi izler

  root.innerHTML = `
    <div id="month-nav">
      <button id="month-prev" type="button" aria-label="Önceki ay">‹</button>
      <h2 id="month-title"></h2>
      <button id="month-next" type="button" aria-label="Sonraki ay">›</button>
    </div>
    <div id="month-wrap">
      <table id="month-table">
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">Tarih</span></th>
            <th scope="col" aria-label="İmsak">İms</th><th scope="col" aria-label="Güneş">Gün</th>
            <th scope="col" aria-label="Öğle">Öğl</th><th scope="col" aria-label="İkindi">İkn</th>
            <th scope="col" aria-label="Akşam">Akş</th><th scope="col" aria-label="Yatsı">Yat</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `
  const title = root.querySelector('#month-title')
  const tbody = root.querySelector('tbody')

  function render() {
    const loc = getLocation()
    const today = new Date()
    // Gece yarısı ay değiştiyse ve kullanıcı gezinmediyse yeni aya geç
    if (!navigated) {
      year = today.getFullYear()
      month = today.getMonth()
    }
    title.textContent = `${MONTHS_TR[month]} ${year}`
    const todayInView = today.getFullYear() === year && today.getMonth() === month
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    // Tek seferde render: satırlar DocumentFragment'ta toplanır
    const frag = document.createDocumentFragment()
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const pt = new PrayerTimes(new Coordinates(loc.lat, loc.lon), date, CalculationMethod.Turkey())
      const tr = document.createElement('tr')
      if (todayInView && day === today.getDate()) tr.className = 'today'
      const th = document.createElement('th')
      th.scope = 'row'
      th.textContent = `${day} ${DAYS_TR[date.getDay()]}`
      tr.appendChild(th)
      for (const key of COLS) {
        const td = document.createElement('td')
        td.textContent = timeFormat.format(pt[key])
        tr.appendChild(td)
      }
      frag.appendChild(tr)
    }
    tbody.replaceChildren(frag)
  }

  function shiftMonth(delta) {
    navigated = true
    month += delta
    if (month < 0) {
      month = 11
      year--
    } else if (month > 11) {
      month = 0
      year++
    }
    render()
  }

  root.querySelector('#month-prev').addEventListener('click', () => shiftMonth(-1))
  root.querySelector('#month-next').addEventListener('click', () => shiftMonth(1))

  function scrollToToday() {
    tbody.querySelector('tr.today')?.scrollIntoView({ block: 'center' })
  }

  render()
  return { render, scrollToToday }
}
