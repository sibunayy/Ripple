// @ts-nocheck
import { lay } from '../../anim/interpolate';
import { S, selIds } from '../../state/state';
import { saveProj } from '../../model/project';
import { renderRight } from '../../ui/inspector/index';
import { FXDEF } from '../../fx/defs';
import { commit } from '../../state/history';
import { buildCanvas } from '../../render/stage';
import { toast } from '../../ui/toast';
import { renderPop } from '../../ui/popovers';
import { fxClip, setFxClip } from '../../ui/inspector/effects';
import { renderAll } from '../../ui/layout';

/** Effects stack. Keys are data-act names. */
export const effectsActions = {
  fxshut: (el) => { const l = lay(S.sel), e = l && l.fx[+el.dataset.v]; if (!e) return; e.shut = !e.shut; saveProj(); renderRight(); },
  fxfold: () => { const l = lay(S.sel); if (!l) return; const shut = !l.fx.every((e) => e.shut); l.fx.forEach((e) => { e.shut = shut; }); saveProj(); renderRight(); },
  fxreset: (el) => { const l = lay(S.sel), e = l && l.fx[+el.dataset.v]; if (!e) return; FXDEF[e.id].ps.forEach(([k, , , , , , def]) => { e[k] = def; }); e.mix = 100; commit('Reset effect'); buildCanvas(); renderRight(); toast(`${e.name} reset`, true); },
  fxmenu: (el) => { const r = el.getBoundingClientRect(); S.pop = { type: 'fxm', i: +el.dataset.v, x: r.right, y: r.bottom }; renderPop(); },
  fxbypass: () => { const l = lay(S.sel); if (!l) return; l.fxOff = !l.fxOff; commit(l.fxOff ? 'Bypass effects' : 'Enable effects'); buildCanvas(); renderRight(); },
  fxcopy: () => { const l = lay(S.sel); if (!l || !l.fx.length) return; setFxClip(JSON.parse(JSON.stringify(l.fx))); renderRight(); toast(`Copied ${l.fx.length} effect${l.fx.length > 1 ? 's' : ''}`); },
  fxpaste: () => { if (!fxClip) return; const ls = selIds().map(lay).filter((l) => l && !l.lock); ls.forEach((l) => { l.fx = [...l.fx, ...JSON.parse(JSON.stringify(fxClip))]; }); commit('Paste effects'); buildCanvas(); renderAll(); toast(`Pasted ${fxClip.length} effect${fxClip.length > 1 ? 's' : ''}`, true); },
  fxdup: () => { const l = lay(S.sel), i = S.pop && S.pop.i; if (!l || l.fx[i] == null) return; l.fx.splice(i + 1, 0, JSON.parse(JSON.stringify(l.fx[i]))); S.pop = null; commit('Duplicate effect'); buildCanvas(); renderAll(); },
  fxmv: (el) => { const l = lay(S.sel), i = S.pop && S.pop.i, j = i + +el.dataset.v; if (!l || j < 0 || j >= l.fx.length) return; const [x] = l.fx.splice(i, 1); l.fx.splice(j, 0, x); S.pop = null; commit('Reorder effects'); buildCanvas(); renderAll(); },
  fxsolo: () => { const l = lay(S.sel), i = S.pop && S.pop.i; if (!l) return; l.fx.forEach((e, j) => { e.on = j === i; }); l.fxOff = false; S.pop = null; commit('Solo effect'); buildCanvas(); renderAll(); toast(`Only ${l.fx[i].name} is on`, true); },
  addfx: () => { S.pop = { type: 'fx' }; renderPop(); },
  fxadd: (el) => { const l = lay(S.sel); const id = el.dataset.v, D = FXDEF[id], e = { id, name: D.name, on: true }; D.ps.forEach(([k, , , , , , def]) => { e[k] = def; }); l.fx.push(e); S.pop = null; commit('Add effect'); buildCanvas(); renderAll(); },
  fxon: (el) => { const l = lay(S.sel); const e = l.fx[+el.dataset.v]; e.on = !e.on; commit('Toggle effect'); buildCanvas(); renderRight(); },
  fxdel: (el) => { const l = lay(S.sel); l.fx.splice(+el.dataset.v, 1); S.pop = null; renderPop(); commit('Remove effect'); buildCanvas(); renderRight(); },
};
