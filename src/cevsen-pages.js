// Cevşen (Büyük Cevşen) sayfa haritası.
// Kaynak: kulliyat.risale.online — Hayrat Neşriyat'ın kuran.hayrat.com.tr
// sayfasının kendisinin gömdüğü resmî külliyat servisi. İçerik taranmış hat
// sayfası görüntüleridir (JPEG); makine-okunur metin sunulmadığından bu
// bölümde metin yok, görüntüler doğrudan servisten gösterilir.
// Hayrat Neşriyat izni: aile onayı alındı, yazılı teyit beklemede.
// Çıkarım: 5 Temmuz 2026 — klasörler HEAD sondajıyla 404 sınırına kadar
// sayıldı; toplam 171 sayfa, servis menüsündeki sayfaNo çapa aralıklarıyla
// birebir doğrulandı. Bölüm sırası kitaptaki (servisteki) sayfa sırasıdır.
export const CEVSEN_BASE = 'https://kulliyat.risale.online/images/Cevsen'

export const CEVSEN_SECTIONS = [
  { ad: 'Kaside-i Celcelutiye', klasor: 'celcelutiye', sayfa: 13 },
  { ad: 'Cevşen-i Kebir', klasor: 'cevsen', sayfa: 41 },
  { ad: "Delaili'n-Nur", klasor: 'delail', sayfa: 16 },
  { ad: 'Dua-i İsm-i Azam', klasor: 'dismiazam', sayfa: 2 },
  { ad: 'Evrad-ı Kudsiye', klasor: 'evrad', sayfa: 17 },
  { ad: "Hulâsatu'l-Hulâsa", klasor: 'hulasa', sayfa: 15 },
  { ad: 'İsm-i Azam', klasor: 'ismiazam', sayfa: 2 },
  { ad: 'Münâcâtlar', klasor: 'munacatlar', sayfa: 11 },
  { ad: "Münâcâtü'l-Kur'ân", klasor: 'munacatulkuran', sayfa: 33 },
  { ad: 'Sekine', klasor: 'sekine', sayfa: 1 },
  { ad: 'Tahmîdiye', klasor: 'tahmidiye', sayfa: 14 },
  { ad: 'Dua-i Tercüman-ı İsm-i Azam', klasor: 'tismiazam', sayfa: 4 },
  { ad: "Münâcat-ı Veyse'l-Karânî", klasor: 'uveys', sayfa: 2 },
]

export function cevsenPageUrl(section, page) {
  return `${CEVSEN_BASE}/${section.klasor}/${String(page).padStart(3, '0')}.jpg`
}
