// Bildirim sunucu ayağı — paylaşılan yardımcılar (altçizgi öneki: rota DEĞİL).
// Vercel serverless (Node runtime). KV = Vercel KV / Upstash (KV_REST_API_*).
import { createHash } from 'node:crypto'
import { kv } from '@vercel/kv'
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan'

// KV şeması: tv:subs (id kümesi) + tv:sub:<id> (abone verisi) + tv:sent:<...> (mükerrer koruması)
export const SUBS_SET = 'tv:subs'
export const subKey = (id) => `tv:sub:${id}`

// Abone kimliği = endpoint'in sabit hash'i (yeniden abonelikte aynı kayıt güncellenir)
export function subId(endpoint) {
  return createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 24)
}

export const NOTIFY_LABELS = {
  fajr: 'İmsak / Sabah',
  dhuhr: 'Öğle',
  asr: 'İkindi',
  maghrib: 'Akşam',
  isha: 'Yatsı',
}

export async function saveSub(id, data) {
  await kv.set(subKey(id), data)
  await kv.sadd(SUBS_SET, id)
}

export async function removeSub(id) {
  await kv.del(subKey(id))
  await kv.srem(SUBS_SET, id)
}

export async function listSubIds() {
  return (await kv.smembers(SUBS_SET)) || []
}

export function getSub(id) {
  return kv.get(subKey(id))
}

// Verilen tarihin (Y/M/G) o konumdaki 5 vakti — Diyanet (Türkiye) yöntemi
export function prayerTimes(date, lat, lon) {
  const pt = new PrayerTimes(new Coordinates(lat, lon), date, CalculationMethod.Turkey())
  return { fajr: pt.fajr, dhuhr: pt.dhuhr, asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha }
}

// now anında (± 60 sn pencere) bu abone için tetiklenecek vakitleri döndürür.
// Bugün + yarın (UTC) taranır: gün dönümü sınırında pencere kaçmasın.
export function dueNotifications(now, lat, lon, prefs) {
  const out = []
  const offset = Number.isInteger(prefs?.offset) ? prefs.offset : 0
  for (const dayOffset of [0, 1]) {
    const base = new Date(now.getTime() + dayOffset * 86400000)
    const times = prayerTimes(base, lat, lon)
    for (const [key, t] of Object.entries(times)) {
      if (prefs?.prayers && prefs.prayers[key] === false) continue
      const notifyMs = t.getTime() - offset * 60000
      if (now.getTime() >= notifyMs && now.getTime() < notifyMs + 60000) {
        const p = new Date(t)
        const dateKey = `${p.getUTCFullYear()}-${p.getUTCMonth() + 1}-${p.getUTCDate()}`
        out.push({ key, label: NOTIFY_LABELS[key], dateKey, offset })
      }
    }
  }
  return out
}

// Basit doğrulama: PushSubscription endpoint + keys, koordinat aralığı
export function validSubscription(sub) {
  return (
    sub &&
    typeof sub.endpoint === 'string' &&
    sub.endpoint.startsWith('https://') &&
    sub.keys &&
    typeof sub.keys.p256dh === 'string' &&
    typeof sub.keys.auth === 'string'
  )
}

export function validCoord(lat, lon) {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  )
}
