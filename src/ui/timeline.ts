// @ts-nocheck
import { $, app, esc } from '../core/dom';
import { DUR, layers, markers } from '../model/project';
import { ic } from './icons';
import { ename } from '../anim/easing';
import { PROPS, TF } from '../model/schema';
import { animated, keyAt, lay } from '../anim/interpolate';
import { S, selIds } from '../state/state';
import { tc } from './inspector/controls';
import { keyClip, selectedKeyObjs } from '../anim/clipboard';
import { drawGraph, graphHtml } from './graph';
import { waveSvg } from '../playback/audio';
import { celBlocks } from '../gestures/cel-timeline';

/* ---------- render: timeline ---------- */
export function tlHeight() {
  const H = app.clientHeight;
  if (S.tlPx != null) return S.tlPx;
  return S.tl === 'peek' ? 58 : S.tl === 'mid' ? Math.round(H * .4) : Math.round(H * .64);
}
function rulerHtml() {
  let h = '';
  const big = DUR > 300, stp = big ? 75 : 15, per = big ? 150 : 30;
  for (let f = 0; f <= DUR; f += stp) { const sec = f % per === 0; h += `<span class="tk ${sec ? '' : 'min'}" style="left:${f / DUR * 100}%">${sec ? f / 30 + 's' : '·'}</span>`; }
  return `<div class="ruler">${h}</div>`;
}
export function renderTL() {
  const el = $('#tl'), l = S.sel && lay(S.sel);
  const ticks = l ? [...new Set(TF.flatMap((p) => animated(l.p[p]) ? l.p[p].keys.map((k) => k.t) : []))] : [];
  const expanded = tlHeight() > 90;
  let body = '';
  if (expanded) {
    const tools = `<div class="tl-tools">
      <div class="seg" role="tablist" aria-label="Timeline view"><button role="tab" aria-selected="${S.tlMode === 'dope'}" data-act="tlmode" data-v="dope">Dope sheet</button><button role="tab" aria-selected="${S.tlMode === 'graph'}" data-act="tlmode" data-v="graph">Graph</button></div>
      <button class="line-btn ghost" data-act="marker" aria-label="Add marker at playhead">${ic('marker', 's')}Marker</button>
      <button class="line-btn ghost ${S.loop ? '' : ''}" data-act="loopt" aria-pressed="${S.loop}" style="${S.loop ? 'color:var(--acc-text)' : ''}" title="Loop playback inside the work area">${ic('loop', 's')}Loop</button>
      ${S.wa[0] > 0 || S.wa[1] < DUR ? `<button class="line-btn ghost" data-act="wareset" title="Reset work area to the full timeline">Full range</button>` : ''}
      <span class="spacer"></span>
      ${S.sel && lay(S.sel) && TF.some((p) => animated(lay(S.sel).p[p])) ? `<button class="line-btn ghost" data-act="keysall" aria-label="Select all keyframes on the selected layer">${ic('selall', 's')}All keys</button>` : ''}
      ${S.keys.length ? `<button class="line-btn ghost" data-act="copykeys" aria-label="Copy selected keyframes">Copy</button>` : ''}${keyClip && S.sel ? `<button class="line-btn ghost" data-act="pastekeys" aria-label="Paste keyframes at playhead">Paste</button>` : ''}
      ${S.keys.length ? `<button class="line-btn ghost" data-act="keysdel" aria-label="Delete selected keyframes" style="color:var(--danger)">${ic('trash', 's')}Delete</button>` : ''}
      ${S.keys.length ? `<button class="line-btn" data-act="right" data-v="easing" style="color:var(--acc-text)">${ic('easing', 's')}${ename(selectedKeyObjs()[0] || {})} · ${S.keys.length}</button>` : ''}
    </div>`;
    let rows = '';
    if (S.tlMode === 'graph') {
      rows = graphHtml(l);
    } else {
      rows = layers.map((L) => {
        const all = [...new Set(TF.flatMap((p) => animated(L.p[p]) ? L.p[p].keys.map((k) => k.t) : []))];
        const open = S.open.has(L.id);
        let h = `<div class="trow ${selIds().includes(L.id) ? 'sel' : ''}" data-ctx="${L.id}">
          <div class="nmc" data-act="sel" data-v="${L.id}">
            <button class="ib" data-act="twirl" data-v="${L.id}" aria-label="${open ? 'Collapse' : 'Expand'} properties" aria-expanded="${open}">${ic(open ? 'down' : 'right', 'xs')}</button>
            <span class="chip-dot" style="background:${L.hue}"></span><span class="nm">${esc(L.name)}</span>
            <button class="ib" data-act="vis" data-v="${L.id}" aria-label="${L.vis ? 'Hide' : 'Show'} layer">${ic(L.vis ? 'eye' : 'eyeoff', 'xs')}</button>
          </div>
          <div class="ttrack" data-l="${L.id}" style="--hue:${L.hue}"><span class="bar" style="left:${(L.inP ?? 0) / DUR * 100}%;right:${(DUR - (L.outP ?? DUR)) / DUR * 100}%" title="Hold, then drag to slide"><i class="trim" data-trim="in" aria-hidden="true"></i><i class="trim" data-trim="out" aria-hidden="true"></i>${L.type === 'audio' ? waveSvg(L) : ''}</span>${L.type === 'draw' ? celBlocks(L) : ''}${(L.anims || []).map((a) => `<span class="astripe" style="left:${a.start / DUR * 100}%;width:${Math.min(DUR - a.start, a.type === 'wave' ? DUR - a.start : a.dur + String(L.text || '').length * a.stagger) / DUR * 100}%"></span>`).join('')}${all.map((t) => `<button class="dk ${TF.every((p) => !animated(L.p[p]) || keyAt(L.p[p], t) < 0 || S.keys.some((k) => k.l === L.id && k.p === p && L.p[p].keys[k.i] && L.p[p].keys[k.i].t === t)) && S.keys.some((k) => k.l === L.id) ? 'sel' : ''}" style="left:${t / DUR * 100}%" data-dk="agg" data-l="${L.id}" data-t="${t}" aria-label="Keyframes at ${tc(t)}"></button>`).join('')}</div><span></span></div>`;
        if (open) for (const p of TF.filter((p) => animated(L.p[p]))) {
          h += `<div class="trow sub"><div class="nmc"><span class="nm">${PROPS[p].label}</span><button class="kf anim ${keyAt(L.p[p], S.f) >= 0 ? 'onkey' : ''}" data-act="kf" data-l="${L.id}" data-p="${p}" aria-label="Keyframe ${PROPS[p].label}">${ic('diamond')}</button></div>
            <div class="ttrack">${L.p[p].keys.map((k, i) => `<button class="dk ${S.keys.some((s) => s.l === L.id && s.p === p && s.i === i) ? 'sel' : ''}" style="left:${k.t / DUR * 100}%" data-dk="one" data-l="${L.id}" data-p="${p}" data-i="${i}" aria-label="${PROPS[p].label} keyframe at ${tc(k.t)}, ${ename(k)}"></button>`).join('')}</div><span></span></div>`;
        }
        return h;
      }).join('');
    }
    body = `<div class="tl-body">${tools}<div class="tl-rows" id="tlrows">${S.tlMode === 'dope' ? '<span class="phl"></span>' : ''}${rows}</div></div>`;
  }
  el.innerHTML = `<button class="tl-handle" id="tlh" aria-label="${expanded ? 'Collapse' : 'Expand'} timeline" title="Drag or tap"></button>
    <div class="peek">
      <div class="ctl">
        <button class="ib stp" data-act="step" data-v="-1" data-kj="-1" aria-label="Previous frame (hold: previous keyframe)" title="Previous frame · hold for previous keyframe">${ic('stepb', 's')}</button>
        <button class="play" data-act="play" aria-label="${S.playing ? 'Pause' : 'Play'}">${ic(S.playing ? 'pause' : 'play')}</button>
        <button class="ib stp" data-act="step" data-v="1" data-kj="1" aria-label="Next frame (hold: next keyframe)" title="Next frame · hold for next keyframe">${ic('stepf', 's')}</button>
        <div class="time"><b class="tc" id="tcode" aria-label="Current time">${tc(S.f)}</b><span class="tc">/ ${tc(DUR)}</span></div>
        <button class="ib ak ${S.autoKey ? 'on' : ''}" data-act="autokey" aria-pressed="${S.autoKey}" aria-label="Auto-key" title="Auto-key (K): edits at the playhead make keyframes"><span class="rec"></span></button>
      </div>
      <div class="track" id="scrub" aria-label="Scrub timeline" role="slider" aria-valuemin="0" aria-valuemax="${DUR}" aria-valuenow="${Math.round(S.f)}" tabindex="0">
        ${rulerHtml()}<div class="scrubbar"><span class="done"></span></div>
        <span class="wa-shade" style="left:0;width:${S.wa[0] / DUR * 100}%"></span><span class="wa-shade" style="left:${S.wa[1] / DUR * 100}%;right:0"></span>
        <button class="wa" data-wa="0" style="left:${S.wa[0] / DUR * 100}%" aria-label="Loop start ${tc(S.wa[0])}" title="Loop start"></button><button class="wa" data-wa="1" style="left:${S.wa[1] / DUR * 100}%" aria-label="Loop end ${tc(S.wa[1])}" title="Loop end"></button>
        ${markers.map((m) => `<span class="mk" style="left:${m.f / DUR * 100}%" title="${esc(m.name)}"></span>`).join('')}
        ${ticks.map((t) => `<span class="pk" style="left:${t / DUR * 100}%"></span>`).join('')}
        ${l && l.type === 'draw' ? (l.cels || []).map((c) => `<span class="ck" style="left:${c.f / DUR * 100}%"></span>`).join('') : ''}
        <span class="ph"></span>
      </div>${l && l.type === 'draw' ? `<div class="celctl" role="group" aria-label="Cels">
        <button class="ib" data-act="celadd" aria-label="New blank cel at playhead" title="New blank cel">${ic('celadd', 's')}</button>
        <button class="ib" data-act="celdup" aria-label="Duplicate current cel at playhead" title="Duplicate cel">${ic('copy', 's')}</button>
        <button class="ib ${S.onion.on ? 'on' : ''}" data-act="onion" data-onion aria-pressed="${S.onion.on}" aria-label="Onion skin (hold for settings)" title="Onion skin · hold for settings">${ic('onion', 's')}</button>
        <button class="ib" data-flip aria-label="Flip: hold to see the previous cel, drag to flip through cels" title="Hold to flip">${ic('flip', 's')}</button>
      </div>` : '<span></span>'}
    </div>${body}`;
  el.classList.toggle('drawsel', !!(l && l.type === 'draw'));
  if (expanded && S.tlMode === 'graph') drawGraph();
}
