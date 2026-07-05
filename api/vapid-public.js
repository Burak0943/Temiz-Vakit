// İstemcinin abone olurken kullanacağı VAPID PUBLIC anahtarını döndürür.
// Anahtar koda gömülmez; Vercel ortam değişkeninden (VAPID_PUBLIC_KEY) okunur.
export default function handler(req, res) {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) {
    res.status(503).json({ error: 'VAPID_PUBLIC_KEY tanımlı değil' })
    return
  }
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.status(200).json({ publicKey: key })
}
