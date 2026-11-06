// Mask rasterisation (spec §7.4): each mask is drawn white-on-transparent with Canvas2D and combined by mode.
import { pv } from '../shape/geometry';
import { evalPath } from '../shape/path';
import { toPath2D } from './raster';
import type { Resolved } from '../eval/evaluate';
import type { MaskMode } from '../model/layer';

let main: HTMLCanvasElement | null = null;
let tmp: HTMLCanvasElement | null = null;

const OP: Record<MaskMode, GlobalCompositeOperation> = {
  none: 'source-over', add: 'source-over', subtract: 'destination-out', intersect: 'destination-in',
  lighten: 'source-over', darken: 'destination-in', difference: 'xor',
};

export const maskProp = (id: string, what: 'opacity' | 'feather' | 'expansion') => `mask:${id}:${what}`;

/** Returns a canvas (buffer-sized) whose alpha is the combined mask, or null when no mask is active. */
export function maskCanvas(r: Resolved, t: number, k: number, w: number, h: number): HTMLCanvasElement | null {
  const l = r.layer, masks = (l.masks ?? []).filter((m) => m.mode !== 'none');
  if (!masks.length) return null;
  main ??= document.createElement('canvas'); tmp ??= document.createElement('canvas');
  for (const c of [main, tmp]) if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const mc = main.getContext('2d')!, tc = tmp.getContext('2d')!;
  mc.setTransform(1, 0, 0, 1, 0, 0); mc.globalCompositeOperation = 'source-over'; mc.globalAlpha = 1; mc.filter = 'none';
  mc.clearRect(0, 0, w, h);
  if (masks[0]!.mode === 'subtract') { mc.fillStyle = '#fff'; mc.fillRect(0, 0, w, h); } // first-mask subtract inverts, as in AE
  const m = r.world;
  for (const mask of masks) {
    const opacity = pv(l, maskProp(mask.id, 'opacity'), t, 100) / 100;
    const feather = Math.max(0, pv(l, maskProp(mask.id, 'feather'), t, 0)) * k;
    const expand = pv(l, maskProp(mask.id, 'expansion'), t, 0);
    const path = toPath2D(evalPath(mask.path, t));
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalCompositeOperation = 'source-over'; tc.globalAlpha = 1;
    tc.clearRect(0, 0, w, h);
    tc.fillStyle = '#fff'; tc.strokeStyle = '#fff';
    tc.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k);
    tc.fill(path);
    if (expand > 0) { tc.lineJoin = 'round'; tc.lineWidth = expand * 2; tc.stroke(path); }
    else if (expand < 0) { tc.globalCompositeOperation = 'destination-out'; tc.lineJoin = 'round'; tc.lineWidth = -expand * 2; tc.stroke(path); tc.globalCompositeOperation = 'source-over'; }
    if (mask.invert) {
      tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalCompositeOperation = 'xor'; tc.fillRect(0, 0, w, h); tc.globalCompositeOperation = 'source-over';
    }
    mc.setTransform(1, 0, 0, 1, 0, 0);
    mc.globalCompositeOperation = OP[mask.mode]; mc.globalAlpha = opacity;
    mc.filter = feather > 0.2 ? `blur(${feather / 2}px)` : 'none';
    mc.drawImage(tmp, 0, 0);
  }
  mc.filter = 'none'; mc.globalAlpha = 1; mc.globalCompositeOperation = 'source-over';
  return main;
}
