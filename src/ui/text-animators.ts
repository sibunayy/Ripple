// @ts-nocheck
import { $$ } from '../core/dom';
import { ic } from './icons';
import { EASES, bez } from '../anim/easing';
import { ANIMS } from '../state/state';
import { grid2, pf, tc } from './inspector/controls';
import { clamp } from './graph';

export function animHtml(l) {
  const list = (l.anims || []).map((a, i) => `<div class="mod"><div class="fx-h" style="font-size:var(--fs-s)">${ANIMS[a.type][0]}<span class="tc" style="color:var(--muted);font-weight:400;font-size:var(--fs-xs)">from ${tc(a.start)}</span><span class="spacer"></span>
      <button class="ib" data-act="animstart" data-v="${i}" aria-label="Start ${ANIMS[a.type][0]} at the playhead" title="Start at playhead">${ic('marker', 's')}</button><button class="ib" data-act="animdel" data-v="${i}" aria-label="Remove ${ANIMS[a.type][0]}">${ic('trash', 's')}</button></div>
      ${a.type === 'wave' ? '' : grid2([a.type === 'track' ? '' : pf(a, 'an', i, 'stagger', 'Stagger', 0, 20, .05, ' f'), pf(a, 'an', i, 'dur', 'Duration', 1, 60, .1, ' f')].filter(Boolean))}</div>`).join('');
  return list + `<div class="chips" style="padding:4px 0 0;flex-wrap:wrap">${Object.entries(ANIMS).map(([k, [n]]) => `<button class="chip" data-act="animadd" data-v="${k}">＋ ${n}</button>`).join('')}</div>
    <p class="hint" style="padding:2px 0 0">Animators start at the playhead and move each character in turn.</p>`;
}
export function applyTextAnims(l, g, f) {
  const eo = bez(EASES.out), size = +l.size || 100;
  $$(':scope > .xf', g).forEach((xf) => {
    const ts = xf.querySelectorAll('tspan[data-ci]'), n = ts.length; if (!n) return;
    const op = new Array(n).fill(1), off = new Array(n).fill(0); let track = +l.track || 0;
    for (const a of l.anims) {
      if (a.type === 'track') { const u = clamp((f - a.start) / Math.max(1, a.dur), 0, 1); track += (1 - eo(u)) * size * .6; continue; }
      for (let i = 0; i < n; i++) {
        const t0 = a.start + i * a.stagger, u = clamp((f - t0) / Math.max(1, a.dur), 0, 1);
        if (a.type === 'fade') op[i] *= eo(u);
        else if (a.type === 'type') op[i] *= f >= t0 ? 1 : 0;
        else if (a.type === 'rise') { const k = eo(u); op[i] *= k; off[i] += (1 - k) * size * .45; }
        else if (a.type === 'wave' && f >= a.start) off[i] += Math.sin((f - a.start) * .25 - i * .55) * size * .12;
      }
    }
    ts.forEach((sp, i) => { sp.setAttribute('fill-opacity', op[i].toFixed(3)); sp.setAttribute('baseline-shift', (-off[i]).toFixed(2)); });
    const tx = xf.querySelector('text'); if (tx) tx.setAttribute('letter-spacing', track.toFixed(2));
  });
}
