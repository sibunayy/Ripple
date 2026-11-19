// @ts-nocheck
import { esc } from '../../core/dom';
import { ic } from '../icons';
import { EASES, EASE_NAMES, EASE_ROW, earr, easeGlyph, ename } from '../../anim/easing';
import { TF } from '../../model/schema';
import { animated, lay } from '../../anim/interpolate';
import { S } from '../../state/state';
import { selectedKeyObjs } from '../../anim/clipboard';

const EZ_SHORT = { out: 'Out', in: 'In', inout: 'In-out', back: 'Back', anticip: 'Antic.', bounce: 'Over' };
export function easingBlock(compact) {
  const ks = selectedKeyObjs(), l = S.sel && lay(S.sel), lk = l ? TF.filter((p) => animated(l.p[p])).reduce((n, p) => n + l.p[p].keys.length, 0) : 0;
  if (!ks.length) return `<p class="hint" style="padding:0">Tap keyframes in the timeline to ease them. Hold a keyframe for quick presets.</p>`
    + `<button class="line-btn" data-act="keysall" ${lk ? '' : 'disabled'}>${ic('selall', 's')}Select all keyframes on ${l ? esc(l.name) : 'layer'}</button>`;
  const a = earr(ks[0]), cur = Array.isArray(ks[0].e) ? null : ks[0].e, hold = cur === 'hold';
  const pts = (x, y) => [12 + x * 256, 112 - y * 92];
  const [p0, p1, p2, p3] = [pts(0, 0), pts(a[0], a[1]), pts(a[2], a[3]), pts(1, 1)];
  const mixed = ks.some((k) => JSON.stringify(k.e) !== JSON.stringify(ks[0].e));
  return `<div class="ease-card">
    <svg class="curve" id="curve" viewBox="0 0 280 132" role="img" aria-label="Easing curve ${ename(ks[0])}" style="${hold ? 'opacity:.4;pointer-events:none' : ''}">
      <path class="grid" d="M12 20H268M12 112H268M12 20V112M268 20V112M140 20V112"/>
      ${hold ? `<path class="c" d="M${p0} H268 V20"/>` : `<line class="arm" x1="${p0[0]}" y1="${p0[1]}" x2="${p1[0]}" y2="${p1[1]}"/><line class="arm" x1="${p3[0]}" y1="${p3[1]}" x2="${p2[0]}" y2="${p2[1]}"/>
      <path class="c" d="M${p0} C${p1} ${p2} ${p3}"/>
      <circle class="hz" data-h="1" cx="${p1[0]}" cy="${p1[1]}" r="18"/><circle class="h" data-h="1" cx="${p1[0]}" cy="${p1[1]}" r="6.5"/>
      <circle class="hz" data-h="2" cx="${p2[0]}" cy="${p2[1]}" r="18"/><circle class="h" data-h="2" cx="${p2[0]}" cy="${p2[1]}" r="6.5"/>`}
    </svg>
    <div class="ezn" role="group" aria-label="Bezier values">${['X1', 'Y1', 'X2', 'Y2'].map((n, i) => `<label>${n}<input class="tc" data-ezv="${i}" inputmode="decimal" value="${a[i].toFixed(2)}" aria-label="Curve ${n}" ${hold ? 'disabled' : ''}></label>`).join('')}</div>
    <div class="sublbl">Presets</div>
    <div class="eases all" role="group" aria-label="Ease presets">${EASE_ROW.map((e) => `<button class="ez ${cur === e ? 'on' : ''}" data-act="ease" data-v="${e}" aria-pressed="${cur === e}" title="${EASE_NAMES[e]}" aria-label="${EASE_NAMES[e]}">${easeGlyph(EASES[e])}${EZ_SHORT[e] || EASE_NAMES[e]}</button>`).join('')}</div>
    <div class="three"><button class="line-btn" data-act="ezcopy" title="Copy this curve">${ic('copy', 's')}Copy</button><button class="line-btn" data-act="ezpaste" ${S.easeClip ? '' : 'disabled'} title="Paste the copied curve">Paste</button><button class="line-btn" data-act="ezrev" ${hold ? 'disabled' : ''} title="Mirror the curve (ease in ↔ ease out)">${ic('arrowH', 's')}Mirror</button></div>
    <button class="line-btn" data-act="keysall" ${lk > ks.length ? '' : 'disabled'}>${ic('selall', 's')}Select all keyframes (${lk})</button>
    ${compact ? '' : `<div class="kv"><span>${ks.length} keyframe${ks.length > 1 ? 's' : ''} · ${mixed ? 'Mixed' : ename(ks[0])}</span><span class="tc">${hold ? 'hold' : a.map((n) => n.toFixed(2)).join(', ')}</span></div>
    <p class="hint" style="padding:0">Hold keeps the value until the next keyframe, then jumps.</p>`}
  </div>`;
}
