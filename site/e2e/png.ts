// A small PNG reader, so a test can look at the pixels of a real screenshot without adding a
// dependency. Handles what Chromium writes: 8-bit RGB or RGBA, not interlaced.
import { inflateSync } from 'node:zlib';

export interface Pixels { width: number; height: number; /** RGBA, row by row. */ data: Uint8Array }

export function decodePng(png: Buffer): Pixels {
  let at = 8, width = 0, height = 0, channels = 0;
  const idat: Buffer[] = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at), type = png.toString('latin1', at + 4, at + 8), body = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      const depth = body[8], colour = body[9], interlace = body[12];
      if (depth !== 8 || (colour !== 2 && colour !== 6) || interlace !== 0) throw new Error(`unsupported PNG: depth ${depth}, colour type ${colour}, interlace ${interlace}`);
      channels = colour === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * channels, data = new Uint8Array(width * height * 4);
  const line = new Uint8Array(stride), above = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!, row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels]! : 0, b = above[i]!, c = i >= channels ? above[i - channels]! : 0;
      let predicted = 0;
      if (filter === 1) predicted = a;
      else if (filter === 2) predicted = b;
      else if (filter === 3) predicted = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = (row[i]! + predicted) & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4, i = x * channels;
      data[o] = line[i]!; data[o + 1] = line[i + 1]!; data[o + 2] = line[i + 2]!; data[o + 3] = channels === 4 ? line[i + 3]! : 255;
    }
    above.set(line);
  }
  return { width, height, data };
}
