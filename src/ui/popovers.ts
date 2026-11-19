// @ts-nocheck
import { $, app, esc } from '../core/dom';
import { HUES, layers } from '../model/project';
import { ic } from './icons';
import { EASES, EASE_NAMES, easeGlyph } from '../anim/easing';
import { lay } from '../anim/interpolate';
import { DRAWMODES, S, SELMODES, selIds } from '../state/state';
import { commit } from '../state/history';
import { FXDEF } from '../fx/defs';
import { renderTop } from './topbar';
import { SHAPES } from './strips';
import { renderLeft } from './left-panel';
import { pf } from './inspector/controls';
import { selectedKeyObjs } from '../anim/clipboard';
import { renderRight } from './inspector/index';
import { renderTL } from './timeline';
import { cp, hexToHsv, setCp } from './color-picker';

export function renderPop() {
  // closing the colour picker commits its live edits as one undo step
  if (cp && !(S.pop && S.pop.type === 'color')) { const d = cp.dirty && cp.key !== 'brush'; setCp(null); if (d) { commit('Colour'); renderLeft(); renderTL(); renderTop(); renderRight(); } }
  const host = $('#layer-pop'); host.innerHTML = '';
  if (!S.pop) return;
  const a = app.getBoundingClientRect();
  let html = '', pos = {};
  if (S.pop === 'insert') {
    const b = $('#lstrip .insert').getBoundingClientRect();
    html = `<div class="pop ins" role="dialog" aria-label="Insert">
      <h3>Draw</h3>
      <div class="draw">${[['text', 'Text'], ['draw', 'Drawing'], ['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['ring', 'Ring'], ['star', 'Star'], ['polygon', 'Polygon'], ['line', 'Line']].map(([t, n]) => `<button class="dt" data-act="add" data-v="${t}">${ic(t === 'ring' ? 'ellipse' : t === 'draw' ? 'brush' : t)}${n}</button>`).join('')}</div>
      <h3>Layers</h3>
      <div class="two">${[['solid', '＋ Solid', 'Add solid layer', 'Full-frame colour'], ['null', '＋ Null', 'Add null layer', 'Invisible parent'], ['adjust', '＋ Adjust', 'Add adjustment layer', 'Effects on layers below'], ['shader', '＋ Shader', 'Add shader layer', 'WebGPU or GLSL'], ['comp', '＋ Comp', 'Add composition', 'Nested timeline']]
        .map(([t, n, al, d]) => `<button class="li" data-act="add" data-v="${t}" aria-label="${al}"><span class="ico">${ic(t, 's')}</span><span>${n}<small>${d}</small></span></button>`).join('')}
        <label class="li" aria-label="Import media"><span class="ico">${ic('media', 's')}</span><span>＋ Media<small>Image, video or audio</small></span><input type="file" accept="image/*,video/*,audio/*" data-media></label></div>
    </div>`;
    pos = { left: b.right - a.left + 8, bottom: Math.max(8, a.bottom - b.bottom) };
  } else if (S.pop === 'menu') {
    const b = $('#top [data-act=menu]').getBoundingClientRect();
    const tp = S.themePref;
    html = `<div class="pop menu" role="menu" aria-label="More">
      <button class="mi" role="menuitem" data-act="settings">${ic('settings', 's')}Project settings…</button>
      <button class="mi" role="menuitem" data-act="help">${ic('help', 's')}Help & shortcuts<kbd>?</kbd></button>
      <div class="mhr"></div><div class="mlbl">Appearance</div>
      <div class="seg" role="group" aria-label="Appearance">${['auto', 'dark', 'light'].map((t) => `<button data-act="theme" data-v="${t}" aria-pressed="${tp === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <button class="mi" role="menuitemcheckbox" aria-checked="${S.glow === 'soft'}" data-act="glow">Reduce glow<span class="tog" aria-pressed="${S.glow === 'soft'}"></span></button>
      <div class="mhr"></div><div class="mlbl">Viewer</div>
      <button class="mi" role="menuitemcheckbox" aria-checked="${S.perf}" data-act="perf">Performance overlay<span class="tog" aria-pressed="${S.perf}"></span></button>
      <button class="mi" role="menuitemcheckbox" aria-checked="${S.autoFold}" data-act="autofold">Auto-fold panels<span class="tog" aria-pressed="${S.autoFold}"></span></button>
      <button class="mi" role="menuitemcheckbox" aria-checked="${S.mb}" data-act="mb">Preview motion blur<span class="tog" aria-pressed="${S.mb}"></span></button>
      <div class="mhr"></div><div class="mlbl">Prototype</div>
      <div class="seg" role="group" aria-label="Accent tint">${[['classic', 'Ocean'], ['warm', 'Aqua']].map(([t, n]) => `<button data-act="tint" data-v="${t}" aria-pressed="${S.tint === t}">${n}</button>`).join('')}</div>
      <button class="mi" role="menuitemcheckbox" aria-checked="${S.portraitPreview}" data-act="pp">Preview iPad portrait<span class="tog" aria-pressed="${S.portraitPreview}"></span></button>
    </div>`;
    pos = { right: a.right - b.right, top: b.bottom - a.top + 6 };
  } else if (S.pop.type === 'ctx') {
    const L = lay(S.pop.id);
    html = `<div class="pop menu" role="menu" aria-label="${esc(L.name)}">
      <button class="mi" role="menuitem" data-act="msel">${ic('marquee', 's')}${(S.ctxPrev || []).includes(S.pop.id) && (S.ctxPrev || []).length > 1 ? 'Remove from selection' : 'Add to selection'}</button>
      <button class="mi" role="menuitem" data-act="dup">${ic('copy', 's')}Duplicate</button>
      <button class="mi" role="menuitem" data-act="group">${ic('group', 's')}Pre-compose</button>
      <button class="mi" role="menuitem" data-act="move" data-v="-1">${ic('up', 's')}Move up</button>
      <button class="mi" role="menuitem" data-act="move" data-v="1">${ic('down', 's')}Move down</button>
      <div class="mhr"></div><button class="mi danger" role="menuitem" data-act="del">${ic('trash', 's')}Delete</button></div>`;
    pos = { left: Math.min(S.pop.x - a.left, a.width - 260), top: Math.min(S.pop.y - a.top, a.height - 260) };
  } else if (S.pop.type === 'ease') {
    const k = selectedKeyObjs()[0];
    html = `<div class="pop easepop" role="dialog" aria-label="Ease keyframe"><div class="mlbl" style="padding-top:2px">Ease · ${S.keys.length} key${S.keys.length > 1 ? 's' : ''}</div>
      <div class="eases">${['linear', 'ease', 'out', 'in', 'inout', 'back', 'snap', 'anticip', 'bounce'].map((e) => `<button class="ez ${k && k.e === e ? 'on' : ''}" data-act="ease" data-v="${e}" data-close="1">${easeGlyph(EASES[e])}${EASE_NAMES[e]}</button>`).join('')}</div>
      <button class="mi" data-act="right" data-v="easing" style="margin-top:4px">${ic('easing', 's')}Edit curve…</button></div>`;
    pos = { left: Math.max(8, Math.min(S.pop.x - a.left - 135, a.width - 280)), top: Math.max(8, S.pop.y - a.top - 300) };
  } else if (S.pop.type === 'fx') {
    const b = $('#rpanel [data-act=addfx]').getBoundingClientRect();
    const groups = [['Stylise', ['glow', 'bloom', 'shadow', 'longshadow', 'outline', 'halftone', 'pixelate', 'grain', 'vignette']], ['Blur', ['blur', 'dirblur']], ['Distort', ['ripple', 'roughen', 'rgbsplit', 'glitch']], ['Colour', ['hue', 'sat', 'bright', 'tint', 'duotone', 'posterize', 'invert']], ['Time', ['postime']]];
    html = `<div class="pop menu" role="menu" aria-label="Add effect" style="max-height:${a.height - 24}px;overflow:auto">${groups.map(([g, ids]) => `<div class="mlbl">${g}</div>${ids.map((id) => `<button class="mi" role="menuitem" data-act="fxadd" data-v="${id}">${FXDEF[id].name}</button>`).join('')}`).join('')}</div>`;
    pos = { right: Math.max(8, a.right - b.right), top: Math.max(8, Math.min(b.bottom - a.top + 6, a.height - 470)) };
  } else if (S.pop.type === 'fxm') {
    const l = lay(S.sel), i = S.pop.i, n = l ? l.fx.length : 0;
    html = `<div class="pop menu" role="menu" aria-label="Effect options">
      <button class="mi" role="menuitem" data-act="fxdup">${ic('copy', 's')}Duplicate</button>
      <button class="mi" role="menuitem" data-act="fxmv" data-v="-1" ${i > 0 ? '' : 'disabled style="opacity:.4"'}>${ic('up', 's')}Move up</button>
      <button class="mi" role="menuitem" data-act="fxmv" data-v="1" ${i < n - 1 ? '' : 'disabled style="opacity:.4"'}>${ic('down', 's')}Move down</button>
      <button class="mi" role="menuitem" data-act="fxsolo">${ic('solo', 's')}Solo this effect</button>
      <div class="mhr"></div><button class="mi danger" role="menuitem" data-act="fxdel" data-v="${i}">${ic('trash', 's')}Remove</button></div>`;
    pos = { left: Math.max(8, Math.min(S.pop.x - a.left - 220, a.width - 260)), top: Math.max(8, Math.min(S.pop.y - a.top + 8, a.height - 300)) };
  } else if (S.pop.type === 'color') {
    const key = S.pop.key || 'hue', l = key === 'brush' ? S.brush : lay(S.sel), b = (key === 'brush' ? $('#bbar .bcol') : $(`#rpanel .cchip[data-key="${key}"]`)).getBoundingClientRect();
    if (key === 'brush') l.brush = l.c;
    if (!cp) setCp({ ...hexToHsv(l[key] || '#ffffff'), key, dirty: false });
    const sw = [...new Set([...layers.map((x) => String(x.hue).toLowerCase()).filter((h) => /^#[0-9a-f]{6}$/.test(h)), ...HUES.map((h) => h.toLowerCase())])].slice(0, 14);
    html = `<div class="pop cp" role="dialog" aria-label="Colour">
      <div class="mlbl" style="padding:2px 4px 0">Document colours</div>
      <div class="swatches">${sw.map((h) => `<button class="sw ${h === String(l[key] || '').toLowerCase() ? 'on' : ''}" style="background:${h}" data-act="cpsw" data-v="${h}" aria-label="Colour ${h}"></button>`).join('')}</div>
      <div class="sv" data-cp="sv" style="--hue:${cp.h}" role="slider" aria-label="Saturation and brightness" aria-valuenow="${Math.round(cp.s * 100)}"><i style="left:${cp.s * 100}%;top:${(1 - cp.v) * 100}%"></i></div>
      <div class="hue" data-cp="hue" role="slider" aria-label="Hue" aria-valuemin="0" aria-valuemax="360" aria-valuenow="${Math.round(cp.h)}"><i style="left:${cp.h / 360 * 100}%"></i></div>
      <div class="cprow"><span class="cpchip" style="background:${l[key]}"></span><input id="cphex" class="txt tc" value="${String(l[key]).toUpperCase()}" aria-label="Hex colour" maxlength="7" spellcheck="false" autocomplete="off"><button class="ib" data-act="eyedrop" aria-label="Pick colour from canvas" title="Eyedropper">${ic('eyedrop', 's')}</button></div>
      <p class="hint" style="padding:0 4px">The eyedropper picks a layer's colour in this prototype.</p></div>`;
    pos = key === 'brush' ? { left: Math.max(8, Math.min(b.left - a.left - 110, a.width - 272)), top: Math.max(8, b.top - a.top - 410) } : { right: Math.max(8, a.right - b.right), top: Math.max(8, Math.min(b.bottom - a.top + 6, a.height - 400)) };
  } else if (S.pop.type === 'anchor') {
    const b = $('#rpanel [data-act=anchorpick]').getBoundingClientRect();
    const rows = ['Top', 'Middle', 'Bottom'], cols = ['left', 'centre', 'right'];
    html = `<div class="pop" role="dialog" aria-label="Anchor point"><div class="mlbl" style="padding:2px 4px 4px">Anchor point</div>
      <div class="a9">${[0, .5, 1].flatMap((fy, ry) => [0, .5, 1].map((fx2, cx2) => `<button data-act="anchor" data-v="${fx2},${fy}" aria-label="${rows[ry]} ${cols[cx2]}"><i></i></button>`)).join('')}</div>
      <p class="hint" style="padding:4px 4px 0;max-width:160px">The layer stays in place.</p></div>`;
    pos = { left: Math.max(8, Math.min(b.left - a.left - 190, a.width - 190)), top: Math.max(8, Math.min(b.top - a.top - 20, a.height - 240)) };
  } else if (S.pop.type === 'selmodes') {
    const b = $('#selbtn').getBoundingClientRect();
    html = `<div class="pop menu" role="menu" aria-label="Selection tools" style="min-width:220px">${SELMODES.map(([id, n, k]) => `<button class="mi" role="menuitem" data-act="picksel" data-v="${id}">${ic(id, 's')}${n}<kbd>${k}</kbd></button>`).join('')}</div>`;
    pos = { left: b.right - a.left + 8, top: b.top - a.top - 8 };
  } else if (S.pop.type === 'align') {
    const b = $('#qbar [data-act=align]').getBoundingClientRect(), n = selIds().length;
    html = `<div class="pop" role="dialog" aria-label="Align"><div class="mlbl" style="padding:2px 4px 6px">Align to ${n > 1 ? 'selection' : 'composition'}</div>
      <div class="al">${[['left', 'Left', 'alL'], ['hcenter', 'Centre', 'alC'], ['right', 'Right', 'alR'], ['top', 'Top', 'alT'], ['vcenter', 'Middle', 'alM'], ['bottom', 'Bottom', 'alB']].map(([v, nm, icn]) => `<button data-act="alignto" data-v="${v}" aria-label="Align ${nm.toLowerCase()}">${ic(icn, 's')}<span>${nm}</span></button>`).join('')}</div>
      ${n >= 3 ? `<div class="al" style="grid-template-columns:1fr 1fr;margin-top:6px"><button data-act="alignto" data-v="dh" aria-label="Distribute horizontally">${ic('distH', 's')}<span>Distribute ↔</span></button><button data-act="alignto" data-v="dv" aria-label="Distribute vertically">${ic('distV', 's')}<span>Distribute ↕</span></button></div>` : ''}</div>`;
    pos = { left: Math.max(8, Math.min(b.left - a.left - 70, a.width - 240)), top: Math.max(8, b.top - a.top - (n >= 3 ? 196 : 140)) };
  } else if (S.pop.type === 'drawmodes') {
    const b = $('#brushbtn').getBoundingClientRect();
    html = `<div class="pop menu" role="menu" aria-label="Drawing tools" style="min-width:200px">${DRAWMODES.map(([id, n, k]) => `<button class="mi" role="menuitem" data-act="pickdraw" data-v="${id}">${ic(id, 's')}${n}<kbd>${k}</kbd></button>`).join('')}</div>`;
    pos = { left: b.right - a.left + 8, top: b.top - a.top - 8 };
  } else if (S.pop.type === 'onion') {
    const O = S.onion, n5 = (k) => `<div class="seg" role="group" aria-label="${k === 'nb' ? 'Cels before' : 'Cels after'}">${[0, 1, 2, 3, 4, 5].map((n) => `<button data-act="onset" data-k="${k}" data-v="${n}" aria-pressed="${O[k] === n}">${n}</button>`).join('')}</div>`;
    html = `<div class="pop onpop" role="dialog" aria-label="Onion skin">
      <div class="kv"><b>Onion skin</b><button class="tog" data-act="onion" aria-pressed="${O.on}" aria-label="Onion skin"></button></div>
      <div class="mlbl" style="padding:0">Cels before <span style="color:#ff6f78">●</span></div>${n5('nb')}
      <div class="mlbl" style="padding:0">Cels after <span style="color:#3bd982">●</span></div>${n5('na')}
      ${pf(O, 'on', 0, 'op', 'Opacity', 5, 90, .4, '%')}
      <div class="kv"><span>Tint before red, after green</span><button class="tog" data-act="onset" data-k="tint" aria-pressed="${O.tint}" aria-label="Tint onion skins"></button></div>
      <div class="kv"><span>Lightbox: dim other layers</span><button class="tog" data-act="onset" data-k="lb" aria-pressed="${O.lb}" aria-label="Lightbox"></button></div></div>`;
    pos = { left: Math.max(8, Math.min(S.pop.x - a.left - 125, a.width - 262)), top: Math.max(8, S.pop.y - a.top - 352) };
  } else if (S.pop.type === 'cel') {
    html = `<div class="pop menu" role="menu" aria-label="Cel">
      <button class="mi" role="menuitem" data-act="celop" data-v="dup">${ic('copy', 's')}Duplicate cel</button>
      <button class="mi" role="menuitem" data-act="celop" data-v="blank">${ic('celadd', 's')}Blank cel after</button>
      <div class="mhr"></div><button class="mi danger" role="menuitem" data-act="celop" data-v="del">${ic('trash', 's')}Delete cel</button></div>`;
    pos = { left: Math.min(S.pop.x - a.left, a.width - 260), top: Math.max(8, Math.min(S.pop.y - a.top - 150, a.height - 170)) };
  } else if (S.pop.type === 'shapes') {
    const b = $('#shapebtn').getBoundingClientRect();
    html = `<div class="pop menu" role="menu" aria-label="Shapes" style="min-width:200px">${SHAPES.map(([id, n, k]) => `<button class="mi" role="menuitem" data-act="pickshape" data-v="${id}">${ic(id, 's')}${n}<kbd>${k}</kbd></button>`).join('')}</div>`;
    pos = { left: b.right - a.left + 8, top: b.top - a.top - 8 };
  }
  host.innerHTML = html;
  const p = host.firstElementChild; if (!p) return;
  for (const k in pos) p.style[k] = Math.round(pos[k]) + 'px';
  setTimeout(() => { const f = p.querySelector('button'); if (f && S.pop && S.pop !== 'menu') f.focus({ preventScroll: true }); }, 0);
}
