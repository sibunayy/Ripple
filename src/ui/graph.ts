// @ts-nocheck
import { $, esc } from '../core/dom';
import { DUR } from '../model/project';
import { ic } from './icons';
import { earr } from '../anim/easing';
import { PROPS, TF } from '../model/schema';
import { animated, lay, val } from '../anim/interpolate';
import { S } from '../state/state';
import { commit } from '../state/history';
import { updateCanvas } from '../render/stage';
import { fmt, tc } from './inspector/controls';
import { selectedKeyObjs } from '../anim/clipboard';
import { renderRight, updateFields } from './inspector/index';
import { renderAll, seek } from './layout';
import { play } from '../playback/loop';
import { longPress, setDragging, setSuppressClick } from '../events/delegate';

const GCOL = { x: '#4aa8ff', y: '#bfe3f5', scale: '#4fd1c5', rot: '#ef6f7f', op: '#b9d65a', ax: '#a8b4c4', ay: '#8e9aaa', ts: '#e0b04a', te: '#c9915a' };
export function graphHtml(l) {
  if (!l) return `<p class="hint">Select a layer to see its animation curves.</p>`;
  const ps = TF.filter((p) => animated(l.p[p]));
  if (!ps.length) return `<p class="hint">${esc(l.name)} has no animated properties yet. Tap the ${ic('diamond', 'xs')} in Properties to start.</p>`;
  const legend = ps.map((p) => `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:12px;font-size:var(--fs-xs);color:var(--muted)"><i style="width:10px;height:3px;border-radius:2px;background:${GCOL[p]}"></i>${PROPS[p].label}</span>`).join('');
  return `<div style="display:grid;grid-template-columns:var(--name) minmax(0,1fr) var(--gut);height:calc(100% - 4px);min-height:160px">
    <div style="padding:10px 12px">${legend}<div class="tc" id="gread" style="margin-top:8px;font-size:var(--fs-xs);color:var(--acc-text);min-height:16px"></div><p class="hint" style="padding:6px 0 0">Drag the graph to scrub. Drag a point to retime or change its value. Select a point to shape its ease with the handles.</p></div>
    <div style="position:relative;height:100%;min-height:160px"><svg class="graph" id="gsvg" aria-label="Value graph"></svg><span class="ph" style="top:0"></span></div><span></span></div>`;
}
/* Interactive graph editor: scrub, select/drag keyframes, drag ease handles. */
let gRO = null, gObs = null, GM = { W: 1, H: 1, T: 22, B: 22 }, GL = null;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function gmap(l, p) {
  if (GL && GL[p]) return GL[p];
  const vs = l.p[p].keys.map((k) => k.v); let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const s = hi - lo; return { lo: lo - s * .15, hi: hi + s * .15 };
}
const gx = (f) => f / DUR * GM.W;
const gy = (m, v) => GM.T + (1 - (v - m.lo) / (m.hi - m.lo)) * (GM.H - GM.T - GM.B);
const gv = (m, y) => m.lo + (1 - (y - GM.T) / (GM.H - GM.T - GM.B)) * (m.hi - m.lo);
export function drawGraph() {
  const svg = $('#gsvg'); if (!svg) return;
  const wrap = svg.parentElement;
  if (!gRO) gRO = new ResizeObserver(() => drawGraph());
  if (gObs !== wrap) { gRO.disconnect(); gRO.observe(wrap); gObs = wrap; }
  const l = S.sel && lay(S.sel); if (!l) return;
  const W = wrap.clientWidth, H = wrap.clientHeight; if (W < 20 || H < 20) return;
  GM = { W, H, T: 22, B: 22 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const ps = TF.filter((p) => animated(l.p[p]));
  const first = S.keys.find((k) => k.l === l.id);
  let curves = '', dots = '', arms = '', hands = '';
  for (const p of ps) {
    const ks = l.p[p].keys, m = gmap(l, p), c = GCOL[p];
    let d = ''; for (let f = 0; f <= DUR; f++) d += (f ? 'L' : 'M') + gx(f).toFixed(1) + ' ' + gy(m, val(l.p[p], f)).toFixed(1);
    curves += `<path d="${d}" stroke="${c}"/>`;
    ks.forEach((k, i) => {
      const on = S.keys.some((s) => s.l === l.id && s.p === p && s.i === i), cx = gx(k.t).toFixed(1), cy = gy(m, k.v).toFixed(1);
      dots += `<circle cx="${cx}" cy="${cy}" r="${on ? 7 : 5}" fill="${on ? '#fff' : c}" stroke="${on ? c : 'var(--surface)'}" stroke-width="${on ? 3 : 1.5}"/><circle data-gk="1" data-p="${p}" data-i="${i}" cx="${cx}" cy="${cy}" r="18" fill="transparent"><title>${PROPS[p].label} at ${tc(k.t)}</title></circle>`;
    });
    if (first && first.p === p && ks[first.i + 1]) {
      const k = ks[first.i], n = ks[first.i + 1], a = earr(k), x0 = gx(k.t), y0 = gy(m, k.v), dx = gx(n.t) - x0, dy = gy(m, n.v) - y0;
      if (Math.abs(dy) > 6) {
        [[1, a[0], a[1]], [2, a[2], a[3]]].forEach(([h, ax, ay]) => {
          const hx = (x0 + ax * dx).toFixed(1), hy = (y0 + ay * dy).toFixed(1), ex = h === 1 ? x0 : x0 + dx, ey = h === 1 ? y0 : y0 + dy;
          arms += `<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${hx}" y2="${hy}" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="3 3"/>`;
          hands += `<circle cx="${hx}" cy="${hy}" r="6.5" fill="var(--surface)" stroke="${c}" stroke-width="2"/><circle data-gh="${h}" data-p="${p}" data-i="${first.i}" cx="${hx}" cy="${hy}" r="18" fill="transparent"/>`;
        });
      }
    }
  }
  svg.innerHTML = `<path class="gl" d="M0 ${GM.T}H${W}M0 ${H - GM.B}H${W}"/>${curves}${arms}${dots}${hands}`;
}
export function graphDown(e) {
  const gh = e.target.closest('[data-gh]'), gk = e.target.closest('[data-gk]');
  const l = S.sel && lay(S.sel); if (!l) return;
  if (S.playing) play(false);
  const svg = $('#gsvg'); if (!svg) return;
  e.preventDefault(); svg.setPointerCapture(e.pointerId);
  const pt = (ev) => { const r = svg.getBoundingClientRect(); return [(ev.clientX - r.left) * GM.W / r.width, (ev.clientY - r.top) * GM.H / r.height]; };
  const end = (mv, up) => { svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up); };
  const bind = (mv, up) => { svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up); };
  const read = $('#gread');
  if (gh) {
    const p = gh.dataset.p, h = +gh.dataset.gh, keys = l.p[p].keys, k0 = keys[+gh.dataset.i], n0 = keys[+gh.dataset.i + 1], m = gmap(l, p);
    if (!n0) return;
    const targets = [k0, ...selectedKeyObjs().filter((k) => k !== k0)];
    const x0 = gx(k0.t), y0 = gy(m, k0.v), dx = gx(n0.t) - x0, dy = gy(m, n0.v) - y0, a = [...earr(k0)];
    const mv = (ev) => {
      const [x, y] = pt(ev), cx = clamp((x - x0) / dx, 0, 1), cy = clamp((y - y0) / dy, -.8, 1.8);
      if (h === 1) { a[0] = cx; a[1] = cy; } else { a[2] = cx; a[3] = cy; }
      targets.forEach((k) => (k.e = [...a])); setDragging(true);
      if (read) read.textContent = 'Ease ' + a.map((n) => n.toFixed(2)).join(', ');
      drawGraph(); updateCanvas();
    };
    const up = () => { end(mv, up); setDragging(false); commit('Edit curve'); renderAll(); };
    bind(mv, up); return;
  }
  if (gk) {
    const p = gk.dataset.p, i = +gk.dataset.i, keys = l.p[p].keys, k = keys[i], m = gmap(l, p), me = { l: l.id, p, i };
    GL = { [p]: m };
    if (e.shiftKey) { const j = S.keys.findIndex((s) => s.l === me.l && s.p === p && s.i === i); j >= 0 ? S.keys.splice(j, 1) : S.keys.push(me); } else S.keys = [me];
    drawGraph();
    const sx = e.clientX, sy = e.clientY; let moved = false;
    const isLong = longPress(e, () => { end(mv, up); GL = null; seek(k.t); S.pop = { type: 'ease', x: sx, y: sy }; renderAll(); });
    const mv = (ev) => {
      if (isLong()) return;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      if (!moved) { moved = true; setDragging(true); }
      const [x, y] = pt(ev);
      k.t = clamp(Math.round(x / GM.W * DUR), i > 0 ? keys[i - 1].t + 1 : 0, i < keys.length - 1 ? keys[i + 1].t - 1 : DUR - 1);
      k.v = clamp(gv(m, clamp(y, GM.T, GM.H - GM.B)), PROPS[p].min, PROPS[p].max);
      if (read) read.textContent = `${PROPS[p].label} ${fmt(k.v, PROPS[p])} · ${tc(k.t)}`;
      drawGraph(); updateCanvas(); updateFields();
    };
    const up = () => { end(mv, up); GL = null; setDragging(false); if (isLong()) return; if (moved) { commit('Edit keyframe'); setSuppressClick(true); } renderAll(); };
    bind(mv, up); return;
  }
  const set = (ev) => seek(Math.round(pt(ev)[0] / GM.W * DUR));
  set(e);
  const up = () => { end(set, up); renderRight(); };
  bind(set, up);
}
