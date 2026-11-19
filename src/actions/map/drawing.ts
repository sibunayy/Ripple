import { S, isDrawTool, isSelTool } from '../../state/state';
import { drawOverlay } from '../../drawing/overlay';
import { SHAPES, renderStrips } from '../../ui/strips';
import { renderFloats } from '../../ui/floats';
import { renderPop } from '../../ui/popovers';
import { addCel, celIdx, freeFrame, insertCel, saveBrush, saveOnion } from '../../drawing/cels';
import { renderBrushBar } from '../../drawing/brush-bar';
import { toast } from '../../ui/toast';
import { lay } from '../../anim/interpolate';
import { commit } from '../../state/history';
import { updateCanvas } from '../../render/stage';
import { renderRight } from '../../ui/inspector/index';
import { renderTL } from '../../ui/timeline';
import { seek } from '../../ui/layout';
import { $$ } from '../../core/dom';

/** Tools, brush and drawing cels. Keys are data-act names. */
export const drawingActions = {
  tool: (el) => { S.tool = el.dataset.v; if (S.tool !== 'pen' && S.penPts.length) { S.penPts = []; drawOverlay(); } if (SHAPES.some((s) => s[0] === S.tool)) S.shape = S.tool; if (isSelTool(S.tool)) S.selMode = S.tool; if (isDrawTool(S.tool)) S.drawMode = S.tool; renderStrips(); renderFloats(); },
  pickdraw: (el) => { S.drawMode = S.tool = el.dataset.v; S.pop = null; renderStrips(); renderPop(); renderFloats(); },
  bpre: (el) => { S.brush.pre = el.dataset.v; if (S.tool !== 'brush') { S.tool = S.drawMode = 'brush'; renderStrips(); } saveBrush(); renderFloats(); },
  btog: (el) => { const k = el.dataset.k; S.brush[k] = !S.brush[k]; saveBrush(); renderBrushBar(); toast(k === 'pr' ? (S.brush.pr ? 'Pressure changes width' : 'Pressure off') : (S.brush.tl ? 'Tilt the Pencil to shade' : 'Tilt off')); },
  bcolour: () => { S.pop = { type: 'color', key: 'brush' }; renderPop(); },
  celadd: () => addCel(false),
  celdup: () => addCel(true),
  celclear: () => { const l = lay(S.sel), i = l && celIdx(l, S.f); if (!l || i < 0) return; l.cels[i].strokes = []; l.cels[i].v = (l.cels[i].v || 0) + 1; commit('Clear cel'); updateCanvas(); renderRight(); renderTL(); toast('Cel cleared', true); },
  onion: () => { S.onion.on = !S.onion.on; saveOnion(); updateCanvas(); renderTL(); if (S.pop && S.pop.type === 'onion') renderPop(); },
  onionpop: (el) => { const r = el.getBoundingClientRect(); S.pop = { type: 'onion', x: r.left + r.width / 2, y: r.top + 360 }; renderPop(); },
  onset: (el) => { const k = el.dataset.k; if (k === 'tint' || k === 'lb') S.onion[k] = !S.onion[k]; else S.onion[k] = +el.dataset.v; if (k !== 'lb' && k !== 'tint') S.onion.on = true; saveOnion(); updateCanvas(); renderTL(); renderPop(); },
  celop: (el) => {
    const P0 = S.pop, l = lay(P0.l), c = l && (l.cels || []).find((x) => x.id === P0.id); S.pop = null; if (!c) { renderPop(); return; }
    if (el.dataset.v === 'del') { l.cels = l.cels.filter((x) => x !== c); commit('Delete cel'); toast('Cel deleted', true); }
    else { const f = freeFrame(l, c.f + 1); if (f < 0) { toast('No free frame after this cel.'); renderPop(); return; } insertCel(l, f, el.dataset.v === 'dup' ? c.strokes : []); commit(el.dataset.v === 'dup' ? 'Duplicate cel' : 'Blank cel'); seek(f); }
    renderPop(); updateCanvas(); renderTL(); renderRight();
  },
  picksel: (el) => { S.selMode = S.tool = el.dataset.v; S.pop = null; renderStrips(); renderPop(); renderFloats(); },
  pickshape: (el) => { S.shape = S.tool = el.dataset.v; S.pop = null; renderStrips(); renderPop(); renderFloats(); },
  flip: (el) => { const on = el.getAttribute('aria-pressed') !== 'true'; el.setAttribute('aria-pressed', on); },
  flipseg: (el) => { $$('button', el.parentElement).forEach((b) => b.setAttribute('aria-pressed', b === el)); },
};
