// SW kaydı + arka plan güncelleme kontrolü. Güncelleme şeridi kaldırıldı:
// yeni sürüm arka planda indirilip bekler; kullanıcı uygulamayı/sekmeleri
// tamamen kapatıp açınca standart PWA akışıyla etkinleşir.
export function setupServiceWorker() {
  if (!(import.meta.env.PROD && 'serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register('/sw.js')

    // Sayfa yeniden görünür olunca güncelleme kontrolü — en fazla saatte bir.
    // Böylece kapat-aç yapıldığında yeni sürüm çoktan indirilip bekliyor olur.
    let lastCheck = Date.now()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > 3600000) {
        lastCheck = Date.now()
        reg.update()
      }
    })
  })
}
