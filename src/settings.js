// Ayarlar: tam ekran alt-görünüm (Vakitler başlığındaki dişliden açılır,
// history'ye kayıtlı — geri tuşu çalışır). Değişiklikler ANINDA uygulanır.
// Yazı boyutu satırları, okuma ekranlarındaki yerinde A-/A+ kontrolleriyle
// AYNI localStorage anahtarlarına yazar (dhikr.js / quran.js adım dizilerinin
// aynası); okuma ekranları açılırken anahtarı yeniden okur.
import { version } from '../package.json'
import { NOTIFY_PRAYERS, NOTIFY_OFFSETS } from './notifications.js'

const FONT_KEY = 'tv_fontsize'
const FONT_STEPS = [16, 20, 24, 28] // dhikr.js FONT_STEPS aynası
const AR_FONT_KEY = 'tv_arfontsize'
const AR_FONT_STEPS = [22, 26, 30, 34] // quran.js AR_FONT_STEPS aynası

// Yedek kapsamı: tüm kullanıcı verisi localStorage'dadır (kaldığın-yer
// konumları dahil). IndexedDB yalnız yeniden indirilebilir Kur'an metni
// önbelleği tuttuğundan BİLİNÇLİ olarak yedeğe girmez.
const BACKUP_KEYS = [
  'tv_prayers',
  'tv_dhikr',
  'tv_qada',
  'tv_fontsize',
  'tv_arfontsize',
  'tv_quran_surahs',
  'tv_quran_pos',
  'tv_cevsen_pos',
  'tv_geo_name',
  'tv_onboarded',
  'tv_hatim',
  'tv_quran_juz',
  'tv_gunun_ayeti',
  'tv_notify',
]

// Boyut tavanları: dürüst veri en fazla yüzlerce KB'dir; dev değerli hazırlanmış
// yedek, kota hatasıyla kısmi yazım tetikleyip depoyu kilitleyebilirdi
const MAX_FILE_BYTES = 1_000_000
const MAX_VALUE_BYTES = 512_000

// Anahtar başına ŞEKİL doğrulaması: yalnız tip kontrolü, hazırlanmış bir
// yedeğin (ör. tv_prayers gün değeri dizi değilken) açılışta ana ekranı
// çökertmesine yetmiyordu. Doğrulayıcı fırlatırsa/false dönerse dosya reddedilir.
const VALIDATORS = {
  tv_prayers: (s) => {
    const o = JSON.parse(s)
    return (
      o && typeof o === 'object' && !Array.isArray(o) &&
      Object.values(o).every((v) => Array.isArray(v) && v.every((x) => typeof x === 'string'))
    )
  },
  tv_dhikr: (s) => {
    const o = JSON.parse(s)
    return o && typeof o === 'object' && !Array.isArray(o)
  },
  tv_qada: (s) => {
    const o = JSON.parse(s)
    return o && typeof o === 'object' && o.kalan && typeof o.kalan === 'object'
  },
  tv_fontsize: (s) => /^\d{1,3}$/.test(s),
  tv_arfontsize: (s) => /^\d{1,3}$/.test(s),
  tv_quran_surahs: (s) => Array.isArray(JSON.parse(s)),
  tv_quran_pos: (s) => {
    const o = JSON.parse(s)
    return o && Number.isInteger(o.surah) && Number.isInteger(o.ayah)
  },
  tv_cevsen_pos: (s) => {
    const o = JSON.parse(s)
    return o && typeof o === 'object' && !Array.isArray(o)
  },
  tv_geo_name: (s) => {
    const o = JSON.parse(s)
    return o && typeof o === 'object' && typeof o.name === 'string'
  },
  tv_onboarded: (s) => s === '1',
  tv_hatim: (s) => {
    const o = JSON.parse(s)
    // Sure numaraları 1..114 ve en çok 114 kayıt: hazırlanmış dev dizi
    // "%74561" gibi anlamsız ilerleme göstermesin
    return (
      o &&
      Array.isArray(o.okundu) &&
      o.okundu.length <= 114 &&
      o.okundu.every((x) => Number.isInteger(x) && x >= 1 && x <= 114)
    )
  },
  tv_quran_juz: (s) => {
    const o = JSON.parse(s)
    // Yalnız uzunluk değil, her girdinin şekli de doğrulanır: bozuk-ama-30
    // önbellek openSurah(undefined) tetikliyordu
    return (
      Array.isArray(o) &&
      o.length === 30 &&
      o.every((j) => j && Number.isInteger(j.surah) && Number.isInteger(j.ayah))
    )
  },
  tv_gunun_ayeti: (s) => {
    const o = JSON.parse(s)
    // surah/ayah da doğrulanır: eksikse kart "undefined:undefined" gösterip
    // tıklamada /surah/undefined isteğine düşüyordu
    return (
      o &&
      typeof o === 'object' &&
      Number.isInteger(o.no) &&
      Number.isInteger(o.surah) &&
      Number.isInteger(o.ayah)
    )
  },
  tv_notify: (s) => {
    const o = JSON.parse(s)
    return o && typeof o === 'object' && !Array.isArray(o)
  },
}

const KAYNAKLAR = [
  'Diyanet İşleri Başkanlığı yayınları — namaz duaları',
  "AlQuran Cloud ve quran.com — Kur'an metni, meali, sesi ve Türkçe sure adları",
  'Hayrat Neşriyat — Cevşen hat sayfaları (izinli kullanım)',
  'OpenStreetMap Nominatim — konum adı',
  'suresioku.com — Esmaül Hüsna adları ve anlamları',
]

function readStep(key, steps) {
  try {
    const v = Number(localStorage.getItem(key))
    return steps.includes(v) ? v : steps[1]
  } catch {
    return steps[1]
  }
}

function writeStep(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // kalıcılaşmasa da bu oturumda uygulanır
  }
}

export function setupSettings(
  root,
  { getLocationLabel, updateLocation, showOnboarding, onBack, notifications },
) {
  const notify = notifications
  const offsetLabel = (n) => (n === 0 ? 'Vaktinde' : `${n} dakika önce`)
  root.innerHTML = `
    <button type="button" id="settings-back">‹ Geri</button>
    <h2>Ayarlar</h2>

    <h3 class="set-section">Konum</h3>
    <div class="set-row">
      <span id="set-location"></span>
      <button type="button" id="set-location-update">Konumu Güncelle</button>
    </div>
    <p id="set-location-note" class="set-note" hidden></p>

    <h3 class="set-section">Görünüm</h3>
    <div class="set-row">
      <span>Dua yazı boyutu</span>
      <span class="set-stepper">
        <button type="button" id="set-font-minus" aria-label="Dua yazısını küçült">A−</button>
        <span id="set-font-value"></span>
        <button type="button" id="set-font-plus" aria-label="Dua yazısını büyüt">A+</button>
      </span>
    </div>
    <div class="set-row">
      <span>Kur'an Arapça boyutu</span>
      <span class="set-stepper">
        <button type="button" id="set-ar-minus" aria-label="Arapça yazıyı küçült">A−</button>
        <span id="set-ar-value"></span>
        <button type="button" id="set-ar-plus" aria-label="Arapça yazıyı büyüt">A+</button>
      </span>
    </div>

    <h3 class="set-section">Bildirimler</h3>
    <div class="set-row">
      <span>Vakit bildirimleri</span>
      <button type="button" id="notif-master" role="switch" aria-checked="false">Kapalı</button>
    </div>
    <div id="notif-detail" hidden>
      <p class="set-note">Hatırlatma zamanı</p>
      <div id="notif-offset" class="set-seg" role="group" aria-label="Hatırlatma zamanı"></div>
      <p class="set-note">Bildirilecek vakitler</p>
      <div id="notif-prayers"></div>
    </div>
    <p id="notif-status" class="set-note" hidden></p>
    <p class="set-note">Uygulama kapalıyken bildirim için sunucu altyapısı yakında. Şimdilik bildirimler yalnız uygulama açıkken gelir.</p>

    <h3 class="set-section">Veriler</h3>
    <div class="set-row">
      <span>Verilerimi Yedekle</span>
      <button type="button" id="set-backup">İndir</button>
    </div>
    <div class="set-row">
      <span>Yedekten Geri Yükle</span>
      <button type="button" id="set-restore">Dosya Seç</button>
      <input type="file" id="set-restore-file" accept="application/json,.json" hidden />
    </div>
    <div class="set-row">
      <span>Hatim ilerlemesini sıfırla</span>
      <button type="button" id="set-hatim-reset">Sıfırla</button>
    </div>
    <p id="set-backup-note" class="set-note" hidden></p>

    <h3 class="set-section">Hakkında ve Kaynaklar</h3>
    <div class="set-about">
      <p id="set-version"></p>
      <ul id="set-sources"></ul>
      <p class="footnote">Vakitler astronomik hesapla üretilir; Diyanet takviminden ±1 dk farkedebilir.</p>
    </div>
    <div class="set-row">
      <button type="button" id="set-privacy-toggle" class="set-link">Gizlilik</button>
    </div>
    <div id="set-privacy" class="set-about" hidden>
      <p>Verileriniz (namaz işaretleri, zikir sayaçları, kaza takibi, okuma konumları, tercihler) yalnız bu cihazda tutulur. Sunucumuz, hesabınız veya bizde saklanan bir veriniz yoktur.</p>
      <p>Konumunuz yalnız vakit hesabı için kullanılır; yer adını göstermek için koordinatlarınız OpenStreetMap Nominatim servisine gönderilir. Kur'an metin/ses ve Cevşen sayfaları ilgili servislerden indirilir.</p>
      <p>Uygulamada reklam ve üçüncü taraf izleme yoktur.</p>
    </div>
    <div class="set-row">
      <a id="set-feedback" class="set-link" href="mailto:nurvaktiapp@gmail.com?subject=Nur%20Vakti%20G%C3%B6r%C3%BC%C5%9F">Görüş Bildir</a>
    </div>

    <div class="set-row">
      <button type="button" id="set-onboarding" class="set-link">İlk tanıtımı tekrar göster</button>
    </div>
  `

  root.querySelector('#settings-back').addEventListener('click', () => onBack())
  root.querySelector('#set-location-update').addEventListener('click', () => {
    setLocationNote('Güncelleniyor…') // sonuç main.js geri çağrılarıyla yazılır
    updateLocation()
  })
  root.querySelector('#set-onboarding').addEventListener('click', () => showOnboarding())

  root.querySelector('#set-version').textContent = `Nur Vakti · sürüm ${version}`
  const srcList = root.querySelector('#set-sources')
  for (const k of KAYNAKLAR) {
    const li = document.createElement('li')
    li.textContent = k
    srcList.appendChild(li)
  }

  function renderFonts() {
    const f = readStep(FONT_KEY, FONT_STEPS)
    const a = readStep(AR_FONT_KEY, AR_FONT_STEPS)
    root.querySelector('#set-font-value').textContent = f
    root.querySelector('#set-ar-value').textContent = a
    root.querySelector('#set-font-minus').classList.toggle('limit', f === FONT_STEPS[0])
    root.querySelector('#set-font-plus').classList.toggle('limit', f === FONT_STEPS[FONT_STEPS.length - 1])
    root.querySelector('#set-ar-minus').classList.toggle('limit', a === AR_FONT_STEPS[0])
    root.querySelector('#set-ar-plus').classList.toggle('limit', a === AR_FONT_STEPS[AR_FONT_STEPS.length - 1])
  }

  function step(key, steps, dir) {
    const cur = readStep(key, steps)
    const idx = steps.indexOf(cur) + dir
    if (idx < 0 || idx >= steps.length) return
    writeStep(key, steps[idx])
    renderFonts()
    // Açık okuma ekranları anında uygulasın (dhikr.js/quran.js dinler)
    window.dispatchEvent(new CustomEvent('tv-font-change'))
  }
  root.querySelector('#set-font-minus').addEventListener('click', () => step(FONT_KEY, FONT_STEPS, -1))
  root.querySelector('#set-font-plus').addEventListener('click', () => step(FONT_KEY, FONT_STEPS, 1))
  root.querySelector('#set-ar-minus').addEventListener('click', () => step(AR_FONT_KEY, AR_FONT_STEPS, -1))
  root.querySelector('#set-ar-plus').addEventListener('click', () => step(AR_FONT_KEY, AR_FONT_STEPS, 1))

  // --- Yedekleme / geri yükleme ---
  function backupNote(text) {
    const el = root.querySelector('#set-backup-note')
    el.textContent = text
    el.hidden = !text
  }

  root.querySelector('#set-backup').addEventListener('click', () => {
    const veriler = {}
    try {
      for (const k of BACKUP_KEYS) {
        const v = localStorage.getItem(k)
        if (v != null) veriler[k] = v // ham dize: kayıpsız gidiş-dönüş
      }
    } catch {
      backupNote('Depolamaya erişilemedi; yedek alınamadı.')
      return
    }
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const tarih = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const dosya = {
      uygulama: 'temiz-vakit',
      surum: version, // ileri uyumluluk alanı
      tarih,
      veriler,
    }
    const blob = new Blob([JSON.stringify(dosya, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `nur-vakti-yedek-${tarih}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    backupNote(`Yedek indirildi (${Object.keys(veriler).length} kayıt).`)
  })

  const fileInput = root.querySelector('#set-restore-file')
  root.querySelector('#set-restore').addEventListener('click', () => {
    fileInput.value = '' // aynı dosya ikinci kez seçilebilsin
    fileInput.click()
  })
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length > MAX_FILE_BYTES) {
        backupNote('Dosya reddedildi: yedek dosyası olamayacak kadar büyük.')
        return
      }
      let dosya
      try {
        dosya = JSON.parse(reader.result)
      } catch {
        backupNote('Dosya okunamadı: geçerli bir yedek dosyası değil.')
        return
      }
      // Şema doğrulaması: uygulama imzası + yalnız bilinen anahtarlar
      if (dosya?.uygulama !== 'temiz-vakit' || typeof dosya.veriler !== 'object' || dosya.veriler === null) {
        backupNote('Dosya tanınmadı: Nur Vakti yedeği değil.')
        return
      }
      const keys = Object.keys(dosya.veriler)
      const yabanci = keys.filter((k) => !BACKUP_KEYS.includes(k))
      if (yabanci.length) {
        backupNote(`Dosya reddedildi: bilinmeyen alan (${yabanci[0]}).`)
        return
      }
      // Tip + boyut + ŞEKİL: bozuk kayıt uygulamayı açılışta çökertmesin
      for (const k of keys) {
        const v = dosya.veriler[k]
        let gecerli = typeof v === 'string' && v.length <= MAX_VALUE_BYTES
        if (gecerli) {
          try {
            gecerli = VALIDATORS[k](v) === true
          } catch {
            gecerli = false
          }
        }
        if (!gecerli) {
          backupNote(`Dosya reddedildi: bozuk kayıt (${k}).`)
          return
        }
      }
      // İçe aktarma ÖNCESİ onay
      if (!window.confirm('Mevcut veriler yedekteki verilerle değiştirilecek. Devam edilsin mi?')) {
        backupNote('Geri yükleme iptal edildi.')
        return
      }
      // localStorage işlemsizdir: yazım öncesi anlık görüntü alınır, hata
      // ortada patlarsa geri sarılır — kısmi/karışık durum bırakılmaz
      const eski = {}
      try {
        for (const k of BACKUP_KEYS) eski[k] = localStorage.getItem(k)
      } catch {
        backupNote('Depolamaya erişilemedi; geri yükleme yapılmadı.')
        return
      }
      try {
        for (const k of keys) localStorage.setItem(k, dosya.veriler[k])
      } catch {
        try {
          for (const k of BACKUP_KEYS) {
            if (eski[k] == null) localStorage.removeItem(k)
            else localStorage.setItem(k, eski[k])
          }
          backupNote('Depolamaya yazılamadı; önceki veriler geri getirildi.')
        } catch {
          backupNote('Depolamaya yazılamadı; geri yükleme tamamlanamadı.')
        }
        return
      }
      backupNote('Geri yüklendi; uygulama yenileniyor…')
      // Tüm modüller yeni veriyle baştan kurulsun
      setTimeout(() => window.location.reload(), 600)
    }
    reader.onerror = () => backupNote('Dosya okunamadı.')
    reader.readAsText(f)
  })

  root.querySelector('#set-hatim-reset').addEventListener('click', () => {
    if (!window.confirm('Hatim ilerlemesi (okundu işaretleri) silinecek. Devam edilsin mi?')) return
    try {
      localStorage.removeItem('tv_hatim')
      backupNote('Hatim ilerlemesi sıfırlandı; uygulama yenileniyor…')
      setTimeout(() => window.location.reload(), 600)
    } catch {
      backupNote('Sıfırlanamadı: depolamaya erişilemedi.')
    }
  })

  root.querySelector('#set-privacy-toggle').addEventListener('click', () => {
    const p = root.querySelector('#set-privacy')
    p.hidden = !p.hidden
  })

  // --- Bildirimler bölümü ---
  const notifMaster = root.querySelector('#notif-master')
  const notifDetail = root.querySelector('#notif-detail')
  const notifStatus = root.querySelector('#notif-status')

  // Offset segmenti ve vakit anahtarları bir kez kurulur
  const offsetSeg = root.querySelector('#notif-offset')
  offsetSeg.append(
    ...NOTIFY_OFFSETS.map((n) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.offset = n
      b.textContent = offsetLabel(n)
      b.addEventListener('click', () => {
        notify.setOffset(n)
        renderNotif()
      })
      return b
    }),
  )
  const prayersWrap = root.querySelector('#notif-prayers')
  for (const p of NOTIFY_PRAYERS) {
    const row = document.createElement('div')
    row.className = 'set-row'
    const label = document.createElement('span')
    label.textContent = p.ad
    const tog = document.createElement('button')
    tog.type = 'button'
    tog.setAttribute('role', 'switch')
    tog.dataset.prayer = p.key
    tog.addEventListener('click', () => {
      const on = notify.getPrefs().prayers[p.key]
      notify.setPrayer(p.key, !on)
      renderNotif()
    })
    row.append(label, tog)
    prayersWrap.appendChild(row)
  }

  notifMaster.addEventListener('click', async () => {
    const prefs = notify.getPrefs()
    if (prefs.enabled) {
      notify.disable()
      renderNotif()
      return
    }
    const perm = await notify.requestEnable()
    if (perm === 'unsupported') notifStatus.textContent = 'Bu tarayıcı bildirimleri desteklemiyor.'
    else if (perm === 'denied') notifStatus.textContent = 'Bildirim izni reddedildi. Tarayıcı ayarlarından açabilirsiniz.'
    else notifStatus.textContent = ''
    renderNotif()
  })

  function renderNotif() {
    const prefs = notify.getPrefs()
    const perm = notify.permission()
    notifMaster.textContent = prefs.enabled ? 'Açık' : 'Kapalı'
    notifMaster.classList.toggle('on', prefs.enabled)
    notifMaster.setAttribute('aria-checked', prefs.enabled)
    notifDetail.hidden = !prefs.enabled
    notifStatus.hidden = !notifStatus.textContent
    for (const b of offsetSeg.children) {
      const active = Number(b.dataset.offset) === prefs.offset
      b.classList.toggle('active', active)
      b.setAttribute('aria-pressed', active)
    }
    for (const t of prayersWrap.querySelectorAll('[data-prayer]')) {
      const on = prefs.prayers[t.dataset.prayer]
      t.textContent = on ? 'Açık' : 'Kapalı'
      t.classList.toggle('on', on)
      t.setAttribute('aria-checked', on)
    }
    if (perm === 'denied' && !prefs.enabled && !notifStatus.textContent) {
      // izin reddedilmişse kalıcı bilgi
    }
  }

  function renderLocation() {
    root.querySelector('#set-location').textContent = getLocationLabel()
  }

  function setLocationNote(text) {
    const el = root.querySelector('#set-location-note')
    el.textContent = text
    el.hidden = !text
  }

  return {
    setLocationNote, // konum güncelleme sonucu Ayarlar İÇİNDE görünsün
    // Görünüm her açıldığında canlı değerlerle tazelenir
    render() {
      renderLocation()
      renderFonts()
      renderNotif()
    },
    renderLocation, // konum çözümü asenkron bittiğinde de tazelensin
  }
}
