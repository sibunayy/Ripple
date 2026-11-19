// @ts-nocheck
import { lay } from '../../anim/interpolate';
import { S } from '../../state/state';
import { commit } from '../../state/history';
import { syncAudio } from '../../playback/audio';
import { renderRight } from '../../ui/inspector/index';
import { app } from '../../core/dom';
import { renderAll } from '../../ui/layout';
import { buildCanvas, selRect, stage, updateCanvas } from '../../render/stage';
import { renderLeft } from '../../ui/left-panel';
import { renderTL } from '../../ui/timeline';
import { toast } from '../../ui/toast';
import { HUES, layers, saveProj, setCompBg, setLayers } from '../../model/project';
import { targets, toggleMember } from '../../state/selection';
import { celId } from '../../drawing/cels';
import { nameCount, newLayer } from '../layers';
import { st } from '../../model/schema';
import { renderStrips } from '../../ui/strips';
import { renderFloats } from '../../ui/floats';

/** Layer list and layer management. Keys are data-act names. */
export const layersActions = {
  amute: () => { const l = lay(S.sel); if (!l) return; l.mute = !l.mute; commit(l.mute ? 'Mute' : 'Unmute'); syncAudio(); renderRight(); },
  sel: (el) => { const id = el.dataset.v; S.multi.clear(); if (S.sel !== id) S.keys = []; S.sel = id; if (app.classList.contains('portrait') && el.classList.contains('lrow')) { S.left = null; } renderAll(); },
  vis: (el, e) => { e.stopPropagation(); const l = lay(el.dataset.v); l.vis = !l.vis; commit('Visibility'); updateCanvas(); renderLeft(); renderTL(); if (el.closest('#rpanel')) renderRight(); },
  lock: (el, e) => { e.stopPropagation(); const l = lay(el.dataset.v); l.lock = !l.lock; commit('Lock'); renderLeft(); if (el.closest('#rpanel')) renderRight(); },
  solo: (el, e) => { e.stopPropagation(); const id = el.dataset.v; S.solo.has(id) ? S.solo.delete(id) : S.solo.add(id); updateCanvas(); renderLeft(); renderRight(); toast(S.solo.size ? `Solo: showing ${S.solo.size} layer${S.solo.size > 1 ? 's' : ''}` : 'Solo off'); },
  allvis: () => { const on = !layers.every((l) => l.vis); layers.forEach((l) => { l.vis = on; }); commit(on ? 'Show all' : 'Hide all'); updateCanvas(); renderLeft(); renderTL(); },
  unlockall: () => { layers.forEach((l) => { l.lock = false; }); commit('Unlock all'); renderLeft(); toast('All layers unlocked'); },
  lqclear: () => { S.lq = ''; renderLeft(); },
  selall: () => { if (!layers.length) return; S.multi = new Set(layers.map((l) => l.id)); S.sel = layers[0].id; S.keys = []; renderAll(); toast(`${layers.length} layers selected`); },
  lmove: (el) => { const l = lay(S.sel); if (!l) return; const i = layers.indexOf(l), j = i + +el.dataset.v; if (j < 0 || j >= layers.length) return; layers.splice(i, 1); layers.splice(j, 0, l); commit('Reorder'); buildCanvas(); renderAll(); },
  compbg: (el) => { setCompBg(el.dataset.v || null); saveProj(); buildCanvas(); renderRight(); },
  dup: () => { const ls = targets(); if (!ls.length) return; const ids = []; ls.forEach((l) => { const c = JSON.parse(JSON.stringify(l)); c.id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); (c.cels || []).forEach((x) => { x.id = celId(); }); c.name = l.name + ' copy'; layers.splice(layers.indexOf(l), 0, c); ids.push(c.id); }); S.multi = new Set(ids); S.sel = ids[0]; S.pop = null; commit('Duplicate'); buildCanvas(); renderAll(); toast(`Duplicated ${ls.length > 1 ? ls.length + ' layers' : ls[0].name}`, true); },
  group: () => {
    const ls = targets(); if (!ls.length) return;
    if (ls.length === 1) { const l = ls[0]; if (!l.comp) { l.comp = true; l.name = l.name + ' comp'; } S.pop = null; commit('Pre-compose'); buildCanvas(); renderAll(); toast('Pre-composed into ' + l.name + '. Double-tap to open it.', true); return; }
    const sr = stage.getBoundingClientRect(), r = selRect(), cx = r ? (r.left + r.width / 2 - sr.left) / sr.width * 1920 : 960, cy = r ? (r.top + r.height / 2 - sr.top) / sr.height * 1080 : 540;
    const at = Math.min(...ls.map((l) => layers.indexOf(l))); nameCount.group = (nameCount.group || 0) + 1;
    const g = { id: 'l' + Date.now().toString(36), name: `Group ${nameCount.group}`, type: 'comp', comp: true, hue: HUES[0], vis: true, lock: false, fx: [], kids: ls.map((l) => l.name), p: { x: st(Math.round(cx)), y: st(Math.round(cy)), scale: st(100), rot: st(0), op: st(100), ax: st(0), ay: st(0), ts: st(0), te: st(100) } };
    setLayers(layers.filter((l) => !ls.includes(l))); layers.splice(at, 0, g); S.multi.clear(); S.sel = g.id; S.keys = []; S.pop = null;
    commit('Pre-compose'); buildCanvas(); renderAll(); toast(`Grouped ${ls.length} layers into ${g.name}. Double-tap to open it.`, true);
  },
  del: () => { const ls = targets(); if (!ls.length) return; setLayers(layers.filter((x) => !ls.includes(x))); S.sel = null; S.multi.clear(); S.keys = []; S.pop = null; commit('Delete'); buildCanvas(); renderAll(); toast(`Deleted ${ls.length > 1 ? ls.length + ' layers' : ls[0].name}`, true); },
  move: (el) => { const l = lay(S.pop.id), i = layers.indexOf(l), j = i + +el.dataset.v; if (j >= 0 && j < layers.length) { layers.splice(i, 1); layers.splice(j, 0, l); commit('Reorder'); buildCanvas(); } S.pop = null; renderAll(); },
  add: (el) => { S.pop = null; newLayer(el.dataset.v); if (el.dataset.v === 'draw') { S.tool = S.drawMode; renderStrips(); renderFloats(); } },
  msel: () => { const id = S.pop && S.pop.id; S.pop = null; if (id) toggleMember(id, S.ctxPrev || []); },
};
