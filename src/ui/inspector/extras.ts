import { esc } from '../../core/dom';
import { DUR, layers } from '../../model/project';
import { ic } from '../icons';
import { STROKABLE } from '../../render/shapes';
import { grid2, isDesc, pf, selH, tc } from './controls';

export function normShape(l) {
  const D = { rect: { w: 280, h: 180, cr: 24 }, star: { n: 5, ir: 43 }, polygon: { n: 5 }, line: { w: 420 } }[l.type];
  if (D) for (const k in D) if (l[k] === undefined) l[k] = D[k];
  if (STROKABLE.includes(l.type) && l.sw === undefined) l.sw = 0;
  if (l.fop === undefined) l.fop = 100; if (l.sop === undefined) l.sop = 100; if (l.grad_r === undefined) l.grad_r = 70; if (l.wsp === undefined) l.wsp = 0;
  if (l.dash > 0 && l.dgap === undefined) l.dgap = Math.max(1, Math.round(l.dash * 1.2)); if (l.doff === undefined) l.doff = 0;
  if ((l.type === 'ring' || l.type === 'line') && l.sw === undefined) l.sw = l.type === 'ring' ? 14 : 12;
}
export function repHtml(l) {
  const R = l.rep;
  if (!R) return `<p class="hint" style="padding:0">Make many copies of this layer: in a line, a circle or a grid. Each copy can fade, scale and start later (stagger) for ripple and burst effects.</p><button class="line-btn" data-act="repon">${ic('copy', 's')}Add duplicator</button>`;
  let h = `<div class="kv"><span>Duplicator</span><button class="tog" data-act="repon" aria-pressed="${R.on}" aria-label="Duplicator"></button></div>`;
  if (!R.on) return h;
  const it = [pf(R, 'rep', 0, 'count', 'Count', 1, 60, .12, '', true)];
  if (R.mode === 'linear') it.push(pf(R, 'rep', 0, 'dx', 'Offset X', -600, 600, 1), pf(R, 'rep', 0, 'dy', 'Offset Y', -600, 600, 1), pf(R, 'rep', 0, 'rot', 'Rotate step', -180, 180, .3, '°'), pf(R, 'rep', 0, 'sc', 'Scale step', -50, 150, .4, '%'));
  else if (R.mode === 'radial') it.push(pf(R, 'rep', 0, 'rad', 'Radius', 0, 900, 1.5), pf(R, 'rep', 0, 'rot', 'Rotate step', -180, 180, .3, '°'), pf(R, 'rep', 0, 'sc', 'Scale step', -50, 150, .4, '%'));
  else it.push(pf(R, 'rep', 0, 'cols', 'Columns', 1, 20, .1, '', true), pf(R, 'rep', 0, 'dx', 'Spacing X', 0, 500, 1), pf(R, 'rep', 0, 'dy', 'Spacing Y', 0, 500, 1), pf(R, 'rep', 0, 'sc', 'Scale step', -50, 150, .4, '%'));
  it.push(pf(R, 'rep', 0, 'fade', 'Fade', 0, 90, .4, '%'), pf(R, 'rep', 0, 'stag', 'Stagger', 0, 30, .06, ' f'));
  h += selH('repmode', 0, [['linear', 'Line'], ['radial', 'Circle'], ['grid', 'Grid']], R.mode, 'Duplicator layout') + grid2(it);
  if (R.mode === 'radial') h += `<div class="kv"><span>Rotate to follow circle</span><button class="tog" data-act="repalign" aria-pressed="${!!R.align}" aria-label="Align to circle"></button></div>`;
  return h + `<p class="hint" style="padding:0">Stagger delays each copy's animation by this many frames.</p>`;
}
const MOD_NAME = { wiggle: 'Wiggle', osc: 'Oscillate', spin: 'Spin', bounce: 'Bounce', pulse: 'Pulse', orbit: 'Orbit', jitter: 'Jitter', drift: 'Drift' };
const MOD_NOTGT = ['spin', 'orbit'], MOD_NOFREQ = ['spin', 'drift'];
const MOD_TGT = [['x', 'Position X'], ['y', 'Position Y'], ['rot', 'Rotation'], ['scale', 'Scale'], ['op', 'Opacity']];
export function behHtml(l) {
  const mods = l.mods || [], rep = l.rep && l.rep.on;
  const list = mods.map((m, i) => {
    const it = [pf(m, 'mod', i, 'amp', m.kind === 'spin' ? 'Deg / sec' : m.kind === 'drift' ? 'Per second' : m.kind === 'orbit' ? 'Radius' : m.kind === 'bounce' ? 'Overshoot' : 'Amount', m.kind === 'spin' ? -720 : -400, m.kind === 'spin' ? 720 : 400, m.kind === 'spin' ? 1 : .5)];
    if (!MOD_NOFREQ.includes(m.kind)) it.push(pf(m, 'mod', i, 'freq', m.kind === 'pulse' ? 'Beats / sec' : 'Speed', 0, 10, .02, ' Hz'));
    if (m.kind === 'bounce' || m.kind === 'pulse') it.push(pf(m, 'mod', i, 'dec', m.kind === 'bounce' ? 'Settle' : 'Sharpness', 0, 20, .05));
    if (m.kind === 'orbit') it.push(pf(m, 'mod', i, 'ell', 'Ellipse', 0, 200, .5, '%'));
    if (m.kind === 'wiggle' || m.kind === 'jitter') it.push(pf(m, 'mod', i, 'seed', 'Seed', 1, 99, .1, '', true));
    if (rep && m.kind !== 'spin') it.push(pf(m, 'mod', i, 'ph', 'Offset / copy', -1, 1, .01));
    return `<div class="mod"><div class="fx-h"><button class="tog" data-act="modon" data-v="${i}" aria-pressed="${m.on}" aria-label="${m.on ? 'Disable' : 'Enable'} ${MOD_NAME[m.kind]}"></button>${MOD_NAME[m.kind]}<span class="spacer"></span><button class="ib" data-act="moddel" data-v="${i}" aria-label="Remove ${MOD_NAME[m.kind]}">${ic('trash', 's')}</button></div>${MOD_NOTGT.includes(m.kind) ? '' : selH('modtgt', i, MOD_TGT, m.tgt, 'Affects')}${grid2(it)}</div>`;
  }).join('');
  return (list || `<p class="hint" style="padding:0">Behaviours move a layer procedurally, with no keyframes: wiggle, jitter, oscillate, bounce in, pulse to a beat, orbit, drift or spin.</p>`)
    + `<div class="three">${['wiggle', 'jitter', 'osc', 'bounce', 'pulse', 'orbit', 'drift', 'spin'].map((k) => `<button class="line-btn" data-act="modadd" data-v="${k}">${ic('plus', 'xs')}${MOD_NAME[k]}</button>`).join('')}</div>`;
}
export const mTag = (l) => { const i = layers.indexOf(l), b = layers[i + 1]; return l.matte && i > 0 ? '<small class="mtag">matted</small>' : b && b.matte ? '<small class="mtag">matte</small>' : ''; };
export function advHtml(l) {
  if (l.inP == null) l.inP = 0; if (l.outP == null) l.outP = DUR;
  const timing = `<div class="sublbl" style="padding-top:0">Timing</div>` + grid2([pf(l, 'lp', 0, 'inP', 'In', 0, DUR - 1, .15, ' f', true), pf(l, 'lp', 0, 'outP', 'Out', 1, DUR, .15, ' f', true)])
    + `<div class="two-btn"><button class="line-btn" data-act="trimin" title="Start the layer at the playhead" aria-label="Set layer in point to the playhead">${ic('trimS', 's')}Set in</button><button class="line-btn" data-act="trimout" title="End the layer at the playhead" aria-label="Set layer out point to the playhead">${ic('trimE', 's')}Set out</button></div>
      <div class="kv"><span>Length</span><b class="tc">${tc(Math.max(0, l.outP - l.inP))}</b></div><div class="sublbl">Parent & matte</div>`;
  const opts = [['', 'None'], ...layers.filter((c) => c.id !== l.id && !isDesc(c, l)).map((c) => [c.id, c.name])];
  return timing + `<div class="kv"><span>Parent</span>${selH('parent', 0, opts, l.parent || '', 'Parent layer')}</div>
    <div class="kv"><span>Track matte</span>${selH('matte', 0, [['', 'None'], ['alpha', 'Alpha matte'], ['alphainv', 'Alpha inverted'], ['luma', 'Luma matte'], ['lumainv', 'Luma inverted']], layers.indexOf(l) > 0 ? (l.matte || '') : '', 'Track matte')}</div>
    <p class="hint" style="padding:0">${layers.indexOf(l) > 0 ? `Uses <b>${esc(layers[layers.indexOf(l) - 1].name)}</b>, the layer above, as the matte. That layer is hidden while it is used.` : 'Move a layer above this one to use it as a matte.'}</p>
    <p class="hint" style="padding:0">A child follows its parent's position, rotation and scale from the moment it is parented.</p>`;
}
