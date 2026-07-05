// Ekran uyanık tutma (Screen Wake Lock): Kur'an/Cevşen okuma ekranları ve
// sesli oynatma sırasında ekran sönmesin. Desteklemeyen tarayıcıda sessiz geç.
// Referans sayacı: okuyucu ve oynatıcı bağımsız istekçilerdir — biri kapanınca
// diğeri hâlâ istiyorsa kilit bırakılmaz.
let lock = null
let acquiring = false // request() uçuşta: eşzamanlı ikinci acquire açılmasın
let wanted = 0

async function acquire() {
  if (lock || acquiring) return
  acquiring = true
  let l = null
  try {
    l = await navigator.wakeLock.request('screen')
  } catch {
    acquiring = false // izin/destek yoksa sessiz
    return
  }
  acquiring = false
  // Bekleme sırasında istek düştüyse (hızlı ref→unref) kilidi hemen bırak —
  // yoksa wanted=0 iken tutulu kalır ve hiçbir yol onu bırakmaz (sızıntı).
  if (wanted === 0) {
    l.release().catch(() => {})
    return
  }
  lock = l
  lock.addEventListener('release', () => {
    // Kimlik koruması: yalnız BU kilit hâlâ aktifse referansı düşür. Bayat bir
    // kilidin gecikmeli release olayı, yerine geçen canlı kilidi null'lamasın.
    if (lock === l) lock = null
  })
}

function sync() {
  if (!('wakeLock' in navigator)) return
  if (wanted > 0) {
    if (!lock && !acquiring) acquire()
  } else if (lock) {
    // Önce referansı düşür ki release olay dinleyicisi (kimlik korumalı) no-op olsun
    const l = lock
    lock = null
    l.release().catch(() => {})
  }
}

export function wakeRef() {
  wanted++
  sync()
}

export function wakeUnref() {
  wanted = Math.max(0, wanted - 1)
  sync()
}

// Sekme gizlenince tarayıcı kilidi kendisi bırakır; geri dönüşte tazelenir
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wanted > 0) sync()
})
