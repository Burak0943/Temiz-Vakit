// public/icon.svg -> PNG ikon seti (PWA 192/512 + apple-touch-icon 180)
// Kullanım: node scripts/generate-icons.mjs
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const svgPath = fileURLToPath(new URL('../public/icon.svg', import.meta.url))
const outputs = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
]

for (const { size, name } of outputs) {
  const outPath = fileURLToPath(new URL(`../public/${name}`, import.meta.url))
  // density: SVG'yi hedef boyutta keskin rasterize etmek için (viewBox 512)
  await sharp(svgPath, { density: (72 * size) / 512 }).resize(size, size).png().toFile(outPath)
  console.log(`${name}: ${size}x${size} uretildi`)
}
