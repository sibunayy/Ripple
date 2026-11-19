// @ts-nocheck
import { $ } from '../core/dom';
import { ic } from './icons';
import { DRAWMODES, S, SELMODES, isDrawTool, isSelTool } from '../state/state';
import { hi, hist } from '../state/history';

/* ---------- render: strips ---------- */
const TOOLS = [['select', 'Select', 'V'], ['hand', 'Hand', 'H'], ['pen', 'Pen', 'P']];
export const SHAPES = [['rect', 'Rectangle', 'R'], ['ellipse', 'Ellipse', 'E'], ['polygon', 'Polygon', 'Y'], ['star', 'Star', 'S'], ['line', 'Line', 'L']];
export function renderStrips() {
  const t = S.tool;
  $('#lstrip').innerHTML = `
    <button class="sb ${isSelTool(t) ? 'on' : ''}" id="selbtn" data-act="tool" data-v="${S.selMode}" aria-label="${SELMODES.find((m) => m[0] === S.selMode)[1]} (hold for marquee and lasso)" aria-pressed="${isSelTool(t)}" title="Selection · hold for Marquee and Lasso">${ic(S.selMode)}<span class="more"></span></button>
    ${TOOLS.slice(1).map(([id, n, k]) => `<button class="sb ${t === id ? 'on' : ''}" data-act="tool" data-v="${id}" aria-label="${n}" aria-pressed="${t === id}" title="${n} · ${k}">${ic(id)}</button>`).join('')}
    <button class="sb ${SHAPES.some((s) => s[0] === t) ? 'on' : ''}" id="shapebtn" data-act="tool" data-v="${S.shape}" aria-label="${SHAPES.find((s) => s[0] === S.shape)[1]} (hold for more shapes)" aria-pressed="${t === S.shape}" title="Shapes · hold for more">${ic(S.shape)}<span class="more"></span></button>
    <button class="sb ${t === 'text' ? 'on' : ''}" data-act="tool" data-v="text" aria-label="Text" aria-pressed="${t === 'text'}" title="Text · T">${ic('text')}</button>
    <button class="sb ${isDrawTool(t) ? 'on' : ''}" id="brushbtn" data-act="tool" data-v="${S.drawMode}" aria-label="${DRAWMODES.find((m) => m[0] === S.drawMode)[1]} (hold for brush, eraser and fill)" aria-pressed="${isDrawTool(t)}" title="Draw · hold for Brush, Eraser, Fill">${ic(S.drawMode)}<span class="more"></span></button>
    <span class="grow"></span>
    <button class="sb" data-act="undo" aria-label="Undo" title="Undo" ${hi <= 0 ? 'disabled' : ''}>${ic('undo')}</button>
    <button class="sb" data-act="redo" aria-label="Redo" title="Redo" ${hi >= hist.length - 1 ? 'disabled' : ''}>${ic('redo')}</button>
    <span class="sep"></span>
    ${[['assets', 'Assets'], ['layers', 'Layers']].map(([id, n]) => `<button class="sb ${S.left === id ? 'on' : ''}" data-act="left" data-v="${id}" aria-label="${n}" aria-pressed="${S.left === id}" title="${n}">${ic(id)}</button>`).join('')}
    <span class="sep"></span>
    <button class="sb insert" data-act="insert" aria-label="Insert" aria-haspopup="dialog" aria-expanded="${S.pop === 'insert'}" title="Insert layer, shape or media">${ic('plus')}</button>`;
  const hasKeys = S.keys.length > 0;
  $('#rstrip').innerHTML = `
    ${[['props', 'Properties'], ['effects', 'Effects'], ['easing', 'Easing'], ['presets', 'Presets']].map(([id, n]) => `<button class="sb ${S.right === id ? 'on' : ''}" data-act="right" data-v="${id}" aria-label="${n}" aria-pressed="${S.right === id}" title="${n}">${ic(id)}${id === 'easing' && hasKeys ? '<span class="dot"></span>' : ''}</button>`).join('')}
    <span class="grow"></span>
    <button class="sb" data-act="help" aria-label="Help and shortcuts" title="Help">${ic('help')}</button>`;
}
