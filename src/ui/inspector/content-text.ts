import { FONTS, WNAME, fontWeights, snapW } from '../../render/text';
import { esc } from '../../core/dom';
import { grid2, pf, selH } from './controls';
import { ic } from '../icons';
import { chip, gradUi } from './paint';

/** Text layers: content, font, size & spacing, paragraph; Fill & outline. */
export function textContent(l) {
  let look, title, paint, paintTitle;
  if (l.lead === undefined) l.lead = 120;
  const WT = fontWeights(l).map((w) => [w, WNAME[w]]);
  const tb = (k, v, inner, lbl, on) => `<button data-act="tset" data-k="${k}" data-v="${v}" aria-label="${lbl}" title="${lbl}" aria-pressed="${on}" style="display:inline-flex;align-items:center;justify-content:center">${inner}</button>`;
  const al = l.align || 'center', tcs = l.tcase || 'none';
  title = 'Text';
  look = `<textarea class="txt" id="ltext" rows="2" aria-label="Text content">${esc(l.text)}</textarea>`
    + `<div class="pair fw">${selH('font', 0, FONTS.map((f) => [f[0], f[1]]), l.font || 'sys', 'Font')}${selH('tweight', 0, WT, snapW(l), 'Weight')}</div>`
    + `<div class="sublbl">Size & spacing</div>`
    + grid2([pf(l, 'lp', 0, 'size', 'Size', 8, 600, .6, '', true), pf(l, 'lp', 0, 'lead', 'Leading', 60, 300, .5, '%'), pf(l, 'lp', 0, 'track', 'Tracking', -30, 100, .2), pf(l, 'lp', 0, 'wsp', 'Word space', -40, 200, .3)])
    + `<div class="sublbl">Paragraph</div>`
    + `<div class="pair"><div class="seg" role="group" aria-label="Alignment">${[['left', 'alignL', 'Align left'], ['center', 'alignC', 'Align centre'], ['right', 'alignR', 'Align right']].map(([v, i, n]) => tb('align', v, ic(i, 's'), n, al === v)).join('')}</div>`
    + `<div class="seg" role="group" aria-label="Style">${tb('italic', '1', ic('italic', 's'), 'Italic', !!l.italic)}${tb('under', '1', ic('underline', 's'), 'Underline', !!l.under)}${tb('strike', '1', ic('strike', 's'), 'Strikethrough', !!l.strike)}</div></div>`
    + `<div class="seg" role="group" aria-label="Capitalisation">${[['none', 'Aa', 'As typed'], ['upper', 'AA', 'All caps'], ['lower', 'aa', 'Lowercase'], ['title', 'Tt', 'Title case']].map(([v, s, n]) => tb('tcase', v, s, n, tcs === v)).join('')}</div>`;
  paintTitle = 'Fill & outline';
  paint = `<div class="sublbl">Fill</div><div class="fillrow">${chip(l, 'Fill', 'hue')}${pf(l, 'lp', 0, 'fop', 'Opacity', 0, 100, .5, '%', true)}</div>` + gradUi(l)
    + `<div class="sublbl">Outline</div>` + (l.tsw > 0 ? `<div class="fillrow">${chip(l, 'Outline', 'tsc')}${pf(l, 'lp', 0, 'tsw', 'Width', 0, 40, .2)}</div>` : grid2([pf(l, 'lp', 0, 'tsw', 'Width', 0, 40, .2)]));
  return { title, look, paint, paintTitle };
}
