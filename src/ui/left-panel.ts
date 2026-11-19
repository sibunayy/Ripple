// @ts-nocheck
import { $, esc } from '../core/dom';
import { layers } from '../model/project';
import { ic } from './icons';
import { lay } from '../anim/interpolate';
import { S, selIds } from '../state/state';
import { mTag } from './inspector/extras';

/* ---------- render: left panel ---------- */
const TYPE_ICON = { draw: 'brush', text: 'text', ellipse: 'ellipse', ring: 'ellipse', line: 'line', rect: 'rect', star: 'star', polygon: 'polygon', solid: 'solid', null: 'null', adjust: 'adjust', shader: 'shader', comp: 'comp', image: 'media', audio: 'audio' };
export const TYPE_NAME = { draw: 'Drawing', text: 'Text', ellipse: 'Ellipse', ring: 'Ring', line: 'Line', rect: 'Rectangle', star: 'Star', polygon: 'Polygon', path: 'Path', audio: 'Audio', solid: 'Solid', null: 'Null', adjust: 'Adjustment', shader: 'Shader', comp: 'Composition', image: 'Image' };
export function renderLeft() {
  if (S.left === 'presets') S.left = null;
  const el = $('#lpanel');
  if (!S.left) { el.innerHTML = ''; return; }
  let head = '', body = '';
  let foot = '';
  if (S.left === 'layers') {
    const q = S.lq.trim().toLowerCase(), shown = layers.filter((l) => !q || l.name.toLowerCase().includes(q) || (TYPE_NAME[l.type] || '').toLowerCase().includes(q));
    const n = selIds().length, allOn = layers.every((l) => l.vis), anyLock = layers.some((l) => l.lock);
    head = `<h2>Layers</h2><span class="sub">${layers.length}</span><span class="spacer"></span>
      <button class="ib" data-act="allvis" aria-label="${allOn ? 'Hide' : 'Show'} all layers" title="${allOn ? 'Hide' : 'Show'} all">${ic(allOn ? 'eye' : 'eyeoff', 's')}</button>
      <button class="ib" data-act="unlockall" aria-label="Unlock all layers" title="Unlock all" ${anyLock ? '' : 'disabled'}>${ic('unlock', 's')}</button>
      <button class="ib" data-act="insert" aria-label="Insert layer">${ic('plus', 's')}</button>`;
    body = `<label class="search" style="margin-top:2px">${ic('search', 's')}<input id="lq" placeholder="Filter layers" aria-label="Filter layers" value="${esc(S.lq)}">${S.lq ? `<button class="ib" data-act="lqclear" aria-label="Clear filter" style="width:28px;height:28px">${ic('x', 'xs')}</button>` : ''}</label>`
      + shown.map((l) => `<div class="lrow ${selIds().includes(l.id) ? 'sel' : ''} ${l.vis ? '' : 'hid'} ${S.solo.has(l.id) ? 'soloed' : ''}" data-act="sel" data-v="${l.id}" data-ctx="${l.id}" role="button" tabindex="0" aria-label="Select ${esc(l.name)}. Alt plus arrow keys to reorder"><span class="grip" data-grip title="Drag to reorder" aria-hidden="true">${ic('grip', 's')}</span>
        <span class="chip-dot" style="background:${l.hue}"></span><span class="ty">${ic(l.comp ? 'comp' : (TYPE_ICON[l.type] || 'rect'), 's')}</span><span class="nm">${esc(l.name)}${mTag(l)}${l.parent && lay(l.parent) ? `<span class="pn" title="Parent">${ic('right', 'xs')}${esc(lay(l.parent).name)}</span>` : ''}</span>
        <button class="ib ${S.solo.has(l.id) ? 'solo-on' : ''}" data-act="solo" data-v="${l.id}" aria-pressed="${S.solo.has(l.id)}" aria-label="Solo ${esc(l.name)}" title="Solo: show only soloed layers" >${ic('solo', 's')}</button>
        <button class="ib" data-act="vis" data-v="${l.id}" aria-label="${l.vis ? 'Hide' : 'Show'} layer">${ic(l.vis ? 'eye' : 'eyeoff', 's')}</button>
        <button class="ib" data-act="lock" data-v="${l.id}" aria-label="${l.lock ? 'Unlock' : 'Lock'} layer" style="${l.lock ? 'color:var(--acc-text)' : ''}">${ic(l.lock ? 'lock' : 'unlock', 's')}</button></div>`).join('')
      + (shown.length ? '' : `<p class="hint">No layers match “${esc(S.lq)}”.</p>`)
      + `<p class="hint">Hold a row, then drag to reorder (or use the grip). Hold and release in place for more.</p>`;
    foot = `<div class="lbar" role="toolbar" aria-label="Layer actions">
      <button class="ib" data-act="selall" aria-label="Select all layers" title="Select all">${ic('selall', 's')}</button>
      <span class="cnt">${n ? `${n} selected` : ''}</span><span class="spacer"></span>
      <button class="ib" data-act="lmove" data-v="-1" aria-label="Move up" title="Move up" ${n === 1 && layers.indexOf(lay(S.sel)) > 0 ? '' : 'disabled'}>${ic('up', 's')}</button>
      <button class="ib" data-act="lmove" data-v="1" aria-label="Move down" title="Move down" ${n === 1 && layers.indexOf(lay(S.sel)) < layers.length - 1 ? '' : 'disabled'}>${ic('down', 's')}</button>
      <button class="ib" data-act="dup" aria-label="Duplicate" title="Duplicate" ${n ? '' : 'disabled'}>${ic('copy', 's')}</button>
      <button class="ib" data-act="group" aria-label="Group / pre-compose" title="Group" ${n ? '' : 'disabled'}>${ic('group', 's')}</button>
      <button class="ib" data-act="del" aria-label="Delete" title="Delete" ${n ? '' : 'disabled'} style="${n ? 'color:var(--danger)' : ''}">${ic('trash', 's')}</button></div>`;
  } else {
    head = `<h2>Assets</h2><span class="spacer"></span><label class="ib" aria-label="Import media" style="position:relative">${ic('plus', 's')}<input type="file" accept="image/*,video/*,audio/*" data-media style="position:absolute;inset:0;opacity:0"></label>`;
    const ASSETS = [['logo-mark.svg', 'Images', 'Vector · 24 KB', 'media', '#4aa8ff'], ['film-grain.png', 'Images', 'Image · 1920×1080', 'media', '#6b625a'], ['paper-texture.jpg', 'Images', 'Image · 2400×1600', 'media', '#c9b79c'], ['whoosh-clip.mp4', 'Video', 'Video · 00:04:12', 'media', '#ef6f7f'], ['light-leak.mov', 'Video', 'Video · 00:02:00', 'media', '#e0b04a'], ['riser-hit.wav', 'Audio', 'Audio · 00:03:08', 'audio', '#4fd1c5'], ['ui-click.wav', 'Audio', 'Audio · 00:00:12', 'audio', '#b9d65a']];
    const cats = ['All', 'Images', 'Video', 'Audio'], q = S.aq.trim().toLowerCase();
    const list = ASSETS.filter(([n, c]) => (S.acat === 'All' || S.acat === c) && (!q || n.toLowerCase().includes(q)));
    body = `<label class="search" style="margin-top:2px">${ic('search', 's')}<input id="aq" placeholder="Search assets" aria-label="Search assets" value="${esc(S.aq)}"></label>
      <div class="chips" role="group" aria-label="Asset type">${cats.map((c) => `<button class="chip ${S.acat === c ? 'on' : ''}" data-act="acat" data-v="${c}" aria-pressed="${S.acat === c}">${c}</button>`).join('')}</div>
      <div class="agrid">${list.map(([n, , d, i, c]) => `<button class="acard" data-act="toast" data-v="Added ${n} to the composition (prototype)." aria-label="Add ${n} to composition"><span class="th" style="background:linear-gradient(135deg, ${c}55, ${c}18)">${ic(i)}</span><span><span class="nm2" style="display:block">${n}</span><small>${d}</small></span></button>`).join('')}</div>
      ${list.length ? '' : '<p class="hint">No assets match.</p>'}<p class="hint">Tap an asset to add it. Drop files onto the canvas or use ＋ to import images, video and audio.</p>`;
  }
  el.innerHTML = `<div class="inner"><div class="phead">${head}</div><div class="pbody">${body}</div>${foot}</div>`;
}
