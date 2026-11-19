import { esc } from '../../core/dom';
import { ic } from '../icons';
import { FXDEF } from '../../fx/defs';
import { grid2, pf } from './controls';

export function fxView(l) {
  const n = l.fx.length, nOn = l.fx.filter((e) => e.on).length;
  const head = `<span class="chip-dot" style="background:${l.hue}"></span><div style="min-width:0"><h2 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.name)}</h2><div class="sub">${n ? `${nOn} of ${n} effect${n === 1 ? '' : 's'} on` : 'No effects'}</div></div><span class="spacer"></span><button class="ib" data-act="addfx" aria-label="Add effect" aria-haspopup="menu">${ic('plus', 's')}</button>`;
  const rows = l.fx.map((e, i) => {
    const D = FXDEF[e.id] || FXDEF.glow;
    D.ps.forEach(([k, , , , , , def]) => { if (e[k] === undefined) e[k] = def; });
    if (e.mix === undefined) e.mix = 100;
    const shut = !!e.shut;
    return `<div class="fx ${shut ? 'shut' : ''} ${e.on ? '' : 'off'}"><div class="fx-h"><button class="tog" data-act="fxon" data-v="${i}" aria-pressed="${e.on}" aria-label="${e.on ? 'Disable' : 'Enable'} ${e.name}"></button>
      <button class="nmb" data-act="fxshut" data-v="${i}" aria-expanded="${!shut}" aria-label="${shut ? 'Expand' : 'Collapse'} ${e.name}">${ic('down', 'xs chev')}<span>${e.name}</span></button>
      <button class="ib" data-act="fxreset" data-v="${i}" aria-label="Reset ${e.name}" title="Reset to defaults">${ic('reset', 's')}</button>
      <button class="ib" data-act="fxmenu" data-v="${i}" aria-label="${e.name} options" aria-haspopup="menu" title="More">${ic('more', 's')}</button></div>
      ${shut ? '' : grid2(D.ps.map(([k, lb, mn, mx, sp, u]) => pf(e, 'fx', i, k, lb, mn, mx, sp, u)).concat(e.id === 'postime' ? [] : [pf(e, 'fx', i, 'mix', 'Mix', 0, 100, .5, '%', true)]))}</div>`;
  }).join('');
  const bar = n ? `<div class="fxbar"><span>Bypass all</span><button class="tog" data-act="fxbypass" aria-pressed="${!!l.fxOff}" aria-label="Bypass all effects"></button><span class="spacer"></span><button class="line-btn ghost" data-act="fxfold" style="min-height:30px">${l.fx.every((e) => e.shut) ? 'Expand all' : 'Collapse all'}</button></div>` : '';
  const body = bar + (l.fxOff && n ? '<p class="hint" style="padding-top:0;color:var(--acc-text)">All effects are bypassed. The settings are kept.</p>' : '') + (rows || `<p class="hint">No effects yet. Add Glow, Ripple distort, Hue shift and more with the plus button. Effects stack top to bottom.</p>`)
    + `${n > 1 ? '<p class="hint">Hold an effect, then drag to reorder, or use ⋯ to move it. Effects apply top to bottom. Mix blends each effect with what is beneath it.</p>' : ''}<div style="padding:10px 14px;display:grid;gap:6px"><button class="line-btn" data-act="addfx" style="justify-content:center">${ic('plus', 's')}Add effect</button>${n || fxClip ? `<div class="two-btn"><button class="line-btn" data-act="fxcopy" ${n ? '' : 'disabled'} title="Copy this effect stack">${ic('copy', 's')}Copy stack</button><button class="line-btn" data-act="fxpaste" ${fxClip ? '' : 'disabled'} title="Paste copied effects onto the selected layers">Paste stack</button></div>` : ''}</div>`;
  return { head, body };
}
export let fxClip = null;
export function setFxClip(v) { return (fxClip = v); }
