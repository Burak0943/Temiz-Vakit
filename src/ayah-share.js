// Ayet paylaşımı: ayetin Arapçası + meali + kaynağıyla bir kare görsel (canvas)
// üretir, Web Share API varsa paylaşır yoksa indirir. Metin API'den gelir
// (içerik kuralı); görsel yalnız o metni yeniden çizer, ezber yok.
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d])

// Canvas'ta metni maxWidth'e göre kelime kelime sar
function wrapLines(ctx, text, maxWidth) {
  const lines = []
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let cur = ''
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w
      if (cur && ctx.measureText(test).width > maxWidth) {
        lines.push(cur)
        cur = w
      } else {
        cur = test
      }
    }
    lines.push(cur)
  }
  return lines
}

// Yeniden-giriş kilidi: paylaşım sayfası açıkken hızlı ikinci dokunuş,
// navigator.share'i InvalidStateError'a düşürüp istenmeyen dosya indirmesi
// üretiyordu. Devam eden paylaşım varken ikinci çağrı hiç başlamaz.
let sharing = false

export async function shareAyah(ayah, surahName, surahNumber) {
  if (sharing) return
  sharing = true
  try {
    await shareAyahInner(ayah, surahName, surahNumber)
  } finally {
    sharing = false
  }
}

async function shareAyahInner(ayah, surahName, surahNumber) {
  const { arapca, meal, no } = ayah
  // Amiri yüklenmeden çizersek yedek fontla ölçüp yanlış sararız
  try {
    await document.fonts.load('54px "Amiri Quran"')
    await document.fonts.ready
  } catch {
    // font yüklenmese de yedekle devam
  }

  const W = 1080
  const PAD = 96
  const CW = W - 2 * PAD
  const AR_SIZE = 54
  const AR_LH = AR_SIZE * 1.95 // Amiri mürekkep taşması için bol satır yüksekliği (v1.4.3 dersi)
  const MEAL_SIZE = 34
  const MEAL_LH = MEAL_SIZE * 1.5

  // Ölçüm bağlamı
  const measure = document.createElement('canvas').getContext('2d')
  measure.font = `${AR_SIZE}px "Amiri Quran", serif`
  const arLines = wrapLines(measure, arapca, CW)
  measure.font = `${MEAL_SIZE}px system-ui, sans-serif`
  const mealLines = meal ? wrapLines(measure, meal, CW) : []

  // Toplam yükseklik
  let y = PAD + 40 // üstte küçük başlık için pay
  const topLabelH = 60
  const arBlockH = arLines.length * AR_LH
  const gap1 = meal ? 44 : 24
  const mealBlockH = mealLines.length * MEAL_LH
  const gap2 = 40
  const refH = 44
  const brandH = 40
  const H = Math.round(
    PAD + topLabelH + arBlockH + gap1 + mealBlockH + gap2 + refH + brandH + PAD,
  )

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Arka plan (koyu tema)
  ctx.fillStyle = '#0f1419'
  ctx.fillRect(0, 0, W, H)
  // İnce amber çerçeve
  ctx.strokeStyle = '#d4a017'
  ctx.lineWidth = 4
  ctx.strokeRect(24, 24, W - 48, H - 48)

  // Üst küçük başlık
  ctx.fillStyle = '#8a949f'
  ctx.font = `600 26px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Nur Vakti', W / 2, PAD + 10)

  y = PAD + topLabelH + AR_SIZE
  // Arapça (RTL, sağa yaslı)
  ctx.fillStyle = '#f2f5f8'
  ctx.font = `${AR_SIZE}px "Amiri Quran", serif`
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  for (const line of arLines) {
    ctx.fillText(line, W - PAD, y)
    y += AR_LH
  }
  ctx.direction = 'ltr'

  // Meal (LTR, sola yaslı)
  if (meal) {
    y += gap1 - AR_LH + AR_SIZE * 0.5
    ctx.fillStyle = '#cfd6dd'
    ctx.font = `${MEAL_SIZE}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    for (const line of mealLines) {
      ctx.fillText(line, PAD, y)
      y += MEAL_LH
    }
  }

  // Kaynak referansı (amber)
  y += gap2
  ctx.fillStyle = '#d4a017'
  ctx.font = `600 30px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(`${surahNumber}. ${surahName} · ${surahNumber}:${no}`, W / 2, y)

  // Marka alt satırı
  y += brandH
  ctx.fillStyle = '#8a949f'
  ctx.font = `24px system-ui, sans-serif`
  ctx.fillText('Kaynak: AlQuran Cloud · Meal: Diyanet İşleri', W / 2, y)

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) return
  const file = new File([blob], `nur-vakti-ayet-${surahNumber}-${no}.png`, { type: 'image/png' })

  // Web Share (dosya) varsa paylaş; yoksa indir
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Nur Vakti' })
      return
    } catch (e) {
      // Kullanıcı paylaşımı iptal ettiyse (veya eşzamanlı çağrı reddedildiyse)
      // indirmeye DÜŞME — istenmeyen dosya indirmesi olmasın
      if (e && (e.name === 'AbortError' || e.name === 'InvalidStateError')) return
      // gerçek başarısızlık: indirmeye düş
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = file.name
  a.click()
  URL.revokeObjectURL(a.href)
}
