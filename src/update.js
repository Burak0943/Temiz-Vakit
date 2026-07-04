// SW kaydı + güncelleme bildirimi: yeni sürüm kurulunca sekme barının üstünde
// "Yeni sürüm hazır" şeridi çıkar; geçiş yalnız kullanıcı onayıyla (Yenile) olur.
export function setupUpdateBar() {
  if (!(import.meta.env.PROD && 'serviceWorker' in navigator)) return

  let dismissed = false // X'e basıldıysa bu oturumda bir daha gösterme
  let userInitiated = false // controllerchange yalnız Yenile sonrası reload etmeli
  let reloaded = false // çift reload koruması
  let updating = false // Yenile çift tıklama guard'ı
  let safetyTimer = null // koşulsuz güvenlik ağı zamanlayıcısı

  const bar = document.createElement('div')
  bar.id = 'update-bar'
  bar.hidden = true
  bar.innerHTML = `
    <span>Yeni sürüm hazır</span>
    <button id="update-reload" type="button">Yenile</button>
    <button id="update-close" type="button" aria-label="Kapat">×</button>
  `
  document.body.appendChild(bar)

  function forceReload() {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  }

  // Yenile: güvenlik ağı İLK iş olarak kurulur — sonraki hiçbir satır ondan
  // önce throw edemez. Mesaj işlenirse controllerchange ağı iptal edip hemen
  // yeniler; işlenmezse (worker yok, teslim aksaklığı, istisna) 2.5 sn'de
  // koşulsuz reload gelir. Buton "hiçbir şey yapmama" durumuna düşemez.
  async function activateUpdate() {
    if (updating) return // 1) çift tıklama guard'ı
    updating = true
    safetyTimer = setTimeout(() => window.location.reload(), 2500) // 2) koşulsuz ağ
    // 3) görsel geri bildirim
    const btn = bar.querySelector('#update-reload')
    btn.textContent = 'Yenileniyor…'
    btn.disabled = true
    userInitiated = true
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
    } catch (err) {
      // Ağ zaten kurulu; 2.5 sn içinde koşulsuz yenilenecek
      console.warn('SKIP_WAITING gönderilemedi, güvenlik ağı yenileyecek:', err)
    }
  }

  function showBar(waitingWorker) {
    if (dismissed || !waitingWorker) return
    // Sekme barı yazı ölçeklemeyle büyüyebilir; şerit tam üstüne otursun
    const tabs = document.querySelector('#tabs')
    if (tabs) bar.style.bottom = `${Math.ceil(tabs.getBoundingClientRect().height)}px`
    bar.hidden = false
    bar.querySelector('#update-reload').onclick = activateUpdate
  }

  bar.querySelector('#update-close').addEventListener('click', () => {
    dismissed = true
    bar.hidden = true
  })

  // İlk kurulumda clients.claim() de controllerchange tetikler; o yüzden
  // yalnızca kullanıcı Yenile'ye bastıysa (userInitiated) reload edilir.
  // Geçişi başka bir sekme onayladıysa buradaki şerit bayatlar — gizle.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!userInitiated) {
      bar.hidden = true
      return
    }
    // Geçiş geldi: güvenlik ağını iptal et, hemen yenile (çift reload korumalı)
    if (safetyTimer) clearTimeout(safetyTimer)
    forceReload()
  })

  window.addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register('/sw.js')

    function watchIncoming(worker) {
      if (!worker) return
      worker.addEventListener('statechange', () => {
        // controller varlığı bunun güncelleme olduğunu gösterir (ilk kurulum değil)
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showBar(reg.waiting || worker)
        }
      })
    }

    // Önceki oturumdan bekleyen sürüm varsa hemen bildir
    if (reg.waiting && navigator.serviceWorker.controller) showBar(reg.waiting)
    // register() çözülmeden updatefound ateşlendiyse kurulmakta olanı da izle
    watchIncoming(reg.installing)
    reg.addEventListener('updatefound', () => watchIncoming(reg.installing))

    // Sayfa yeniden görünür olunca güncelleme kontrolü — en fazla saatte bir
    let lastCheck = Date.now()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > 3600000) {
        lastCheck = Date.now()
        reg.update()
      }
    })
  })
}
