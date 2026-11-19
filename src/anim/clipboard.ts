import { DUR } from '../model/project';
import { lay } from './interpolate';
import { S, selIds } from '../state/state';
import { commit } from '../state/history';
import { updateCanvas } from '../render/stage';
import { tc } from '../ui/inspector/controls';
import { renderTL } from '../ui/timeline';
import { toast } from '../ui/toast';
import { renderAll } from '../ui/layout';

export let keyClip = null;
export function copyKeys() {
  const ks = S.keys.map((k) => { const l = lay(k.l), pr = l && l.p[k.p], key = pr && pr.keys && pr.keys[k.i]; return key ? { p: k.p, key: { ...key } } : null; }).filter(Boolean);
  if (!ks.length) return false;
  const t0 = Math.min(...ks.map((o) => o.key.t)); keyClip = ks.map((o) => ({ p: o.p, key: { ...o.key, t: o.key.t - t0 } }));
  renderTL(); toast(`Copied ${ks.length} keyframe${ks.length > 1 ? 's' : ''}`); return true;
}
export function pasteKeys() {
  const ls = selIds().map(lay).filter((l) => l && !l.lock); if (!keyClip || !ls.length) return false;
  const at = Math.round(S.f), added = [];
  ls.forEach((l) => keyClip.forEach((o) => {
    const t = at + o.key.t; if (t > DUR - 1) return;
    let pr = l.p[o.p]; if (!pr) return;
    if (!pr.keys) { pr.keys = [{ t: 0, v: pr.v, e: 'ease' }]; delete pr.v; }
    const j = pr.keys.findIndex((k) => Math.round(k.t) === t); const nk = { ...o.key, t };
    if (j >= 0) pr.keys[j] = nk; else pr.keys.push(nk);
    pr.keys.sort((a, b) => a.t - b.t); added.push({ l: l.id, p: o.p, i: pr.keys.indexOf(nk) });
  }));
  if (!added.length) return false;
  S.keys = added; commit('Paste keyframes'); updateCanvas(); renderAll(); toast(`Pasted ${added.length} keyframe${added.length > 1 ? 's' : ''} at ${tc(at)}`, true); return true;
}
export function selectedKeyObjs() { return S.keys.map((k) => { const l = lay(k.l); const pr = l && l.p[k.p]; return pr && pr.keys && pr.keys[k.i] ? pr.keys[k.i] : null; }).filter(Boolean); }
