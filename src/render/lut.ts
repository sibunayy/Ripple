// 3D LUT support (spec §7.3): .cube parsing and compact storage (8-bit RGB, base64) for effect data.
export interface Lut3D { size: number; b64: string; name: string }

export function parseCube(text: string, name = 'LUT'): Lut3D {
  let size = 0, dmin = [0, 0, 0], dmax = [1, 1, 1], title = name;
  const vals: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [k, ...rest] = line.split(/\s+/);
    if (k === 'TITLE') { title = rest.join(' ').replace(/^"|"$/g, '') || name; continue; }
    if (k === 'LUT_3D_SIZE') { size = parseInt(rest[0]!, 10); continue; }
    if (k === 'LUT_1D_SIZE') throw new Error('1D LUTs are not supported — use a 3D .cube file.');
    if (k === 'DOMAIN_MIN') { dmin = rest.map(Number); continue; }
    if (k === 'DOMAIN_MAX') { dmax = rest.map(Number); continue; }
    if (/^[-+\d.]/.test(k!)) { const n = [k!, ...rest].map(Number); if (n.length >= 3 && n.every(Number.isFinite)) vals.push(n[0]!, n[1]!, n[2]!); }
  }
  if (!Number.isInteger(size) || size < 2 || size > 65) throw new Error('Not a valid 3D .cube file (missing LUT_3D_SIZE).');
  if (vals.length !== size ** 3 * 3) throw new Error(`The .cube file has ${vals.length / 3} entries, expected ${size ** 3}.`);
  const bytes = new Uint8Array(vals.length);
  for (let i = 0; i < vals.length; i++) { const c = i % 3; bytes[i] = Math.round(Math.min(1, Math.max(0, (vals[i]! - dmin[c]!) / ((dmax[c]! - dmin[c]!) || 1))) * 255); }
  return { size, b64: toB64(bytes), name: title };
}

export const identityLut = (): Lut3D => {
  const n = 17, b = new Uint8Array(n ** 3 * 3);
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = (x + n * (y + n * z)) * 3; b[i] = Math.round((x / (n - 1)) * 255); b[i + 1] = Math.round((y / (n - 1)) * 255); b[i + 2] = Math.round((z / (n - 1)) * 255); }
  return { size: n, b64: toB64(b), name: 'Identity' };
};

export function toB64(b: Uint8Array): string { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); }
export function fromB64(s: string): Uint8Array { const bin = atob(s), o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }

/** RGB bytes → RGBA bytes for texImage3D. */
export function lutRGBA(l: Lut3D): Uint8Array {
  const rgb = fromB64(l.b64), out = new Uint8Array(l.size ** 3 * 4);
  for (let i = 0, n = l.size ** 3; i < n; i++) { out[i * 4] = rgb[i * 3]!; out[i * 4 + 1] = rgb[i * 3 + 1]!; out[i * 4 + 2] = rgb[i * 3 + 2]!; out[i * 4 + 3] = 255; }
  return out;
}
