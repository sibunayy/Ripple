import { $, $$ } from '../core/dom';
import { lay } from '../anim/interpolate';
import { S } from '../state/state';
import { buildCanvas } from '../render/stage';
import { clamp } from './graph';
import { saveBrush } from '../drawing/cels';

/* ---------- render: popovers & dialogs ---------- */
export function hexToHsv(hex) {
  const n = parseInt(String(hex).slice(1, 7), 16) || 0, r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
}
function hsvToHex(h, s2, v) { const f = (n) => { const k = (n + h / 60) % 6; return v - v * s2 * Math.max(0, Math.min(k, 4 - k, 1)); }; return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); }
export let cp = null;
 // colour picker session: { h, s, v, dirty }
export function cpApply(hexIn?) {
  const l = S.sel && lay(S.sel); if (!cp || (!l && cp.key !== 'brush')) return;
  const hex = hexIn || hsvToHex(cp.h, cp.s, cp.v);
  if (cp.key === 'brush') { S.brush.c = hex; saveBrush(); const bc = $('#bbar .bcol'); if (bc) bc.style.background = hex; }
  else { l[cp.key || 'hue'] = hex; cp.dirty = true; buildCanvas(); }
  const pop = $('.pop.cp');
  if (pop) {
    pop.querySelector('.sv').style.setProperty('--hue', cp.h);
    const k = pop.querySelector('.sv i'); k.style.left = cp.s * 100 + '%'; k.style.top = (1 - cp.v) * 100 + '%';
    pop.querySelector('.hue i').style.left = cp.h / 360 * 100 + '%';
    const hx = pop.querySelector('#cphex'); if (document.activeElement !== hx) hx.value = hex.toUpperCase();
    pop.querySelector('.cpchip').style.background = hex;
    $$('.sw', pop).forEach((b) => b.classList.toggle('on', b.dataset.v.toLowerCase() === hex.toLowerCase()));
  }
  const cc = $(`#rpanel .cchip[data-key="${cp.key || 'hue'}"]`); if (cc) { cc.querySelector('.cc').style.background = hex; cc.querySelector('.hex').textContent = hex.toUpperCase(); }
}
export function cpDrag(e, el) {
  if (!cp) return;
  e.preventDefault(); el.setPointerCapture(e.pointerId);
  const set = (ev) => { const r = el.getBoundingClientRect(), x = clamp((ev.clientX - r.left) / r.width, 0, 1), y = clamp((ev.clientY - r.top) / r.height, 0, 1); if (el.dataset.cp === 'sv') { cp.s = x; cp.v = 1 - y; } else cp.h = x * 359.9; cpApply(); };
  set(e);
  const up = () => { el.removeEventListener('pointermove', set); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  el.addEventListener('pointermove', set); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
export function setCp(v) { return (cp = v); }
