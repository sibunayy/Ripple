// Resolve a shape layer's animated parameters into concrete geometry at time t, and measure/hit-test layers.
import { evalProp } from '../anim/interp';
import { evalPath, distToPoly, ellipsePath, flatten, pathBounds, pointInPoly, polygonPath, rectPath, starPath, type Box } from './path';
import { layoutText } from '../text/metrics';
import type { BezPath, Layer, Prop, Vec2 } from '../model/layer';

export const pv = <T,>(l: Layer, k: string, t: number, d: T): T => {
  const p = l.props?.[k] as Prop<any> | undefined;
  return p ? (evalProp(p, t) as T) : d;
};

export function shapePath(l: Layer, t: number): BezPath | null {
  const s = l.shape; if (!s) return null;
  switch (s.kind) {
    case 'rect': { const [w, h] = pv<Vec2>(l, 'shape.size', t, [240, 160]); return rectPath(w, h, pv(l, 'shape.round', t, 0)); }
    case 'ellipse': { const [w, h] = pv<Vec2>(l, 'shape.size', t, [200, 200]); return ellipsePath(w, h); }
    case 'polygon': return polygonPath(pv(l, 'shape.points', t, 5), pv(l, 'shape.outer', t, 100));
    case 'star': return starPath(pv(l, 'shape.points', t, 5), pv(l, 'shape.outer', t, 120), pv(l, 'shape.inner', t, 50));
    default: return s.path ? evalPath(s.path, t) : null;
  }
}

export const strokeWidth = (l: Layer, t: number) => (l.shape?.stroke ? Math.max(0, pv(l, 'stroke.width', t, 0)) : 0);

/** Layer-space bounding box [x0,y0,x1,y1] (includes stroke). */
export function layerBox(l: Layer, t: number): Box {
  if (l.type === 'text' && l.text) { const m = layoutText(l, t); return [0, 0, Math.max(m.w, 1), Math.max(m.h, 1)]; }
  if (l.type === 'shape') {
    const p = shapePath(l, t), b = p && pathBounds(p);
    if (b) { const w = strokeWidth(l, t) / 2; return [b[0] - w, b[1] - w, b[2] + w, b[3] + w]; }
    return [0, 0, 0, 0];
  }
  return [0, 0, l.size[0], l.size[1]];
}

/** Precise layer-space hit test. `tol` is the touch slop in layer units. */
export function hitLayer(l: Layer, t: number, x: number, y: number, tol = 6): boolean {
  const b = layerBox(l, t);
  if (l.type === 'shape') {
    const p = shapePath(l, t); if (!p) return false;
    const poly = flatten(p, 12);
    if (l.shape!.fill && poly.pts.length > 2 && pointInPoly(poly.pts, x, y)) return true;
    return distToPoly(poly, x, y) <= Math.max(strokeWidth(l, t) / 2, 0) + tol;
  }
  return x >= b[0] && y >= b[1] && x <= b[2] && y <= b[3];
}
