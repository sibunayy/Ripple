import { $, app } from '../core/dom';
import { animated, keyAt, lay, val } from '../anim/interpolate';
import { S, selIds } from '../state/state';
import { commit } from '../state/history';
import { setVal } from '../anim/keys';
import { anchorAt, selRect, stage, toLocal, updateCanvas } from '../render/stage';
import { updateFields } from '../ui/inspector/index';
import { clamp } from '../ui/graph';
import { renderAll, seek } from '../ui/layout';
import { play } from '../playback/loop';
import { foldEnd, foldStart } from '../ui/autofold';
import { longPress, setDragging } from '../events/delegate';

// Corner handles scale and the knob rotates, around the anchor (one layer) or the selection centre (several).
export function handleDrag(e, el) {
  e.preventDefault(); e.stopPropagation();
  const kind = el.dataset.hd, ls = selIds().map(lay).filter((l) => l && !l.lock); if (!ls.length) return;
  const sr = stage.getBoundingClientRect(), toComp = (x, y) => [(x - sr.left) / sr.width * 1920, (y - sr.top) / sr.height * 1080];
  const multi = ls.length > 1, r = selRect();
  const a0p = multi ? null : anchorAt(ls[0], S.f);
  const c = multi ? toComp(r.left + r.width / 2, r.top + r.height / 2) : [a0p.x, a0p.y];
  const st0 = ls.map((l) => { const w = anchorAt(l, S.f); return { l, x: val(l.p.x, S.f), y: val(l.p.y, S.f), s: val(l.p.scale, S.f), r: val(l.p.rot, S.f), wx: w.x, wy: w.y }; });
  const p0 = toComp(e.clientX, e.clientY), d0 = Math.max(4, Math.hypot(p0[0] - c[0], p0[1] - c[1])), a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
  const badge = $('#spd'); let moved = false;
  const mv = (ev) => {
    const q = toComp(ev.clientX, ev.clientY);
    if (!moved) { moved = true; setDragging(true); foldStart('drag'); }
    let k = 1, dth = 0;
    if (kind === 's') k = Math.max(.01, Math.hypot(q[0] - c[0], q[1] - c[1]) / d0);
    else { dth = (Math.atan2(q[1] - c[1], q[0] - c[0]) - a0) * 180 / Math.PI; if (dth > 180) dth -= 360; if (dth < -180) dth += 360; if (S.snap) dth = Math.round((st0[0].r + dth) / 15) * 15 - st0[0].r; }
    const rad = dth * Math.PI / 180, co = Math.cos(rad), si = Math.sin(rad);
    st0.forEach((o) => {
      if (kind === 's') setVal(o.l, 'scale', clamp(o.s * k, 0, 1000)); else setVal(o.l, 'rot', o.r + dth);
      if (multi) { const vx = o.wx - c[0], vy = o.wy - c[1], [lx, ly] = toLocal(o.l, c[0] + k * (vx * co - vy * si) - o.wx, c[1] + k * (vx * si + vy * co) - o.wy); setVal(o.l, 'x', o.x + lx); setVal(o.l, 'y', o.y + ly); }
    });
    updateCanvas(); updateFields();
    const a = app.getBoundingClientRect(); badge.hidden = false; badge.textContent = kind === 's' ? Math.round(st0[0].s * k) + '%' : Math.round(st0[0].r + dth) + '°';
    badge.style.left = (ev.clientX - a.left + 14) + 'px'; badge.style.top = (ev.clientY - a.top - 34) + 'px';
  };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); setDragging(false); badge.hidden = true; foldEnd('drag'); if (moved) { commit(kind === 's' ? 'Scale' : 'Rotate'); renderAll(); } };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
// Motion-path dots: drag to move that Position keyframe, tap to jump to it, hold for ease presets.
export function mpDrag(e, dot) {
  e.preventDefault(); e.stopPropagation();
  const l = S.sel && lay(S.sel); if (!l) return;
  const t = +dot.dataset.mp, sr = stage.getBoundingClientRect(), x0 = val(l.p.x, t), y0 = val(l.p.y, t), sx = e.clientX, sy = e.clientY; let moved = false;
  const isLong = longPress(e, () => { const ks = []; ['x', 'y'].forEach((p) => { const i = keyAt(l.p[p], t); if (i >= 0) ks.push({ l: l.id, p, i }); }); S.keys = ks; seek(t); S.pop = { type: 'ease', x: sx, y: sy }; renderAll(); });
  const mv = (ev) => {
    if (isLong()) return; if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return; moved = true; setDragging(true);
    const f = S.f; S.f = t;
    const [lx, ly] = toLocal(l, (ev.clientX - sx) / sr.width * 1920, (ev.clientY - sy) / sr.height * 1080, t);
    const nx = Math.round(x0 + lx), ny = Math.round(y0 + ly);
    if (animated(l.p.x) || nx !== Math.round(x0)) setVal(l, 'x', nx, true); if (animated(l.p.y) || ny !== Math.round(y0)) setVal(l, 'y', ny, true);
    S.f = f; updateCanvas(); updateFields();
  };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); setDragging(false); if (isLong()) return; if (moved) { commit('Move position keyframe'); renderAll(); } else { if (S.playing) play(false); seek(t); renderAll(); } };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
