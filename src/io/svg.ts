// SVG → native shape layers (spec §7.10). Pure helpers (path/colour/transform parsing) are DOM-free and unit-tested;
// `svgToLayers` uses DOMParser. Supported: path, rect, circle, ellipse, line, polyline, polygon, nested groups,
// transform attributes (baked into the geometry), fill/stroke/opacity (attributes and style=""), linear/radial gradients.
import { apply, compose, mul, IDENT, type Mat } from '../eval/affine';
import { ellipsePath, node, rectPath, recenter } from '../shape/path';
import { createShapeLayer, type BezPath, type GradStop, type Layer, type Paint, type PathNode, type Vec2 } from '../model/layer';
import type { ColorRGBA, ProjectSettings } from '../model/project';

// ---- path data --------------------------------------------------------------------------------------------------

/** Parse SVG path data into cubic-bézier subpaths. Arcs and quadratics are converted; relative commands resolved. */
export function parsePathD(d: string): BezPath[] {
  const out: BezPath[] = [];
  let i = 0;
  const ws = () => { while (i < d.length && /[\s,]/.test(d[i]!)) i++; };
  const num = (): number => {
    ws();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i));
    if (!m) throw new Error('number expected');
    i += m[0].length; return parseFloat(m[0]);
  };
  const flag = (): number => { ws(); const c = d[i++]; if (c !== '0' && c !== '1') throw new Error('flag expected'); return +c; };
  const more = () => { ws(); return i < d.length && !/[A-Za-z]/.test(d[i]!); };

  let cur: PathNode[] = [], closed = false, cx = 0, cy = 0, sx = 0, sy = 0, lastCtl: Vec2 | null = null, lastQ: Vec2 | null = null, prevCmd = '';
  const flush = () => { if (cur.length) out.push({ nodes: cur, closed }); cur = []; closed = false; };
  const lineTo = (x: number, y: number) => { cur.push(node(x, y)); cx = x; cy = y; };
  const cubicTo = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    const last = cur[cur.length - 1]!;
    last.o = [x1 - last.p[0], y1 - last.p[1]];
    cur.push({ p: [x, y], i: [x2 - x, y2 - y], o: [0, 0] });
    lastCtl = [x2, y2]; cx = x; cy = y;
  };
  const arcTo = (rx: number, ry: number, rot: number, large: number, sweep: number, x: number, y: number) => {
    if (rx === 0 || ry === 0) { lineTo(x, y); return; }
    rx = Math.abs(rx); ry = Math.abs(ry);
    const phi = (rot * Math.PI) / 180, c = Math.cos(phi), s = Math.sin(phi);
    const dx = (cx - x) / 2, dy = (cy - y) / 2, x1 = c * dx + s * dy, y1 = -s * dx + c * dy;
    const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
    if (lam > 1) { const k = Math.sqrt(lam); rx *= k; ry *= k; }
    const sq = Math.max(0, (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) / (rx * rx * y1 * y1 + ry * ry * x1 * x1));
    const co = (large === sweep ? -1 : 1) * Math.sqrt(sq), cxp = (co * rx * y1) / ry, cyp = (-co * ry * x1) / rx;
    const ccx = c * cxp - s * cyp + (cx + x) / 2, ccy = s * cxp + c * cyp + (cy + y) / 2;
    const ang = (ux: number, uy: number, vx: number, vy: number) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
    let th1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry), dth = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
    if (!sweep && dth > 0) dth -= 2 * Math.PI; else if (sweep && dth < 0) dth += 2 * Math.PI;
    const n = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2) - 1e-9)), step = dth / n, t = (4 / 3) * Math.tan(step / 4);
    const pt = (a: number): Vec2 => [ccx + rx * Math.cos(a) * c - ry * Math.sin(a) * s, ccy + rx * Math.cos(a) * s + ry * Math.sin(a) * c];
    const dv = (a: number): Vec2 => [-rx * Math.sin(a) * c - ry * Math.cos(a) * s, -rx * Math.sin(a) * s + ry * Math.cos(a) * c];
    for (let k = 0; k < n; k++) {
      const a0 = th1 + k * step, a1 = a0 + step, p0 = pt(a0), p1 = k === n - 1 ? ([x, y] as Vec2) : pt(a1), d0 = dv(a0), d1 = dv(a1);
      cubicTo(p0[0] + t * d0[0], p0[1] + t * d0[1], p1[0] - t * d1[0], p1[1] - t * d1[1], p1[0], p1[1]);
    }
    void th1;
  };

  while (true) {
    ws();
    if (i >= d.length) break;
    let cmd = d[i]!;
    if (/[A-Za-z]/.test(cmd)) i++; else if (prevCmd) cmd = prevCmd === 'M' ? 'L' : prevCmd === 'm' ? 'l' : prevCmd; else throw new Error('bad path');
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? cx : 0, oy = rel ? cy : 0;
    if (C !== 'S' && C !== 'C') lastCtl = null;
    if (C !== 'Q' && C !== 'T') lastQ = null;
    switch (C) {
      case 'M': { flush(); const x = num() + ox, y = num() + oy; cur = [node(x, y)]; cx = sx = x; cy = sy = y; break; }
      case 'L': lineTo(num() + ox, num() + oy); break;
      case 'H': lineTo(num() + ox, cy); break;
      case 'V': lineTo(cx, num() + oy); break;
      case 'C': { const a = num() + ox, b = num() + oy, c2 = num() + ox, e = num() + oy, x = num() + ox, y = num() + oy; cubicTo(a, b, c2, e, x, y); break; }
      case 'S': { const c1: Vec2 = lastCtl ? [2 * cx - lastCtl[0], 2 * cy - lastCtl[1]] : [cx, cy]; const c2x = num() + ox, c2y = num() + oy, x = num() + ox, y = num() + oy; cubicTo(c1[0], c1[1], c2x, c2y, x, y); break; }
      case 'Q': { const qx = num() + ox, qy = num() + oy, x = num() + ox, y = num() + oy; const x0 = cx, y0 = cy; cubicTo(x0 + (2 / 3) * (qx - x0), y0 + (2 / 3) * (qy - y0), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y); lastQ = [qx, qy]; break; }
      case 'T': { const q: Vec2 = lastQ ? [2 * cx - lastQ[0], 2 * cy - lastQ[1]] : [cx, cy]; const x = num() + ox, y = num() + oy; const x0 = cx, y0 = cy; cubicTo(x0 + (2 / 3) * (q[0] - x0), y0 + (2 / 3) * (q[1] - y0), x + (2 / 3) * (q[0] - x), y + (2 / 3) * (q[1] - y), x, y); lastQ = q; break; }
      case 'A': { const rx = num(), ry = num(), rot = num(), la = flag(), sw = flag(), x = num() + ox, y = num() + oy; arcTo(rx, ry, rot, la, sw, x, y); break; }
      case 'Z': {
        if (cur.length > 1) {
          const f = cur[0]!, l = cur[cur.length - 1]!;
          if (Math.hypot(f.p[0] - l.p[0], f.p[1] - l.p[1]) < 1e-6) { f.i = l.i; cur.pop(); }
        }
        closed = true; flush(); cx = sx; cy = sy; cur = [node(sx, sy)]; cur = []; break;
      }
      default: throw new Error(`unsupported command ${cmd}`);
    }
    prevCmd = cmd;
    if (C === 'Z') prevCmd = '';
    void more;
  }
  flush();
  return out.filter((p) => p.nodes.length > 1);
}

// ---- colour / transform -------------------------------------------------------------------------------------------

const NAMED: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', lime: '#00ff00', blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff', gray: '#808080', grey: '#808080', silver: '#c0c0c0', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', brown: '#a52a2a', navy: '#000080', teal: '#008080', maroon: '#800000', olive: '#808000' };

/** CSS colour → RGBA (0–1), or null for none/transparent/unparseable. */
export function parseColor(v: string | null | undefined): ColorRGBA | null {
  if (!v) return null;
  let s = v.trim().toLowerCase();
  if (s === 'none' || s === 'transparent') return null;
  if (NAMED[s]) s = NAMED[s]!;
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) { const h = m[1]!; return [parseInt(h[0]! + h[0]!, 16) / 255, parseInt(h[1]! + h[1]!, 16) / 255, parseInt(h[2]! + h[2]!, 16) / 255, 1]; }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) { const n = parseInt(m[1]!, 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, m[2] ? parseInt(m[2], 16) / 255 : 1]; }
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1]!.split(/[\s,/]+/).filter(Boolean).map((x) => (x.endsWith('%') ? (parseFloat(x) / 100) : parseFloat(x)));
    const pct = m[1]!.includes('%');
    return [(p[0] ?? 0) / (pct ? 1 : 255), (p[1] ?? 0) / (pct ? 1 : 255), (p[2] ?? 0) / (pct ? 1 : 255), p[3] ?? 1];
  }
  return null;
}

/** SVG transform list → matrix. */
export function parseTransform(t: string | null | undefined): Mat {
  if (!t) return IDENT;
  let m: Mat = IDENT;
  for (const mt of t.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const a = mt[2]!.split(/[\s,]+/).filter(Boolean).map(Number);
    let n: Mat = IDENT;
    switch (mt[1]) {
      case 'matrix': n = [a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!]; break;
      case 'translate': n = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case 'scale': n = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]; break;
      case 'rotate': { const r = ((a[0] ?? 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), cx = a[1] ?? 0, cy = a[2] ?? 0; n = mul(mul([1, 0, 0, 1, cx, cy], [c, s, -s, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]); break; }
      case 'skewX': n = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0]; break;
      case 'skewY': n = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]; break;
    }
    if (n.every(Number.isFinite)) m = mul(m, n);
  }
  return m;
}

const xformPath = (p: BezPath, m: Mat): BezPath => ({
  closed: p.closed,
  nodes: p.nodes.map((n) => ({
    p: apply(m, n.p[0], n.p[1]),
    i: [m[0] * n.i[0] + m[2] * n.i[1], m[1] * n.i[0] + m[3] * n.i[1]] as Vec2,
    o: [m[0] * n.o[0] + m[2] * n.o[1], m[1] * n.o[0] + m[3] * n.o[1]] as Vec2,
  })),
});

// ---- DOM walk ----------------------------------------------------------------------------------------------------------

interface Style { fill: string | null; stroke: string | null; sw: number; opacity: number; fo: number; so: number; cap: 'butt' | 'round' | 'square'; join: 'miter' | 'round' | 'bevel' }
const BASE: Style = { fill: '#000000', stroke: null, sw: 1, opacity: 1, fo: 1, so: 1, cap: 'butt', join: 'miter' };

function styleOf(el: Element, parent: Style): Style {
  const get = (n: string) => {
    const st = el.getAttribute('style');
    if (st) { const m = new RegExp(`(?:^|;)\\s*${n}\\s*:\\s*([^;]+)`).exec(st); if (m) return m[1]!.trim(); }
    return el.getAttribute(n);
  };
  const s: Style = { ...parent, opacity: 1 };
  const f = get('fill'); if (f !== null) s.fill = f === 'currentColor' ? '#000000' : f;
  const st = get('stroke'); if (st !== null) s.stroke = st === 'none' ? null : st;
  const sw = get('stroke-width'); if (sw !== null) s.sw = parseFloat(sw) || 0;
  const op = get('opacity'); if (op !== null) s.opacity = parseFloat(op);
  const fo = get('fill-opacity'); if (fo !== null) s.fo = parseFloat(fo);
  const so = get('stroke-opacity'); if (so !== null) s.so = parseFloat(so);
  const cap = get('stroke-linecap'); if (cap === 'round' || cap === 'square' || cap === 'butt') s.cap = cap;
  const join = get('stroke-linejoin'); if (join === 'round' || join === 'bevel' || join === 'miter') s.join = join;
  return s;
}

const numAttr = (el: Element, n: string, d = 0) => { const v = parseFloat(el.getAttribute(n) ?? ''); return Number.isFinite(v) ? v : d; };

export interface SvgImport { layers: Layer[]; skipped: string[]; width: number; height: number }

/** Convert SVG text to shape layers centred in the comp (top layer first). */
export function svgToLayers(text: string, settings: ProjectSettings, startIndex = 0): SvgImport {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('This file is not a valid SVG.');
  const vb = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const vx = vb.length === 4 ? vb[0]! : 0, vy = vb.length === 4 ? vb[1]! : 0;
  const w = vb.length === 4 ? vb[2]! : numAttr(root, 'width', 512), h = vb.length === 4 ? vb[3]! : numAttr(root, 'height', 512);
  const fit = Math.min(1, (settings.width * 0.9) / w, (settings.height * 0.9) / h);
  const place: Mat = mul([1, 0, 0, 1, settings.width / 2, settings.height / 2], mul([fit, 0, 0, fit, 0, 0], [1, 0, 0, 1, -(vx + w / 2), -(vy + h / 2)]));
  const skipped = new Set<string>();
  const found: { name: string; path: BezPath; style: Style; m: Mat }[] = [];

  const grads = new Map<string, Element>();
  doc.querySelectorAll('linearGradient,radialGradient').forEach((g) => { if (g.id) grads.set(g.id, g); });

  const walk = (el: Element, m: Mat, parent: Style) => {
    const tag = el.localName;
    if (['defs', 'title', 'desc', 'metadata', 'style', 'linearGradient', 'radialGradient', 'clipPath', 'mask', 'symbol'].includes(tag)) { if (['clipPath', 'mask', 'symbol', 'style'].includes(tag)) skipped.add(tag); return; }
    const mm = mul(m, parseTransform(el.getAttribute('transform')));
    const st = styleOf(el, parent);
    const add = (paths: BezPath[]) => paths.forEach((p) => found.push({ name: el.id || tag, path: p, style: st, m: mm }));
    const nameCap = found.length > 600;
    if (nameCap) { skipped.add('more than 600 shapes (truncated)'); return; }
    try {
      switch (tag) {
        case 'svg': case 'g': case 'a': for (const c of Array.from(el.children)) walk(c, mm, st); break;
        case 'path': add(parsePathD(el.getAttribute('d') ?? '')); break;
        case 'rect': { const x = numAttr(el, 'x'), y = numAttr(el, 'y'), rw = numAttr(el, 'width'), rh = numAttr(el, 'height'), rx = numAttr(el, 'rx', numAttr(el, 'ry'));
          if (rw > 0 && rh > 0) { const r = rectPath(rw, rh, rx); add([{ closed: true, nodes: r.nodes.map((n) => ({ ...n, p: [n.p[0] + x + rw / 2, n.p[1] + y + rh / 2] as Vec2 })) }]); } break; }
        case 'circle': case 'ellipse': { const cx = numAttr(el, 'cx'), cy = numAttr(el, 'cy'), rx = tag === 'circle' ? numAttr(el, 'r') : numAttr(el, 'rx'), ry = tag === 'circle' ? rx : numAttr(el, 'ry');
          if (rx > 0 && ry > 0) { const e = ellipsePath(rx * 2, ry * 2); add([{ closed: true, nodes: e.nodes.map((n) => ({ ...n, p: [n.p[0] + cx, n.p[1] + cy] as Vec2 })) }]); } break; }
        case 'line': add([{ closed: false, nodes: [node(numAttr(el, 'x1'), numAttr(el, 'y1')), node(numAttr(el, 'x2'), numAttr(el, 'y2'))] }]); break;
        case 'polyline': case 'polygon': {
          const n = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
          const nodes: PathNode[] = []; for (let k = 0; k + 1 < n.length; k += 2) nodes.push(node(n[k]!, n[k + 1]!));
          if (nodes.length > 1) add([{ closed: tag === 'polygon', nodes }]); break; }
        case 'image': case 'text': case 'use': case 'foreignObject': case 'filter': skipped.add(tag); break;
        default: if (!['switch'].includes(tag)) skipped.add(tag);
      }
    } catch { skipped.add(`${tag} (bad path data)`); }
  };
  walk(root, place, BASE);

  const layers: Layer[] = [];
  const stops = (g: Element): GradStop[] => {
    let src: Element | null = g; let list = Array.from(src.querySelectorAll('stop'));
    for (let hops = 0; !list.length && hops < 4; hops++) { const ref: string | null = src?.getAttribute('href') ?? src?.getAttribute('xlink:href') ?? null; src = ref ? grads.get(ref.replace('#', '')) ?? null : null; if (!src) break; list = Array.from(src.querySelectorAll('stop')); }
    return list.map((s) => { const off = (s.getAttribute('offset') ?? '0').trim(); const c = parseColor(s.getAttribute('stop-color') ?? /stop-color\s*:\s*([^;]+)/.exec(s.getAttribute('style') ?? '')?.[1] ?? '#000') ?? [0, 0, 0, 1];
      const so = parseFloat(s.getAttribute('stop-opacity') ?? /stop-opacity\s*:\s*([^;]+)/.exec(s.getAttribute('style') ?? '')?.[1] ?? '1');
      return { at: Math.min(1, Math.max(0, off.endsWith('%') ? parseFloat(off) / 100 : parseFloat(off))), c: [c[0], c[1], c[2], c[3] * (Number.isFinite(so) ? so : 1)] as ColorRGBA }; });
  };

  found.forEach((f, idx) => {
    const baked = xformPath(f.path, f.m), rc = recenter(baked);
    const layer = createShapeLayer('path', settings, startIndex + idx, rc.offset, rc.path);
    layer.name = f.name === 'path' ? `Path ${startIndex + idx + 1}` : f.name;
    const props = { ...layer.props! };
    const scale = Math.sqrt(Math.abs(f.m[0] * f.m[3] - f.m[1] * f.m[2])) || 1;
    const box = (() => { const xs = rc.path.nodes.map((n) => n.p[0]), ys = rc.path.nodes.map((n) => n.p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const; })();
    const paint = (ref: string): Paint | null => {
      const id = /url\(\s*['"]?#([^'")]+)/.exec(ref)?.[1]; const g = id ? grads.get(id) : null; if (!g) return null;
      const radial = g.localName === 'radialGradient', obb = (g.getAttribute('gradientUnits') ?? 'objectBoundingBox') !== 'userSpaceOnUse';
      const pc = (n: string, d: number) => { const v = g.getAttribute(n); if (v === null) return d; return v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v); };
      const toLocal = (x: number, y: number): Vec2 => {
        if (obb) return [box[0] + x * (box[2] - box[0]), box[1] + y * (box[3] - box[1])];
        const q = apply(f.m, x, y); return [q[0] - rc.offset[0], q[1] - rc.offset[1]];
      };
      const from = radial ? toLocal(pc('cx', 0.5), pc('cy', 0.5)) : toLocal(pc('x1', 0), pc('y1', 0));
      const to = radial ? ((): Vec2 => { const c0 = toLocal(pc('cx', 0.5), pc('cy', 0.5)); const r = pc('r', 0.5) * (obb ? Math.max(box[2] - box[0], box[3] - box[1]) : scale); return [c0[0] + r, c0[1]]; })() : toLocal(pc('x2', 1), pc('y2', 0));
      const st = stops(g); if (st.length < 2) return null;
      return { kind: radial ? 'radial' : 'linear', stops: st, from, to };
    };
    const fillRef = f.style.fill;
    let fillPaint: Paint | null = null, fillCol: ColorRGBA | null = null;
    if (fillRef?.startsWith('url(')) fillPaint = paint(fillRef); else fillCol = parseColor(fillRef);
    const strokeRef = f.style.stroke;
    let strokePaint: Paint | null = null, strokeCol: ColorRGBA | null = null;
    if (strokeRef?.startsWith('url(')) strokePaint = paint(strokeRef); else strokeCol = parseColor(strokeRef);
    const hasFill = !!(fillCol || fillPaint);
    props['fill.color'] = { value: fillCol ?? [1, 1, 1, 1] };
    props['fill.opacity'] = { value: f.style.opacity * f.style.fo * 100 * (fillCol ? fillCol[3] : 1) };
    props['stroke.color'] = { value: strokeCol ?? [1, 1, 1, 1] };
    props['stroke.width'] = { value: f.style.sw * scale };
    props['stroke.opacity'] = { value: f.style.opacity * f.style.so * 100 * (strokeCol ? strokeCol[3] : 1) };
    const solid = (): Paint => ({ kind: 'solid', stops: [{ at: 0, c: [1, 1, 1, 1] }, { at: 1, c: [0, 0, 0, 1] }], from: [0, 0], to: [1, 0] });
    layer.props = props;
    layer.shape = {
      ...layer.shape!,
      fill: hasFill && (fillCol || fillPaint) ? (fillPaint ?? solid()) : null,
      stroke: strokeCol || strokePaint ? { cap: f.style.cap, join: f.style.join, dash: 0, gap: 0, paint: strokePaint ?? solid() } : null,
    };
    layers.push(layer);
  });
  return { layers: layers.reverse(), skipped: [...skipped], width: w, height: h };
}
