import { FPS } from '../model/project';
import { lay, val } from './interpolate';

/* ---- procedural pose: keyframes + behaviours + duplicator ---- */
function noise1(x, seed) {
  const h = (n) => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const i = Math.floor(x), t = x - i, u = t * t * (3 - 2 * t);
  return h(i) * (1 - u) + h(i + 1) * u;
}
export const REP_DEF = { on: true, mode: 'linear', count: 5, dx: 60, dy: 0, rot: 0, sc: 0, rad: 160, align: true, cols: 4, fade: 0, stag: 3 };
export function pose(l, f, i) {
  const ff = l.rep && l.rep.on ? f - (l.rep.stag || 0) * i : f, v = (p, d) => (l.p[p] ? val(l.p[p], ff) : d);
  const q = { x: v('x', 0), y: v('y', 0), s: v('scale', 100), r: v('rot', 0), o: v('op', 100), ax: v('ax', 0), ay: v('ay', 0), ts: v('ts', 0), te: v('te', 100), fx: l.flipX ? -1 : 1, fy: l.flipY ? -1 : 1 };
  const t = f / FPS;
  for (const m of l.mods || []) {
    if (!m.on) continue;
    let d = 0;
    const tl = Math.max(0, t - (l.inP ?? 0) / FPS + i * (m.ph || 0));
    if (m.kind === 'wiggle') d = m.amp * noise1(t * m.freq + i * (m.ph || 0) * 3, m.seed || 1);
    else if (m.kind === 'jitter') d = m.amp * noise1(Math.floor(t * m.freq * 4 + i * (m.ph || 0) * 3) * 1.37, m.seed || 1);
    else if (m.kind === 'osc') d = m.amp * Math.sin(Math.PI * 2 * (t * m.freq + i * (m.ph || 0)));
    else if (m.kind === 'bounce') d = m.amp * Math.exp(-(m.dec ?? 4) * tl) * Math.cos(Math.PI * 2 * m.freq * tl);
    else if (m.kind === 'pulse') { const ph = (t * m.freq + i * (m.ph || 0)) % 1; d = m.amp * Math.exp(-ph * (m.dec ?? 6)); }
    else if (m.kind === 'orbit') { const a = Math.PI * 2 * (t * m.freq + i * (m.ph || 0)); q.x += m.amp * Math.cos(a); q.y += m.amp * Math.sin(a) * (m.ell ?? 100) / 100; continue; }
    else d = m.amp * t;
    const k = m.kind === 'spin' ? 'r' : { x: 'x', y: 'y', rot: 'r', scale: 's', op: 'o' }[m.tgt] || 'y';
    q[k] += d;
  }
  return q;
}
export function repXf(l, q, i) {
  const R = l.rep, n = Math.max(1, R.count | 0);
  if (R.mode === 'radial') { const a = i / n * Math.PI * 2 - Math.PI / 2; q.x += Math.cos(a) * R.rad; q.y += Math.sin(a) * R.rad; if (R.align) q.r += i / n * 360; }
  else if (R.mode === 'grid') { const c = Math.max(1, R.cols | 0), rows = Math.ceil(n / c); q.x += ((i % c) - (c - 1) / 2) * R.dx; q.y += (Math.floor(i / c) - (rows - 1) / 2) * R.dy; }
  else { q.x += R.dx * i; q.y += R.dy * i; }
  q.r += R.rot * i; q.s *= Math.pow(Math.max(0, 1 + R.sc / 100), i); q.o *= Math.pow(Math.max(0, 1 - R.fade / 100), i);
}
export function mat(q) { const m = new DOMMatrix(); m.translateSelf(q.x, q.y); m.rotateSelf(q.r); m.scaleSelf(Math.max(0, q.s) / 100 * (q.fx || 1), Math.max(0, q.s) / 100 * (q.fy || 1)); m.translateSelf(-q.ax, -q.ay); return m; }
export const mstr = (m) => `matrix(${m.a.toFixed(5)} ${m.b.toFixed(5)} ${m.c.toFixed(5)} ${m.d.toFixed(5)} ${m.e.toFixed(3)} ${m.f.toFixed(3)})`;
export function world(l, f, d = 0) { const own = mat(pose(l, f, 0)); return l.parent && lay(l.parent) && d < 8 ? relM(l, f, d).multiply(own) : own; }
/* A parented layer follows its parent's movement since the frame it was parented, so it keeps its look at that frame. */
export function relM(l, f, d) {
  const p = lay(l.parent); let inv;
  try { inv = world(p, l.pt || 0, d + 1).inverse(); if (!isFinite(inv.a) || !isFinite(inv.e)) inv = new DOMMatrix(); } catch { inv = new DOMMatrix(); }
  return world(p, f, d + 1).multiply(inv);
}
export const repN = (l) => (l.rep && l.rep.on ? Math.max(1, Math.min(60, Math.round(l.rep.count) || 1)) : 1);
export let xfEls = {};
export function setXfEls(v) { return (xfEls = v); }
