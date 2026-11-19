// @ts-nocheck
import { $ } from '../core/dom';
import { HUES, layers } from '../model/project';
import { st } from '../model/schema';
import { lay } from '../anim/interpolate';
import { S } from '../state/state';
import { commit } from '../state/history';
import { buildCanvas, compPt, stage, updateCanvas, vp } from '../render/stage';
import { world } from '../anim/pose';
import { renderLeft } from '../ui/left-panel';
import { renderRight } from '../ui/inspector/index';
import { renderTL } from '../ui/timeline';
import { toast } from '../ui/toast';
import { play } from '../playback/loop';
import { foldEnd, foldStart } from '../ui/autofold';
import { nameCount } from '../actions/layers';
import { brushCur, celIdx, insertCel } from './cels';
import { celCache, celRaster, rasterCel, stampStroke } from './raster';
import { setDragging } from '../events/delegate';
import { ptrs } from '../gestures/canvas';

/* ---- live strokes ---- */
export let liveHide = null;
const ink = $('#ink'), ictx = ink.getContext('2d');
function inkSetup(l) {
  const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  ink.width = Math.round(W * dpr); ink.height = Math.round(H * dpr); ink.style.width = W + 'px'; ink.style.height = H + 'px';
  const sr = stage.getBoundingClientRect(), k = sr.width / 1920;
  ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, ink.width, ink.height);
  ictx.beginPath(); ictx.rect(sr.left * dpr, sr.top * dpr, sr.width * dpr, sr.height * dpr); ictx.clip();
  const m = new DOMMatrix([dpr, 0, 0, dpr, 0, 0]).translate(sr.left, sr.top).scale(k).multiply(world(l, S.f));
  ictx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
}
function inkClear() { ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, ink.width, ink.height); ictx.restore && 0; ink.width = ink.width; ink.style.opacity = ''; }
function drawTarget() {
  let l = S.sel && lay(S.sel);
  if (l && l.type === 'draw' && !l.lock && l.vis) return l;
  nameCount.draw = (nameCount.draw || 0) + 1;
  l = { id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: 'Drawing ' + nameCount.draw, type: 'draw', hue: HUES[(layers.length + 2) % HUES.length], vis: true, lock: false, fx: [], cels: [],
    p: { x: st(960), y: st(540), scale: st(100), rot: st(0), op: st(100), ax: st(0), ay: st(0), ts: st(0), te: st(100) } };
  layers.unshift(l); S.sel = l.id; S.multi = new Set(); S.keys = []; buildCanvas(); renderLeft(); renderTL(); renderRight();
  toast('Started a new drawing layer', false);
  return l;
}
function localPt(l, e) { const [cx, cy] = compPt(e); let inv; try { inv = world(l, S.f).inverse(); } catch { inv = new DOMMatrix(); } const q = inv.transformPoint(new DOMPoint(cx, cy)); return [q.x, q.y]; }
function penData(e) {
  const pen = e.pointerType === 'pen', B = S.brush;
  let p = pen ? (e.pressure || 0.5) : 0.6; if (!B.pr) p = 0.6;
  let alt = 1.5708;
  if (pen && B.tl) { if (typeof e.altitudeAngle === 'number') alt = e.altitudeAngle; else if (e.tiltX || e.tiltY) { const tx = Math.tan(e.tiltX * Math.PI / 180), ty = Math.tan(e.tiltY * Math.PI / 180); alt = Math.PI / 2 - Math.atan(Math.hypot(tx, ty)); } }
  return [Math.round(p * 100) / 100, Math.round(alt * 100) / 100];
}
export function drawDown(e) {
  if (S.playing) play(false);
  S.flip = null;
  const tool = S.tool;
  if (tool === 'erase') { const l0 = S.sel && lay(S.sel); if (!l0 || l0.type !== 'draw' || celIdx(l0, S.f) < 0) { toast('Nothing to erase on this frame.'); return; } }
  const l = drawTarget(), [x, y] = localPt(l, e);
  let k = celIdx(l, S.f), c = k >= 0 ? l.cels[k] : null;
  const newCel = !c; if (newCel) c = insertCel(l, Math.round(S.f), []);
  if (tool === 'fill') {
    c.strokes.push({ k: 'fill', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, c: S.brush.c }); c.v = (c.v || 0) + 1;
    const before = celCache.get(c); rasterCel(c);
    const e2 = celCache.get(c);
    if ((before && e2.url === before.url) || !e2.w) { c.strokes.pop(); c.v++; if (newCel) l.cels = l.cels.filter((x) => x !== c); toast('That area is not closed. Close the shape, then fill.'); celRaster(c); updateCanvas(); return; }
    commit('Fill'); updateCanvas(); renderTL(); renderRight(); return;
  }
  const B = S.brush, cur = brushCur(), [p, alt] = penData(e);
  const s = { k: tool === 'erase' ? 'erase' : 'brush', pre: B.pre, c: B.c, sz: cur.sz, op: cur.op, pts: [[Math.round(x * 10) / 10, Math.round(y * 10) / 10, p, alt]] };
  const stt = {}; let cancelled = false, folded = false;
  inkSetup(l);
  if (s.k === 'erase') { const er = celRaster(c); liveHide = l.id; updateCanvas(); ictx.save(); ictx.globalAlpha = 1; if (er.img && er.w) ictx.drawImage(er.img, er.x, er.y, er.w, er.h); ictx.restore(); ictx.globalCompositeOperation = 'destination-out'; stampStroke(ictx, s, stt, s.op / 100); }
  else { ink.style.opacity = s.op / 100; stampStroke(ictx, s, stt); }
  setDragging(true);
  const mv = (ev) => {
    if (cancelled) return;
    if (ptrs.size > 1) { cancelled = true; inkClear(); return; }
    if (!folded && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 4) { folded = true; foldStart('drag'); }
    const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
    for (const q of (evs.length ? evs : [ev])) { const [qx, qy] = localPt(l, q), [qp, qa] = penData(q); const last = s.pts[s.pts.length - 1]; if (Math.hypot(qx - last[0], qy - last[1]) < 0.4) continue; s.pts.push([Math.round(qx * 10) / 10, Math.round(qy * 10) / 10, qp, qa]); }
    stampStroke(ictx, s, stt, s.k === 'erase' ? s.op / 100 : 1);
  };
  const up = () => {
    vp.removeEventListener('pointermove', mv); vp.removeEventListener('pointerup', up); vp.removeEventListener('pointercancel', up);
    setDragging(false); liveHide = null; foldEnd('drag');
    if (cancelled) { inkClear(); if (newCel && !c.strokes.length) l.cels = l.cels.filter((x) => x !== c); updateCanvas(); return; }
    c.strokes.push(s); c.v = (c.v || 0) + 1; rasterCel(c);
    inkClear(); commit(s.k === 'erase' ? 'Erase' : 'Brush stroke'); updateCanvas(); renderTL(); renderRight();
  };
  vp.addEventListener('pointermove', mv); vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
}
