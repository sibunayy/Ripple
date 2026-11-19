import { $, $$ } from '../core/dom';
import { DUR, FPS, compBg, layers } from '../model/project';
import { lay, val } from '../anim/interpolate';
import { S, isDrawTool, isSelTool, selIds } from '../state/state';
import { guideHtml } from './guides';
import { shapeSvg } from './shapes';
import { postT, rippleBF } from '../fx/defs';
import { fxDefs } from '../fx/filters';
import { mat, mstr, pose, relM, repN, repXf, setXfEls, world, xfEls } from '../anim/pose';
import { mountShaders, renderShader } from '../shader/runtime';
import { frozen } from '../ui/autofold';
import { lightboxOn } from '../drawing/cels';
import { drawXf } from '../drawing/raster';
import { drawOverlay } from '../drawing/overlay';
import { applyTextAnims } from '../ui/text-animators';
import { dragging } from '../events/delegate';

/* ---------- canvas ---------- */
export const stage = $('#stage'), vp = $('#vp');
export let gEls = {};
export function buildCanvas() {
  let defs = layers.map(fxDefs).join('') + '<filter id="mtw" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter><filter id="mtk" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/></filter><filter id="mtl" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .2126 .7152 .0722 0 0" result="a"/><feComposite in="a" in2="SourceAlpha" operator="in"/></filter>';
  const srcOf = (l) => { const i = layers.indexOf(l); return l.matte && i > 0 ? layers[i - 1] : null; };
  const mSrc = new Set(layers.map(srcOf).filter(Boolean).map((x) => x.id));
  const W = '<rect x="-6000" y="-6000" width="14000" height="14000" fill="#fff"/>';
  layers.forEach((l) => { const m = srcOf(l); if (!m) return; const u = `<use href="#mg-${m.id}"`;
    defs += `<mask id="mt-${l.id}" maskUnits="userSpaceOnUse" x="-6000" y="-6000" width="14000" height="14000">${l.matte === 'alpha' ? u + ' filter="url(#mtw)"/>' : l.matte === 'alphainv' ? W + u + ' filter="url(#mtk)"/>' : l.matte === 'luma' ? u + '/>' : W + u + ' filter="url(#mtl)"/>'}</mask>`; });
  const hidden = [];
  const body = [...layers].reverse().map((l) => {
    const n = repN(l), sh = shapeSvg(l);
    const copies = Array.from({ length: n }, (_, k) => `<g class="xf" data-i="${n - 1 - k}">${sh}</g>`).join('');
    const bl = l.blend && l.blend !== 'normal' ? ` style="mix-blend-mode:${l.blend}"` : '';
    const mk = srcOf(l) ? ` mask="url(#mt-${l.id})"` : '';
    const gs = `<g data-id="${l.id}"${mSrc.has(l.id) ? ` id="mg-${l.id}"` : ''}${bl}${mk} ${!l.fxOff && l.fx.some((e) => e.on && e.id !== 'postime') ? `filter="url(#fx-${l.id})"` : ''} ${l.type === 'adjust' ? 'pointer-events="none"' : ''}>${copies}</g>`;
    if (mSrc.has(l.id)) { hidden.push(gs); return ''; }
    return mk ? `<g>${gs}</g>` : gs;
  }).join('');
  defs += hidden.join('');
  stage.innerHTML = `<svg viewBox="0 0 1920 1080" role="img" aria-label="Composition: Logo sting, 1920 by 1080"><defs>${defs}<filter id="onB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 .28  0 0 0 0 .32  0 0 0 1 0"/></filter><filter id="onA"><feColorMatrix type="matrix" values="0 0 0 0 .22  0 0 0 0 .86  0 0 0 0 .5  0 0 0 1 0"/></filter></defs><rect width="1920" height="1080" style="fill: ${compBg || 'var(--comp-bg)'}"/>${body}</svg>${guideHtml()}`;
  gEls = {}; setXfEls({});
  mountShaders();
  $$('g[data-id]', stage).forEach((g) => { gEls[g.dataset.id] = g; xfEls[g.dataset.id] = []; $$(':scope > .xf', g).forEach((x) => { xfEls[g.dataset.id][+x.dataset.i] = x; }); });
  updateCanvas();
}
export function updateCanvas() {
  const F0 = S.f;
  for (const l of layers) {
    const f = postT(l, F0), t = f / FPS;
    const g = gEls[l.id], xs = xfEls[l.id]; if (!g || !xs) continue;
    const base = l.parent && lay(l.parent) ? relM(l, f, 0) : null;
    xs.forEach((xf, i) => {
      if (!xf) return;
      const q = pose(l, f, i); if (l.rep && l.rep.on) repXf(l, q, i);
      let m = mat(q); if (base) m = base.multiply(m);
      xf.setAttribute('transform', mstr(m));
      xf.setAttribute('opacity', Math.max(0, Math.min(1, q.o / 100)).toFixed(3));
      if (l.type === 'draw') drawXf(l, xf, i, f);
      const tp = xf.querySelector('.tp');
      if (tp) {
        const lo = Math.max(0, Math.min(q.ts, q.te)), hi = Math.min(100, Math.max(q.ts, q.te)), len = +tp.dataset.len || 100;
        if (lo <= .01 && hi >= 99.99) { if (tp.dataset.dash) tp.setAttribute('stroke-dasharray', tp.dataset.dash); else tp.removeAttribute('stroke-dasharray'); if (tp.dataset.doff) tp.setAttribute('stroke-dashoffset', tp.dataset.doff); else tp.removeAttribute('stroke-dashoffset'); tp.style.strokeOpacity = ''; }
        else { tp.setAttribute('stroke-dasharray', `${((hi - lo) / 100 * len).toFixed(2)} ${(len * 2).toFixed(1)}`); tp.setAttribute('stroke-dashoffset', (-lo / 100 * len).toFixed(2)); tp.style.strokeOpacity = hi - lo < .05 ? '0' : ''; }
      }
    });
    const vis = l.vis && (!S.solo.size || S.solo.has(l.id)) && F0 >= (l.inP ?? 0) && F0 < (l.outP ?? DUR);
    g.setAttribute('opacity', vis ? (lightboxOn() && l.id !== S.sel ? .2 : 1) : 0);
    if (l.type === 'shader' && vis) { const rt = renderShader(l, f); const ph = g.querySelector('.shph'); if (ph) ph.style.display = rt.ok ? 'none' : ''; }
    if (l.type === 'text' && (l.anims || []).length) applyTextAnims(l, g, f);
    l.fx.forEach((e, j) => {
      if (e.on && (e.id === 'roughen' || e.id === 'grain' || e.id === 'glitch')) { const tb = stage.querySelector(`#rf-${l.id}-${j}`); if (tb) tb.setAttribute('seed', e.id === 'grain' ? 1 + Math.floor(F0) % 97 : 1 + Math.floor(F0 * (e.speed || 0) / 30) % 997); }
      if (e.on && e.id === 'ripple') { const tb = stage.querySelector(`#rt-${l.id}-${j}`); if (tb) { const bf = rippleBF(e), sp = (e.speed ?? 30) * .12; tb.setAttribute('baseFrequency', `${(bf * (1 + .22 * Math.sin(t * sp))).toFixed(5)} ${(bf * (1 + .22 * Math.cos(t * sp * .83))).toFixed(5)}`); } }
    });
  }
  placeSel();
}
export function layoutStage() {
  if (frozen) {
    const v = vp.getBoundingClientRect(), k = S.zoom / frozen.zoom, W = frozen.w * k, H = frozen.h * k;
    const cx = frozen.cx + S.pan[0] - frozen.pan[0], cy = frozen.cy + S.pan[1] - frozen.pan[1];
    Object.assign(stage.style, { width: W + 'px', height: H + 'px', left: (cx - W / 2 - v.left) + 'px', top: (cy - H / 2 - v.top) + 'px' });
    const pct = $('#zoom .pct'); if (pct) pct.textContent = Math.round(W / 1920 * 100) + '%';
    placeSel(); return;
  }
  const w = vp.clientWidth, h = vp.clientHeight;
  const fit = Math.min((w - 56) / 1920, (h - 56) / 1080);
  const sc = Math.max(.05, fit * S.zoom);
  const W = 1920 * sc, H = 1080 * sc;
  Object.assign(stage.style, { width: W + 'px', height: H + 'px', left: ((w - W) / 2 + S.pan[0]) + 'px', top: ((h - H) / 2 + S.pan[1]) + 'px' });
  const pct = $('#zoom .pct'); if (pct) pct.textContent = Math.round(sc * 100) + '%';
  placeSel();
}
export function compPt(e) { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1920, (e.clientY - r.top) / r.height * 1080]; }
export function selRect() {
  let r = null;
  for (const id of selIds()) {
    const l = lay(id), g = gEls[id]; if (!g || !l || !l.vis) continue;
    const b = g.getBoundingClientRect(); if (b.width < 1 && b.height < 1) continue;
    r = r ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) } : { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
  }
  if (r) { r.width = r.right - r.left; r.height = r.bottom - r.top; }
  return r;
}
// A layer's anchor point in composition space (follows parenting and behaviours).
export const anchorAt = (l, f) => world(l, f).transformPoint(new DOMPoint(l.p.ax ? val(l.p.ax, f) : 0, l.p.ay ? val(l.p.ay, f) : 0));
// Convert a composition-space move into the layer's own (parent) space.
export function toLocal(l, dx, dy, f = S.f) {
  if (l.parent && lay(l.parent)) { try { const inv = relM(l, f, 0).inverse(); if (isFinite(inv.a)) return [inv.a * dx + inv.c * dy, inv.b * dx + inv.d * dy]; } catch { /* keep comp delta */ } }
  return [dx, dy];
}
export function placeSel() {
  const box = $('#selbox'), qb = $('#qbar'), anc = $('#anc'), v = vp.getBoundingClientRect(), dt = isDrawTool(S.tool), r = dt ? null : selRect();
  drawOverlay();
  $('#bbar').classList.toggle('show', dt && !S.playing);
  if (!r) { box.hidden = true; anc.hidden = true; qb.classList.remove('show'); return; }
  const multi = selIds().length > 1, l = lay(S.sel);
  box.hidden = false; box.classList.toggle('multi', multi);
  if (!multi && l) { const sr = stage.getBoundingClientRect(), ap = anchorAt(l, S.f); anc.hidden = false; anc.style.left = (sr.left - v.left + ap.x / 1920 * sr.width) + 'px'; anc.style.top = (sr.top - v.top + ap.y / 1080 * sr.height) + 'px'; } else anc.hidden = true;
  Object.assign(box.style, { left: (r.left - v.left - 4) + 'px', top: (r.top - v.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' });
  const show = isSelTool(S.tool) && !S.playing && !dragging;
  qb.classList.toggle('show', show);
  if (!show) return;
  const qw = qb.offsetWidth, qh = qb.offsetHeight;
  let x = r.left - v.left + r.width / 2 - qw / 2; x = Math.max(8, Math.min(v.width - qw - 8, x));
  let y = r.bottom - v.top + 14;
  if (y + qh > v.height - 8) y = r.top - v.top - qh - 40;
  if (y < 56) y = v.height - qh - 10;
  qb.style.left = x + 'px'; qb.style.top = y + 'px';
}
