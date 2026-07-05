// Kerahat vakti pencereleri. TANIM dakikaları kendi bilgimizden yazılmadı:
// Diyanet'in dakika tanımına tek fetch denendi (bulunamadı — rapor edildi);
// yaygın takvim uygulamasındaki sabitler kullanılır: güneş doğumundan sonra
// 45 dk, zeval (öğle) öncesi 10 dk, gün batımı öncesi 45 dk. Zamanlar adhan
// kütüphanesinin güneş doğuş / öğle (zeval) / batış hesaplarından türetilir
// (adhan'ın dhuhr'u zeval sonrası başlangıçtır; pencere bitişi olarak kullanılır).
export const KERAHAT_DK = { dogusSonrasi: 45, zevalOncesi: 10, batisOncesi: 45 }

export function kerahatWindows({ sunrise, dhuhr, maghrib }) {
  const dk = 60000
  return [
    {
      etiket: 'güneş doğumu sonrası',
      start: sunrise,
      end: new Date(sunrise.getTime() + KERAHAT_DK.dogusSonrasi * dk),
    },
    {
      etiket: 'öğle öncesi (zeval)',
      start: new Date(dhuhr.getTime() - KERAHAT_DK.zevalOncesi * dk),
      end: dhuhr,
    },
    {
      etiket: 'gün batımı öncesi',
      start: new Date(maghrib.getTime() - KERAHAT_DK.batisOncesi * dk),
      end: maghrib,
    },
  ]
}

export function activeKerahat(windows, now) {
  return windows.find((w) => now >= w.start && now < w.end) || null
}
