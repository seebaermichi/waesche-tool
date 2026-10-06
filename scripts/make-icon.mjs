// Erzeugt die App-Icons als PNG – ohne Bildbibliothek, nur mit zlib aus der Node-Standard-
// bibliothek. So bleibt das Projekt ohne zusätzliche Abhängigkeiten und die Icons lassen
// sich jederzeit neu bauen: `npm run icons`.

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const SIZES = [180, 192, 512]

const BACKGROUND = [37, 99, 235] // accent-600
const FOREGROUND = [255, 255, 255]

// --- PNG-Grundgerüst --------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** pixels: RGBA-Buffer der Länge size*size*4 */
function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // Bittiefe
  ihdr[9] = 6 // Farbtyp RGBA
  // 10..12 bleiben 0: Deflate, Standardfilter, kein Interlace

  // Jede Scanline bekommt ein führendes Filter-Byte (0 = keine Filterung).
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- Motiv: Trommel / Bullauge ----------------------------------------------

/** Weiche Kante über etwa einen Pixel, damit die Kreise nicht ausfransen. */
function coverage(distance, radius, edge) {
  return Math.min(1, Math.max(0, (radius - distance) / edge + 0.5))
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const center = (size - 1) / 2
  const edge = size / 180 // ~1 Pixel bei 180er-Icon

  const glassRadius = size * 0.3
  const rimRadius = size * 0.34
  const rimWidth = size * 0.05
  const innerRadius = size * 0.155
  const innerWidth = size * 0.045

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center
      const dy = y - center
      const d = Math.hypot(dx, dy)

      // Ring = Fläche innerhalb des Außenrands minus Fläche innerhalb des Innenrands.
      const rim =
        coverage(d, rimRadius + rimWidth / 2, edge) - coverage(d, rimRadius - rimWidth / 2, edge)
      const inner =
        coverage(d, innerRadius + innerWidth / 2, edge) -
        coverage(d, innerRadius - innerWidth / 2, edge)
      const glass = coverage(d, glassRadius, edge) * 0.16

      const alpha = Math.min(1, Math.max(rim, inner, glass))

      const offset = (y * size + x) * 4
      for (let c = 0; c < 3; c++) {
        pixels[offset + c] = Math.round(BACKGROUND[c] + (FOREGROUND[c] - BACKGROUND[c]) * alpha)
      }
      pixels[offset + 3] = 255
    }
  }

  return encodePng(size, pixels)
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of SIZES) {
  const file = join(OUT_DIR, `icon-${size}.png`)
  writeFileSync(file, drawIcon(size))
  console.log(`icon-${size}.png geschrieben`)
}
