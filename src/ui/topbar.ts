import { $, esc } from '../core/dom';
import { projName } from '../model/project';
import { ic } from './icons';
import { S } from '../state/state';
import { hi, hist, lastLabel } from '../state/history';

/* ---------- render: top bar ---------- */
export function renderTop() {
  $('#top').innerHTML = `
    <button class="ib back" style="width:auto" aria-label="Back to library">${ic('left', 's')}<span style="font-size:var(--fs-s)">Library</span></button>
    <input class="name" id="pname" value="${esc(projName)}" aria-label="Project name"><span class="meta tc">30 fps · 1920×1080</span>
    <span class="save" role="status"><i></i>Autosaved</span>
    <span class="spacer"></span>
    <button class="ib" data-act="menu" aria-label="More" aria-haspopup="menu" aria-expanded="${S.pop === 'menu'}">${ic('more')}</button>
    <button class="primary" data-act="export" style="margin-left:6px">${ic('share', 's')}Export</button>`;
  fitName();
  syncHist();
}
/* Project name field hugs its text so the fps / resolution meta sits right beside it. */
function fitName() {
  const n = $('#pname'); if (!n) return;
  const cs = getComputedStyle(n), c = (fitName as any).c || ((fitName as any).c = document.createElement('canvas').getContext('2d'));
  c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  n.style.width = Math.ceil(c.measureText(n.value || ' ').width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 3) + 'px';
}
/* undo / redo live at the top of the left strip's lower group; keep their state current whenever history changes */
function syncHist() {
  const u = $('#lstrip [data-act="undo"]'), r = $('#lstrip [data-act="redo"]');
  if (u) { u.disabled = hi <= 0; u.title = 'Undo' + (lastLabel ? ' ' + lastLabel : ''); }
  if (r) r.disabled = hi >= hist.length - 1;
}
/** Registers this module's event listeners. main.ts calls it once, in the original order. */
export function listen() {
  document.addEventListener('input', (e) => { if (e.target && (e.target as any).id === 'pname') fitName(); if (e.target && (e.target as any).id === 'shcode') S.shDraft = (e.target as any).value; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitName);
}
