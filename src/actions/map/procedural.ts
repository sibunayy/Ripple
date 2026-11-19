// @ts-nocheck
import { lay } from '../../anim/interpolate';
import { ANIMS, S } from '../../state/state';
import { REP_DEF } from '../../anim/pose';
import { commit } from '../../state/history';
import { buildCanvas, updateCanvas } from '../../render/stage';
import { renderRight } from '../../ui/inspector/index';
import { renderTL } from '../../ui/timeline';
import { toast } from '../../ui/toast';
import { tc } from '../../ui/inspector/controls';

/** Duplicator, behaviours and text animators. Keys are data-act names. */
export const proceduralActions = {
  repon: () => { const l = lay(S.sel); if (!l) return; if (!l.rep) l.rep = { ...REP_DEF, on: true }; else l.rep.on = !l.rep.on; if (l.rep.on) S.collapsed.delete('rep'); commit('Duplicator'); buildCanvas(); renderRight(); renderTL(); },
  repalign: () => { const l = lay(S.sel); l.rep.align = !l.rep.align; commit('Duplicator'); updateCanvas(); renderRight(); },
  modadd: (el) => {
    const l = lay(S.sel); if (!l) return; const kind = el.dataset.v; l.mods = l.mods || [];
    const base = { spin: { tgt: 'rot', amp: 90, freq: 1 }, wiggle: { tgt: 'x', amp: 30, freq: 1.2 }, jitter: { tgt: 'rot', amp: 8, freq: 2 }, bounce: { tgt: 'scale', amp: 40, freq: 1.6, dec: 4 }, pulse: { tgt: 'scale', amp: 15, freq: 2, dec: 6 }, orbit: { tgt: 'x', amp: 80, freq: .4, ell: 100 }, drift: { tgt: 'x', amp: 40, freq: 1 } }[kind] || { tgt: 'y', amp: 20, freq: .5 };
    l.mods.push({ kind, on: true, ph: 0, seed: 1 + Math.floor(Math.random() * 80), ...base }); commit('Add behaviour'); updateCanvas(); renderRight();
  },
  moddel: (el) => { const l = lay(S.sel); l.mods.splice(+el.dataset.v, 1); commit('Remove behaviour'); updateCanvas(); renderRight(); },
  modon: (el) => { const l = lay(S.sel), m = l.mods[+el.dataset.v]; m.on = !m.on; commit('Toggle behaviour'); updateCanvas(); renderRight(); },
  animadd: (el) => { const l = lay(S.sel); const t = el.dataset.v, d = ANIMS[t]; l.anims = [...(l.anims || []), { type: t, start: Math.round(S.f), stagger: d[2], dur: d[1] || 1 }]; S.collapsed.delete('tanim'); commit('Add text animator'); buildCanvas(); renderRight(); renderTL(); toast(`${d[0]} starts at ${tc(S.f)}. Press play to see it.`, true); },
  animdel: (el) => { const l = lay(S.sel); l.anims.splice(+el.dataset.v, 1); commit('Remove text animator'); buildCanvas(); renderRight(); renderTL(); },
  animstart: (el) => { const l = lay(S.sel); l.anims[+el.dataset.v].start = Math.round(S.f); commit('Move text animator'); updateCanvas(); renderRight(); renderTL(); },
};
