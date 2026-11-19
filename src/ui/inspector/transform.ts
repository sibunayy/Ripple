import { propRow } from './controls';
import { ic } from '../icons';

/** Transform section: position, scale, rotation, anchor; align to composition; flip and reset. */
export function transformSection(l, multi) {
  // Transform: geometry only. Opacity moves to Layer; trim paths move to Stroke.
  const tf = ['pos', 'scale', 'rot', 'anchor'].map((g) => propRow(l, g)).join('')
    + `<div class="sublbl">Align to ${multi ? 'selection' : 'composition'}</div><div class="al6" role="group" aria-label="Align">${[['left', 'Left', 'alL'], ['hcenter', 'Centre', 'alC'], ['right', 'Right', 'alR'], ['top', 'Top', 'alT'], ['vcenter', 'Middle', 'alM'], ['bottom', 'Bottom', 'alB']].map(([v, nm, icn]) => `<button data-act="alignto" data-v="${v}" aria-label="Align ${nm.toLowerCase()}" title="Align ${nm.toLowerCase()}">${ic(icn, 's')}</button>`).join('')}</div>`
    + `<div class="three"><button class="line-btn" data-act="flipx" aria-pressed="${!!l.flipX}" style="${l.flipX ? 'color:var(--acc-text);box-shadow:var(--lit);background:var(--lit-bg)' : ''}" title="Flip horizontal">${ic('flipH', 's')}Flip H</button><button class="line-btn" data-act="flipy" aria-pressed="${!!l.flipY}" style="${l.flipY ? 'color:var(--acc-text);box-shadow:var(--lit);background:var(--lit-bg)' : ''}" title="Flip vertical">${ic('flipV', 's')}Flip V</button><button class="line-btn" data-act="tfreset" title="Reset position, scale, rotation and opacity">${ic('reset', 's')}Reset</button></div>`;
  return tf;
}
