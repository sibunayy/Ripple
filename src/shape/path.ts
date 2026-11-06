// Bezier path geometry (spec §7.7). Pure; no DOM. Handles are stored relative to their node.
import type { BezPath, PathNode, Vec2 } from '../model/layer';

const K = 0.5522847498; // circle-by-4-beziers constant
const Z: Vec2 = [0, 0];
export const node = (x: number, y: number, i: Vec2 = Z, o: Vec2 = Z): PathNode => ({ p: [x, y], i, o });
export const isCorner = (n: PathNode) => n.i[0] === 0 && n.i[1] === 0 && n.o[0] === 0 && n.o[1] === 0;

// ---- primitives ------------------------------------------------------------------------------

export function rectPath(w: number, h: number, round: number): BezPath {
  const hw = w / 2, hh = h / 2, r = Math.max(0, Math.min(round, hw, hh));
  if (r < 0.01) return { closed: true, nodes: [node(-hw, -hh), node(hw, -hh), node(hw, hh), node(-hw, hh)] };
  const n: PathNode[] = [];
  // clockwise from the top edge; each corner contributes two nodes joined by a quarter arc
  n.push(node(-hw + r, -hh, Z, Z), node(hw - r, -hh, Z, [r * K, 0]));
  n.push(node(hw, -hh + r, [0, -r * K], Z), node(hw, hh - r, Z, [0, r * K]));
  n.push(node(hw - r, hh, [r * K, 0], Z), node(-hw + r, hh, Z, [-r * K, 0]));
  n.push(node(-hw, hh - r, [0, r * K], Z), node(-hw, -hh + r, Z, [0, -r * K]));
  n[0] = node(-hw + r, -hh, [-r * K, 0], Z); // closing arc into the top edge
  return { closed: true, nodes: n };
}

export function ellipsePath(w: number, h: number): BezPath {
  const a = w / 2, b = h / 2;
  return { closed: true, nodes: [
    node(0, -b, [-a * K, 0], [a * K, 0]), node(a, 0, [0, -b * K], [0, b * K]),
    node(0, b, [a * K, 0], [-a * K, 0]), node(-a, 0, [0, b * K], [0, -b * K]),
  ] };
}

export function polygonPath(points: number, outer: number): BezPath {
  const n = Math.max(3, Math.round(points));
  return { closed: true, nodes: Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return node(Math.cos(a) * outer, Math.sin(a) * outer);
  }) };
}

export function starPath(points: number, outer: number, inner: number): BezPath {
  const n = Math.max(3, Math.round(points));
  return { closed: true, nodes: Array.from({ length: n * 2 }, (_, i) => {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? inner : outer;
    return node(Math.cos(a) * r, Math.sin(a) * r);
  }) };
}

// ---- segments ----------------------------------------------------------------------------------

/** Cubic control points of the segment from node i to its successor (null for the closing gap of an open path). */
export function segment(path: BezPath, i: number): [Vec2, Vec2, Vec2, Vec2] | null {
  const a = path.nodes[i], b = path.nodes[(i + 1) % path.nodes.length];
  if (!a || !b || (!path.closed && i === path.nodes.length - 1)) return null;
  return [a.p, [a.p[0] + a.o[0], a.p[1] + a.o[1]], [b.p[0] + b.i[0], b.p[1] + b.i[1]], b.p];
}
export const segmentCount = (path: BezPath) => (path.closed ? path.nodes.length : Math.max(0, path.nodes.length - 1));

const cubic = (s: [Vec2, Vec2, Vec2, Vec2], t: number): Vec2 => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * s[0][0] + b * s[1][0] + c * s[2][0] + d * s[3][0], a * s[0][1] + b * s[1][1] + c * s[2][1] + d * s[3][1]];
};

/** Split a cubic at t (de Casteljau). */
export function splitCubic(s: [Vec2, Vec2, Vec2, Vec2], t: number): [[Vec2, Vec2, Vec2, Vec2], [Vec2, Vec2, Vec2, Vec2]] {
  const l = (a: Vec2, b: Vec2): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const ab = l(s[0], s[1]), bc = l(s[1], s[2]), cd = l(s[2], s[3]), abc = l(ab, bc), bcd = l(bc, cd), m = l(abc, bcd);
  return [[s[0], ab, abc, m], [m, bcd, cd, s[3]]];
}

// ---- flattening ----------------------------------------------------------------------------------

export interface Poly { pts: Vec2[]; closed: boolean }

/** Flatten to a polyline with `steps` samples per curved segment (straight segments stay single lines). */
export function flatten(path: BezPath, steps = 20): Poly {
  const pts: Vec2[] = [];
  const n = path.nodes.length;
  if (!n) return { pts, closed: false };
  pts.push(path.nodes[0]!.p);
  for (let i = 0; i < segmentCount(path); i++) {
    const s = segment(path, i)!;
    const straight = s[1][0] === s[0][0] && s[1][1] === s[0][1] && s[2][0] === s[3][0] && s[2][1] === s[3][1];
    if (!straight) for (let k = 1; k < steps; k++) pts.push(cubic(s, k / steps));
    // the last point of a closed path equals the first; skip duplicating it
    if (!(path.closed && i === n - 1)) pts.push(s[3]);
  }
  return { pts, closed: path.closed && n > 1 };
}

export const polyLength = (poly: Poly): number => {
  let len = 0;
  const { pts } = poly;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  if (poly.closed && pts.length > 1) len += Math.hypot(pts[0]![0] - pts[pts.length - 1]![0], pts[0]![1] - pts[pts.length - 1]![1]);
  return len;
};

/**
 * Trim paths (spec §7.7): keep the portion from `start` to `end` (both 0–1, relative to total length) after
 * shifting by `offset` (fractions of a revolution). Closed paths wrap; open paths clamp. Returns open polylines.
 */
export function trimPoly(poly: Poly, start: number, end: number, offset: number): Poly[] {
  const pts = poly.closed ? [...poly.pts, poly.pts[0]!] : poly.pts;
  if (pts.length < 2) return [];
  const total = polyLength(poly);
  if (total <= 0) return [];
  let a = start + offset, b = end + offset;
  if (b < a) [a, b] = [b, a];
  if (!poly.closed) { a = Math.max(0, a); b = Math.min(1, b); if (b <= a) return []; }
  else if (b - a >= 1) return [{ pts, closed: false }];
  const spans: [number, number][] = [];
  if (poly.closed) {
    const a0 = a - Math.floor(a), b0 = a0 + (b - a);
    if (b0 > 1) spans.push([a0, 1], [0, b0 - 1]); else spans.push([a0, b0]);
  } else spans.push([a, b]);
  const out: Poly[] = [];
  for (const [s, e] of spans) {
    if (e - s <= 1e-9) continue;
    const ds = s * total, de = e * total;
    const cut: Vec2[] = [];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1]!, p1 = pts[i]!, seg = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const lo = acc, hi = acc + seg;
      if (hi >= ds && lo <= de && seg > 0) {
        const t0 = Math.max(0, (ds - lo) / seg), t1 = Math.min(1, (de - lo) / seg);
        const q0: Vec2 = [p0[0] + (p1[0] - p0[0]) * t0, p0[1] + (p1[1] - p0[1]) * t0];
        const q1: Vec2 = [p0[0] + (p1[0] - p0[0]) * t1, p0[1] + (p1[1] - p0[1]) * t1];
        if (!cut.length) cut.push(q0);
        cut.push(q1);
      }
      acc = hi;
    }
    if (cut.length > 1) out.push({ pts: cut, closed: false });
  }
  return out;
}

// ---- measurement / hit testing ------------------------------------------------------------------

export type Box = [number, number, number, number]; // x0, y0, x1, y1

export function pathBounds(path: BezPath): Box | null {
  const { pts } = flatten(path, 12);
  if (!pts.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
}

export function pointInPoly(pts: readonly Vec2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const distSeg = (px: number, py: number, a: Vec2, b: Vec2): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
};

/** Distance from a point to the polyline. */
export function distToPoly(poly: Poly, x: number, y: number): number {
  const pts = poly.closed ? [...poly.pts, poly.pts[0]!] : poly.pts;
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, distSeg(x, y, pts[i - 1]!, pts[i]!));
  return d;
}

/** Nearest point on the path: segment index, parameter and distance. */
export function nearestOnPath(path: BezPath, x: number, y: number): { seg: number; t: number; dist: number } | null {
  let best: { seg: number; t: number; dist: number } | null = null;
  for (let i = 0; i < segmentCount(path); i++) {
    const s = segment(path, i)!;
    for (let k = 0; k <= 24; k++) {
      const q = cubic(s, k / 24), d = Math.hypot(q[0] - x, q[1] - y);
      if (!best || d < best.dist) best = { seg: i, t: k / 24, dist: d };
    }
  }
  return best;
}

// ---- editing -----------------------------------------------------------------------------------

/** Insert a node on segment `seg` at parameter t, preserving the curve shape. */
export function insertNode(path: BezPath, seg: number, t: number): BezPath {
  const s = segment(path, seg); if (!s) return path;
  const [l, r] = splitCubic(s, t);
  const nodes = path.nodes.map((n) => ({ ...n }));
  const a = nodes[seg]!, bIdx = (seg + 1) % nodes.length, b = nodes[bIdx]!;
  a.o = [l[1][0] - l[0][0], l[1][1] - l[0][1]];
  b.i = [r[2][0] - r[3][0], r[2][1] - r[3][1]];
  const m: PathNode = { p: l[3], i: [l[2][0] - l[3][0], l[2][1] - l[3][1]], o: [r[1][0] - r[0][0], r[1][1] - r[0][1]] };
  nodes.splice(seg + 1, 0, m);
  return { ...path, nodes };
}

export function removeNode(path: BezPath, idx: number): BezPath {
  if (path.nodes.length <= 2) return path;
  return { ...path, nodes: path.nodes.filter((_, i) => i !== idx) };
}

export function moveNode(path: BezPath, idx: number, p: Vec2): BezPath {
  return { ...path, nodes: path.nodes.map((n, i) => (i === idx ? { ...n, p } : n)) };
}

/** Move a handle. Smooth nodes keep the opposite handle collinear (length preserved) unless `alt` breaks it. */
export function moveHandle(path: BezPath, idx: number, which: 'i' | 'o', rel: Vec2, alt = false): BezPath {
  return { ...path, nodes: path.nodes.map((n, k) => {
    if (k !== idx) return n;
    const other = which === 'i' ? 'o' : 'i';
    const len = Math.hypot(n[other][0], n[other][1]), l = Math.hypot(rel[0], rel[1]);
    const smooth = !alt && len > 0 && l > 0;
    return { ...n, [which]: rel, [other]: smooth ? [(-rel[0] / l) * len, (-rel[1] / l) * len] : n[other] };
  }) };
}

/** Toggle a node between corner (no handles) and smooth (handles along the neighbours' chord). */
export function toggleSmooth(path: BezPath, idx: number): BezPath {
  const n = path.nodes[idx]; if (!n) return path;
  if (!isCorner(n)) return { ...path, nodes: path.nodes.map((q, k) => (k === idx ? { ...q, i: Z, o: Z } : q)) };
  const N = path.nodes.length;
  const prev = path.nodes[(idx - 1 + N) % N]!, next = path.nodes[(idx + 1) % N]!;
  const hasPrev = path.closed || idx > 0, hasNext = path.closed || idx < N - 1;
  const a = hasPrev ? prev.p : n.p, b = hasNext ? next.p : n.p;
  let dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const hi = hasPrev ? Math.hypot(n.p[0] - prev.p[0], n.p[1] - prev.p[1]) / 3 : 0;
  const ho = hasNext ? Math.hypot(next.p[0] - n.p[0], next.p[1] - n.p[1]) / 3 : 0;
  return { ...path, nodes: path.nodes.map((q, k) => (k === idx ? { ...q, i: [-dx * hi, -dy * hi], o: [dx * ho, dy * ho] } : q)) };
}

/** Re-centre a path on its bounding-box centre; returns the offset removed. */
export function recenter(path: BezPath): { path: BezPath; offset: Vec2 } {
  const b = pathBounds(path);
  if (!b) return { path, offset: [0, 0] };
  const c: Vec2 = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  return { offset: c, path: { ...path, nodes: path.nodes.map((n) => ({ ...n, p: [n.p[0] - c[0], n.p[1] - c[1]] })) } };
}

/** SVG path data (for debugging/export). */
export function toSvgD(path: BezPath): string {
  if (!path.nodes.length) return '';
  const f = (v: number) => +v.toFixed(2);
  let d = `M${f(path.nodes[0]!.p[0])} ${f(path.nodes[0]!.p[1])}`;
  for (let i = 0; i < segmentCount(path); i++) {
    const s = segment(path, i)!;
    d += `C${f(s[1][0])} ${f(s[1][1])} ${f(s[2][0])} ${f(s[2][1])} ${f(s[3][0])} ${f(s[3][1])}`;
  }
  return d + (path.closed ? 'Z' : '');
}
