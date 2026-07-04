// Bağlamsal selam satırı: yerel saate göre selam; sıradaki vakte 45 dk'dan az
// kaldıysa selam yerine vakit bildirimi. Saf fonksiyon — now/next enjekte edilir.
export function greetingText(now, next) {
  if (next && next.time > now && next.time - now < 45 * 60000) {
    const name = next.key === 'fajr' ? 'İmsak' : next.label
    return `${name} vaktine az kaldı`
  }
  const h = now.getHours()
  if (h >= 4 && h < 11) return 'Hayırlı sabahlar'
  if (h >= 11 && h < 18) return 'Hayırlı günler'
  if (h >= 18 && h < 22) return 'Hayırlı akşamlar'
  return 'Hayırlı geceler'
}
