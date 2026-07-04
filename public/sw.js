// Temiz Vakit service worker — app shell önbelleği, cache-first.
// Vakit hesabı adhan ile tamamen yerel; uygulamanın ağ bağımlılığı yok.
const CACHE = 'tv-v24'
// Cevşen hat sayfası görüntüleri (kulliyat.risale.online): CORS başlığı
// olmadığından sayfa JS'i blob okuyamaz — offline, SW'nin opak yanıt
// önbelleğiyle sağlanır. AYRI ve KALICI cache: sürüm bump'larında silinmez,
// ziyaret edilen sayfalar birikir (toplu ön-indirme yok).
const CEVSEN_CACHE = 'tv-cevsen-sayfa'
const CEVSEN_HOST = 'kulliyat.risale.online'
const CEVSEN_PATH = '/images/Cevsen/'
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
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k !== CEVSEN_CACHE) // Cevşen sayfaları kalıcı
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
  // Cevşen sayfa görüntüleri: cache-first, opak yanıt saklanır (no-cors img).
  // Sayfa haritası sabit istekler ürettiğinden 404 önbelleğe girme riski yok.
  if (url.hostname === CEVSEN_HOST && url.pathname.startsWith(CEVSEN_PATH)) {
    event.respondWith(
      caches.open(CEVSEN_CACHE).then((cache) =>
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
