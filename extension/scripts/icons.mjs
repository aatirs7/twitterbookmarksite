// Zero dependency PNG icon generator: etched canvas tile with an accent slab serif "T".
import { deflateSync } from "node:zlib";

const CANVAS = [0x0f, 0x11, 0x15];
const PANEL = [0x1b, 0x1f, 0x27];
const RING = [0x3a, 0x41, 0x4f];
const ACCENT = [0x7c, 0x9c, 0xff];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf, crc = 0xffffffff) {
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return crc;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((crc32(td) ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, td, crc]);
}


const inBox = (u, v, u0, u1, v0, v1) => u >= u0 && u <= u1 && v >= v0 && v <= v1;

/** Slab serif "T": crossbar with drooping end serifs, stem and a foot slab. */
function glyph(u, v) {
  return (
    inBox(u, v, 0.21, 0.79, 0.22, 0.34) || // crossbar
    inBox(u, v, 0.21, 0.31, 0.22, 0.43) || // left serif
    inBox(u, v, 0.69, 0.79, 0.22, 0.43) || // right serif
    inBox(u, v, 0.435, 0.565, 0.22, 0.78) || // stem
    inBox(u, v, 0.33, 0.67, 0.7, 0.8) // foot
  );
}

/**
 * Color of the icon at (u, v) in a unit square, or null outside the tile.
 * ringW is the hairline width in unit space so it stays about one pixel at small sizes.
 */
function sample(u, v, ringW) {
  const r = 0.22;
  const qx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0);
  const qy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
  const d = Math.hypot(qx, qy) - r; // signed distance to the rounded square edge
  if (d > 0) return null;
  if (glyph(u, v)) return ACCENT;
  if (d > -ringW) return RING;
  // Barely lifted panel toward the top, canvas below: a very subtle etched fill.
  const t = Math.min(Math.max(v, 0), 1);
  return CANVAS.map((c, i) => c + (PANEL[i] - c) * (1 - t));
}

export function iconPng(size) {
  const ss = 4; // supersampling for smooth edges
  const ringW = Math.max(1 / size, 0.016);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let a = 0;
      const rgb = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const col = sample((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, ringW);
          if (col) {
            a++;
            for (let c = 0; c < 3; c++) rgb[c] += col[c];
          }
        }
      const n = ss * ss;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      for (let c = 0; c < 3; c++) raw[o + c] = a ? Math.round(rgb[c] / a) : CANVAS[c];
      raw[o + 3] = Math.round((a / n) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
