import { lay, val } from '../../anim/interpolate';
import { S, selIds } from '../../state/state';
import { commit } from '../../state/history';
import { buildCanvas, gEls, updateCanvas } from '../../render/stage';
import { renderRight } from '../../ui/inspector/index';
import { st } from '../../model/schema';
import { renderAll } from '../../ui/layout';
import { toast } from '../../ui/toast';
import { DUR } from '../../model/project';
import { renderTL } from '../../ui/timeline';
import { renderPop } from '../../ui/popovers';
import { setVal } from '../../anim/keys';
import { cp, cpApply, hexToHsv } from '../../ui/color-picker';
import { renderFloats } from '../../ui/floats';
import { alignTo } from '../align';

/** Inspector property controls. Keys are data-act names. */
export const inspectorActions = {
  fillon: () => { const l = lay(S.sel); l.fill = l.fill === false; commit('Fill'); buildCanvas(); renderRight(); },
  flipx: () => { const ls = selIds().map(lay); ls.forEach((l) => { l.flipX = !l.flipX; }); commit('Flip horizontal'); updateCanvas(); renderRight(); },
  flipy: () => { const ls = selIds().map(lay); ls.forEach((l) => { l.flipY = !l.flipY; }); commit('Flip vertical'); updateCanvas(); renderRight(); },
  tfreset: () => {
    const ls = selIds().map(lay).filter((l) => l && !l.lock); if (!ls.length) return;
    const D = { x: 960, y: 540, scale: 100, rot: 0, op: 100 };
    ls.forEach((l) => { for (const p in D) l.p[p] = st(D[p]); l.flipX = l.flipY = false; });
    S.keys = S.keys.filter((k) => !(ls.some((l) => l.id === k.l) && k.p in D));
    commit('Reset transform'); updateCanvas(); renderAll(); toast('Transform reset: centred, 100%, 0°, fully opaque', true);
  },
  gtype: (el) => { const l = lay(S.sel); if (!l) return; l.gtype = el.dataset.v; commit('Gradient type'); buildCanvas(); renderRight(); },
  gswap: () => { const l = lay(S.sel); if (!l) return; const a = l.hue; l.hue = l.hue2 || '#ff5ea8'; l.hue2 = a; commit('Swap gradient'); buildCanvas(); renderAll(); },
  trimin: () => { const l = lay(S.sel); if (!l) return; l.inP = Math.min(Math.round(S.f), (l.outP ?? DUR) - 1); commit('Layer in'); buildCanvas(); renderRight(); renderTL(); },
  trimout: () => { const l = lay(S.sel); if (!l) return; l.outP = Math.max(Math.round(S.f) + 1, (l.inP ?? 0) + 1); commit('Layer out'); buildCanvas(); renderRight(); renderTL(); },
  hue: (el) => { const l = lay(S.sel); l.hue = el.dataset.v; commit('Colour'); buildCanvas(); renderAll(); },
  tset: (el) => { const l = lay(S.sel); if (!l) return; const k = el.dataset.k; if (k === 'italic' || k === 'under' || k === 'strike') l[k] = !l[k]; else l[k] = el.dataset.v; commit('Text style'); buildCanvas(); renderRight(); },
  weight: (el) => { const l = lay(S.sel); l.weight = +el.dataset.v; commit('Weight'); buildCanvas(); renderRight(); },
  align: () => { S.pop = { type: 'align' }; renderPop(); },
  anchorpick: () => { S.pop = { type: 'anchor' }; renderPop(); },
  anchor: (el) => {
    const l = S.sel && lay(S.sel), g = l && gEls[l.id]; if (!g) return;
    const bb = g.querySelector('.xf').getBBox(), [fx2, fy] = el.dataset.v.split(',').map(Number), f = S.f;
    const ax0 = val(l.p.ax, f), ay0 = val(l.p.ay, f), nax = Math.round(bb.x + fx2 * bb.width), nay = Math.round(bb.y + fy * bb.height);
    const sc = val(l.p.scale, f) / 100, r = val(l.p.rot, f) * Math.PI / 180, dx = (nax - ax0) * sc, dy = (nay - ay0) * sc;
    setVal(l, 'x', val(l.p.x, f) + dx * Math.cos(r) - dy * Math.sin(r)); setVal(l, 'y', val(l.p.y, f) + dx * Math.sin(r) + dy * Math.cos(r));
    setVal(l, 'ax', nax); setVal(l, 'ay', nay);
    S.pop = null; commit('Anchor point'); updateCanvas(); renderAll(); toast('Anchor moved. The layer stays in place.', true);
  },
  colour: (el) => { S.pop = { type: 'color', key: el.dataset.key || 'hue' }; renderPop(); },
  cpsw: (el) => { if (!cp) return; Object.assign(cp, hexToHsv(el.dataset.v)); cpApply(el.dataset.v); },
  eyedrop: () => { S.eyedrop = cp ? (cp.key || 'hue') : 'hue'; S.pop = null; renderPop(); renderFloats(); },
  alignto: (el) => alignTo(el.dataset.v),
  gradon: () => { const l = lay(S.sel); if (!l) return; l.grad = !l.grad; if (!l.hue2) l.hue2 = '#ff5ea8'; if (l.gang == null) l.gang = 90; commit('Gradient'); buildCanvas(); renderRight(); },
};
