import { ic } from '../icons';
import { grid2, pf, propRow, selH } from './controls';
import { hasStroke } from '../../render/shapes';

export function gradUi(l) {
  const cv = l.hue2 || '#ff5ea8';
  return `<div class="rowt"><span class="hint" style="padding:0">Gradient fill</span><button class="tog" data-act="gradon" aria-pressed="${!!l.grad}" aria-label="Gradient fill"></button></div>`
    + (l.grad ? `<div class="seg" role="group" aria-label="Gradient type">${[['linear', 'Linear'], ['radial', 'Radial']].map(([v, n]) => `<button data-act="gtype" data-v="${v}" aria-pressed="${(l.gtype || 'linear') === v}">${n}</button>`).join('')}</div>`
      + `<button class="cchip" data-act="colour" data-key="hue2" aria-haspopup="dialog" aria-label="Gradient end colour ${cv}"><span class="cc" style="background:${cv}"></span><span>To</span><span class="tc hex">${String(cv).toUpperCase()}</span></button>`.replace(/^/, '<div class="rowt">') + `<button class="ib" data-act="gswap" aria-label="Swap gradient colours" title="Swap colours">${ic('arrowH', 's')}</button></div>`
      + grid2([l.gtype === 'radial' ? pf(l, 'lp', 0, 'grad_r', 'Radius', 10, 150, .5, '%') : pf(l, 'lp', 0, 'gang', 'Angle', 0, 360, 1, '°')]) : '');
}

// Shared by the content sections. Each colour chip pairs with its own opacity field.
export const chip = (l, lbl, key) => { const cv = l[key] ?? '#ffffff'; return `<button class="cchip" data-act="colour" data-key="${key}" aria-haspopup="dialog" aria-label="${lbl} colour ${cv}"><span class="cc" style="background:${cv}"></span><span>${lbl}</span><span class="tc hex">${String(cv).toUpperCase()}</span></button>`; };
export const grpHead = (lbl, act, on) => `<div class="kv sh"><span class="sublbl">${lbl}</span><button class="tog" data-act="${act}" aria-pressed="${on}" aria-label="${lbl} on"></button></div>`;
export const capJoin = (l) => [selH('cap', 0, [['round', 'Round cap'], ['butt', 'Flat cap'], ['square', 'Square cap']], l.cap || 'round', 'Line cap'), selH('join', 0, [['round', 'Round join'], ['miter', 'Sharp join'], ['bevel', 'Bevel join']], l.join || 'round', 'Corner join')];
export const dashF = (l) => [pf(l, 'lp', 0, 'dash', 'Dash', 0, 120, .4, '')].concat(l.dash > 0 ? [pf(l, 'lp', 0, 'dgap', 'Gap', 1, 200, .4), pf(l, 'lp', 0, 'doff', 'Offset', -500, 500, 1)] : []);
export const trimRow = (l) => (hasStroke(l) ? propRow(l, 'trim') : '');
