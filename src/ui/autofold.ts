// @ts-nocheck
import { app } from '../core/dom';
import { S } from '../state/state';
import { layoutStage, stage, vp } from '../render/stage';

/* ---------- auto-fold ---------- */
// Panels fold while the user drags on the canvas or plays back. During drags the stage is frozen in
// screen space so the artwork never shifts under the finger; afterwards the frozen rect becomes zoom/pan.
export let frozen = null, foldBy = null, unfoldTimer = 0;
function unfreeze() {
  if (!frozen) return;
  const r = stage.getBoundingClientRect(), v = vp.getBoundingClientRect();
  const fit = Math.min((v.width - 56) / 1920, (v.height - 56) / 1080);
  S.zoom = r.width / 1920 / fit;
  S.pan = [r.left - v.left - (v.width - r.width) / 2, r.top - v.top - (v.height - r.height) / 2];
  frozen = null; layoutStage();
}
export function foldStart(kind) {
  if (!S.autoFold || foldBy || app.classList.contains('portrait') || !(S.left || S.right)) return;
  clearTimeout(unfoldTimer);
  if (kind === 'drag') { const r = stage.getBoundingClientRect(); frozen = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, pan: [...S.pan], zoom: S.zoom }; }
  else unfreeze();
  foldBy = kind; app.classList.add('folding');
}
export function foldEnd(kind) {
  if (foldBy !== kind) return;
  foldBy = null; app.classList.remove('folding');
  if (frozen) unfoldTimer = setTimeout(unfreeze, 260);
}
