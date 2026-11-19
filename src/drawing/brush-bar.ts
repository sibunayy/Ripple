// @ts-nocheck
import { $, app } from '../core/dom';
import { ic } from '../ui/icons';
import { BPRE, DRAWMODES, S, isDrawTool } from '../state/state';
import { renderStrips } from '../ui/strips';
import { pf } from '../ui/inspector/controls';
import { renderRight } from '../ui/inspector/index';
import { applyLayout } from '../ui/layout';
import { brushCur } from './cels';

/* ---- brush bar ---- */
let lastBarTool = null;
export function renderBrushBar() {
  const B = S.brush, t = S.tool, el = $('#bbar'); if (!el) return;
  if (!isDrawTool(t)) { lastBarTool = t; el.innerHTML = ''; el.classList.remove('show'); return; }
  // picking a drawing tool in portrait folds the inspector sheet so the canvas is clear (it can be reopened while drawing)
  if (lastBarTool !== t && !isDrawTool(lastBarTool) && app.classList.contains('portrait') && S.right) { S.right = null; applyLayout(); renderRight(); renderStrips(); }
  lastBarTool = t;
  const cur = brushCur();
  el.innerHTML = (t === 'brush' ? `<div class="seg" role="group" aria-label="Brush">${BPRE.map(([id, n]) => `<button data-act="bpre" data-v="${id}" aria-pressed="${B.pre === id}" title="${n}">${ic(id === 'marker' ? 'hilite' : id, 'xs')}${n}</button>`).join('')}</div>` : `<div class="seg" role="group" aria-label="Tool">${DRAWMODES.map(([id, n]) => `<button data-act="pickdraw" data-v="${id}" aria-pressed="${t === id}">${ic(id, 'xs')}${n}</button>`).join('')}</div>`)
    + (t !== 'fill' ? pf(cur, 'br', 0, 'sz', 'Size', 1, 240, .3) + pf(cur, 'br', 0, 'op', 'Opacity', 5, 100, .4, '%') : '')
    + (t !== 'erase' ? `<button class="bcol" data-act="bcolour" style="background:${B.c}" aria-label="Brush colour ${B.c}" aria-haspopup="dialog" title="Colour"></button>` : '')
    + (t !== 'fill' ? `<span class="vsep"></span><button class="ib ${B.pr ? 'on' : ''}" data-act="btog" data-k="pr" aria-pressed="${B.pr}" aria-label="Pressure" title="Pencil pressure">${ic('press', 's')}</button><button class="ib ${B.tl ? 'on' : ''}" data-act="btog" data-k="tl" aria-pressed="${B.tl}" aria-label="Tilt" title="Pencil tilt">${ic('tilt', 's')}</button>` : '');
  el.classList.toggle('show', !S.playing);
}
