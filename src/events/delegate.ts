// @ts-nocheck
import { $ } from '../core/dom';
import { HUES, layers, markers, saveProj, setProjName } from '../model/project';
import { earr } from '../anim/easing';
import { lay } from '../anim/interpolate';
import { S } from '../state/state';
import { commit } from '../state/history';
import { buildCanvas, updateCanvas } from '../render/stage';
import { snapW } from '../render/text';
import { SHP } from '../shader/presets';
import { renderTop } from '../ui/topbar';
import { renderStrips } from '../ui/strips';
import { TYPE_NAME, renderLeft } from '../ui/left-panel';
import { clearAnim } from '../ui/inspector/controls';
import { selectedKeyObjs } from '../anim/clipboard';
import { renderRight } from '../ui/inspector/index';
import { renderTL } from '../ui/timeline';
import { clamp, graphDown } from '../ui/graph';
import { cp, cpApply, cpDrag, hexToHsv } from '../ui/color-picker';
import { renderPop } from '../ui/popovers';
import { toast } from '../ui/toast';
import { renderAll } from '../ui/layout';
import { importAudio } from '../playback/audio';
import { newLayer } from '../actions/layers';
import { A } from '../actions/index';
import { celDown, flipDrag } from '../gestures/cel-timeline';
import { handleDrag, mpDrag } from '../gestures/handles';
import { jumpKey, tcDrag, trackDown, trimDrag, waDrag } from '../gestures/timeline';
import { fxReorder, layerHold } from '../gestures/reorder';
import { curveDrag, fieldDrag, keyDown, layerDrag, scrubDrag, sheetDrag, tlDrag } from '../gestures/drags';
import { canvasDown } from '../gestures/canvas';

export let dragging = false, suppressClick = false, fitSelOn = false;
// Long press helper: fires cb after 450 ms unless the pointer moves or lifts.
export function longPress(e, cb) {
  const sx = e.clientX, sy = e.clientY; let done = false;
  const tm = setTimeout(() => { done = true; suppressClick = true; cb(); cleanup(); }, 450);
  const mv = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) cleanup(); };
  const cleanup = () => { clearTimeout(tm); removeEventListener('pointermove', mv); removeEventListener('pointerup', cleanup); removeEventListener('pointercancel', cleanup); };
  addEventListener('pointermove', mv); addEventListener('pointerup', cleanup); addEventListener('pointercancel', cleanup);
  return () => done;
}
export function setFitSelOn(v) { return (fitSelOn = v); }
export function setSuppressClick(v) { return (suppressClick = v); }
export function setDragging(v) { return (dragging = v); }
/** Registers this module's event listeners. main.ts calls it once, in the original order. */
export function listen() {
  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
    const el = e.target.closest('[data-act]');
    if (S.pop && !e.target.closest('.pop') && !(el && ['menu', 'insert', 'addfx', 'colour', 'anchorpick', 'bcolour', 'onionpop', 'align'].includes(el.dataset.act))) { S.pop = null; renderPop(); renderTop(); renderStrips(); if (!el) return; }
    if (!el || el.tagName === 'LABEL') return;
    const f = A[el.dataset.act]; if (f) f(el, e);
  });
  $('#scrim').addEventListener('click', () => { S.left = null; renderAll(); });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.sel) {
      const l = S.sel && lay(S.sel); if (!l) return; const k = t.dataset.sel, i = +t.dataset.i;
      if (k === 'font') { l.font = t.value; l.weight = snapW(l); commit('Font'); renderRight(); buildCanvas(); }
      else if (k === 'tweight') { l.weight = +t.value; commit('Weight'); buildCanvas(); }
      else if (k === 'cap' || k === 'join') { l[k] = t.value; commit('Stroke ' + k); buildCanvas(); }
      else if (k === 'shp') { if (t.value !== '__custom') { const P = SHP[t.value]; l.preset = t.value; delete l.code; l.hue = P.c[0]; l.hue2 = P.c[1]; P.def.forEach((v, j) => { l['sp' + j] = v; }); if (/^(Shader|Liquid gradient|Plasma|Aurora|Ring tunnel|Cells|Synth grid)( \d+)?$/.test(l.name)) l.name = P.name; commit('Shader preset'); buildCanvas(); renderAll(); } return; }
      else if (k === 'matte') { if (layers.indexOf(l) < 1) { toast('There is no layer above to use as a matte.'); renderRight(); return; } l.matte = t.value || null; commit(l.matte ? 'Track matte' : 'Remove matte'); buildCanvas(); renderAll(); return; }
      else if (k === 'blend') { l.blend = t.value; commit('Blend mode'); buildCanvas(); }
      else if (k === 'parent') { l.parent = t.value || null; l.pt = Math.round(S.f); commit('Parent'); updateCanvas(); renderLeft(); }
      else if (k === 'repmode' && l.rep) { l.rep.mode = t.value; commit('Duplicator layout'); buildCanvas(); renderRight(); }
      else if (k === 'modtgt' && l.mods && l.mods[i]) { l.mods[i].tgt = t.value; commit('Behaviour target'); updateCanvas(); }
      return;
    }
    if (t.dataset && t.dataset.ezv != null) {
      const ks = selectedKeyObjs(); if (!ks.length) return; const i = +t.dataset.ezv, a = [...earr(ks[0])];
      const v = parseFloat(t.value); if (isNaN(v)) { renderRight(); return; }
      a[i] = i % 2 ? clamp(v, -1, 2) : clamp(v, 0, 1); ks.forEach((k) => { k.e = [...a]; });
      commit('Edit curve'); updateCanvas(); renderRight(); renderTL(); return;
    }
    if (t.matches('[data-media]') && t.files && t.files[0]) {
      const file = t.files[0]; S.pop = null;
      if (file.type.startsWith('audio/')) { renderPop(); importAudio(file); return; }
      if (!file.type.startsWith('image/')) { renderPop(); toast(`Imported ${file.name}. Video playback is not part of this prototype.`); return; }
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { const k = Math.min(1, 900 / img.width, 600 / img.height); newLayer('image', { src: url, w: img.width * k, h: img.height * k, name: file.name, hue: HUES[4] }); };
      img.src = url;
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'lq' || t.id === 'aq') { S[t.id] = t.value; const pos = t.selectionStart; renderLeft(); const n = $('#' + t.id); n.focus(); n.setSelectionRange(pos, pos); }
    if (t.id === 'pq') { S.q = t.value; const pos = t.selectionStart; renderRight(); const n = $('#pq'); n.focus(); n.setSelectionRange(pos, pos); }
    if (t.id === 'cphex' && cp && /^#[0-9a-f]{6}$/i.test(t.value)) { Object.assign(cp, hexToHsv(t.value)); cpApply(t.value.toLowerCase()); }
    if (t.id === 'lname') { const l = lay(S.sel); if (l) l.name = t.value; }
    if (t.id === 'pname') { setProjName(t.value); saveProj(); }
    if (t.dataset && t.dataset.mkn != null && markers[+t.dataset.mkn]) { markers[+t.dataset.mkn].name = t.value; }
    if (t.id === 'ltext') { const l = lay(S.sel); l.text = t.value || ' '; l.name = ((t.value || 'Text').split('\n')[0] || 'Text').slice(0, 32); buildCanvas(); }
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.id === 'lname') { const l = lay(S.sel); if (l) { if (!l.name.trim()) l.name = TYPE_NAME[l.type] || 'Layer'; commit('Rename layer'); renderLeft(); renderTL(); renderRight(); } }
    if (e.target.dataset && e.target.dataset.mkn != null) { commit('Rename marker'); renderTL(); } if (e.target.id === 'ltext') { commit('Edit text'); renderLeft(); renderTL(); renderTop(); } });
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-ctx],[data-dk],#shapebtn,#selbtn,#brushbtn,[data-onion],[data-flip],[data-cel],#vp,[data-kj],.fld,.bar')) e.preventDefault(); });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target;
    // shapes flyout on the rail
    if (t.closest('#shapebtn')) { longPress(e, () => { S.pop = { type: 'shapes' }; renderPop(); }); return; }
    if (t.closest('#selbtn')) { longPress(e, () => { S.pop = { type: 'selmodes' }; renderPop(); }); return; }
    if (t.closest('#brushbtn')) { longPress(e, () => { S.pop = { type: 'drawmodes' }; renderPop(); }); return; }
    const onb = t.closest('[data-onion]'); if (onb) { longPress(e, () => { const r = onb.getBoundingClientRect(); S.pop = { type: 'onion', x: r.left + r.width / 2, y: r.top }; renderPop(); }); return; }
    if (t.closest('[data-flip]')) return flipDrag(e);
    const cb = t.closest('[data-cel]'); if (cb) return celDown(e, cb);
    const hdl = t.closest('#selbox [data-hd]'); if (hdl) return handleDrag(e, hdl);
    const mpd = t.closest('[data-mp]'); if (mpd) return mpDrag(e, mpd);
    const kj = t.closest('[data-kj]'); if (kj) { longPress(e, () => jumpKey(+kj.dataset.kj)); return; }
    if (t.closest('#tcode')) return tcDrag(e);
    const wa = t.closest('[data-wa]'); if (wa) return waDrag(e, +wa.dataset.wa);
    // timeline height handle
    if (t.closest('#tlh')) return tlDrag(e);
    if (t.closest('#sheetgrab')) return sheetDrag(e);
    if (t.closest('#scrub')) return scrubDrag(e, $('#scrub'));
    if (t.closest('#gsvg')) return graphDown(e);
    const cpz = t.closest('[data-cp]'); if (cpz) return cpDrag(e, cpz);
    const kdb = t.closest('[data-kd]'); if (kdb) { const g = kdb.dataset.kd; longPress(e, () => { const l = S.sel && lay(S.sel); if (l) clearAnim(l, g); }); return; }
    const dk = t.closest('[data-dk]'); if (dk) return keyDown(e, dk);
    const trk = t.closest('#tlrows .ttrack'); if (trk) { const tr = t.closest('[data-trim]'); return tr ? trimDrag(e, tr, trk) : trackDown(e, trk); }
    const fl = t.closest('.fld'); if (fl && !t.closest('input')) return fieldDrag(e, fl);
    const hd = t.closest('#curve [data-h]'); if (hd) return curveDrag(e, +hd.dataset.h);
    const gr = t.closest('[data-grip]'); if (gr) return layerDrag(e, gr);
    const fxEl = t.closest('.fx'); if (fxEl && !t.closest('button, .fld, input, textarea')) return fxReorder(e, fxEl);
    const ctx = t.closest('[data-ctx]'); if (ctx && !t.closest('button')) return layerHold(e, ctx);
    if (t.closest('#vp') && !t.closest('.float')) return canvasDown(e);
  });
}
