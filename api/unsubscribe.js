// Abonelik silme: endpoint'ten türetilen kimlikle KV kaydı kaldırılır.
import { subId, removeSub } from './_lib.js'

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
  const endpoint = body?.endpoint
  if (typeof endpoint !== 'string' || !endpoint) {
    res.status(400).json({ error: 'endpoint gerekli' })
    return
  }
  try {
    await removeSub(subId(endpoint))
  } catch {
    res.status(500).json({ error: 'silme başarısız' })
    return
  }
  res.status(200).json({ ok: true })
}
