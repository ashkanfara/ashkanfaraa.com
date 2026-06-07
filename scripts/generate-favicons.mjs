/**
 * Generates brand favicons for ashkanfaraa.com.
 * Run once from the project root: node scripts/generate-favicons.mjs
 *
 * Output:
 *   src/app/favicon.ico          (ICO wrapping a 32x32 PNG — replaces Vercel default)
 *   public/favicon-16x16.png
 *   public/favicon-32x32.png
 *   public/apple-touch-icon.png  (180x180)
 *   public/icon-192.png          (for future PWA / manifest use)
 */

import sharp from 'sharp'
import path   from 'path'
import fs     from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')

// ── Brand tokens ──────────────────────────────────────────────
const BG     = '#0e0c0a'   // site background
const GOLD   = '#c4973a'   // var(--accent)

// ── SVG template ─────────────────────────────────────────────
// Geometric bold "AF" — drawn as two simple letter shapes so it
// renders crisply even at 16×16 without relying on font rendering.
// At large sizes (180, 192) the letters have elegant proportions.
function svg(size) {
  const pad  = size * 0.10          // 10% edge padding
  const w    = size - pad * 2
  const h    = size - pad * 2
  const cx   = size / 2
  const cy   = size / 2

  // font size: 58% of canvas, weight 700, tight tracking
  const fs   = Math.round(size * 0.58)
  const ls   = size < 24 ? 0 : -(size * 0.02)

  return /* xml */`<svg xmlns="http://www.w3.org/2000/svg"
  width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">

  <!-- background -->
  <rect width="${size}" height="${size}" fill="${BG}" rx="${Math.round(size * 0.13)}"/>

  <!-- AF monogram -->
  <text
    x="${cx}"
    y="${cy + fs * 0.36}"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', 'Didot', 'Playfair Display', serif"
    font-size="${fs}"
    font-weight="700"
    letter-spacing="${ls}"
    fill="${GOLD}"
  >AF</text>
</svg>`
}

// ── PNG-in-ICO encoder ────────────────────────────────────────
// ICO format: 6-byte header + one 16-byte directory entry + PNG data.
// PNG-in-ICO is supported by all browsers and Windows Vista+.
function pngToIco(pngBuffer) {
  const HEADER_SIZE = 6
  const DIR_SIZE    = 16
  const dataOffset  = HEADER_SIZE + DIR_SIZE

  const header = Buffer.alloc(HEADER_SIZE)
  header.writeUInt16LE(0,  0)   // reserved
  header.writeUInt16LE(1,  2)   // type: ICO
  header.writeUInt16LE(1,  4)   // number of images

  const dir = Buffer.alloc(DIR_SIZE)
  dir.writeUInt8(32,  0)        // width  (0 = 256 in spec, but 32 here)
  dir.writeUInt8(32,  1)        // height
  dir.writeUInt8(0,   2)        // colour palette
  dir.writeUInt8(0,   3)        // reserved
  dir.writeUInt16LE(1, 4)       // colour planes
  dir.writeUInt16LE(32, 6)      // bits per pixel
  dir.writeUInt32LE(pngBuffer.length, 8)   // image data size
  dir.writeUInt32LE(dataOffset,        12) // offset to image data

  return Buffer.concat([header, dir, pngBuffer])
}

async function run() {
  const appDir    = path.join(ROOT, 'src', 'app')
  const publicDir = path.join(ROOT, 'public')

  const sizes = {
    16:  path.join(publicDir, 'favicon-16x16.png'),
    32:  path.join(publicDir, 'favicon-32x32.png'),
    180: path.join(publicDir, 'apple-touch-icon.png'),
    192: path.join(publicDir, 'icon-192.png'),
  }

  for (const [size, dest] of Object.entries(sizes)) {
    const s = Number(size)
    await sharp(Buffer.from(svg(s)))
      .resize(s, s)
      .png({ compressionLevel: 9 })
      .toFile(dest)
    console.log(`✓  ${dest.replace(ROOT, '.')}`)
  }

  // favicon.ico — wrap a 32×32 PNG as ICO
  const png32 = await sharp(Buffer.from(svg(32)))
    .resize(32, 32)
    .png()
    .toBuffer()

  const icoPath = path.join(appDir, 'favicon.ico')
  fs.writeFileSync(icoPath, pngToIco(png32))
  console.log(`✓  ${icoPath.replace(ROOT, '.')}`)

  console.log('\nAll favicons generated.')
}

run().catch(err => { console.error(err); process.exit(1) })
