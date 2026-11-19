// @ts-nocheck
import { DUR } from '../../model/project';
import { ic } from '../icons';
import { S } from '../../state/state';
import { celIdx } from '../../drawing/cels';

/* ---- inspector ---- */
export function drawHtml(l) {
  const cels = l.cels || [], k = celIdx(l, S.f), c = cels[k];
  const len = c ? ((cels[k + 1] ? cels[k + 1].f : (l.outP ?? DUR)) - c.f) : 0;
  return `<div class="kv"><span>Cels</span><b class="tc">${cels.length}</b></div>
    <div class="kv"><span>At playhead</span><b class="tc">${c ? `Cel ${k + 1} · holds ${len} f` : 'No cel yet'}</b></div>
    <div class="three"><button class="line-btn" data-act="celadd">${ic('celadd', 'xs')}Blank</button><button class="line-btn" data-act="celdup" ${c ? '' : 'disabled'}>${ic('copy', 'xs')}Duplicate</button><button class="line-btn" data-act="celclear" ${c && c.strokes.length ? '' : 'disabled'}>${ic('trash', 'xs')}Clear</button></div>
    <button class="line-btn" data-act="onionpop" aria-haspopup="dialog">${ic('onion', 's')}Onion skin · ${S.onion.on ? `${S.onion.nb} before, ${S.onion.na} after` : 'off'}</button>
    <p class="hint" style="padding:0">Draw with the brush (B). Each cel holds until the next one. Step frames with the arrows under the canvas, then add a cel.</p>`;
}
