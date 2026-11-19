import { $, $$, esc } from '../../core/dom';
import { DUR, FPS, compBg, markers, projName } from '../../model/project';
import { ic } from '../icons';
import { GROUPS, PROPS } from '../../model/schema';
import { lay, val } from '../../anim/interpolate';
import { S } from '../../state/state';
import { presetsView } from '../presets';
import { fmt, grpState, kdLabel, sec, tc } from './controls';
import { easingBlock } from './easing';
import { fxView } from './effects';
import { propsView } from './props-view';

export function renderRight() {
  const el = $('#rpanel');
  if (!S.right) { el.innerHTML = ''; return; }
  const l = S.sel && lay(S.sel);
  const grab = `<button class="grab" id="sheetgrab" aria-label="${S.full ? 'Collapse' : 'Expand'} inspector sheet"></button>`;
  let head, body;
  if (S.right === 'presets') {
    ({ head, body } = presetsView());
  } else if (S.right === 'easing') {
    const n = S.keys.length;
    head = `<span class="chip-dot" style="background:rgb(var(--acc))"></span><div><h2>Easing</h2><div class="sub">${n ? `${n} keyframe${n > 1 ? 's' : ''} selected` : 'No keyframes selected'}</div></div>`;
    body = `<div class="sec-b" style="padding-top:4px">${easingBlock(false)}</div>`;
  } else if (!l) {
    head = `<div><h2>${S.right === 'effects' ? 'Effects' : 'Composition'}</h2><div class="sub">${esc(projName)} · 1920×1080 · 30 fps · ${DUR / FPS} s</div></div>`;
    body = `<p class="hint">Select a layer on the canvas or in Layers to edit it. Use ＋ to add text, shapes or media.</p>
      ${sec('comp', 'Composition', `<div class="kv"><span>Size</span><b class="tc">1920 × 1080</b></div><div class="kv"><span>Frame rate</span><b class="tc">30 fps</b></div>
        <div class="sublbl">Duration</div><div class="seg" role="group" aria-label="Duration">${[3, 5, 10, 15].map((d) => `<button data-act="setdur" data-v="${d}" aria-pressed="${DUR === d * FPS}">${d} s</button>`).join('')}</div>
        <div class="sublbl">Background</div><div class="swatches">${[['', 'Theme'], ['#000000', 'Black'], ['#15120f', 'Charcoal'], ['#0b1b33', 'Navy'], ['#f4efe9', 'Paper'], ['#ffffff', 'White'], ['#2a6cff', 'Blue'], ['#ff5ea8', 'Pink']].map(([c, n]) => `<button class="sw ${(compBg || '') === c ? 'on' : ''}" data-act="compbg" data-v="${c}" aria-label="Background ${n}" title="${n}" style="background:${c || 'conic-gradient(var(--comp-bg) 0 50%, var(--surface-3) 0)'}"></button>`).join('')}</div>
        <div class="sublbl">Overlays</div><div class="seg" role="group" aria-label="Overlays">${[['off', 'None'], ['safe', 'Safe areas'], ['thirds', 'Thirds']].map(([v, n]) => `<button data-act="guide" data-v="${v}" aria-pressed="${S.guide === v}">${n}</button>`).join('')}</div>
        <button class="line-btn" data-act="settings">${ic('settings', 's')}Project settings…</button>`)}
      ${sec('mk', 'Markers', `<button class="line-btn" data-act="marker">${ic('plus', 's')}Add marker at ${tc(S.f)}</button>` + (markers.length ? markers.map((m, i) => `<div class="mkrow"><button class="ib" data-act="mkjump" data-v="${i}" aria-label="Go to ${esc(m.name)}" title="Go to marker">${ic('marker', 's')}</button><input class="lname" data-mkn="${i}" value="${esc(m.name)}" aria-label="Marker name"><span class="tc" style="color:var(--muted)">${tc(m.f)}</span><button class="ib" data-act="mkdel" data-v="${i}" aria-label="Delete ${esc(m.name)}">${ic('trash', 's')}</button></div>`).join('') : '<p class="hint" style="padding:0">No markers yet. Use Marker in the timeline tools.</p>'))}`;
  } else if (S.right === 'effects') {
    ({ head, body } = fxView(l));
  } else {
    ({ head, body } = propsView(l));
  }
  const rKey = S.right + ':' + (S.sel || ''), oldBody = el.querySelector('.pbody');
  const keepTop = oldBody && el.dataset.rkey === rKey ? oldBody.scrollTop : 0;
  el.innerHTML = `<div class="inner">${grab}<div class="phead">${head}</div><div class="pbody">${body}</div></div>`;
  el.dataset.rkey = rKey;
  if (keepTop) el.querySelector('.pbody').scrollTop = keepTop;
  el.classList.toggle('full', S.full);
}
export function updateFields() {
  $$('#rpanel .fld[data-p]').forEach((f) => {
    const L = lay(f.dataset.l), p = f.dataset.p; if (!L || !L.p[p]) return;
    const v = val(L.p[p], S.f), sp = f.querySelector('.v'); if (sp) sp.textContent = fmt(v, PROPS[p]);
    f.setAttribute('aria-valuenow', Math.round(v));
  });
  const l = S.sel && lay(S.sel); if (!l) return;
  $$('#rpanel .prop[data-g]').forEach((row) => {
    const g = row.dataset.g, st2 = grpState(l, g), b = row.querySelectorAll('.kc button');
    b[0].disabled = st2.prev == null; b[2].disabled = st2.next == null;
    row.classList.toggle('is-anim', st2.anim); b[1].classList.toggle('anim', st2.anim); b[1].classList.toggle('onkey', st2.on); b[1].setAttribute('aria-label', kdLabel(GROUPS[g].label, st2));
  });
}
