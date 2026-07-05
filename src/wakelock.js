// Ekran uyanık tutma (Screen Wake Lock): Kur'an/Cevşen okuma ekranları ve
// sesli oynatma sırasında ekran sönmesin. Desteklemeyen tarayıcıda sessiz geç.
// Referans sayacı: okuyucu ve oynatıcı bağımsız istekçilerdir — biri kapanınca
// diğeri hâlâ istiyorsa kilit bırakılmaz.
let lock = null
let wanted = 0

async function acquire() {
  try {
    lock = await navigator.wakeLock.request('screen')
    lock.addEventListener('release', () => {
      // Sistem bıraktıysa (sekme gizlendi vb.) kaydı düşür; görünürlükte yeniden alınır
      lock = null
    })
  } catch {
    lock = null // izin/destek yoksa sessiz
  }
}

function sync() {
  if (!('wakeLock' in navigator)) return
  if (wanted > 0 && !lock) acquire()
  else if (wanted === 0 && lock) {
    lock.release().catch(() => {})
    lock = null
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
