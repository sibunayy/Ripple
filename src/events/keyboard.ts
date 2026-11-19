// @ts-nocheck
import { $ } from '../core/dom';
import { layers } from '../model/project';
import { lay } from '../anim/interpolate';
import { S, isDrawTool, isSelTool } from '../state/state';
import { commit, redo, undo } from '../state/history';
import { buildCanvas } from '../render/stage';
import { renderTop } from '../ui/topbar';
import { SHAPES, renderStrips } from '../ui/strips';
import { copyKeys, keyClip, pasteKeys } from '../anim/clipboard';
import { renderFloats } from '../ui/floats';
import { renderPop } from '../ui/popovers';
import { renderAll, seek } from '../ui/layout';
import { play } from '../playback/loop';
import { A } from '../actions/index';
import { drawOverlay } from '../drawing/overlay';
import { penFinish, pinch0 } from '../gestures/canvas';

// two-finger tap = undo, three-finger tap = redo (touch only)
let tapStart = null;
/** Registers this module's event listeners. main.ts calls it once, in the original order. */
export function listen() {
  addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '');
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (S.tool === 'pen' && S.penPts.length && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.key === 'Enter' ? penFinish(false) : (S.penPts = [], drawOverlay(), renderFloats()); return; }
    if (e.key === 'Escape') { if (S.dialog) A.close(); else if (S.pop) { S.pop = null; renderPop(); renderTop(); renderStrips(); } else { S.keys = []; renderAll(); } return; }
    if (typing) return;
    const ar = document.activeElement && document.activeElement.closest && document.activeElement.closest('.lrow[data-v]');
    if (e.altKey && ar && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const l = lay(ar.dataset.v), i = layers.indexOf(l), j = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (l && j >= 0 && j < layers.length) { layers.splice(i, 1); layers.splice(j, 0, l); commit('Reorder layers'); buildCanvas(); renderAll(); const nr = $(`#lpanel .lrow[data-v="${l.id}"]`); if (nr) nr.focus(); }
      return;
    }
    if (mod && k === 'c' && S.keys.length) { e.preventDefault(); copyKeys(); return; }
    if (mod && k === 'v' && keyClip && S.sel) { e.preventDefault(); pasteKeys(); return; }
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'a') { e.preventDefault(); A.selall(); return; }
    if (mod && k === 'd' && S.sel) { e.preventDefault(); A.dup(); return; }
    if (mod && k === 'g' && S.sel) { e.preventDefault(); A.group(); return; }
    if (S.dialog) return;
    if (e.key === ' ') { e.preventDefault(); play(); return; }
    if (e.key === '?') { A.help(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); if (S.playing) play(false); seek(Math.round(S.f) + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)); return; }
    const map = { b: 'brush', x: 'erase', g: 'fill', v: 'select', m: 'marquee', q: 'lasso', h: 'hand', p: 'pen', t: 'text', r: 'rect', e: 'ellipse', y: 'polygon', s: 'star', l: 'line' };
    if (!mod && map[k]) { S.tool = map[k]; if (S.tool !== 'pen' && S.penPts.length) { S.penPts = []; drawOverlay(); } if (SHAPES.some((s) => s[0] === S.tool)) S.shape = S.tool; if (isSelTool(S.tool)) S.selMode = S.tool; if (isDrawTool(S.tool)) S.drawMode = S.tool; renderStrips(); renderFloats(); return; }
    if (!mod && k === 'k') { A.autokey(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.keys.length) { A.keysdel(); } else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { A.del(); }
  });
  addEventListener('touchstart', (e) => { if (e.touches.length >= 2) tapStart = { n: e.touches.length, t: performance.now() }; }, { passive: true });
  addEventListener('touchend', (e) => { if (tapStart && e.touches.length === 0) { if (performance.now() - tapStart.t < 260 && pinch0 === null) { tapStart.n === 2 ? undo() : tapStart.n === 3 && redo(); } tapStart = null; } }, { passive: true });
}
