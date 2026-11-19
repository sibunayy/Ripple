// @ts-nocheck
import { $, $$ } from '../core/dom';
import { DUR, layers } from '../model/project';
import { TF } from '../model/schema';
import { animated, keyAt, lay } from '../anim/interpolate';
import { S, selIds } from '../state/state';
import { commit } from '../state/history';
import { updateCanvas } from '../render/stage';
import { tc } from '../ui/inspector/controls';
import { renderRight } from '../ui/inspector/index';
import { renderTL } from '../ui/timeline';
import { clamp } from '../ui/graph';
import { toast } from '../ui/toast';
import { renderAll, seek } from '../ui/layout';
import { play } from '../playback/loop';
import { longPress, setSuppressClick } from '../events/delegate';

export function jumpKey(dir) {
  const ids = selIds().length ? selIds() : layers.map((l) => l.id);
  const ts = [...new Set(ids.map(lay).filter(Boolean).flatMap((l) => TF.flatMap((p) => animated(l.p[p]) ? l.p[p].keys.map((k) => k.t) : [])))].sort((a, b) => a - b);
  const t = dir < 0 ? ts.filter((x) => x < S.f - .5).pop() : ts.find((x) => x > S.f + .5);
  if (t == null) { toast(dir < 0 ? 'No earlier keyframe' : 'No later keyframe'); return; }
  if (S.playing) play(false); seek(t); renderTL(); renderRight();
}
export function tcDrag(e) {
  e.preventDefault(); const x0 = e.clientX, f0 = Math.round(S.f); if (S.playing) play(false);
  const mv = (ev) => seek(clamp(f0 + Math.round((ev.clientX - x0) / 6), 0, DUR - 1));
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); renderTL(); renderRight(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
export function waDrag(e, i) {
  e.preventDefault(); e.stopPropagation();
  const mv = (ev) => { const r = $('#scrub').getBoundingClientRect(), f = Math.round((ev.clientX - r.left) / r.width * DUR); S.wa[i] = i ? clamp(f, S.wa[0] + 5, DUR) : clamp(f, 0, S.wa[1] - 5); renderTL(); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); toast(`Loop ${tc(S.wa[0])} – ${tc(S.wa[1])}`); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
export function trimDrag(e, el, trk) {
  e.preventDefault(); e.stopPropagation();
  const L = lay(trk.dataset.l); if (!L) return; const side = el.dataset.trim, bar = trk.querySelector('.bar'); let moved = false;
  const mv = (ev) => {
    moved = true; const r = trk.getBoundingClientRect(), f = Math.round((ev.clientX - r.left) / r.width * DUR);
    if (side === 'in') L.inP = clamp(f, 0, (L.outP ?? DUR) - 1); else L.outP = clamp(f, (L.inP ?? 0) + 1, DUR);
    bar.style.left = (L.inP ?? 0) / DUR * 100 + '%'; bar.style.right = (DUR - (L.outP ?? DUR)) / DUR * 100 + '%'; updateCanvas();
  };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); if (moved) { commit('Trim layer'); renderAll(); toast(`${L.name} plays ${tc(L.inP ?? 0)} – ${tc(L.outP ?? DUR)}`, true); } };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
// Dope-sheet track: drag on empty space = keyframe marquee; hold the layer bar, then drag = slide the layer in time.
export function trackDown(e, trk) {
  const rows = $('#tlrows'); if (!rows) return;
  const L = trk.dataset.l && lay(trk.dataset.l), bar = e.target.closest('.bar');
  const x0 = e.clientX, y0 = e.clientY; let mode = null, sl = null;
  const isLong = bar && L ? longPress(e, () => {
    mode = 'slide'; sl = { inP: L.inP ?? 0, outP: L.outP ?? DUR, keys: TF.flatMap((p) => animated(L.p[p]) ? L.p[p].keys.map((k) => [k, k.t]) : []), anims: (L.anims || []).map((a) => [a, a.start]) };
    trk.closest('.trow').classList.add('sliding'); toast('Drag to slide ' + L.name + ' in time');
  }) : () => false;
  const box = document.createElement('div'); box.className = 'kmq';
  const mv = (ev) => {
    if (mode === 'slide') {
      const w = trk.clientWidth, d = clamp(Math.round((ev.clientX - x0) / w * DUR), -sl.inP, DUR - sl.outP);
      L.inP = sl.inP + d; L.outP = sl.outP + d; sl.keys.forEach(([k, t]) => (k.t = t + d)); sl.anims.forEach(([a, s0]) => (a.start = s0 + d));
      const b = trk.querySelector('.bar'); b.style.left = L.inP / DUR * 100 + '%'; b.style.right = (DUR - L.outP) / DUR * 100 + '%';
      trk.querySelectorAll('.dk').forEach((dk) => (dk.style.transform = `translateX(${d / DUR * w}px)`)); updateCanvas(); return;
    }
    if (isLong()) return;
    if (!mode) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; mode = 'mq'; rows.appendChild(box); }
    const rr = rows.getBoundingClientRect();
    Object.assign(box.style, { left: Math.min(x0, ev.clientX) - rr.left + rows.scrollLeft + 'px', top: Math.min(y0, ev.clientY) - rr.top + rows.scrollTop + 'px', width: Math.abs(ev.clientX - x0) + 'px', height: Math.abs(ev.clientY - y0) + 'px' });
  };
  const up = (ev) => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    if (mode === 'slide') { commit('Slide layer'); renderAll(); toast(`${L.name} now starts at ${tc(L.inP)}`, true); return; }
    if (mode !== 'mq') return;
    box.remove(); setSuppressClick(true);
    const X1 = Math.min(x0, ev.clientX), X2 = Math.max(x0, ev.clientX), Y1 = Math.min(y0, ev.clientY), Y2 = Math.max(y0, ev.clientY);
    const inside = (dk) => { const b = dk.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2; return cx >= X1 && cx <= X2 && cy >= Y1 && cy <= Y2; };
    const sel = [], has = (l, p, i) => sel.some((q) => q.l === l && q.p === p && q.i === i);
    $$('#tlrows .dk[data-dk="one"]').forEach((dk) => { if (inside(dk) && !has(dk.dataset.l, dk.dataset.p, +dk.dataset.i)) sel.push({ l: dk.dataset.l, p: dk.dataset.p, i: +dk.dataset.i }); });
    $$('#tlrows .dk[data-dk="agg"]').forEach((dk) => { if (!inside(dk)) return; const LL = lay(dk.dataset.l), t = +dk.dataset.t; TF.forEach((p) => { const i = keyAt(LL.p[p], t); if (i >= 0 && !has(LL.id, p, i)) sel.push({ l: LL.id, p, i }); }); });
    S.keys = sel; if (sel[0] && !selIds().includes(sel[0].l)) { S.sel = sel[0].l; S.multi.clear(); }
    renderAll(); toast(sel.length ? `${sel.length} keyframes selected` : 'No keyframes in that area');
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
