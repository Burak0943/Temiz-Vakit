// Temiz Vakit service worker — app shell önbelleği, cache-first.
// Vakit hesabı adhan ile tamamen yerel; uygulamanın ağ bağımlılığı yok.
const CACHE = 'tv-v14'
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

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
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
