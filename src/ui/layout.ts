// @ts-nocheck
import { $, app, root } from '../core/dom';
import { DUR } from '../model/project';
import { store } from '../core/store';
import { S } from '../state/state';
import { updateCanvas } from '../render/stage';
import { renderTop } from './topbar';
import { renderStrips } from './strips';
import { renderLeft } from './left-panel';
import { tc } from './inspector/controls';
import { renderRight, updateFields } from './inspector/index';
import { renderFloats } from './floats';
import { renderTL, tlHeight } from './timeline';
import { renderPop } from './popovers';

/* ---------- layout ---------- */
export function applyLayout() {
  const w = app.clientWidth, h = app.clientHeight;
  const portrait = S.portraitPreview || w < 900 || w / h < 1;
  app.classList.toggle('portrait', portrait);
  app.classList.toggle('preview-portrait', S.portraitPreview);
  if (!portrait && S.left && S.right && w - 96 - 280 - 296 < 520) { S.right = null; }
  if (portrait && S.left && S.right) S.right = null;
  app.classList.toggle('left-open', !!S.left);
  app.classList.toggle('right-open', !!S.right);
  app.style.setProperty('--tlh', tlHeight() + 'px');
}
export function renderAll() { applyLayout(); renderTop(); renderStrips(); renderLeft(); renderRight(); renderTL(); renderFloats(); renderPop(); setPF(); persist(); }
export function persist() { store.set('left', S.left); store.set('right', S.right); store.set('tl', S.tl); store.set('collapsed', [...S.collapsed]); }
export function setPF() { app.style.setProperty('--pf', (S.f / DUR).toFixed(5)); const t = $('#tcode'); if (t) t.textContent = tc(S.f); const sc = $('#scrub'); if (sc) sc.setAttribute('aria-valuenow', Math.round(S.f)); }
export function seek(f) { S.f = Math.max(0, Math.min(DUR - 1, f)); setPF(); updateCanvas(); updateFields(); }
export function applyTheme() {
  if (S.themePref === 'auto') { if (S.hostTheme) root.setAttribute('data-theme', S.hostTheme); else root.removeAttribute('data-theme'); }
  else root.setAttribute('data-theme', S.themePref);
  root.setAttribute('data-glow', S.glow); root.setAttribute('data-tint', S.tint);
  store.set('theme', S.themePref); store.set('glow', S.glow); store.set('tint', S.tint);
}
