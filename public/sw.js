// Temiz Vakit service worker — app shell önbelleği, cache-first.
// Vakit hesabı adhan ile tamamen yerel; uygulamanın ağ bağımlılığı yok.
const CACHE = 'tv-v35'
// Cevşen hat sayfası görüntüleri (kulliyat.risale.online): CORS başlığı
// olmadığından sayfa JS'i blob okuyamaz — offline, SW'nin opak yanıt
// önbelleğiyle sağlanır. AYRI ve KALICI cache: sürüm bump'larında silinmez,
// ziyaret edilen sayfalar birikir (toplu ön-indirme yok).
const CEVSEN_CACHE = 'tv-cevsen-sayfa'
const CEVSEN_HOST = 'kulliyat.risale.online'
const CEVSEN_PATH = '/images/Cevsen/'
// Mushaf (Hayrat) sayfa görüntüleri — aynı opak-önbellek deseni, ayrı kalıcı cache
const MUSHAF_CACHE = 'tv-mushaf-sayfa'
const MUSHAF_HOST = 'kuran.hayrat.com.tr'
const MUSHAF_PATH = '/Sayfalar/'
// Kalıcı görüntü önbellekleri: sürüm bump'larında silinmez
const IMAGE_CACHES = [CEVSEN_CACHE, MUSHAF_CACHE]

// İstek bir hat-sayfası görüntüsüyse ilgili kalıcı cache adını döndürür
function imageCacheFor(url) {
  if (url.hostname === CEVSEN_HOST && url.pathname.startsWith(CEVSEN_PATH)) return CEVSEN_CACHE
  if (url.hostname === MUSHAF_HOST && url.pathname.startsWith(MUSHAF_PATH)) return MUSHAF_CACHE
  return null
}
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.svg',
  '/fonts/amiri-quran.woff2',
]

// Yanıtı yeniden sararak saklar: redirect'li yanıt navigasyonda network error
// ürettiğinden redirected bayrağı temiz bir kopya önbelleğe konur.
async function precache(cache, urls) {
  await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, { cache: 'no-cache' })
      if (!response.ok) throw new Error(`precache ${url}: ${response.status}`)
      const body = await response.blob()
      await cache.put(url, new Response(body, { status: 200, headers: response.headers }))
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await precache(cache, APP_SHELL)
      // Hash'li derleme çıktıları (js/css) index.html içinden bulunur; ilk
      // ziyaretteki istekler SW devralmadan bittiği için runtime cache'e
      // güvenilemez — offline'ın tek ziyaretle çalışması için burada eklenir.
      const html = await cache.match('/index.html').then((r) => r.text())
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
      if (assets.length) await precache(cache, assets)
      // skipWaiting bilinçli olarak YOK: eski shell'den açılmış sayfalar
      // yaşarken eski cache silinirse modül istekleri ortada kalıyor
      // (cache-first güncelleme yarışı). Yeni SW eski sekmeler kapanınca
      // devralır; güncelleme bir sonraki ziyarette etkinleşir.
    })(),
  )
})

// Otomatik skipWaiting yok (yukarıdaki not); yalnızca kullanıcı "Yenile" ile
// onaylarsa sayfa bekleyen worker'a bu mesajı gönderir.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// Web push: sunucudan gelen vakit bildirimini göster (uygulama KAPALIYKEN de).
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'Nur Vakti'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: 'tv-prayer', // aynı anda tek bildirim yığılsın
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    }),
  )
})

// Bildirime tıklama: açık sekme varsa öne getir, yoksa uygulamayı aç.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) return w.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && !IMAGE_CACHES.includes(k)) // hat sayfaları kalıcı
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Cevşen/Mushaf hat sayfası görüntüleri: cache-first, opak yanıt saklanır
  // (no-cors img). Sayfa haritası sabit istekler ürettiğinden 404 önbelleğe
  // girme riski yok; hata gövdesi client tarafında onarılır.
  const imgCache = imageCacheFor(url)
  if (imgCache) {
    event.respondWith(
      caches.open(imgCache).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
              return response
            }),
        ),
      ),
    )
    return
  }
  if (url.origin !== self.location.origin) return
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request)
          .then((response) => {
            if (response.ok && !response.redirected) {
              const copy = response.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          })
          .catch((err) => {
            // Offline'da query'li navigasyonlar ('/?utm=...') shell'e düşsün
            if (request.mode === 'navigate') return caches.match('/')
            throw err
          }),
    ),
  )
})
