// @ts-nocheck
import { copyKeys, pasteKeys, selectedKeyObjs } from '../../anim/clipboard';
import { S } from '../../state/state';
import { animated, keyAt, lay, val } from '../../anim/interpolate';
import { GROUPS, KEYALL, TF } from '../../model/schema';
import { renderAll, seek } from '../../ui/layout';
import { commit } from '../../state/history';
import { updateCanvas } from '../../render/stage';
import { toast } from '../../ui/toast';
import { renderRight } from '../../ui/inspector/index';
import { EASE_NAMES, earr, ename } from '../../anim/easing';
import { toggleKey } from '../../anim/keys';
import { renderTL } from '../../ui/timeline';
import { renderTop } from '../../ui/topbar';
import { renderPop } from '../../ui/popovers';
import { targets } from '../../state/selection';
import { grpState, tc } from '../../ui/inspector/controls';
import { play } from '../../playback/loop';

/** Keyframes and easing. Keys are data-act names. */
export const keysActions = {
  copykeys: () => copyKeys(),
  pastekeys: () => pasteKeys(),
  keysall: () => { const l = S.sel && lay(S.sel); if (!l) return; S.keys = TF.filter((p) => animated(l.p[p])).flatMap((p) => l.p[p].keys.map((k, i) => ({ l: l.id, p, i }))); S.open.add(l.id); renderAll(); },
  keysdel: () => {
    if (!S.keys.length) return; const n = S.keys.length;
    const hold = {}; S.keys.forEach((k) => { const l = lay(k.l), pr = l && l.p[k.p]; if (pr) hold[k.l + ':' + k.p] = val(pr, S.f); });
    [...S.keys].sort((a, b) => b.i - a.i).forEach((k) => { const l = lay(k.l), pr = l && l.p[k.p]; if (!pr || !pr.keys || !pr.keys[k.i]) return; pr.keys.splice(k.i, 1); if (!pr.keys.length) { delete pr.keys; pr.v = hold[k.l + ':' + k.p]; } });
    S.keys = []; commit('Delete keyframes'); updateCanvas(); renderAll(); toast(`Deleted ${n} keyframe${n > 1 ? 's' : ''}`, true);
  },
  ezcopy: () => { const k = selectedKeyObjs()[0]; if (!k) return; S.easeClip = Array.isArray(k.e) ? [...k.e] : k.e; renderRight(); toast(`Copied ${ename(k)} curve`); },
  ezpaste: () => { if (!S.easeClip) return; selectedKeyObjs().forEach((k) => { k.e = Array.isArray(S.easeClip) ? [...S.easeClip] : S.easeClip; }); commit('Paste easing'); updateCanvas(); renderAll(); },
  ezrev: () => { const ks = selectedKeyObjs(); if (!ks.length) return; ks.forEach((k) => { const a = earr(k); k.e = [1 - a[2], 1 - a[3], 1 - a[0], 1 - a[1]].map((n) => Math.round(n * 100) / 100); }); commit('Mirror easing'); updateCanvas(); renderAll(); },
  kf: (el, e) => { e.stopPropagation(); const l = lay(el.dataset.l); toggleKey(l, el.dataset.p); updateCanvas(); renderRight(); renderTL(); renderTop(); },
  ease: (el) => { const e = el.dataset.v; selectedKeyObjs().forEach((k) => (k.e = e)); commit('Easing'); if (el.dataset.close) { S.pop = null; renderPop(); } renderRight(); renderTL(); renderTop(); updateCanvas(); toast(`Easing set to ${EASE_NAMES[e]}`); },
  qease: (el) => {
    const l = S.sel && lay(S.sel); if (!l) return;
    if (!S.keys.length) {
      const ks = []; TF.forEach((p) => { const i = keyAt(l.p[p], S.f); if (i >= 0) ks.push({ l: l.id, p, i }); });
      if (!ks.length) { toast('Move the playhead onto a keyframe to ease it, or tap Keyframe first.'); return; }
      S.keys = ks;
    }
    const r = el.getBoundingClientRect(); S.pop = { type: 'ease', x: r.left + r.width / 2, y: r.top }; renderAll();
  },
  autokey: () => { S.autoKey = !S.autoKey; renderTL(); toast(S.autoKey ? 'Auto-key on: edits at the playhead make keyframes.' : 'Auto-key off'); },
  keyall: () => { const ls = targets(); let n = 0; ls.forEach((l) => KEYALL.forEach((p) => { const pr = l.p[p]; if (!animated(pr)) { pr.keys = [{ t: Math.round(S.f), v: pr.v, e: 'ease' }]; delete pr.v; n++; } else if (keyAt(pr, S.f) < 0) { pr.keys.push({ t: Math.round(S.f), v: val(pr, S.f), e: 'ease' }); pr.keys.sort((a, b) => a.t - b.t); n++; } })); if (!ls.length) return; commit('Keyframe'); ls.forEach((l) => S.open.add(l.id)); renderAll(); toast(`Keyed ${n} properties on ${ls.length > 1 ? ls.length + ' layers' : ls[0].name} at ${tc(S.f)}`, true); },
  kprev: (el) => { const l = S.sel && lay(S.sel); if (!l) return; const st2 = grpState(l, el.dataset.g); if (st2.prev != null) { if (S.playing) play(false); seek(st2.prev); renderTL(); } },
  knext: (el) => { const l = S.sel && lay(S.sel); if (!l) return; const st2 = grpState(l, el.dataset.g); if (st2.next != null) { if (S.playing) play(false); seek(st2.next); renderTL(); } },
  kgroup: (el) => {
    const l = S.sel && lay(S.sel); if (!l) return;
    const g = el.dataset.g, G = GROUPS[g], st2 = grpState(l, g), f = Math.round(S.f);
    if (st2.on) {
      G.ps.forEach((p) => { const pr = l.p[p], i = keyAt(pr, S.f); if (i >= 0) { const v = pr.keys[i].v; pr.keys.splice(i, 1); if (!pr.keys.length) { delete pr.keys; pr.v = v; } } });
      S.keys = S.keys.filter((k) => !(k.l === l.id && G.ps.includes(k.p))); commit('Remove keyframe');
    } else {
      G.ps.forEach((p) => { const pr = l.p[p]; if (!animated(pr)) { pr.keys = [{ t: f, v: pr.v, e: 'ease' }]; delete pr.v; } else { pr.keys.push({ t: f, v: val(pr, S.f), e: 'ease' }); pr.keys.sort((a, b) => a.t - b.t); } });
      commit(st2.anim ? 'Add keyframe' : 'Animate ' + G.label);
      if (!st2.anim) toast(`${G.label} is animated. Edits at the playhead now make keyframes.`);
    }
    S.open.add(l.id); updateCanvas(); renderRight(); renderTL(); renderTop();
  },
};
