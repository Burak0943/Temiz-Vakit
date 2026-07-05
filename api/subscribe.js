// Abonelik kaydı: PushSubscription + konum + vakit tercihleri KV'ye yazılır.
// Anahtar = endpoint hash'i (yeniden abonelikte aynı kayıt güncellenir).
import { subId, saveSub, validSubscription, validCoord } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'yalnız POST' })
    return
  }
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      res.status(400).json({ error: 'geçersiz JSON' })
      return
    }
  }
  const { subscription, lat, lon, prefs } = body || {}
  if (!validSubscription(subscription)) {
    res.status(400).json({ error: 'geçersiz abonelik' })
    return
  }
  if (!validCoord(lat, lon)) {
    res.status(400).json({ error: 'geçersiz konum' })
    return
  }
  // Tercihler süzülür: yalnız beklenen alanlar saklanır (kirli veri girmesin)
  const cleanPrayers = {}
  for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    cleanPrayers[k] = prefs?.prayers?.[k] !== false
  }
  const offset = [0, 15, 30].includes(prefs?.offset) ? prefs.offset : 0
  const id = subId(subscription.endpoint)
  try {
    await saveSub(id, { subscription, lat, lon, prefs: { offset, prayers: cleanPrayers } })
  } catch (e) {
    res.status(500).json({ error: 'kayıt başarısız' })
    return
  }
  res.status(200).json({ ok: true, id })
}
