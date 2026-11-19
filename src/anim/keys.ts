// @ts-nocheck
import { PROPS } from '../model/schema';
import { animated, keyAt, val } from './interpolate';
import { S } from '../state/state';
import { commit } from '../state/history';
import { toast } from '../ui/toast';

export function setVal(l, p, v, forceKey) {
  const pr = l.p[p];
  if (animated(pr)) { const i = keyAt(pr, S.f); if (i >= 0) pr.keys[i].v = v; else { pr.keys.push({ t: Math.round(S.f), v, e: 'ease' }); pr.keys.sort((a, b) => a.t - b.t); } }
  else if (S.autoKey || forceKey) { const old = pr.v; pr.keys = []; if (S.f > 0) pr.keys.push({ t: 0, v: old, e: 'ease' }); pr.keys.push({ t: Math.round(S.f), v, e: 'ease' }); delete pr.v; }
  else pr.v = v;
}
export function toggleKey(l, p) {
  const pr = l.p[p];
  if (!animated(pr)) { pr.keys = [{ t: Math.round(S.f), v: pr.v, e: 'ease' }]; delete pr.v; commit('Animate ' + PROPS[p].label); toast(`${PROPS[p].label} is animated. Edits at the playhead now make keyframes.`); return; }
  const i = keyAt(pr, S.f);
  if (i < 0) { pr.keys.push({ t: Math.round(S.f), v: val(pr, S.f), e: 'ease' }); pr.keys.sort((a, b) => a.t - b.t); commit('Add keyframe'); return; }
  const v = pr.keys[i].v; pr.keys.splice(i, 1);
  if (!pr.keys.length) { delete pr.keys; pr.v = v; }
  S.keys = S.keys.filter((k) => !(k.l === l.id && k.p === p));
  commit('Remove keyframe');
}
