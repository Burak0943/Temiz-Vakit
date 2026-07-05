// Dakikalık cron: her aboneyi gez, konumundan bu dakikanın vaktini adhan ile
// hesapla, tercihe uyan vakit/offset penceresindeyse web-push ile bildir.
// Geçersiz abonelikler (404/410) temizlenir. Mükerrer koruması KV'de.
import webpush from 'web-push'
import { kv } from '@vercel/kv'
import { listSubIds, getSub, removeSub, dueNotifications } from '../_lib.js'

function configureVapid() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  return true
}

export default async function handler(req, res) {
  // Vercel Cron isteği doğrulaması (CRON_SECRET tanımlıysa zorunlu)
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'yetkisiz' })
    return
  }
  if (!configureVapid()) {
    res.status(503).json({ error: 'VAPID anahtarları tanımlı değil' })
    return
  }

  const now = new Date()
  const ids = await listSubIds()
  let sent = 0
  let removed = 0
  let scanned = 0

  for (const id of ids) {
    const sub = await getSub(id)
    if (!sub || !sub.subscription) {
      await removeSub(id)
      removed++
      continue
    }
    scanned++
    const due = dueNotifications(now, sub.lat, sub.lon, sub.prefs)
    for (const d of due) {
      // Mükerrer koruması: aynı gün+vakit için tek gönderim (2 saat TTL)
      const sentKey = `tv:sent:${id}:${d.dateKey}:${d.key}`
      const already = await kv.get(sentKey)
      if (already) continue
      await kv.set(sentKey, 1, { ex: 7200 })
      const body = d.offset > 0 ? `${d.label} vaktine ${d.offset} dakika` : `${d.label} vakti girdi`
      const payload = JSON.stringify({ title: 'Temiz Vakit', body, url: '/' })
      try {
        await webpush.sendNotification(sub.subscription, payload)
        sent++
      } catch (e) {
        // Süresi dolmuş/kaldırılmış abonelik: temizle
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await removeSub(id)
          removed++
        }
      }
    }
  }

  res.status(200).json({ ok: true, scanned, sent, removed, at: now.toISOString() })
}
