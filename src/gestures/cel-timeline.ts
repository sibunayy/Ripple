import { $ } from '../core/dom';
import { DUR } from '../model/project';
import { lay } from '../anim/interpolate';
import { S } from '../state/state';
import { commit } from '../state/history';
import { updateCanvas } from '../render/stage';
import { tc } from '../ui/inspector/controls';
import { renderTL } from '../ui/timeline';
import { clamp } from '../ui/graph';
import { toast } from '../ui/toast';
import { renderAll, seek } from '../ui/layout';
import { play } from '../playback/loop';
import { celIdx } from '../drawing/cels';
import { longPress, setDragging, setSuppressClick } from '../events/delegate';

/* ---- timeline cels ---- */
export function celBlocks(L) {
  const cels = L.cels || [], k = L.id === S.sel ? celIdx(L, S.f) : -1;
  return cels.map((c, i) => { const end = cels[i + 1] ? cels[i + 1].f : (L.outP ?? DUR); return `<span class="celblk ${c.strokes.length ? '' : 'empty'} ${i === k ? 'on' : ''}" data-cel="${c.id}" style="left:${c.f / DUR * 100}%;width:${Math.max(0, end - c.f) / DUR * 100}%" title="Cel ${i + 1} · ${tc(c.f)} · drag to retime, hold for options"></span>`; }).join('');
}
export function celDown(e, el) {
  e.stopPropagation(); e.preventDefault();
  const trk = el.closest('.ttrack'), l = lay(trk.dataset.l), c = l && (l.cels || []).find((x) => x.id === el.dataset.cel); if (!c) return;
  if (S.playing) play(false);
  const x0 = e.clientX, W = trk.clientWidth, f0 = c.f, i = l.cels.indexOf(c), prev = l.cels[i - 1], next = l.cels[i + 1];
  const lo = prev ? prev.f + 1 : 0, hi = next ? next.f - 1 : DUR - 1; let moved = false;
  const isLong = longPress(e, () => { S.sel = l.id; S.pop = { type: 'cel', l: l.id, id: c.id, x: e.clientX, y: e.clientY }; renderAll(); });
  const mv = (ev) => {
    if (isLong()) return;
    const dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 6) return;
    moved = true; setDragging(true);
    const nf = clamp(f0 + Math.round(dx / W * DUR), lo, hi);
    if (nf !== c.f) { c.f = nf; S.sel = l.id; seek(nf); renderTL(); const b = $(`[data-cel="${c.id}"]`); if (b) b.classList.add('drag'); }
  };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); setDragging(false);
    if (isLong()) return;
    if (moved) { if (c.f !== f0) { commit('Retime cel'); toast(`Cel moved to ${tc(c.f)}`, true); } setSuppressClick(true); renderAll(); return; }
    S.sel = l.id; S.multi = new Set(); seek(c.f); renderAll();
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
// Hold to see the previous cel in place; drag left or right while holding to flip through cels.
export function flipDrag(e) {
  e.preventDefault();
  const l = S.sel && lay(S.sel); if (!l || l.type !== 'draw' || (l.cels || []).length < 2) { toast('Flip needs at least two cels.'); return; }
  if (S.playing) play(false);
  const k = Math.max(0, celIdx(l, S.f)), x0 = e.clientX, n = l.cels.length;
  S.flip = Math.max(0, k - 1); updateCanvas();
  const mv = (ev) => { const nf = clamp(k - 1 + Math.round((ev.clientX - x0) / 26), 0, n - 1); if (nf !== S.flip) { S.flip = nf; updateCanvas(); } };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); S.flip = null; updateCanvas(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
