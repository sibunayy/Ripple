// @ts-nocheck
import { $, $$, app } from '../core/dom';
import { DUR, layers } from '../model/project';
import { earr } from '../anim/easing';
import { PROPS, TF } from '../model/schema';
import { animated, lay, val } from '../anim/interpolate';
import { S } from '../state/state';
import { commit } from '../state/history';
import { buildCanvas, layoutStage, placeSel, updateCanvas } from '../render/stage';
import { renderTop } from '../ui/topbar';
import { renderLeft } from '../ui/left-panel';
import { fmt } from '../ui/inspector/controls';
import { selectedKeyObjs } from '../anim/clipboard';
import { renderRight } from '../ui/inspector/index';
import { renderTL, tlHeight } from '../ui/timeline';
import { clamp } from '../ui/graph';
import { renderPop } from '../ui/popovers';
import { toast } from '../ui/toast';
import { renderAll, seek } from '../ui/layout';
import { play } from '../playback/loop';
import { applyProp } from '../state/selection';
import { brushCur, saveBrush, saveOnion } from '../drawing/cels';
import { renderBrushBar } from '../drawing/brush-bar';
import { longPress, setDragging, setSuppressClick } from '../events/delegate';

export function layerDrag(e, grip) {
  const row = grip.closest('.lrow'), list = row.parentElement, rows = $$('.lrow', list), from = rows.indexOf(row);
  if (from < 0) return;
  e.preventDefault(); grip.setPointerCapture(e.pointerId);
  const hs = rows.map((r) => r.offsetHeight), tops = rows.map((r) => r.offsetTop), n = rows.length;
  const lo = tops[0] - tops[from], hi = tops[n - 1] + hs[n - 1] - tops[from] - hs[from];
  const y0 = e.clientY; let to = from, moved = false;
  const mv = (ev) => {
    let dy = ev.clientY - y0;
    if (!moved && Math.abs(dy) < 4) return;
    if (!moved) { moved = true; setDragging(true); row.classList.add('lift'); rows.forEach((r) => { if (r !== row) r.classList.add('shift'); }); }
    dy = clamp(dy, lo, hi); row.style.transform = `translateY(${dy}px)`;
    const c = tops[from] + hs[from] / 2 + dy;
    to = rows.findIndex((r, i) => c < tops[i] + hs[i]); if (to < 0) to = n - 1;
    rows.forEach((r, i) => { if (i === from) return; r.style.transform = from < to && i > from && i <= to ? `translateY(${-hs[from]}px)` : from > to && i >= to && i < from ? `translateY(${hs[from]}px)` : ''; });
  };
  const up = () => {
    grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
    setDragging(false);
    if (moved && to !== from) { const l = lay(rows[from].dataset.v), j = layers.indexOf(lay(rows[to].dataset.v)); layers.splice(layers.indexOf(l), 1); layers.splice(j, 0, l); S.sel = l.id; commit('Reorder layers'); buildCanvas(); renderAll(); toast('Moved ' + l.name, true); }
    else renderLeft();
  };
  grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
}
export function tlDrag(e) {
  const h0 = tlHeight(), y0 = e.clientY, hd = $('#tlh'); let moved = false;
  app.classList.remove('anim'); hd.classList.add('drag'); hd.setPointerCapture(e.pointerId);
  const mv = (ev) => { const dy = y0 - ev.clientY; if (Math.abs(dy) > 4) moved = true; S.tlPx = Math.max(58, Math.min(app.clientHeight * .78, h0 + dy)); app.style.setProperty('--tlh', S.tlPx + 'px'); if ((S.tlPx > 90) !== ($('.tl-body') !== null)) renderTL(); layoutStage(); };
  const up = () => {
    hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up);
    const H = app.clientHeight, cur = S.tlPx ?? h0;
    if (!moved) S.tl = S.tl === 'peek' ? 'mid' : 'peek';
    else { const opts = [['peek', 58], ['mid', H * .4], ['tall', H * .64]]; S.tl = opts.reduce((a, b) => (Math.abs(b[1] - cur) < Math.abs(a[1] - cur) ? b : a))[0]; }
    S.tlPx = null; app.classList.add('anim'); renderAll(); setTimeout(layoutStage, 240);
  };
  hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
}
export function sheetDrag(e) {
  const y0 = e.clientY, g = $('#sheetgrab'); let moved = false; g.setPointerCapture(e.pointerId);
  const mv = (ev) => { if (Math.abs(ev.clientY - y0) > 6) moved = true; };
  const up = (ev) => {
    g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up);
    const dy = ev.clientY - y0;
    if (!moved) S.full = !S.full; else if (dy < -30) S.full = true; else if (dy > 30) { if (S.full) S.full = false; else S.right = null; }
    renderAll();
  };
  g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up);
}
export function scrubDrag(e, el) {
  if (S.playing) play(false);
  el.setPointerCapture(e.pointerId);
  const set = (ev) => { const r = el.getBoundingClientRect(); seek(Math.round((ev.clientX - r.left) / r.width * DUR)); };
  set(e); const mv = (ev) => set(ev);
  const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); renderRight(); };
  el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
}
export function keyDown(e, dk) {
  e.stopPropagation();
  const L = lay(dk.dataset.l);
  const pick = () => {
    if (dk.dataset.dk === 'one') { const k = { l: L.id, p: dk.dataset.p, i: +dk.dataset.i }; const has = S.keys.findIndex((s) => s.l === k.l && s.p === k.p && s.i === k.i); if (e.shiftKey) { has >= 0 ? S.keys.splice(has, 1) : S.keys.push(k); } else S.keys = [k]; }
    else { const t = +dk.dataset.t; S.keys = TF.flatMap((p) => animated(L.p[p]) ? L.p[p].keys.map((k, i) => ({ k, i, p })).filter((o) => Math.abs(o.k.t - t) < .5).map((o) => ({ l: L.id, p: o.p, i: o.i })) : []); }
    S.sel = L.id;
  };
  const isLong = longPress(e, () => { pick(); seek(+(dk.dataset.t ?? L.p[dk.dataset.p].keys[+dk.dataset.i].t)); const r = dk.getBoundingClientRect(); S.pop = { type: 'ease', x: r.left + r.width / 2, y: r.top }; renderAll(); });
  // drag to retime
  const x0 = e.clientX, track = dk.parentElement; let moved = false;
  const mv = (ev) => {
    if (isLong()) return;
    const dx = ev.clientX - x0; if (Math.abs(dx) < 6 && !moved) return;
    if (!moved) { moved = true; pick(); }
    const df = Math.round(dx / track.clientWidth * DUR);
    dk.style.transform = `translateX(${df / DUR * track.clientWidth}px)`; dk.dataset.df = df;
  };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
    if (isLong()) return;
    if (!moved) { pick(); renderAll(); return; }
    const df = +(dk.dataset.df || 0);
    if (df) {
      for (const s of S.keys) { const k = lay(s.l).p[s.p].keys[s.i]; k.t = Math.max(0, Math.min(DUR - 1, k.t + df)); }
      for (const s of S.keys) { const pr = lay(s.l).p[s.p]; const k = pr.keys[s.i]; pr.keys.sort((a, b) => a.t - b.t); s.i = pr.keys.indexOf(k); }
      commit('Move keyframes'); updateCanvas();
    }
    setSuppressClick(true); renderAll();
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
// Relative scrub: each point of horizontal travel changes the value by the property's step.
// Moving the finger further above the field speeds it up (×2/×5/×10), further below slows it (×0.5/×0.2/×0.1).
export function fieldDrag(e, fl) {
  e.preventDefault();
  const o = fl.dataset.o, isObj = o != null, isOpt = o === 'po' || o === 'br' || o === 'on';
  const l = isOpt ? {} : lay(isObj ? S.sel : fl.dataset.l); if (!l) return;
  const p = fl.dataset.p, key = fl.dataset.k, ii = +fl.dataset.i, isInt = fl.dataset.int === '1';
  const tgt = () => (o === 'br' ? brushCur() : o === 'on' ? S.onion : isOpt ? S : o === 'fx' ? l.fx[ii] : o === 'rep' ? l.rep : o === 'mod' ? (l.mods || [])[ii] : o === 'an' ? (l.anims || [])[ii] : l);
  if (isObj && !tgt()) return;
  const m = isObj ? { step: +fl.dataset.step || .5, min: +fl.dataset.min, max: +fl.dataset.max, u: fl.dataset.u || '', label: fl.getAttribute('aria-label') } : PROPS[p];
  const getV = () => (isObj ? tgt()[key] : val(l.p[p], S.f));
  const setV = (nv) => { if (isObj) { tgt()[key] = isInt ? Math.round(nv) : nv; if (key === 'inP' || key === 'outP') { l.inP = Math.min(l.inP ?? 0, (l.outP ?? DUR) - 1); } if (isOpt) { if (o === 'br') saveBrush(); else if (o === 'on') { saveOnion(); updateCanvas(); } return; } if (o === 'mod') updateCanvas(); else buildCanvas(); } else { applyProp(l, p, nv); updateCanvas(); } };
  let v = getV();
  const r0 = fl.getBoundingClientRect(), cy0 = r0.top + r0.height / 2, x0 = e.clientX; let lastX = e.clientX, moved = false;
  const badge = $('#spd');
  fl.setPointerCapture(e.pointerId);
  const mv = (ev) => {
    if (!moved && Math.abs(ev.clientX - x0) < 4) return;
    if (!moved) { moved = true; fl.classList.add('drag'); setDragging(true); lastX = ev.clientX; return; }
    const dy = ev.clientY - cy0, ad = Math.abs(dy);
    const speed = ad <= 24 ? 1 : dy < 0 ? (ad >= 120 ? 10 : ad >= 80 ? 5 : ad >= 40 ? 2 : 1) : (ad >= 120 ? .1 : ad >= 80 ? .2 : ad >= 40 ? .5 : 1);
    v = clamp(v + (ev.clientX - lastX) * m.step * speed * (ev.altKey ? .25 : 1), m.min, m.max); lastX = ev.clientX;
    setV(v);
    fl.querySelector('.v').textContent = fmt(isInt ? Math.round(v) : v, m);
    const a = app.getBoundingClientRect();
    if (speed !== 1) { badge.hidden = false; badge.textContent = '×' + speed; badge.style.left = (ev.clientX - a.left + 14) + 'px'; badge.style.top = (ev.clientY - a.top - 34) + 'px'; } else badge.hidden = true;
  };
  const up = () => {
    fl.removeEventListener('pointermove', mv); fl.removeEventListener('pointerup', up); fl.removeEventListener('pointercancel', up);
    fl.classList.remove('drag'); setDragging(false); badge.hidden = true;
    if (moved) { if (isOpt) { renderRight(); renderBrushBar(); if (S.pop && S.pop.type === 'onion') renderPop(); return; } commit('Edit ' + m.label); renderTop(); renderTL(); renderRight(); placeSel(); return; }
    // tap: type an exact value
    const span = fl.querySelector('.v'), cur = getV();
    const inp = document.createElement('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.value = Math.round(cur * 10) / 10; inp.setAttribute('aria-label', fl.getAttribute('aria-label'));
    span.replaceWith(inp); inp.focus(); inp.select();
    const done = (ok) => { if (ok) { const nv = parseFloat(inp.value); if (!isNaN(nv)) { setV(clamp(nv, m.min, m.max)); if (!isOpt) commit('Edit'); } } renderBrushBar(); if (S.pop && S.pop.type === 'onion') renderPop(); renderRight(); renderTL(); renderTop(); };
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); inp.onblur = null; done(true); } if (ev.key === 'Escape') { inp.onblur = null; done(false); } });
    inp.onblur = () => done(true);
  };
  fl.addEventListener('pointermove', mv); fl.addEventListener('pointerup', up); fl.addEventListener('pointercancel', up);
}
export function curveDrag(e, h) {
  const svg = $('#curve'); svg.setPointerCapture(e.pointerId);
  const ks = selectedKeyObjs(); if (!ks.length) return;
  const a = [...earr(ks[0])];
  const mv = (ev) => {
    const r = svg.getBoundingClientRect(); const x = ((ev.clientX - r.left) / r.width * 280 - 12) / 256, y = (112 - (ev.clientY - r.top) / r.height * 132) / 92;
    const cx = Math.max(0, Math.min(1, x)), cy = Math.max(-.8, Math.min(1.8, y));
    if (h === 1) { a[0] = cx; a[1] = cy; } else { a[2] = cx; a[3] = cy; }
    ks.forEach((k) => (k.e = [...a]));
    const p1 = [12 + a[0] * 256, 112 - a[1] * 92], p2 = [12 + a[2] * 256, 112 - a[3] * 92];
    svg.querySelector('.c').setAttribute('d', `M12,112 C${p1} ${p2} 268,20`);
    const arms = svg.querySelectorAll('.arm'); arms[0].setAttribute('x2', p1[0]); arms[0].setAttribute('y2', p1[1]); arms[1].setAttribute('x2', p2[0]); arms[1].setAttribute('y2', p2[1]);
    svg.querySelectorAll(`[data-h="1"]`).forEach((c) => { c.setAttribute('cx', p1[0]); c.setAttribute('cy', p1[1]); });
    svg.querySelectorAll(`[data-h="2"]`).forEach((c) => { c.setAttribute('cx', p2[0]); c.setAttribute('cy', p2[1]); });
    updateCanvas();
  };
  const up = () => { svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); commit('Edit curve'); renderRight(); renderTL(); renderTop(); };
  svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up);
}
