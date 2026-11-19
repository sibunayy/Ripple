// @ts-nocheck
import { $$ } from '../core/dom';
import { layers } from '../model/project';
import { lay } from '../anim/interpolate';
import { S, selIds } from '../state/state';
import { commit } from '../state/history';
import { buildCanvas } from '../render/stage';
import { clamp } from '../ui/graph';
import { toast } from '../ui/toast';
import { renderAll } from '../ui/layout';
import { setDragging, setSuppressClick } from '../events/delegate';

/* Hold-and-drag reorder. Hold ~0.4 s to lift the item, drag to move it, release to drop.
   groups: arrays of elements that move together; from: index of the held group.
   onDone(from, to) runs when the order changed; onTap(x, y) when released in place after a hold. */
let reorderLive = false;
function holdReorder(e, groups, from, o) {
  if (e.button > 0 || from < 0) return;
  const n = groups.length, sx = e.clientX, sy = e.clientY;
  let lx = sx, ly = sy, lifted = false, to = from, geo = null;
  const tm = setTimeout(() => {
    lifted = true; reorderLive = true; setDragging(true); setSuppressClick(true);
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch { /* unsupported */ } }
    geo = groups.map((g) => { const a = g[0].getBoundingClientRect(), b = g[g.length - 1].getBoundingClientRect(); return { top: a.top, h: b.bottom - a.top }; });
    groups.forEach((g, i) => g.forEach((x) => x.classList.add(i === from ? 'rz-lift' : 'rz-shift')));
  }, 380);
  const clear = () => { groups.forEach((g) => g.forEach((x) => { x.classList.remove('rz-lift', 'rz-shift'); x.style.transform = ''; })); };
  const stop = () => { clearTimeout(tm); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel); reorderLive = false; };
  const mv = (ev) => {
    lx = ev.clientX; ly = ev.clientY;
    if (!lifted) { if (Math.hypot(lx - sx, ly - sy) > 8) stop(); return; }
    const lo = geo[0].top - geo[from].top, hi = geo[n - 1].top + geo[n - 1].h - geo[from].top - geo[from].h;
    const dy = clamp(ly - sy, lo, hi);
    groups[from].forEach((x) => (x.style.transform = `translateY(${dy}px)`));
    const c = geo[from].top + geo[from].h / 2 + dy;
    to = geo.findIndex((g) => c < g.top + g.h); if (to < 0) to = n - 1;
    groups.forEach((g, i) => { if (i === from) return; const t2 = from < to && i > from && i <= to ? -geo[from].h : from > to && i >= to && i < from ? geo[from].h : 0; g.forEach((x) => (x.style.transform = t2 ? `translateY(${t2}px)` : '')); });
  };
  const finish = () => { const was = lifted; stop(); setDragging(false); clear(); if (was) setTimeout(() => { setSuppressClick(false); }, 80); return was; };
  const cancel = () => { finish(); };
  const up = () => {
    if (!finish()) return;
    if (to !== from) o.onDone(from, to);
    else if (Math.hypot(lx - sx, ly - sy) < 6 && o.onTap) o.onTap(lx, ly);
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
}
export function layerHold(e, row) {
  const tl = row.classList.contains('trow'), list = row.parentElement;
  const heads = $$(tl ? '.trow:not(.sub)' : '.lrow', list), id = row.dataset.ctx, prevSel = selIds();
  const groups = heads.map((h) => { const g = [h]; if (tl) for (let s = h.nextElementSibling; s && s.classList.contains('sub'); s = s.nextElementSibling) g.push(s); return g; });
  holdReorder(e, groups, heads.indexOf(row), {
    onDone: (a, b) => { const l = lay(heads[a].dataset.ctx), j = layers.indexOf(lay(heads[b].dataset.ctx)); layers.splice(layers.indexOf(l), 1); layers.splice(j, 0, l); S.sel = l.id; commit('Reorder layers'); buildCanvas(); renderAll(); toast('Moved ' + l.name, true); },
    onTap: (x, y) => { S.ctxPrev = prevSel; if (!prevSel.includes(id)) { S.sel = id; S.multi.clear(); } S.pop = { type: 'ctx', id, x, y }; renderAll(); },
  });
}
export function fxReorder(e, fx) {
  const l = S.sel && lay(S.sel); if (!l) return;
  const items = $$('.fx', fx.parentElement);
  holdReorder(e, items.map((x) => [x]), items.indexOf(fx), {
    onDone: (a, b) => { const [x] = l.fx.splice(a, 1); l.fx.splice(b, 0, x); commit('Reorder effects'); buildCanvas(); renderAll(); toast('Moved ' + x.name, true); },
  });
}
/** Registers this module's event listeners. main.ts calls it once, in the original order. */
export function listen() {
  document.addEventListener('touchmove', (ev) => { if (reorderLive && ev.cancelable) ev.preventDefault(); }, { passive: false });
}
