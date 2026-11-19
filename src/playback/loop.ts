// @ts-nocheck
import { $ } from '../core/dom';
import { FPS, layers } from '../model/project';
import { S } from '../state/state';
import { placeSel } from '../render/stage';
import { updateFields } from '../ui/inspector/index';
import { renderTL } from '../ui/timeline';
import { seek, setPF } from '../ui/layout';
import { syncAudio } from './audio';
import { foldEnd, foldStart } from '../ui/autofold';

let raf = 0, lastT = 0, fpsAcc = [];
function loop(t) {
  if (!S.playing) return;
  const dt = lastT ? (t - lastT) / 1000 : 0; lastT = t;
  fpsAcc.push(dt); if (fpsAcc.length > 30) fpsAcc.shift();
  let f = S.f + dt * FPS, wrap = false; if (f >= S.wa[1] || f < S.wa[0]) { if (!S.loop && f >= S.wa[1]) { seek(S.wa[1] - 1); play(false); return; } f = S.wa[0]; wrap = true; }
  seek(f); syncAudio(wrap);
  if (S.perf) { const avg = fpsAcc.reduce((a, b) => a + b, 0) / fpsAcc.length; $('#hud').textContent = `${avg ? Math.round(1 / avg) : 60} fps · ${layers.length} layers · frame ${Math.floor(S.f)}`; }
  raf = requestAnimationFrame(loop);
}
export function play(on) { S.playing = on ?? !S.playing; lastT = 0; cancelAnimationFrame(raf); if (S.playing) { foldStart('play'); raf = requestAnimationFrame(loop); } else { S.f = Math.round(S.f); foldEnd('play'); } syncAudio(true); renderTL(); setPF(); placeSel(); updateFields(); }
