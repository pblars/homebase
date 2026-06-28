// gen-placeholder.js
// -----------------------------------------------------------------------------
// Generates assets/sky/placeholder.webp — a solid dark green-black fallback used
// by SkyManager when a real sky image is missing.
//
// No image libraries are required. This hand-encodes a minimal *lossless* WebP
// (VP8L) 1x1 image of a single solid color. Because the sky <img> uses
// object-fit:cover, a 1x1 pixel stretches to fill the whole viewport — visually
// identical to a large solid rectangle. Real illustrated images replace it.
//
//   Run:  node scripts/gen-placeholder.js
//
// Color: #0a1a0f  (R=10, G=26, B=15), fully opaque.
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const COLOR = { r: 0x0a, g: 0x1a, b: 0x0f, a: 0xff };

// --- LSB-first bit writer (matches VP8L's ReadBits ordering) -----------------
class BitWriter {
  constructor() {
    this.bytes = [];
    this.cur = 0;
    this.nbits = 0;
  }
  writeBits(value, count) {
    for (let i = 0; i < count; i++) {
      const bit = (value >> i) & 1;
      this.cur |= bit << this.nbits;
      this.nbits++;
      if (this.nbits === 8) {
        this.bytes.push(this.cur);
        this.cur = 0;
        this.nbits = 0;
      }
    }
  }
  finish() {
    if (this.nbits > 0) {
      this.bytes.push(this.cur);
      this.cur = 0;
      this.nbits = 0;
    }
    return Buffer.from(this.bytes);
  }
}

// Write one "simple" Huffman code that always resolves to a single 8-bit symbol.
function writeSimpleSymbolCode(bw, symbol) {
  bw.writeBits(1, 1); // simple_code = 1
  bw.writeBits(0, 1); // num_symbols - 1 = 0  (one symbol)
  bw.writeBits(1, 1); // first_symbol_len_code = 1  (symbol is 8 bits)
  bw.writeBits(symbol, 8);
}

function buildVP8LBitstream(color) {
  const bw = new BitWriter();

  // Image header
  bw.writeBits(0, 14); // width  - 1  -> 1px
  bw.writeBits(0, 14); // height - 1  -> 1px
  bw.writeBits(1, 1);  // alpha_is_used
  bw.writeBits(0, 3);  // version

  // Stream setup
  bw.writeBits(0, 1);  // no transform
  bw.writeBits(0, 1);  // no color cache
  bw.writeBits(0, 1);  // no meta-huffman (single huffman group)

  // Five Huffman codes, in order: green, red, blue, alpha, distance.
  // Each is a forced single symbol, so the lone pixel costs 0 extra bits.
  writeSimpleSymbolCode(bw, color.g); // GREEN literal
  writeSimpleSymbolCode(bw, color.r); // RED
  writeSimpleSymbolCode(bw, color.b); // BLUE
  writeSimpleSymbolCode(bw, color.a); // ALPHA
  writeSimpleSymbolCode(bw, 0);       // DISTANCE (unused, symbol 0)

  // The single pixel: every channel is the forced symbol -> no data bits needed.
  return bw.finish();
}

function buildWebP(color) {
  const SIGNATURE = 0x2f;
  const bits = buildVP8LBitstream(color);
  const payload = Buffer.concat([Buffer.from([SIGNATURE]), bits]);

  // VP8L chunk
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.write('VP8L', 0, 'ascii');
  chunkHeader.writeUInt32LE(payload.length, 4);

  const needsPad = payload.length % 2 === 1;
  const chunk = needsPad
    ? Buffer.concat([chunkHeader, payload, Buffer.from([0x00])])
    : Buffer.concat([chunkHeader, payload]);

  // RIFF wrapper
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'ascii');
  riff.writeUInt32LE(4 + chunk.length, 4); // size of everything after this field
  riff.write('WEBP', 8, 'ascii');

  return Buffer.concat([riff, chunk]);
}

const outPath = path.join(__dirname, '..', 'assets', 'sky', 'placeholder.webp');
const webp = buildWebP(COLOR);
fs.writeFileSync(outPath, webp);
console.log(`Wrote ${webp.length} bytes -> ${outPath}`);
console.log(`Color #${[COLOR.r, COLOR.g, COLOR.b].map((c) => c.toString(16).padStart(2, '0')).join('')}, 1x1 lossless WebP`);
