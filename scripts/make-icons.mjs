// Generates the PWA icons as PNGs with no dependencies. Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [11, 13, 16]
const BAR = [108, 184, 255]
const INK = [243, 245, 248]

// Three rising bars on a dark square, drawn in a 100×100 unit space.
const bars = [
  { x: 22, w: 14, h: 30, c: BAR },
  { x: 43, w: 14, h: 45, c: BAR },
  { x: 64, w: 14, h: 60, c: INK },
]
const base = 78

function pixel(u, v) {
  for (const b of bars) if (u >= b.x && u < b.x + b.w && v >= base - b.h && v < base) return b.c
  return BG
}

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel((x / size) * 100, (y / size) * 100)
      const o = y * (size * 3 + 1) + 1 + x * 3
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/icon-192.png', png(192))
writeFileSync('public/icon-512.png', png(512))
writeFileSync('public/apple-touch-icon.png', png(180))

const hex = (c) => `#${c.map((n) => n.toString(16).padStart(2, '0')).join('')}`
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="${hex(BG)}"/>${bars
    .map((b) => `<rect x="${b.x}" y="${base - b.h}" width="${b.w}" height="${b.h}" rx="2" fill="${hex(b.c)}"/>`)
    .join('')}</svg>\n`,
)
console.log('icons written')
