/**
 * Generates public/pwa-192.png and public/pwa-512.png without any raster
 * dependency: pixels are computed analytically (rounded square + hexagon
 * outline + "U" glyph) and encoded as PNG with Node's built-in zlib.
 *
 * Run: node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- PNG encoding ------------------------------------------------------------

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // scanlines with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Geometry ------------------------------------------------------------------

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function insideRoundedRect(x, y, size, radius) {
  const min = 0;
  const max = size;
  if (x < min || x > max || y < min || y > max) return false;
  const cx = Math.max(radius, Math.min(size - radius, x));
  const cy = Math.max(radius, Math.min(size - radius, y));
  return Math.hypot(x - cx, y - cy) <= radius;
}

function render(size) {
  const S = size / 64; // design grid is 64
  const cornerRadius = 14 * S;
  const center = 32 * S;

  // Hexagon, flat orientation, first vertex at top.
  const hexR = 20 * S;
  const hexPoints = [];
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 - 90) * Math.PI) / 180;
    hexPoints.push([center + hexR * Math.cos(a), center + hexR * Math.sin(a)]);
  }
  const hexStroke = 2.4 * S;

  // "U" glyph: two vertical bars + lower semicircle, round caps.
  const uHalf = 6.5 * S;
  const uTop = center - 9 * S;
  const uArcY = center + 3 * S;
  const uStroke = 4 * S;

  function uDist(x, y) {
    const left = distToSegment(x, y, center - uHalf, uTop, center - uHalf, uArcY);
    const right = distToSegment(x, y, center + uHalf, uTop, center + uHalf, uArcY);
    let arc = Infinity;
    if (y >= uArcY) arc = Math.abs(Math.hypot(x - center, y - uArcY) - uHalf);
    return Math.min(left, right, arc);
  }

  function hexDist(x, y) {
    let d = Infinity;
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = hexPoints[i];
      const [bx, by] = hexPoints[(i + 1) % 6];
      d = Math.min(d, distToSegment(x, y, ax, ay, bx, by));
    }
    return d;
  }

  const bg = [3, 6, 11]; // #03060B
  const hexColor = [79, 195, 255]; // #4FC3FF
  const uColor = [122, 227, 255]; // #7AE3FF

  const SS = 3; // supersampling factor
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (!insideRoundedRect(px, py, size, cornerRadius)) continue;
          let cr = bg[0];
          let cg = bg[1];
          let cb = bg[2];
          if (hexDist(px, py) <= hexStroke / 2) {
            [cr, cg, cb] = hexColor;
          }
          if (uDist(px, py) <= uStroke / 2) {
            [cr, cg, cb] = uColor;
          }
          r += cr;
          g += cg;
          b += cb;
          a += 255;
        }
      }
      const n = SS * SS;
      const covered = a / n / 255;
      const i = (y * size + x) * 4;
      // Premultiplied average over covered subsamples only.
      rgba[i] = covered > 0 ? Math.round(r / n / covered) : 0;
      rgba[i + 1] = covered > 0 ? Math.round(g / n / covered) : 0;
      rgba[i + 2] = covered > 0 ? Math.round(b / n / covered) : 0;
      rgba[i + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(join(root, 'public'), { recursive: true });
for (const size of [192, 512]) {
  const png = render(size);
  writeFileSync(join(root, 'public', `pwa-${size}.png`), png);
  console.log(`wrote public/pwa-${size}.png (${png.length} bytes)`);
}
