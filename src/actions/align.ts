import { lay, val } from '../anim/interpolate';
import { S, selIds } from '../state/state';
import { commit } from '../state/history';
import { setVal } from '../anim/keys';
import { gEls, stage, toLocal, updateCanvas } from '../render/stage';
import { toast } from '../ui/toast';
import { renderAll } from '../ui/layout';

export function alignTo(v) {
  const ls = selIds().map(lay).filter((l) => l && !l.lock && gEls[l.id]); if (!ls.length) return;
  const sr = stage.getBoundingClientRect();
  const boxes = ls.map((l) => { const r = gEls[l.id].getBoundingClientRect(); return { l: (r.left - sr.left) / sr.width * 1920, r: (r.right - sr.left) / sr.width * 1920, t: (r.top - sr.top) / sr.height * 1080, b: (r.bottom - sr.top) / sr.height * 1080 }; });
  const U = ls.length > 1 ? { l: Math.min(...boxes.map((b) => b.l)), r: Math.max(...boxes.map((b) => b.r)), t: Math.min(...boxes.map((b) => b.t)), b: Math.max(...boxes.map((b) => b.b)) } : { l: 0, r: 1920, t: 0, b: 1080 };
  const shift = (l, dx, dy) => { if (!dx && !dy) return; const [lx, ly] = toLocal(l, dx, dy); setVal(l, 'x', Math.round(val(l.p.x, S.f) + lx)); setVal(l, 'y', Math.round(val(l.p.y, S.f) + ly)); };
  if (v === 'dh' || v === 'dv') {
    const h = v === 'dh', o = ls.map((l, i) => ({ l, c: h ? (boxes[i].l + boxes[i].r) / 2 : (boxes[i].t + boxes[i].b) / 2 })).sort((a, b) => a.c - b.c);
    const c0 = o[0].c, c1 = o[o.length - 1].c; o.forEach((q, i) => { const d = c0 + (c1 - c0) * i / (o.length - 1) - q.c; h ? shift(q.l, d, 0) : shift(q.l, 0, d); });
  } else ls.forEach((l, i) => { const b = boxes[i]; shift(l, v === 'left' ? U.l - b.l : v === 'right' ? U.r - b.r : v === 'hcenter' ? (U.l + U.r - b.l - b.r) / 2 : 0, v === 'top' ? U.t - b.t : v === 'bottom' ? U.b - b.b : v === 'vcenter' ? (U.t + U.b - b.t - b.b) / 2 : 0); });
  S.pop = null; commit('Align'); updateCanvas(); renderAll();
  toast(v === 'dh' || v === 'dv' ? `Distributed ${ls.length} layers` : `Aligned to ${ls.length > 1 ? 'selection' : 'composition'}`, true);
}
