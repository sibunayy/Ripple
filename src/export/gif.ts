import { DUR } from '../model/project';
import { EX } from './dialog';
import { rasterFrame } from './raster';

/* ---- GIF ---- */
function medianCut(counts, n) {
  // counts: Map bin(6 bits per channel) -> pixels. Returns [[r,g,b] x n]
  const bins = [...counts.keys()].map((b) => ({ r: (b >> 12) & 63, g: (b >> 6) & 63, b: b & 63, n: counts.get(b) }));
  let boxes = [bins];
  const range = (bx) => { let a = [63, 63, 63], z = [0, 0, 0]; for (const c of bx) { const v = [c.r, c.g, c.b]; for (let i = 0; i < 3; i++) { if (v[i] < a[i]) a[i] = v[i]; if (v[i] > z[i]) z[i] = v[i]; } } return [z[0] - a[0], z[1] - a[1], z[2] - a[2]]; };
  while (boxes.length < n) {
    let bi = -1, best = 0;
    boxes.forEach((bx, i) => { if (bx.length < 2) return; const s = Math.max(...range(bx)) * Math.sqrt(bx.reduce((t, c) => t + c.n, 0)); if (s > best) { best = s; bi = i; } });
    if (bi < 0) break;
    const bx = boxes[bi], rg = range(bx), ch = rg.indexOf(Math.max(...rg)), key = ['r', 'g', 'b'][ch];
    bx.sort((p, q) => p[key] - q[key]);
    const tot = bx.reduce((t, c) => t + c.n, 0); let acc = 0, cut = 1;
    for (let i = 0; i < bx.length - 1; i++) { acc += bx[i].n; cut = i + 1; if (acc >= tot / 2) break; }
    boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut));
  }
  return boxes.map((bx) => { let t = 0, r = 0, g = 0, b = 0; for (const c of bx) { t += c.n; r += c.r * c.n; g += c.g * c.n; b += c.b * c.n; } t = t || 1; return [Math.min(255, Math.round(r / t * 4 + 2)), Math.min(255, Math.round(g / t * 4 + 2)), Math.min(255, Math.round(b / t * 4 + 2))]; });
}
function lzw(ix) {
  const out = [], MIN = 8, CLEAR = 256, EOI = 257;
  let cur = 0, nb = 0, size = MIN + 1, next = EOI + 1; const dict = new Map();
  const emit = (c) => { cur |= c << nb; nb += size; while (nb >= 8) { out.push(cur & 255); cur >>>= 8; nb -= 8; } };
  emit(CLEAR); let pre = ix[0];
  for (let i = 1; i < ix.length; i++) {
    const k = ix[i], key = pre * 256 + k, v = dict.get(key);
    if (v !== undefined) { pre = v; continue; }
    emit(pre);
    if (next === 4096) { emit(CLEAR); dict.clear(); next = EOI + 1; size = MIN + 1; }
    else { if (next >= (1 << size)) size++; dict.set(key, next++); }
    pre = k;
  }
  emit(pre); emit(EOI); if (nb > 0) out.push(cur & 255);
  return out;
}
class GifOut {
  declare w: number; declare h: number; declare tIdx: number; declare parts: any[];
  constructor(w, h, pal, tIdx) {
    this.w = w; this.h = h; this.tIdx = tIdx; this.parts = [];
    const hd = [71, 73, 70, 56, 57, 97, w & 255, w >> 8, h & 255, h >> 8, 0xF7, 0, 0];
    const gp = new Uint8Array(768); pal.forEach((c, i) => { gp[i * 3] = c[0]; gp[i * 3 + 1] = c[1]; gp[i * 3 + 2] = c[2]; });
    this.parts.push(new Uint8Array(hd), gp, new Uint8Array([0x21, 0xFF, 11, 78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48, 3, 1, 0, 0, 0]));
  }
  frame(ix, delay) {
    const t = this.tIdx >= 0;
    this.parts.push(new Uint8Array([0x21, 0xF9, 4, ((t ? 2 : 1) << 2) | (t ? 1 : 0), delay & 255, delay >> 8, t ? this.tIdx : 0, 0, 0x2C, 0, 0, 0, 0, this.w & 255, this.w >> 8, this.h & 255, this.h >> 8, 0, 8]));
    const d = lzw(ix), blocks = [];
    for (let i = 0; i < d.length; i += 255) { const n = Math.min(255, d.length - i); blocks.push(n, ...d.slice(i, i + n)); }
    blocks.push(0); this.parts.push(Uint8Array.from(blocks));
  }
  done() { this.parts.push(new Uint8Array([0x3B])); return new Blob(this.parts, { type: 'image/gif' }); }
}
export async function exportGif(job, w, h, fps, nF) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d', { willReadFrequently: true });
  const trans = EX.trans, at = (i) => Math.min(DUR, i * 30 / fps);
  // pass 1: sample colours from ~12 frames
  const counts = new Map(), step = Math.max(1, Math.floor(nF / 12));
  for (let i = 0; i < nF; i += step) {
    if (job.cancel) return null;
    await rasterFrame(at(i), w, h, ctx, trans);
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let p = 0; p < d.length; p += 4 * 3) { if (trans && d[p + 3] < 128) continue; const b = ((d[p] >> 2) << 12) | ((d[p + 1] >> 2) << 6) | (d[p + 2] >> 2); counts.set(b, (counts.get(b) || 0) + 1); }
    job.set(Math.min(10, (i / nF) * 10), 'Choosing colours');
  }
  if (!counts.size) counts.set(0, 1);
  let pal = medianCut(counts, trans ? 255 : 256); if (trans) pal = [[0, 0, 0], ...pal]; while (pal.length < 256) pal.push([0, 0, 0]);
  const off = trans ? 1 : 0, map = new Int16Array(262144).fill(-1);
  const nearest = (r, g, b) => { let bi = off, bd = 1e9; for (let i = off; i < 256; i++) { const c = pal[i], dr = c[0] - r, dg = c[1] - g, db = c[2] - b, dd = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (dd < bd) { bd = dd; bi = i; } } return bi; };
  const gif = new GifOut(w, h, pal, trans ? 0 : -1), ix = new Uint8Array(w * h);
  let acc = 0;
  for (let i = 0; i < nF; i++) {
    if (job.cancel) return null;
    await rasterFrame(at(i), w, h, ctx, trans);
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let p = 0, q = 0; p < d.length; p += 4, q++) {
      if (trans && d[p + 3] < 128) { ix[q] = 0; continue; }
      const b = ((d[p] >> 2) << 12) | ((d[p + 1] >> 2) << 6) | (d[p + 2] >> 2); let v = map[b];
      if (v < 0) { v = nearest(d[p], d[p + 1], d[p + 2]); map[b] = v; } ix[q] = v;
    }
    const nx = Math.round((i + 1) * 100 / fps), delay = Math.max(2, nx - acc); acc = nx;
    gif.frame(ix, delay);
    job.set(10 + (i + 1) / nF * 90, `Frame ${i + 1} of ${nF}`);
    if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
  }
  return gif.done();
}
