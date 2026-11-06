// Canvas2D rasteriser for shape and text layers (spec §6.1, deviation: Canvas2D instead of mesh tessellation).
// Each layer is drawn at preview-buffer resolution into a scratch canvas clipped to its on-screen bounds,
// then uploaded as a texture by the GL renderer. Gradients, joins/caps, trim paths and repeaters come for free.
import { apply, compose, mul, type Mat } from '../eval/affine';
import { flatten, segment, segmentCount, trimPoly } from '../shape/path';
import { layerBox, pv, shapePath } from '../shape/geometry';
import { fontString, layoutText, textStyle } from '../text/metrics';
import { influence, unitMap } from '../text/animate';
import type { Resolved } from '../eval/evaluate';
import type { BezPath, Layer, Paint, Vec2 } from '../model/layer';
import type { ColorRGBA } from '../model/project';

export interface Raster { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number } // comp units

let scratch: HTMLCanvasElement | null = null;

export const css = (c: ColorRGBA, a = 1) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${Math.max(0, Math.min(1, c[3] * a))})`;

export function toPath2D(path: BezPath): Path2D {
  const p = new Path2D();
  const n = path.nodes;
  if (!n.length) return p;
  p.moveTo(n[0]!.p[0], n[0]!.p[1]);
  for (let i = 0; i < segmentCount(path); i++) {
    const s = segment(path, i)!;
    p.bezierCurveTo(s[1][0], s[1][1], s[2][0], s[2][1], s[3][0], s[3][1]);
  }
  if (path.closed) p.closePath();
  return p;
}

function style(ctx: CanvasRenderingContext2D, l: Layer, t: number, which: 'fill' | 'stroke', paint: Paint): string | CanvasGradient {
  const op = pv(l, `${which}.opacity`, t, 100) / 100;
  if (paint.kind === 'solid') return css(pv<ColorRGBA>(l, `${which}.color`, t, [1, 1, 1, 1]), op);
  const g = paint.kind === 'linear'
    ? ctx.createLinearGradient(paint.from[0], paint.from[1], paint.to[0], paint.to[1])
    : ctx.createRadialGradient(paint.from[0], paint.from[1], 0, paint.from[0], paint.from[1], Math.max(0.001, Math.hypot(paint.to[0] - paint.from[0], paint.to[1] - paint.from[1])));
  for (const s of paint.stops) g.addColorStop(Math.min(1, Math.max(0, s.at)), css(s.c, op));
  return g;
}

/** Per-glyph drawing with animator transforms (position/scale/rotation/opacity, optional colour). */
function drawAnimatedText(ctx: CanvasRenderingContext2D, l: Layer, t: number, lay: ReturnType<typeof layoutText>, size: number, leading: number) {
  const sh = l.shape!, x = l.text!, lh = (size * leading) / 100;
  const maps = x.animators!.map((a) => ({ a, ...unitMap(x.text, a.unit) }));
  const fill = sh.fill ? style(ctx, l, t, 'fill', sh.fill) : null;
  const base = pv<ColorRGBA>(l, 'fill.color', t, [1, 1, 1, 1]);
  let charIdx = 0;
  const lines = x.text.split('\n');
  lay.lines.forEach((ln, li) => {
    const chars = Array.from(lines[li] ?? '');
    chars.forEach((ch, ci) => {
      const g = charIdx++, flat = g + li; // flat index counts newlines (unitMap includes them)
      const w = ctx.measureText(ch).width, pre = ctx.measureText(chars.slice(0, ci).join('')).width;
      let dx = 0, dy = 0, sx = 1, sy = 1, rot = 0, op = 1, mix = 0, col = base;
      for (const m of maps) {
        const u = m.idx[flat]; if (u === undefined || u < 0) continue;
        const k = (n: string) => `ta:${m.a.id}:${n}`;
        const inf = influence(u, m.count, pv(l, k('start'), t, 0), pv(l, k('end'), t, 100), pv(l, k('offset'), t, 0), m.a.shape);
        const pos = pv<number[]>(l, k('position'), t, [0, 0]), scl = pv<number[]>(l, k('scale'), t, [100, 100]);
        dx += pos[0]! * inf; dy += pos[1]! * inf;
        sx *= 1 + (scl[0]! / 100 - 1) * inf; sy *= 1 + (scl[1]! / 100 - 1) * inf;
        rot += pv(l, k('rotation'), t, 0) * inf;
        op *= 1 + (pv(l, k('opacity'), t, 100) / 100 - 1) * inf;
        if (m.a.colorOn) { col = pv<ColorRGBA>(l, k('color'), t, [1, 1, 1, 1]); mix = Math.max(mix, inf); }
      }
      if (op <= 0.001 || !fill) return;
      ctx.save();
      ctx.translate(ln.x + pre + w / 2 + dx, ln.y + lh / 2 + dy);
      ctx.rotate((rot * Math.PI) / 180); ctx.scale(sx, sy);
      ctx.globalAlpha *= Math.min(1, Math.max(0, op));
      ctx.fillStyle = mix > 0 && typeof fill === 'string' ? css([base[0] + (col[0] - base[0]) * mix, base[1] + (col[1] - base[1]) * mix, base[2] + (col[2] - base[2]) * mix, base[3]], pv(l, 'fill.opacity', t, 100) / 100) : fill;
      ctx.fillText(ch, -w / 2, -lh / 2);
      ctx.restore();
    });
  });
}

function drawCopy(ctx: CanvasRenderingContext2D, l: Layer, t: number, path: BezPath | null) {
  const sh = l.shape!;
  if (l.type === 'text') {
    const st = textStyle(l, t), lay = layoutText(l, t);
    ctx.font = fontString(l, st.size);
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${(st.tracking / 1000) * st.size}px`;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    if (l.text!.animators?.length) { drawAnimatedText(ctx, l, t, lay, st.size, st.leading); return; }
    if (sh.fill) { ctx.fillStyle = style(ctx, l, t, 'fill', sh.fill); for (const ln of lay.lines) ctx.fillText(ln.text, ln.x, ln.y); }
    if (sh.stroke) {
      ctx.strokeStyle = style(ctx, l, t, 'stroke', sh.stroke.paint); ctx.lineWidth = pv(l, 'stroke.width', t, 0);
      ctx.lineJoin = sh.stroke.join; for (const ln of lay.lines) ctx.strokeText(ln.text, ln.x, ln.y);
    }
    return;
  }
  if (!path) return;
  if (sh.fill) { ctx.fillStyle = style(ctx, l, t, 'fill', sh.fill); ctx.fill(toPath2D(path)); }
  const st = sh.stroke;
  if (!st) return;
  ctx.strokeStyle = style(ctx, l, t, 'stroke', st.paint);
  ctx.lineWidth = pv(l, 'stroke.width', t, 0);
  ctx.lineCap = st.cap; ctx.lineJoin = st.join;
  ctx.setLineDash(st.dash > 0 ? [st.dash, st.gap > 0 ? st.gap : st.dash] : []);
  if (sh.trim) {
    const a = pv(l, 'trim.start', t, 0) / 100, b = pv(l, 'trim.end', t, 100) / 100, o = pv(l, 'trim.offset', t, 0) / 360;
    for (const poly of trimPoly(flatten(path, 32), a, b, o)) {
      ctx.beginPath(); poly.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    }
  } else ctx.stroke(toPath2D(path));
}

/** Rasterise one layer at buffer scale k (buffer px per comp px). Returns null when it is entirely off-screen. */
export function rasterLayer(r: Resolved, t: number, k: number, comp: { w: number; h: number }): Raster | null {
  const l = r.layer;
  if (!l.shape) return null;
  const rep = l.shape.repeater;
  const copies = rep ? Math.max(1, Math.min(200, Math.round(pv(l, 'rep.copies', t, 3)))) : 1;
  const path = l.type === 'shape' ? shapePath(l, t) : null;
  if (l.type === 'shape' && !path) return null;

  // On-screen bounds (comp units). Repeater copies can land anywhere, so use the whole frame.
  let x0 = 0, y0 = 0, x1 = comp.w, y1 = comp.h;
  if (!rep) {
    const b = layerBox(l, t), pad = 3;
    const pts = ([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]] as Vec2[]).map(([x, y]) => apply(r.world, x, y));
    x0 = Math.max(0, Math.min(...pts.map((p) => p[0])) - pad); y0 = Math.max(0, Math.min(...pts.map((p) => p[1])) - pad);
    x1 = Math.min(comp.w, Math.max(...pts.map((p) => p[0])) + pad); y1 = Math.min(comp.h, Math.max(...pts.map((p) => p[1])) + pad);
  }
  const bx = Math.floor(x0 * k), by = Math.floor(y0 * k);
  const bw = Math.ceil(x1 * k) - bx, bh = Math.ceil(y1 * k) - by;
  if (bw <= 0 || bh <= 0) return null;

  scratch ??= document.createElement('canvas');
  if (scratch.width !== bw || scratch.height !== bh) { scratch.width = bw; scratch.height = bh; }
  const ctx = scratch.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, bw, bh);

  const base: Mat = mul([k, 0, 0, k, -bx, -by], r.world);
  const step = rep
    ? compose(pv<Vec2>(l, 'rep.position', t, [0, 0]), pv(l, 'rep.rotation', t, 0), pv<Vec2>(l, 'rep.scale', t, [100, 100]), [0, 0])
    : null;
  const mats: Mat[] = [base];
  if (step) for (let i = 1; i < copies; i++) mats.push(mul(mats[i - 1]!, step));
  const o0 = pv(l, 'rep.opacityStart', t, 100) / 100, o1 = pv(l, 'rep.opacityEnd', t, 100) / 100;
  for (let i = copies - 1; i >= 0; i--) { // copy 0 is on top
    const m = mats[i]!;
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.globalAlpha = copies > 1 ? o0 + (o1 - o0) * (i / (copies - 1)) : 1;
    drawCopy(ctx, l, t, path);
  }
  ctx.globalAlpha = 1;
  return { canvas: scratch, x: bx / k, y: by / k, w: bw / k, h: bh / k };
}
