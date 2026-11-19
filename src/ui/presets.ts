// @ts-nocheck
import { esc } from '../core/dom';
import { store } from '../core/store';
import { ic } from './icons';
import { lay } from '../anim/interpolate';
import { S, selIds } from '../state/state';
import { grid2, pf, sec, tc } from './inspector/controls';

export const PRESETS = [
  { id: 'fadeIn', name: 'Fade In', cat: 'In', g: 'fade', d: '0.5 s · opacity' }, { id: 'slideUp', name: 'Slide In', cat: 'In', g: 'slide', d: '0.6 s · position + fade · uses Direction' },
  { id: 'scalePop', name: 'Scale Pop', cat: 'In', g: 'gpop', d: '0.6 s · back-out overshoot' }, { id: 'bounceIn', name: 'Bounce In', cat: 'In', g: 'gpop', d: '0.7 s · scale, settles twice' },
  { id: 'spinIn', name: 'Spin In', cat: 'In', g: 'spin', d: '0.8 s · rotation + fade' }, { id: 'wipe', name: 'Wipe On', cat: 'In', g: 'wipe', d: '0.5 s · scale X' },
  { id: 'draw', name: 'Draw On', cat: 'In', g: 'draw', d: '1 s · trims a stroke from 0 to 100' },
  { id: 'drop', name: 'Drop & Settle', cat: 'Emphasis', g: 'drop', d: '0.8 s · two bounces' }, { id: 'shake', name: 'Shake', cat: 'Emphasis', g: 'shake', d: '0.5 s · jolt · uses Direction' },
  { id: 'wobble', name: 'Wobble', cat: 'Emphasis', g: 'shake', d: '0.7 s · rotation sway' },
  { id: 'pulse', name: 'Pulse', cat: 'Loop', g: 'pulse', d: '1 s · scale 100 to 112' }, { id: 'float', name: 'Float', cat: 'Loop', g: 'float', d: 'Behaviour · gentle sine bob' },
  { id: 'wiggle', name: 'Wiggle', cat: 'Loop', g: 'shake', d: 'Behaviour · random drift' }, { id: 'spinLoop', name: 'Spin Forever', cat: 'Loop', g: 'spin', d: 'Behaviour · 90° per second' },
  { id: 'fadeOut', name: 'Fade Out', cat: 'Out', g: 'out', d: '0.5 s · opacity' }, { id: 'slideOut', name: 'Slide Out', cat: 'Out', g: 'out', d: '0.6 s · position + fade · uses Direction' }, { id: 'scaleOut', name: 'Scale Out', cat: 'Out', g: 'gpop', d: '0.5 s · shrink + fade' },
  { id: 'rippleRings', name: 'Ripple Rings', cat: 'Procedural', g: 'ripple', d: 'Duplicator · 5 staggered echoes' }, { id: 'fanOut', name: 'Fan Out', cat: 'Procedural', g: 'ripple', d: 'Duplicator · 8 around a circle' },
  { id: 'gridPop', name: 'Grid Pop', cat: 'Procedural', g: 'gpop', d: 'Duplicator · 5×3 grid, staggered' }, { id: 'wave', name: 'Wave', cat: 'Procedural', g: 'float', d: 'Duplicator + oscillate, phase per copy' },
];
export const myPresets = () => store.get('myPresets', []);
function presetOpts() {
  const seg = (k, items, lbl) => `<div class="seg" role="group" aria-label="${lbl}">${items.map(([v, n]) => `<button data-act="popt" data-k="${k}" data-v="${v}" aria-pressed="${S[k] === v}" aria-label="${{ up: 'From below, moving up', down: 'From above, moving down', left: 'From the right, moving left', right: 'From the left, moving right' }[v] || n}">${n}</button>`).join('')}</div>`;
  const P = { pDur: S.pDur, pAmt: S.pAmt, pStag: S.pStag };
  return grid2([pf(P, 'po', 0, 'pDur', 'Duration', 25, 400, 1, '%', true), pf(P, 'po', 0, 'pAmt', 'Intensity', 10, 300, 1, '%', true)])
    + `<div class="sublbl">Direction of travel</div>` + seg('pDir', [['up', '↑'], ['down', '↓'], ['left', '←'], ['right', '→']], 'Direction')
    + `<div class="sublbl">Start</div>` + seg('pAt', [['head', 'Playhead'], ['in', 'Layer in'], ['out', 'Layer out']], 'Start')
    + grid2([pf(P, 'po', 0, 'pStag', 'Stagger', 0, 30, .1, ' f', true)])
    + `<p class="hint" style="padding:0">Stagger offsets each selected layer. Duration stretches timing, Intensity scales how far things move.</p>
      <button class="line-btn ghost" data-act="popreset" ${S.pDur !== 100 || S.pAmt !== 100 || S.pStag || S.pAt !== 'head' || S.pDir !== 'up' ? '' : 'disabled'}>${ic('reset', 's')}Reset options</button>`;
}
export function presetsView() {
  const l = S.sel && lay(S.sel);
  const head = `<span class="chip-dot" style="background:rgb(var(--acc))"></span><div><h2>Presets</h2><div class="sub">Motion presets</div></div>`;
  const cats = ['All', 'In', 'Out', 'Emphasis', 'Loop', 'Procedural', 'Mine'], q = S.q.toLowerCase();
  const list = PRESETS.filter((p) => (S.cat === 'All' || p.cat === S.cat) && p.name.toLowerCase().includes(q));
  const mine = S.cat === 'All' || S.cat === 'Mine' ? myPresets().filter((p) => p.name.toLowerCase().includes(q)) : [];
  const body = `<label class="search">${ic('search', 's')}<input id="pq" placeholder="Search presets" aria-label="Search presets" value="${esc(S.q)}"></label>
      <div class="chips" role="group" aria-label="Preset category">${cats.map((c) => `<button class="chip ${S.cat === c ? 'on' : ''}" data-act="cat" data-v="${c}" aria-pressed="${S.cat === c}">${c}</button>`).join('')}</div>
      ${sec('popt', 'Apply options', presetOpts(), S.pDur !== 100 || S.pAmt !== 100 || S.pStag || S.pAt !== 'head' ? '<span class="count">custom</span>' : '')}
      <p class="hint">${l ? `Applies to <b style="color:var(--text)">${selIds().length > 1 ? selIds().length + ' layers' : esc(l.name)}</b> ${S.pAt === 'head' ? 'at ' + tc(S.f) : S.pAt === 'in' ? 'at the layer start' : 'ending at the layer end'}.` : 'Select a layer to apply a preset.'}</p>
      ${list.map((p) => `<button class="prow" data-act="preset" data-v="${p.id}" ${l ? '' : 'disabled'}><span class="glyph ${p.g}"><i></i></span><span>${p.name}<small>${p.d}</small></span></button>`).join('')}
      ${mine.map((p) => `<div class="prow2"><button class="prow" data-act="mypreset" data-v="${p.id}" ${l ? '' : 'disabled'}><span class="glyph gpop"><i></i></span><span>${esc(p.name)}<small>Saved by you</small></span></button><button class="ib" data-act="mypdel" data-v="${p.id}" aria-label="Delete ${esc(p.name)}">${ic('trash', 's')}</button></div>`).join('')}
      ${list.length + mine.length ? '' : '<p class="hint">No presets match.</p>'}
      <div style="padding:10px 12px 0;display:flex;gap:6px"><button class="line-btn" style="flex:1" ${l ? '' : 'disabled'} data-act="psave">${ic('plus', 's')}Save selection as preset</button></div>`;
  return { head, body };
}
