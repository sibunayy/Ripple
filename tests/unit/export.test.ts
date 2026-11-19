import { describe, it, expect } from 'vitest';
import { lzw, medianCut } from '../../src/export/gif';
import { zipStore } from '../../src/export/zip';
import { muxMp4 } from '../../src/export/mp4';
import { lrgb, lprop, lgeom, lpaint } from '../../src/export/lottie';

const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
const u32 = (u: Uint8Array, o: number) => ((u[o] << 24) | (u[o + 1] << 16) | (u[o + 2] << 8) | u[o + 3]) >>> 0;
const tag = (u: Uint8Array, o: number) => String.fromCharCode(...u.slice(o, o + 4));

// A plain GIF LZW decoder (minimum code size 8), used to check that the encoder round-trips.
function unlzw(d: number[]) {
  let pos = 0, size = 9, dict: number[][] = [], prev: number[] | null = null;
  const out: number[] = [];
  const reset = () => { dict = Array.from({ length: 258 }, (_, i) => [i]); size = 9; prev = null; };
  const read = () => { let v = 0; for (let i = 0; i < size; i++, pos++) v |= ((d[pos >> 3] >> (pos & 7)) & 1) << i; return v; };
  reset();
  while (pos < d.length * 8) {
    const c = read();
    if (c === 256) { reset(); continue; }
    if (c === 257) break;
    const e = c < dict.length ? dict[c] : [...prev!, prev![0]];
    out.push(...e);
    if (prev) dict.push([...prev, e[0]]);
    if (dict.length === 1 << size && size < 12) size++;
    prev = e;
  }
  return out;
}

describe('GIF encoder', () => {
  it('lzw round-trips short, repetitive and long input', () => {
    const mixed = Array.from({ length: 20000 }, (_, i) => (i * 7919 + (i >> 5)) & 255);
    for (const ix of [[0, 0], [1, 2, 3, 1, 2, 3, 1, 2, 3], Array(5000).fill(9), mixed]) expect(unlzw(lzw(ix))).toEqual(ix);
  });
  it('medianCut returns the requested size and finds the main colours', () => {
    const bin = (r: number, g: number, b: number) => ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    const counts = new Map([[bin(255, 0, 0), 500], [bin(0, 0, 255), 300], [bin(250, 5, 0), 20], [bin(0, 255, 0), 10]]);
    const pal = medianCut(counts, 4);
    expect(pal).toHaveLength(4);
    expect(pal).toContainEqual([254, 2, 2]);
    expect(pal).toContainEqual([2, 2, 254]);
  });
  it('medianCut stops early when there are fewer colours than slots', () => {
    expect(medianCut(new Map([[0, 5]]), 256)).toHaveLength(1);
  });
});

describe('zipStore', () => {
  it('writes a valid stored ZIP with the right CRC and offsets', async () => {
    const enc = new TextEncoder();
    const files = [{ name: 'a.txt', data: enc.encode('hello') }, { name: 'b/c.png', data: new Uint8Array([1, 2, 3]) }];
    const u = await bytes(zipStore(files));
    const dv = new DataView(u.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    expect(dv.getUint32(14, true)).toBe(0x3610a686); // CRC-32 of "hello"
    expect(u.length).toBe((30 + 5 + 5) + (30 + 7 + 3) + (46 + 5) + (46 + 7) + 22);
    const end = u.length - 22;
    expect(dv.getUint32(end, true)).toBe(0x06054b50);
    expect(dv.getUint16(end + 10, true)).toBe(2);
    const cd = dv.getUint32(end + 16, true);
    expect(dv.getUint32(cd, true)).toBe(0x02014b50);
    expect(dv.getUint32(cd + 46 + 5 + 42, true)).toBe(40); // the second file's local header offset
  });
});

describe('muxMp4', () => {
  it('nests boxes with consistent sizes and points stco at the sample data', async () => {
    const samples = [
      { key: true, data: new Uint8Array(100).fill(1) },
      { key: false, data: new Uint8Array(40).fill(2) },
      { key: true, data: new Uint8Array(7).fill(3) },
    ];
    const u = await bytes(muxMp4(320, 180, 30, new Uint8Array([1, 66, 0, 30, 255]), samples));
    // Top level: ftyp, moov, mdat, and their sizes add up to the whole file.
    const top: string[] = [];
    let o = 0;
    while (o < u.length) { top.push(tag(u, o + 4)); o += u32(u, o); }
    expect(top).toEqual(['ftyp', 'moov', 'mdat']);
    expect(o).toBe(u.length);
    // Every child box fits inside its parent.
    const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf']);
    const walk = (s: number, e: number) => {
      for (let p = s; p < e;) {
        const n = u32(u, p);
        expect(n).toBeGreaterThanOrEqual(8);
        expect(p + n).toBeLessThanOrEqual(e);
        if (containers.has(tag(u, p + 4))) walk(p + 8, p + n);
        p += n;
      }
    };
    const moov = u32(u, 0);
    walk(moov + 8, moov + u32(u, moov));
    const find = (t: string) => { for (let i = 4; i < u.length - 4; i++) if (tag(u, i) === t) return i - 4; return -1; };
    const mdat = find('mdat');
    expect(u32(u, mdat)).toBe(8 + 147);
    expect(u32(u, find('stco') + 16)).toBe(mdat + 8);
    const stsz = find('stsz');
    expect(u32(u, stsz + 16)).toBe(3);
    expect([u32(u, stsz + 20), u32(u, stsz + 24), u32(u, stsz + 28)]).toEqual([100, 40, 7]);
    const stss = find('stss');
    expect(u32(u, stss + 12)).toBe(2);
    expect(u32(u, stss + 20)).toBe(3);
    expect(u[mdat + 8]).toBe(1);
    expect(u[u.length - 1]).toBe(3);
  });
});

describe('Lottie builders', () => {
  it('lrgb turns hex into 0–1 channels', () => {
    expect(lrgb('#ff8000')).toEqual([1, 0.502, 0]);
    expect(lrgb('nope')).toEqual([1, 1, 1]);
  });
  it('lprop writes a static value when nothing changes', () => expect(lprop([5, 5, 5], 0)).toEqual({ a: 0, k: 5 }));
  it('lprop drops keys in the middle of a flat run and closes the last key', () => {
    const p: any = lprop([0, 1, 1, 1, 2], 10);
    expect(p.a).toBe(1);
    expect(p.k.map((k: any) => k.t)).toEqual([10, 11, 13, 14]);
    expect(p.k[3].i).toBeUndefined();
    expect(p.k[0].i).toEqual({ x: [1], y: [1] });
  });
  it('lgeom builds a rounded rectangle and an ellipse', () => {
    expect(lgeom({ type: 'rect', w: 100, h: 40, cr: 30 })).toMatchObject({ g: { ty: 'rc', s: { k: [100, 40] }, r: { k: 20 } }, bb: [100, 40] });
    expect(lgeom({ type: 'ellipse', r: 50 })).toMatchObject({ g: { ty: 'el', s: { k: [100, 100] } }, bb: [100, 100] });
    expect(lgeom({ type: 'text' })).toBeNull();
  });
  it('lpaint gives a fill, and a ring gets a stroke in its hue', () => {
    expect(lpaint({ type: 'rect', hue: '#000000' }, [10, 10], null)).toEqual([{ ty: 'fl', c: { a: 0, k: [0, 0, 0, 1] }, o: { a: 0, k: 100 }, r: 1 }]);
    const ring: any[] = lpaint({ type: 'ring', hue: '#ffffff', r: 50 }, [100, 100], null);
    expect(ring.map((x) => x.ty)).toEqual(['st']);
    expect(ring[0].w.k).toBe(14);
  });
});
