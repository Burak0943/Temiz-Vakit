// SW kaydı + güncelleme bildirimi: yeni sürüm kurulunca sekme barının üstünde
// "Yeni sürüm hazır" şeridi çıkar; geçiş yalnız kullanıcı onayıyla (Yenile) olur.
export function setupUpdateBar() {
  if (!(import.meta.env.PROD && 'serviceWorker' in navigator)) return

  let dismissed = false // X'e basıldıysa bu oturumda bir daha gösterme
  let userInitiated = false // controllerchange yalnız Yenile sonrası reload etmeli
  let reloaded = false // çift reload koruması

  const bar = document.createElement('div')
  bar.id = 'update-bar'
  bar.hidden = true
  bar.innerHTML = `
    <span>Yeni sürüm hazır</span>
    <button id="update-reload" type="button">Yenile</button>
    <button id="update-close" type="button" aria-label="Kapat">×</button>
  `
  document.body.appendChild(bar)

  function showBar(waitingWorker) {
    if (dismissed || !waitingWorker) return
    // Sekme barı yazı ölçeklemeyle büyüyebilir; şerit tam üstüne otursun
    const tabs = document.querySelector('#tabs')
    if (tabs) bar.style.bottom = `${Math.ceil(tabs.getBoundingClientRect().height)}px`
    bar.hidden = false
    bar.querySelector('#update-reload').onclick = () => {
      userInitiated = true
      // Başka bir sekme geçişi zaten onayladıysa worker beklemede değildir;
      // mesaj no-op olur, doğrudan yenilemek yeterli
      if (waitingWorker.state === 'installed') waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      else window.location.reload()
    }
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
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })

  window.addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register('/sw.js')

    // Önceki oturumdan bekleyen sürüm varsa hemen bildir
    if (reg.waiting && navigator.serviceWorker.controller) showBar(reg.waiting)

    reg.addEventListener('updatefound', () => {
      const incoming = reg.installing
      if (!incoming) return
      incoming.addEventListener('statechange', () => {
        // controller varlığı bunun güncelleme olduğunu gösterir (ilk kurulum değil)
        if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
          showBar(reg.waiting || incoming)
        }
      })
    })

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
