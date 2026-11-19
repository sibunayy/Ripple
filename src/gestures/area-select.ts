import { DUR, layers } from '../model/project';
import { lay } from '../anim/interpolate';
import { S, selIds } from '../state/state';
import { gEls, vp } from '../render/stage';
import { toast } from '../ui/toast';
import { renderAll } from '../ui/layout';
import { pip } from '../state/selection';
import { drawOverlay } from '../drawing/overlay';
import { setDragging } from '../events/delegate';

export let areaSvg = '';
export function areaSelect(e) {
  const v = vp.getBoundingClientRect(), lasso = S.tool === 'lasso', pts = [[e.clientX - v.left, e.clientY - v.top]], add = e.shiftKey ? selIds() : [];
  let moved = false;
  const mv = (ev) => {
    const q = [ev.clientX - v.left, ev.clientY - v.top];
    if (!moved && Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) < 4) return; moved = true; setDragging(true);
    if (lasso) pts.push(q); else pts[1] = q;
    if (lasso) areaSvg = `<path class="area" d="M${pts.map((r) => r[0].toFixed(1) + ' ' + r[1].toFixed(1)).join('L')}Z"/>`;
    else { const [a, b] = pts; areaSvg = `<rect class="area" x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(a[0] - b[0])}" height="${Math.abs(a[1] - b[1])}"/>`; }
    drawOverlay();
  };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    setDragging(false); areaSvg = '';
    if (!moved) { const g = e.target.closest('g[data-id]'), L = g && lay(g.dataset.id); S.multi.clear(); S.sel = L && !L.lock ? L.id : null; S.keys = []; renderAll(); return; }
    const hit = layers.filter((l) => l.vis && !l.lock && gEls[l.id] && !['solid', 'shader', 'adjust'].includes(l.type) && S.f >= (l.inP ?? 0) && S.f < (l.outP ?? DUR)).filter((l) => {
      const b = gEls[l.id].getBoundingClientRect(); if (b.width < 1 && b.height < 1) return false;
      const r = { l: b.left - v.left, t: b.top - v.top, r: b.right - v.left, b: b.bottom - v.top };
      if (!lasso) { const [a, c] = [pts[0], pts[1] || pts[0]]; return r.l < Math.max(a[0], c[0]) && r.r > Math.min(a[0], c[0]) && r.t < Math.max(a[1], c[1]) && r.b > Math.min(a[1], c[1]); }
      return pts.length > 2 && pip([(r.l + r.r) / 2, (r.t + r.b) / 2], pts);
    }).map((l) => l.id);
    const ids = [...new Set([...add, ...hit])];
    S.multi = new Set(ids); S.sel = ids[0] || null; S.keys = []; renderAll();
    toast(ids.length ? `${ids.length} layer${ids.length > 1 ? 's' : ''} selected` : 'Nothing inside the selection');
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
