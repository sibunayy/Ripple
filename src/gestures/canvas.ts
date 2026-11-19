import { $ } from '../core/dom';
import { layers } from '../model/project';
import { lay, val } from '../anim/interpolate';
import { S, isDrawTool, selIds } from '../state/state';
import { commit, hi, hist, setLastLabel } from '../state/history';
import { setVal } from '../anim/keys';
import { buildCanvas, compPt, layoutStage, placeSel, stage, toLocal, updateCanvas, vp } from '../render/stage';
import { renderStrips } from '../ui/strips';
import { updateFields } from '../ui/inspector/index';
import { renderFloats } from '../ui/floats';
import { toast } from '../ui/toast';
import { renderAll } from '../ui/layout';
import { foldEnd, foldStart } from '../ui/autofold';
import { newLayer } from '../actions/layers';
import { toggleMember } from '../state/selection';
import { areaSelect } from './area-select';
import { saveBrush } from '../drawing/cels';
import { drawDown } from '../drawing/ink';
import { renderBrushBar } from '../drawing/brush-bar';
import { drawOverlay } from '../drawing/overlay';
import { longPress, setDragging, setSuppressClick } from '../events/delegate';

// Canvas: select/move, hand pan, pinch zoom, place shapes and text.
export const ptrs = new Map(); export let pinch0 = null, penSeen = false;
 // a stale suppress flag from a drag that ended off-target must not eat the next tap
export function penFinish(close) {
  const P = S.penPts; S.penPts = [];
  if (P.length < 2) { drawOverlay(); renderFloats(); if (P.length) toast('A path needs at least two points'); return; }
  const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]), cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2), cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
  S.tool = 'select'; S.selMode = 'select';
  newLayer('path', { x: cx, y: cy, pts: P.map((q) => [q[0] - cx, q[1] - cy]), closed: !!close && P.length > 2, smooth: false, fill: false, sw: 8 });
}
export function penUndo() { S.penPts.pop(); drawOverlay(); renderFloats(); }
export function canvasDown(e) {
  ptrs.set(e.pointerId, [e.clientX, e.clientY]); vp.setPointerCapture(e.pointerId);
  if (ptrs.size === 2) { foldStart('drag'); const [a, b] = [...ptrs.values()], v = vp.getBoundingClientRect(); pinch0 = { d: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), z: S.zoom, pan: [...S.pan], c: [(a[0] + b[0]) / 2 - v.left, (a[1] + b[1]) / 2 - v.top] }; setDragging(false); return; }
  if (S.eyedrop) {
    const g = e.target.closest('g[data-id]'), src = g && lay(g.dataset.id), dst = S.sel && lay(S.sel);
    const key: string = typeof S.eyedrop === 'string' ? S.eyedrop : 'hue'; S.eyedrop = false; renderFloats();
    if (key === 'brush' && src) { S.brush.c = src.hue; saveBrush(); renderBrushBar(); toast(`Brush colour ${String(src.hue).toUpperCase()} from ${src.name}`); return; }
    if (src && dst) { dst[key] = src.hue; commit('Pick colour'); buildCanvas(); renderAll(); toast(`Picked ${String(src.hue).toUpperCase()} from ${src.name}`, true); }
    else toast('No layer there. Tap the eyedropper and try again.');
    return;
  }
  if (isDrawTool(S.tool) && e.button !== 1) { if (e.pointerType === 'touch' && penSeen) return panStart(e); return drawDown(e); }
  const [cx, cy] = compPt(e);
  if (S.tool === 'text') { newLayer('text', { x: Math.round(cx), y: Math.round(cy) }); S.tool = 'select'; renderStrips(); renderFloats(); return; }
  if (['rect', 'ellipse', 'star', 'polygon', 'line'].includes(S.tool)) return shapeDrag(e, cx, cy);
  if (S.tool === 'pen') {
    if (ptrs.size > 1) return;
    const [px, py] = compPt(e), P = S.penPts;
    if (P.length > 2 && Math.hypot(px - P[0][0], py - P[0][1]) < 28 / Math.max(.2, S.zoom)) { penFinish(true); return; }
    P.push([Math.round(px), Math.round(py)]); drawOverlay(); renderFloats(); return;
  }
  if (S.tool === 'hand' || e.button === 1) return panStart(e);
  const inBox = (() => { const b = $('#selbox'); if (b.hidden) return false; const r = b.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; })();
  if ((S.tool === 'marquee' || S.tool === 'lasso') && !inBox) return areaSelect(e);
  const g = e.target.closest('g[data-id]'); let L = g && lay(g.dataset.id);
  if (S.tool !== 'select' && inBox) L = lay(S.sel);
  const prev = selIds();
  if (L && e.shiftKey) { toggleMember(L.id, prev); return; }
  if (!L || L.lock) { if (S.sel) { S.sel = null; S.multi.clear(); S.keys = []; renderAll(); } return; }
  if (!prev.includes(L.id)) { S.sel = L.id; S.multi.clear(); S.keys = []; renderAll(); }
  else if (S.sel !== L.id) { S.sel = L.id; renderAll(); }
  const start = selIds().map(lay).filter((x) => x && !x.lock).map((l) => [l, val(l.p.x, S.f), val(l.p.y, S.f)]);
  const isLong = longPress(e, () => toggleMember(L.id, prev));
  let moved = false;
  const mv = (ev) => {
    if (ptrs.size > 1 || isLong()) return;
    const [nx, ny] = compPt(ev); let dx = nx - cx, dy = ny - cy;
    if (!moved && Math.hypot(dx, dy) < 4) return; if (!moved) foldStart('drag'); moved = true; setDragging(true);
    let sx = false, sy = false;
    if (S.snap && !L.parent && start.length === 1) { const x = start[0][1] + dx, y = start[0][2] + dy; if (Math.abs(x - 960) < 14) { dx += 960 - x; sx = true; } if (Math.abs(y - 540) < 14) { dy += 540 - y; sy = true; } }
    const sr = stage.getBoundingClientRect(), vr = vp.getBoundingClientRect();
    $('#gv').style.display = sx ? 'block' : 'none'; $('#gv').style.left = (sr.left - vr.left + sr.width / 2) + 'px';
    $('#gh').style.display = sy ? 'block' : 'none'; $('#gh').style.top = (sr.top - vr.top + sr.height / 2) + 'px';
    start.forEach(([l, x0, y0]) => { const [lx, ly] = toLocal(l, dx, dy); setVal(l, 'x', Math.round(x0 + lx)); setVal(l, 'y', Math.round(y0 + ly)); });
    updateCanvas(); updateFields();
  };
  const up = () => { vp.removeEventListener('pointermove', mv); vp.removeEventListener('pointerup', up); vp.removeEventListener('pointercancel', up); setDragging(false); foldEnd('drag'); $('#gv').style.display = $('#gh').style.display = 'none'; if (isLong()) return; if (moved) { commit(start.length > 1 ? `Move ${start.length} layers` : 'Move'); renderAll(); } else placeSel(); };
  vp.addEventListener('pointermove', mv); vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
}
// Click-drag with a shape tool sizes the new shape: rectangles corner to corner, round shapes from the centre out, lines end to end. A plain tap places the default size.
function shapeDrag(e, cx, cy) {
  const type = S.tool; let L = null, moved = false;
  const apply = (nx, ny) => {
    const dx = nx - cx, dy = ny - cy;
    if (type === 'rect') { L.w = Math.max(8, Math.round(Math.abs(dx))); L.h = Math.max(8, Math.round(Math.abs(dy))); L.cr = Math.min(L.cr ?? 24, L.w / 2, L.h / 2); setVal(L, 'x', Math.round(cx + dx / 2)); setVal(L, 'y', Math.round(cy + dy / 2)); }
    else if (type === 'line') { L.w = Math.max(8, Math.round(Math.hypot(dx, dy))); setVal(L, 'rot', Math.round(Math.atan2(dy, dx) * 180 / Math.PI)); setVal(L, 'x', Math.round(cx + dx / 2)); setVal(L, 'y', Math.round(cy + dy / 2)); }
    else L.r = Math.max(4, Math.round(Math.hypot(dx, dy)));
  };
  const mv = (ev) => {
    if (ptrs.size > 1) return;
    const [nx, ny] = compPt(ev);
    if (!moved) { if (Math.hypot(nx - cx, ny - cy) < 6) return; moved = true; setDragging(true); newLayer(type, { x: Math.round(cx), y: Math.round(cy) }); L = lay(S.sel); }
    apply(nx, ny); buildCanvas(); updateFields();
  };
  const up = () => {
    vp.removeEventListener('pointermove', mv); vp.removeEventListener('pointerup', up); vp.removeEventListener('pointercancel', up); setDragging(false);
    if (!moved) newLayer(type, { x: Math.round(cx), y: Math.round(cy) });
    else { hist[hi] = JSON.stringify(layers); setLastLabel('Add ' + L.name); renderAll(); }
    S.tool = 'select'; renderStrips(); renderFloats();
  };
  vp.addEventListener('pointermove', mv); vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
}
function panStart(e) {
  const p0 = [...S.pan], x0 = e.clientX, y0 = e.clientY;
  let moved = false;
  const mv = (ev) => { if (ptrs.size > 1) return; if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return; if (!moved) { moved = true; foldStart('drag'); } S.pan = [p0[0] + ev.clientX - x0, p0[1] + ev.clientY - y0]; layoutStage(); };
  const up = () => { vp.removeEventListener('pointermove', mv); vp.removeEventListener('pointerup', up); foldEnd('drag'); };
  vp.addEventListener('pointermove', mv); vp.addEventListener('pointerup', up);
}
const endPtr = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null; if (!ptrs.size) foldEnd('drag'); };
/** Registers this module's event listeners. main.ts calls it once, in the original order. */
export function listen() {
  addEventListener('pointerdown', (e) => { setSuppressClick(false); if (e.pointerType === 'pen') penSeen = true; }, true);
  vp.addEventListener('pointermove', (e) => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (pinch0 && ptrs.size === 2) { const [a, b] = [...ptrs.values()], v = vp.getBoundingClientRect(); const z = Math.max(.25, Math.min(6, pinch0.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0.d)), k = z / pinch0.z; const cx = (a[0] + b[0]) / 2 - v.left, cy = (a[1] + b[1]) / 2 - v.top, mx = v.width / 2, my = v.height / 2; S.zoom = z; S.pan = [cx - mx - (pinch0.c[0] - mx - pinch0.pan[0]) * k, cy - my - (pinch0.c[1] - my - pinch0.pan[1]) * k]; layoutStage(); } });
  vp.addEventListener('pointerup', endPtr); vp.addEventListener('pointercancel', endPtr);
  vp.addEventListener('wheel', (e) => { e.preventDefault(); if (e.ctrlKey || e.metaKey) S.zoom = Math.max(.25, Math.min(6, S.zoom * (e.deltaY < 0 ? 1.08 : .92))); else S.pan = [S.pan[0] - e.deltaX, S.pan[1] - e.deltaY]; layoutStage(); }, { passive: false });
  vp.addEventListener('dblclick', (e) => { const g = e.target.closest('g[data-id]'); const L = g && lay(g.dataset.id); if (L && L.type === 'text') { S.right = 'props'; S.collapsed.delete('app'); renderAll(); setTimeout(() => { const t = $('#ltext'); if (t) { t.focus(); t.select(); } }, 80); } });
}
