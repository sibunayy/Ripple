import { FPS } from '../../model/project';
import { ic } from '../icons';
import { GROUPS, PROPS } from '../../model/schema';
import { animated, keyAt, lay, val } from '../../anim/interpolate';
import { S } from '../../state/state';
import { commit } from '../../state/history';
import { updateCanvas } from '../../render/stage';
import { renderTop } from '../topbar';
import { renderRight } from './index';
import { renderTL } from '../timeline';
import { toast } from '../toast';

/* ---------- render: right panel ---------- */
function fldBox(l, p, axis) {
  const m = PROPS[p], v = val(l.p[p], S.f);
  return `<div class="fld" role="slider" tabindex="0" aria-label="${m.label}" aria-valuemin="${m.min}" aria-valuemax="${m.max}" aria-valuenow="${Math.round(v)}" data-l="${l.id}" data-p="${p}">${axis ? `<span class="axg" aria-hidden="true">${axis}</span>` : ''}<span class="v tc">${fmt(v, m)}</span></div>`;
}
export function grpState(l, g) {
  const ps = GROUPS[g].ps, anim = ps.some((p) => animated(l.p[p])), on = anim && ps.some((p) => keyAt(l.p[p], S.f) >= 0);
  const ts = [...new Set<number>(ps.flatMap((p) => animated(l.p[p]) ? l.p[p].keys.map((k) => k.t) : []))].sort((a, b) => a - b);
  return { anim, on, prev: ts.filter((t) => t < S.f - .5).pop(), next: ts.find((t) => t > S.f + .5) };
}
export const kdLabel = (n, st2) => st2.anim ? (st2.on ? `Remove ${n} keyframe` : `Add ${n} keyframe`) : `Animate ${n}`;
export function propRow(l, g) {
  const G = GROUPS[g], st2 = grpState(l, g);
  const extra = g === 'anchor' ? `<button class="lk" data-act="anchorpick" aria-haspopup="dialog" aria-label="Anchor point presets" title="Move the anchor to a corner, edge or the centre">Presets</button>` : '';
  return `<div class="prop ${st2.anim ? 'is-anim' : ''}" data-g="${g}"><div class="plbl"><span>${G.label}</span>${extra}</div><div class="pv">${G.ps.map((p, i) => fldBox(l, p, G.axes && G.axes[i])).join('')}</div>
    <div class="kc" role="group" aria-label="${G.label} keyframes">
      <button data-act="kprev" data-g="${g}" aria-label="Previous ${G.label} keyframe" title="Previous keyframe" ${st2.prev == null ? 'disabled' : ''}>${ic('left', 'xs')}</button>
      <button class="kd ${st2.anim ? 'anim' : ''} ${st2.on ? 'onkey' : ''}" data-act="kgroup" data-kd="${g}" data-g="${g}" aria-label="${kdLabel(G.label, st2)}" title="Tap: add or remove keyframe · hold: remove all animation">${ic('diamond')}</button>
      <button data-act="knext" data-g="${g}" aria-label="Next ${G.label} keyframe" title="Next keyframe" ${st2.next == null ? 'disabled' : ''}>${ic('right', 'xs')}</button>
    </div></div>`;
}
export function clearAnim(l, g) {
  const G = GROUPS[g]; let n = 0;
  G.ps.forEach((p) => { const pr = l.p[p]; if (animated(pr)) { pr.v = val(pr, S.f); delete pr.keys; n++; } });
  if (!n) return;
  S.keys = S.keys.filter((k) => !(k.l === l.id && G.ps.includes(k.p)));
  commit('Remove animation'); updateCanvas(); renderRight(); renderTL(); renderTop(); toast(`Removed ${G.label} animation`, true);
}
export const fmt = (v, m) => { const r = Math.round(v * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + (m.u || ''); };
export const tc = (f) => `00:${String(Math.floor(f / FPS)).padStart(2, '0')}:${String(Math.floor(f % FPS)).padStart(2, '0')}`;
export function sec(id, title, inner, extra = '') {
  const open = !S.collapsed.has(id);
  return `<div class="sec"><button class="sec-h" data-act="sec" data-v="${id}" aria-expanded="${open}">${title}${extra}${ic('down', 'xs chev')}</button>${open ? `<div class="sec-b">${inner}</div>` : ''}</div>`;
}
/* ---------- inspector building blocks ---------- */
const fmtv = (v, u) => { const r = Math.round((+v || 0) * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + (u || ''); };
// Plain (non-keyframed) parameter: o = 'lp' layer · 'fx' effect · 'rep' duplicator · 'mod' behaviour
export function pf(obj, o, idx, key, label, min, max, step, u = '', int = false) {
  return `<div class="fld" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${Math.round(obj[key] ?? 0)}" data-o="${o}" data-i="${idx}" data-k="${key}" data-min="${min}" data-max="${max}" data-step="${step}" data-u="${u}" data-int="${int ? 1 : 0}"><span class="lb">${label}</span><span class="v tc">${fmtv(obj[key], u)}</span></div>`;
}
export const grid2 = (items) => { const out = []; for (let i = 0; i < items.length; i += 2) out.push(`<div class="pair">${items[i]}${items[i + 1] || '<span></span>'}</div>`); return out.join(''); };
export const selH = (name, idx, opts, cur, label) => `<select class="sel" data-sel="${name}" data-i="${idx}" aria-label="${label}">${opts.map(([v, n]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
export const BLENDS = [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['soft-light', 'Soft light'], ['difference', 'Difference'], ['plus-lighter', 'Add']];
export const isDesc = (cand, l) => { let c = cand, n = 0; while (c && n++ < 10) { if (c.parent === l.id) return true; c = lay(c.parent); } return false; };
