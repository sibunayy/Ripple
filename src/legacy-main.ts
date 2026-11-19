// @ts-nocheck
// Phase 1: the prototype script, moved verbatim. Phase 2 splits it into modules.
import './styles/index.css';

(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app'), root = document.documentElement;
const FPS = 30; let DUR = 150; let projName = 'Logo sting'; let compBg = null;
const HUES = ['#4aa8ff', '#bfe3f5', '#4fd1c5', '#ef6f7f', '#b9d65a', '#7f9bd6'];
const store = { get(k, d) { try { const v = localStorage.getItem('rfp-' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('rfp-' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } } };

/* ---------- icons (stroke, 24 grid) ---------- */
const P = {
  select: 'M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.13 1.58a2 2 0 0 0-1.43 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z',
  hand: 'M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  pen: 'M15.7 21.3a1 1 0 0 1-1.4 0l-1.6-1.6a1 1 0 0 1 0-1.4l5.6-5.6a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4zM18 13l-1.4-6.9a1 1 0 0 0-.7-.8L3.2 2a1 1 0 0 0-1.2 1.2l3.3 12.7a1 1 0 0 0 .8.7L13 18M2.3 2.3l7.3 7.3M13 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  rect: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  ellipse: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z',
  polygon: 'M12 3l8.5 6.2-3.2 10.3H6.7L3.5 9.2z',
  star: 'M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z',
  line: 'M5 19L19 5',
  text: 'M5 7V5h14v2M9 19h6M12 5v14',
  plus: 'M12 5v14M5 12h14',
  layers: 'M12 3 3 7.5l9 4.5 9-4.5zM3 16.5l9 4.5 9-4.5M3 12l9 4.5 9-4.5',
  presets: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
  assets: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM20 15l-5-5L5 20M10 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0',
  props: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1.5 14h5M9.5 8h5M17.5 16h5',
  effects: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM15 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
  easing: 'M3 20c8 0 7-16 18-16M3 20h0M21 4h0',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  left: 'M15 18l-6-6 6-6', right: 'M9 18l6-6-6-6', up: 'M18 15l-6-6-6 6', down: 'M6 9l6 6 6-6',
  play: '<path class="f" d="M7 4.5v15a.8.8 0 0 0 1.2.7l12-7.5a.8.8 0 0 0 0-1.4l-12-7.5A.8.8 0 0 0 7 4.5z"/>',
  pause: '<path class="f" d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeoff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2',
  lock: 'M6 11h12v9H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11', unlock: 'M6 11h12v9H6zM8.5 11V7.5a3.5 3.5 0 0 1 6.8-1.2',
  diamond: '<path class="f" d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/><path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/>',
  key: 'M12 3l9 9-9 9-9-9zM12 9v6M9 12h6',
  magnet: 'M6 15l-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15M5 8l4 4M12 15l4 4',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  marquee: 'M4 8V4h4M11 4h2M16 4h4v4M20 11v2M20 16v4h-4M13 20h-2M8 20H4v-4M4 13v-2',
  lasso: 'M6.5 16.5C4 15 3 13 3 11c0-4 4-7 9-7s9 3 9 7-4 7-9 7c-1.3 0-2.6-.2-3.7-.5M7 16a2 2 0 1 0 0 4c1 0 1.5.8 1.5 2',
  stepb: 'M17 6l-8 6 8 6zM7 6v12', stepf: 'M7 6l8 6-8 6zM17 6v12',
  alL: 'M4 3v18M8 7h12v4H8zM8 14h7v4H8z', alC: 'M12 3v18M6 7h12v4H6zM8.5 14h7v4h-7z', alR: 'M20 3v18M4 7h12v4H4zM9 14h7v4H9z',
  alT: 'M3 4h18M7 8h4v12H7zM14 8h4v7h-4z', alM: 'M3 12h18M7 6h4v12H7zM14 8.5h4v7h-4z', alB: 'M3 20h18M7 4h4v12H7zM14 9h4v7h-4z',
  distH: 'M4 4v16M20 4v16M9.5 8h5v8h-5z', distV: 'M4 4h16M4 20h16M8 9.5h8v5H8z',
  move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  arrowH: 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4', arrowV: 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4',
  scaleI: 'M14 3h7v7M10 21H3v-7M21 3l-7 7M3 21l7-7',
  rotI: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5',
  opac: '<path class="f" d="M12 4a8 8 0 0 0 0 16z"/><path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"/>',
  anchorI: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v6M12 16v6M2 12h6M16 12h6',
  eyedrop: 'M3 21l1.5-1.5h3l8-8M4.5 19.5v-3l8-8M14 5l3-3a2.1 2.1 0 0 1 3 3l-3 3 1 1-2 2-6-6 2-2 1 1z',
  alignL: 'M4 6h16M4 12h10M4 18h14', alignC: 'M4 6h16M7 12h10M5 18h14', alignR: 'M4 6h16M10 12h10M6 18h14', italic: 'M19 4h-9M14 20H5M15 4 9 20', underline: 'M6 4v7a6 6 0 0 0 12 0V4M4 21h16',
  minus: 'M5 12h14', fitsel: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3M9 9h6v6H9z',
  align: 'M12 3v18M7 7h10v4H7zM5 14h14v4H5z', copy: 'M9 9h11v11H9zM5 15V4h11',
  group: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 8h8v8H8z',
  trash: 'M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5l-4.3-4.3', x: 'M18 6L6 18M6 6l12 12',
  solid: '<path class="f" d="M5 5h14v14H5z" opacity=".85"/>', null: 'M12 3v18M3 12h18M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  adjust: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM12 4v16', shader: 'M4 17l6-6-6-6M12 19h8',
  comp: 'M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z',
  media: 'M4 5h16v14H4zM10 9.5v5l4.5-2.5z', audio: 'M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2', marker: 'M6 3h12v12l-6 5-6-5z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  strike: 'M16 5H10a3 3 0 0 0-2.6 4.5M14 13a3.5 3.5 0 0 1-1 6.8H6M4 12h16', flipH: 'M12 3v18M8 7l-5 5 5 5V7zM16 7l5 5-5 5V7z', flipV: 'M3 12h18M7 8l5-5 5 5H7zM7 16l5 5 5-5H7z',
  reset: 'M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5', grid: 'M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18', safe: 'M3 5h18v14H3zM7 8.5h10v7H7z', solo: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  loop: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3', selall: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', zin: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5l-4.3-4.3M8 11h6M11 8v6', zout: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5l-4.3-4.3M8 11h6',
  skip: 'M19 20L9 12l10-8zM5 19V5', step: 'M15 18l-6-6 6-6M19 18V6', trim: 'M4 12h6M14 12h6M10 8v8M14 8v8', trimS: 'M5 5v14M9 12h10M15 8l4 4-4 4', trimE: 'M19 5v14M15 12H5M9 8l-4 4 4 4',
};
Object.assign(P, {
  brush: 'M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z',
  erase: 'M7 21l-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9',
  fill: 'M19 11l-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11zM5 2l5 5M2 13h15M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4z',
  pencil: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5zM15 5l4 4',
  ink: 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z',
  hilite: 'M9 11l-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4z',
  air: 'M4 5h.01M7 3h.01M7 7h.01M4 9h.01M10 5h.01M14 6h5v3h-5zM13 9h7v11a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z',
  onion: 'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM6.6 13.2A6 6 0 0 1 17 8.1M4 9.4A6 6 0 0 1 14.6 4',
  flip: 'M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 20v2M12 14v2M12 8v2M12 2v2',
  celadd: 'M4 5h16v14H4zM12 9v6M9 12h6', press: 'M3 12h3l3-8 4 16 3-8h5', tilt: 'M4 20h16M6 20L17 5M11 20a7 7 0 0 0-1.5-4.3',
});
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] && P[n].startsWith('<') ? P[n] : `<path d="${P[n] || ''}"/>`}</svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- easing ---------- */
const EASES = { hold: [0, 0, 1, 1], linear: [0, 0, 1, 1], ease: [.25, .1, .25, 1], out: [0, 0, .58, 1], in: [.42, 0, 1, 1], inout: [.42, 0, .58, 1], back: [.34, 1.56, .64, 1], snap: [.7, 0, .2, 1], anticip: [.36, -0.5, .6, 1], bounce: [.2, 1.8, .5, .8] };
const EASE_NAMES = { hold: 'Hold', linear: 'Linear', ease: 'Ease', out: 'Ease out', in: 'Ease in', inout: 'In & out', back: 'Back out', snap: 'Snap', anticip: 'Anticipate', bounce: 'Overshoot' };
const EASE_ROW = ['linear', 'ease', 'out', 'in', 'inout', 'back', 'snap', 'anticip', 'bounce', 'hold'];
const earr = (k) => Array.isArray(k.e) ? k.e : EASES[k.e || 'linear'];
const ename = (k) => Array.isArray(k.e) ? 'Custom' : EASE_NAMES[k.e || 'linear'];
function bez(a) {
  const [x1, y1, x2, y2] = a;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (u) => ((ax * u + bx) * u + cx) * u, Y = (u) => ((ay * u + by) * u + cy) * u;
  return (t) => { let lo = 0, hi = 1; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (X(m) < t) lo = m; else hi = m; } return Y((lo + hi) / 2); };
}
const easeGlyph = (a) => a === EASES.hold ? '<svg viewBox="0 0 34 22" aria-hidden="true"><path d="M3 19H31V3"/></svg>' : `<svg viewBox="0 0 34 22" aria-hidden="true"><path d="M3 19C${3 + a[0] * 28} ${19 - a[1] * 16} ${3 + a[2] * 28} ${19 - a[3] * 16} 31 3"/></svg>`;

/* ---------- document ---------- */
// step = value change per point of horizontal drag (before the vertical speed multiplier)
const PROPS = { x: { label: 'Position X', step: 1, min: -4000, max: 6000, u: '' }, y: { label: 'Position Y', step: 1, min: -4000, max: 6000, u: '' }, scale: { label: 'Scale', step: .5, min: 0, max: 1000, u: '%' }, rot: { label: 'Rotation', step: .5, min: -3600, max: 3600, u: '°' }, op: { label: 'Opacity', step: .5, min: 0, max: 100, u: '%' }, ax: { label: 'Anchor X', step: 1, min: -4000, max: 4000, u: '' }, ay: { label: 'Anchor Y', step: 1, min: -4000, max: 4000, u: '' }, ts: { label: 'Trim start', step: .4, min: 0, max: 100, u: '%' }, te: { label: 'Trim end', step: .4, min: 0, max: 100, u: '%' } };
const TF = ['x', 'y', 'scale', 'rot', 'op', 'ax', 'ay', 'ts', 'te'];
const KEYALL = ['x', 'y', 'scale', 'rot', 'op'];
// Inspector rows: Position and Anchor key X and Y together, like After Effects.
const GROUPS = { pos: { label: 'Position', ps: ['x', 'y'], icon: 'move', axes: ['X', 'Y'] }, scale: { label: 'Scale', ps: ['scale'], icon: 'scaleI' }, rot: { label: 'Rotation', ps: ['rot'], icon: 'rotI' }, op: { label: 'Opacity', ps: ['op'], icon: 'opac' }, anchor: { label: 'Anchor point', ps: ['ax', 'ay'], icon: 'anchorI', axes: ['X', 'Y'] }, trim: { label: 'Trim paths', ps: ['ts', 'te'], icon: 'trim', axes: ['Start', 'End'] } };
const st = (v) => ({ v }), an = (...k) => ({ keys: k.map(([t, v, e]) => ({ t, v, e: e || 'linear' })) });
let layers = [
  { id: 'tag', name: 'motion made simple', type: 'text', hue: HUES[1], text: 'motion made simple', size: 64, weight: 500, track: 6, vis: true, lock: false, fx: [],
    p: { x: st(960), y: an([62, 760, 'out'], [86, 718]), scale: st(100), rot: st(0), op: an([62, 0, 'out'], [82, 100]) } },
  { id: 'logo', name: 'YOUR LOGO', type: 'text', hue: HUES[0], text: 'YOUR LOGO', size: 150, weight: 800, track: -2, vis: true, lock: false, fx: [{ id: 'glow', name: 'Glow', on: true, radius: 18, amount: 70 }],
    p: { x: st(960), y: st(600), scale: an([30, 70, 'back'], [54, 100]), rot: st(0), op: an([30, 0, 'out'], [44, 100]) } },
  { id: 'core', name: 'Core', type: 'ellipse', hue: HUES[3], r: 64, vis: true, lock: false, fx: [],
    p: { x: st(960), y: st(330), scale: an([8, 0, 'back'], [28, 100]), rot: st(0), op: st(100) } },
  { id: 'ring', name: 'Ring', type: 'ring', hue: HUES[2], r: 128, vis: true, lock: false, fx: [],
    p: { x: st(960), y: st(330), scale: an([0, 40, 'out'], [30, 100]), rot: an([0, -120, 'inout'], [60, 0]), op: an([0, 0], [12, 100]) } },
];
layers.forEach((l) => { l.p.ax = l.p.ax || st(0); l.p.ay = l.p.ay || st(0); l.p.ts = l.p.ts || st(0); l.p.te = l.p.te || st(l.type === 'ring' ? 70 : 100); });
const markers = [{ f: 30, name: 'Logo hit' }, { f: 86, name: 'Tagline' }];
try {
  const pj = JSON.parse(localStorage.getItem('rfp-project') || 'null');
  if (pj && Array.isArray(pj.layers) && pj.layers.length) {
    layers = pj.layers.filter((l) => !(l.src && String(l.src).startsWith('blob:')));
    markers.splice(0, markers.length, ...(pj.markers || []));
    DUR = pj.dur || 150; if (pj.name) projName = pj.name; if (pj.bg) compBg = pj.bg;
  }
} catch { /* no saved project */ }
function saveProj() {
  try { localStorage.setItem('rfp-project', JSON.stringify({ layers, markers, dur: DUR, name: projName, bg: compBg })); const sv = document.querySelector('.save'); if (sv) sv.classList.remove('off'); } catch { const sv = document.querySelector('.save'); if (sv) sv.classList.add('off'); }
}
const lay = (id) => layers.find((l) => l.id === id);
const animated = (pr) => !!(pr && pr.keys && pr.keys.length);
function val(pr, f) {
  if (!animated(pr)) return pr.v;
  const k = pr.keys;
  if (f <= k[0].t) return k[0].v;
  if (f >= k[k.length - 1].t) return k[k.length - 1].v;
  for (let i = 0; i < k.length - 1; i++) if (f >= k[i].t && f <= k[i + 1].t) { const a = k[i], b = k[i + 1]; if (a.e === 'hold') return f >= b.t ? b.v : a.v; const t = (f - a.t) / (b.t - a.t || 1); return a.v + (b.v - a.v) * bez(earr(a))(t); }
  return k[0].v;
}
const keyAt = (pr, f) => animated(pr) ? pr.keys.findIndex((k) => Math.abs(k.t - f) < .5) : -1;

/* ---------- state ---------- */
const S = {
  tool: 'select', shape: 'rect', left: store.get('left', null), right: store.get('right', 'props'), sel: 'logo', keys: [], f: 42, playing: false,
  tl: store.get('tl', 'peek'), tlPx: null, full: false, autoKey: false, snap: true, zoom: 1, pan: [0, 0], perf: false, mb: false,
  open: new Set(['logo']), tlMode: 'dope', pop: null, dialog: null, cat: 'All', q: '', collapsed: new Set(store.get('collapsed', ['blend', 'masks', 'trim', 'repeat'])),
  portraitPreview: false, toast: null, hostTheme: root.getAttribute('data-theme'), themePref: store.get('theme', 'auto'), glow: store.get('glow', 'full'), tint: store.get('tint', 'classic'),
  autoFold: store.get('autofold', true), eyedrop: false, penPts: [],
  selMode: 'select', multi: new Set(), wa: [0, DUR], ctxPrev: null,
  drawMode: 'brush', flip: null,
  brush: Object.assign({ pre: 'ink', c: '#f4efe9', pr: true, tl: true, P: { pencil: { sz: 6, op: 90 }, ink: { sz: 10, op: 100 }, marker: { sz: 22, op: 75 }, air: { sz: 70, op: 45 } }, er: { sz: 34, op: 100 } }, store.get('brush', {})),
  onion: Object.assign({ on: true, nb: 2, na: 1, op: 45, tint: true, lb: false }, store.get('onion', {})),
  solo: new Set(), guide: store.get('guide', 'off'), loop: true, lq: '', acat: 'All', aq: '',
  pDur: 100, pAmt: 100, pDir: 'up', pAt: 'head', pStag: 0, easeClip: null,
};
/* Composition overlays: title/action safe areas and a rule-of-thirds grid. Drawn over the stage, never exported. */
function guideHtml() {
  if (S.guide === 'safe') return '<div class="gd" aria-hidden="true"><i style="inset:5%"></i><i style="inset:10%"></i><b style="left:50%;top:0;bottom:0;width:0;border-left-width:1px"></b><b style="top:50%;left:0;right:0;height:0;border-top-width:1px"></b></div>';
  if (S.guide === 'thirds') return '<div class="gd" aria-hidden="true"><b style="left:33.333%;top:0;bottom:0;width:0;border-left-width:1px"></b><b style="left:66.666%;top:0;bottom:0;width:0;border-left-width:1px"></b><b style="top:33.333%;left:0;right:0;height:0;border-top-width:1px"></b><b style="top:66.666%;left:0;right:0;height:0;border-top-width:1px"></b></div>';
  return '';
}
// Multi-selection: S.multi only counts while it contains the primary S.sel, so single-select code stays valid.
const selIds = () => (S.sel && S.multi.size > 1 && S.multi.has(S.sel)) ? [...S.multi].filter((id) => lay(id)) : (S.sel && lay(S.sel) ? [S.sel] : []);
const isDrawTool = (t) => t === 'brush' || t === 'erase' || t === 'fill';
const DRAWMODES = [['brush', 'Brush', 'B'], ['erase', 'Eraser', 'X'], ['fill', 'Fill', 'G']];
const BPRE = [['pencil', 'Pencil'], ['ink', 'Ink'], ['marker', 'Marker'], ['air', 'Airbrush']];
const isSelTool = (t) => t === 'select' || t === 'marquee' || t === 'lasso';
const SELMODES = [['select', 'Select', 'V'], ['marquee', 'Marquee', 'M'], ['lasso', 'Lasso', 'Q']];
const ANIMS = { fade: ['Fade by character', 8, 2], type: ['Typewriter', 1, 2], rise: ['Rise by character', 12, 2], wave: ['Wave', 0, 0], track: ['Tracking in', 24, 0] };
if (!store.get('collapsedV', 0)) { S.collapsed.add('more'); store.set('collapsedV', 1); store.set('collapsed', [...S.collapsed]); }
if (!store.get('collapsedV3', 0)) { S.collapsed.add('rep'); S.collapsed.add('beh'); store.set('collapsedV3', 1); store.set('collapsed', [...S.collapsed]); }
if (!store.get('collapsedV2', 0)) { S.collapsed.add('adv'); store.set('collapsedV2', 1); store.set('collapsed', [...S.collapsed]); }
let hist = [JSON.stringify(layers)], hi = 0;
function commit(label) { hist = hist.slice(0, hi + 1); hist.push(JSON.stringify(layers)); hi = hist.length - 1; lastLabel = label; saveProj(); }
let lastLabel = '';
function undo() { if (hi <= 0) return; hi--; layers = JSON.parse(hist[hi]); afterHist(); }
function redo() { if (hi >= hist.length - 1) return; hi++; layers = JSON.parse(hist[hi]); afterHist(); }
function afterHist() { if (S.sel && !lay(S.sel)) S.sel = null; S.keys = S.keys.filter((k) => lay(k.l)); buildCanvas(); renderAll(); }

function setVal(l, p, v, forceKey) {
  const pr = l.p[p];
  if (animated(pr)) { const i = keyAt(pr, S.f); if (i >= 0) pr.keys[i].v = v; else { pr.keys.push({ t: Math.round(S.f), v, e: 'ease' }); pr.keys.sort((a, b) => a.t - b.t); } }
  else if (S.autoKey || forceKey) { const old = pr.v; pr.keys = []; if (S.f > 0) pr.keys.push({ t: 0, v: old, e: 'ease' }); pr.keys.push({ t: Math.round(S.f), v, e: 'ease' }); delete pr.v; }
  else pr.v = v;
}
function toggleKey(l, p) {
  const pr = l.p[p];
  if (!animated(pr)) { pr.keys = [{ t: Math.round(S.f), v: pr.v, e: 'ease' }]; delete pr.v; commit('Animate ' + PROPS[p].label); toast(`${PROPS[p].label} is animated. Edits at the playhead now make keyframes.`); return; }
  const i = keyAt(pr, S.f);
  if (i < 0) { pr.keys.push({ t: Math.round(S.f), v: val(pr, S.f), e: 'ease' }); pr.keys.sort((a, b) => a.t - b.t); commit('Add keyframe'); return; }
  const v = pr.keys[i].v; pr.keys.splice(i, 1);
  if (!pr.keys.length) { delete pr.keys; pr.v = v; }
  S.keys = S.keys.filter((k) => !(k.l === l.id && k.p === p));
  commit('Remove keyframe');
}

/* ---------- canvas ---------- */
const stage = $('#stage'), vp = $('#vp');
let gEls = {};
function ptsArr(n, ro, ri) { const a = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, t = Math.PI * i / n - Math.PI / 2; a.push([Math.cos(t) * r, Math.sin(t) * r]); } return a; }
function starPts(n, ro, ri) { return ptsArr(n, ro, ri).map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '); }
const polyOf = (l) => l.type === 'star' ? ptsArr(l.n || 5, 120, 120 * (l.ir ?? 43) / 100) : ptsArr(l.n || 3, 120, 120 * Math.cos(Math.PI / (l.n || 3)));
const STROKABLE = ['rect', 'ellipse', 'star', 'polygon'];
const hasStroke = (l) => l.type === 'ring' || l.type === 'line' || l.type === 'path' || (STROKABLE.includes(l.type) && (l.sw || 0) > 0);
function pathSegs(l) {
  const P = l.pts || [], n = P.length, segs = [], cl = !!l.closed && n > 2, g = (i) => cl ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
  const m = cl ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = P[i], b = P[(i + 1) % n];
    if (l.smooth && n > 2) { const p0 = g(i - 1), p3 = g(i + 2); segs.push([a, [a[0] + (b[0] - p0[0]) / 6, a[1] + (b[1] - p0[1]) / 6], [b[0] - (p3[0] - a[0]) / 6, b[1] - (p3[1] - a[1]) / 6], b]); }
    else segs.push([a, a, b, b]);
  }
  return segs;
}
function pathD(l) {
  const S0 = pathSegs(l); if (!S0.length) return ''; const f = (q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1);
  return 'M' + f(S0[0][0]) + S0.map((q) => (l.smooth && l.pts.length > 2 ? 'C' + f(q[1]) + ' ' + f(q[2]) + ' ' + f(q[3]) : 'L' + f(q[3]))).join('') + (l.closed && l.pts.length > 2 ? 'Z' : '');
}
function shapeLen(l) {
  switch (l.type) {
    case 'path': { let t = 0; for (const q of pathSegs(l)) { let pr = q[0]; for (let k = 1; k <= 12; k++) { const u = k / 12, v = 1 - u, x = v * v * v * q[0][0] + 3 * v * v * u * q[1][0] + 3 * v * u * u * q[2][0] + u * u * u * q[3][0], y = v * v * v * q[0][1] + 3 * v * v * u * q[1][1] + 3 * v * u * u * q[2][1] + u * u * u * q[3][1]; t += Math.hypot(x - pr[0], y - pr[1]); pr = [x, y]; } } return Math.max(1, t); }
    case 'ring': case 'ellipse': return 2 * Math.PI * l.r;
    case 'rect': return 2 * ((l.w || 280) + (l.h || 180));
    case 'line': return l.w || 420;
    case 'star': case 'polygon': { const p = polyOf(l); let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += Math.hypot(a[0] - b[0], a[1] - b[1]); } return s; }
    default: return 100;
  }
}
const FONTS = [['sys', 'SF Pro', "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif"], ['hn', 'Helvetica Neue', "'Helvetica Neue', Helvetica, Arial, sans-serif"], ['avn', 'Avenir Next', "'Avenir Next', Avenir, sans-serif"], ['fut', 'Futura', "Futura, 'Trebuchet MS', sans-serif"], ['gill', 'Gill Sans', "'Gill Sans', sans-serif"], ['opt', 'Optima', 'Optima, sans-serif'], ['verd', 'Verdana', 'Verdana, sans-serif'], ['treb', 'Trebuchet MS', "'Trebuchet MS', sans-serif"], ['impact', 'Impact', "Impact, 'Arial Narrow Bold', sans-serif"], ['georgia', 'Georgia', 'Georgia, serif'], ['times', 'Times New Roman', "'Times New Roman', Times, serif"], ['pal', 'Palatino', "Palatino, 'Palatino Linotype', serif"], ['bask', 'Baskerville', 'Baskerville, serif'], ['didot', 'Didot', "Didot, 'Bodoni 72', serif"], ['rock', 'Rockwell', 'Rockwell, serif'], ['amtype', 'American Typewriter', "'American Typewriter', serif"], ['mono', 'Menlo', "Menlo, 'SF Mono', monospace"], ['courier', 'Courier New', "'Courier New', monospace"], ['marker', 'Marker Felt', "'Marker Felt', 'Comic Sans MS', fantasy"]];
const WNAME = { 300: 'Light', 400: 'Regular', 500: 'Medium', 650: 'Semibold', 700: 'Bold', 800: 'Heavy', 900: 'Black' };
const FW = { sys: [300, 400, 500, 650, 700, 800, 900], hn: [300, 400, 500, 700], avn: [400, 500, 650, 700, 800], fut: [500, 700], gill: [300, 400, 700], opt: [400, 700, 900], verd: [400, 700], treb: [400, 700], impact: [400], georgia: [400, 700], times: [400, 700], pal: [400, 700], bask: [400, 650, 700], didot: [400, 700], rock: [400, 700], amtype: [300, 400, 700], mono: [400, 700], courier: [400, 700], marker: [400] };
const fontWeights = (l) => FW[(FONTS.find((f) => f[0] === l.font) || FONTS[0])[0]] || [400, 700];
const snapW = (l) => fontWeights(l).reduce((b, w) => Math.abs(w - l.weight) < Math.abs(b - l.weight) ? w : b);
function textSvg(l) {
  const F = FONTS.find((f) => f[0] === l.font) || FONTS[0], lead = (l.lead ?? 120) / 100, size = +l.size || 100;
  let t = String(l.text ?? '');
  if (l.tcase === 'upper') t = t.toUpperCase(); else if (l.tcase === 'lower') t = t.toLowerCase(); else if (l.tcase === 'title') t = t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const lines = t.split('\n'), n = lines.length, anchor = { left: 'start', center: 'middle', right: 'end' }[l.align || 'center'] || 'middle';
  let ci = 0; const per = (l.anims || []).length;
  const inner = (ln) => per && ln ? [...ln].map((ch) => `<tspan data-ci="${ci++}">${esc(ch)}</tspan>`).join('') : (esc(ln) || '&#160;');
  const tsp = lines.map((ln, i) => `<tspan x="0" dy="${(i === 0 ? -(n - 1) * lead * size / 2 : lead * size).toFixed(2)}">${inner(ln)}</tspan>`).join('');
  return `<text text-anchor="${anchor}" dominant-baseline="central" font-family="${esc(F[2]).replace(/'/g, '&#39;')}" font-size="${size}" font-weight="${snapW(l)}"${l.italic ? ' font-style="italic"' : ''}${l.under || l.strike ? ` text-decoration="${[l.under ? 'underline' : '', l.strike ? 'line-through' : ''].join(' ').trim()}"` : ''}${l.wsp ? ` word-spacing="${l.wsp}"` : ''}${(l.fop ?? 100) < 100 ? ` fill-opacity="${(l.fop / 100).toFixed(2)}"` : ''} letter-spacing="${l.track}" fill="${fillVal(l)}"${l.tsw > 0 ? ` stroke="${l.tsc || '#ffffff'}" stroke-width="${l.tsw}" stroke-linejoin="round" paint-order="stroke"` : ''}>${tsp}</text>`;
}
const gradId = (l) => 'gr-' + l.id;
const gradDef = (l) => { if (!l.grad) return ''; const stops = `<stop offset="0" stop-color="${l.hue}"/><stop offset="1" stop-color="${l.hue2 || '#ff5ea8'}"/>`;
  return l.gtype === 'radial' ? `<defs><radialGradient id="${gradId(l)}" cx="50%" cy="50%" r="${(l.grad_r ?? 70)}%">${stops}</radialGradient></defs>` : `<defs><linearGradient id="${gradId(l)}" gradientTransform="rotate(${l.gang ?? 90} .5 .5)">${stops}</linearGradient></defs>`; };
const fillVal = (l) => l.grad ? `url(#${gradId(l)})` : l.hue;
function shapeSvg(l) { return gradDef(l) + shapeSvg0(l); }
const dashGap = (l) => Math.max(1, Math.round(l.dgap ?? l.dash * 1.2));
function shapeSvg0(l) {
  const fillA = l.fill === false ? 'none' : fillVal(l);
  const sw = l.type === 'ring' ? (l.sw ?? 14) : l.type === 'line' ? (l.sw ?? 12) : l.type === 'path' ? (l.sw ?? 8) : (l.sw || 0);
  const stk = hasStroke(l) && sw > 0 ? ` stroke="${l.type === 'ring' || l.type === 'path' ? l.hue : (l.sc || '#ffffff')}" stroke-width="${sw}" stroke-linecap="${l.cap || 'round'}" stroke-linejoin="${l.join || 'round'}"${l.dash > 0 ? ` stroke-dasharray="${l.dash} ${dashGap(l)}" data-dash="${l.dash} ${dashGap(l)}"` : ''}${l.dash > 0 && l.doff ? ` stroke-dashoffset="${l.doff}" data-doff="${l.doff}"` : ''}${(l.sop ?? 100) < 100 ? ` stroke-opacity="${(l.sop / 100).toFixed(2)}"` : ''} class="tp" data-len="${shapeLen(l).toFixed(1)}"` : '';
  const fop = (l.fop ?? 100) < 100 ? ` fill-opacity="${(l.fop / 100).toFixed(2)}"` : '';
  switch (l.type) {
    case 'text': return textSvg(l);
    case 'path': return `<path d="${pathD(l)}" fill="${l.fill === true ? fillVal(l) : 'none'}"${fop}${stk}/>`;
    case 'ellipse': return `<circle r="${l.r}" fill="${fillA}"${fop}${stk}/>`;
    case 'ring': return `<circle r="${l.r}" fill="none"${stk}/>`;
    case 'line': return `<line x1="${-(l.w || 420) / 2}" y1="0" x2="${(l.w || 420) / 2}" y2="0" fill="none"${stk || ` stroke="${l.hue}" stroke-width="12" stroke-linecap="round" class="tp" data-len="${shapeLen(l).toFixed(1)}"`}/>`;
    case 'rect': { const w = l.w || 280, h = l.h || 180; return `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${Math.min(l.cr ?? 24, w / 2, h / 2)}" fill="${fillA}"${fop}${stk}/>`; }
    case 'star': case 'polygon': return `<polygon points="${polyOf(l).map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="${fillA}"${fop}${stk}/>`;
    case 'solid': return `<rect x="-960" y="-540" width="1920" height="1080" fill="${l.hue}"/>`;
    case 'shader': return `<rect x="-960" y="-540" width="1920" height="1080" fill="url(#shd-${l.id})" class="shph"/><foreignObject class="shfo" data-sh="${l.id}" x="-960" y="-540" width="1920" height="1080"></foreignObject>`;
    case 'audio': return '';
    case 'image': return `<image href="${l.src}" x="${-l.w / 2}" y="${-l.h / 2}" width="${l.w}" height="${l.h}"/>`;
    case 'draw': return `<g class="onion"></g><image class="cel" x="0" y="0" width="0" height="0" preserveAspectRatio="none" href="${BLANK}"/>`;
    case 'comp': return `<rect x="-300" y="-170" width="600" height="340" rx="10" fill="none" stroke="${l.hue}" stroke-width="4" stroke-dasharray="14 10"/><text text-anchor="middle" dominant-baseline="central" font-family="-apple-system, sans-serif" font-size="40" fill="${l.hue}">${esc(l.name)}</text>`;
    default: return `<rect x="-24" y="-24" width="48" height="48" fill="transparent"/>`;
  }
}
/* ---- effects ---- */
// ps: [key, label, min, max, step per point, unit, default]
const FXDEF = {
  glow: { name: 'Glow', ps: [['radius', 'Radius', 0, 80, .25, '', 18], ['amount', 'Amount', 0, 100, .5, '%', 70]] },
  shadow: { name: 'Drop shadow', ps: [['radius', 'Blur', 0, 80, .25, '', 20], ['amount', 'Opacity', 0, 100, .5, '%', 60]] },
  outline: { name: 'Outline', ps: [['radius', 'Width', 1, 40, .15, '', 6], ['amount', 'Opacity', 0, 100, .5, '%', 100]] },
  blur: { name: 'Gaussian blur', ps: [['radius', 'Radius', 0, 80, .25, '', 10]] },
  dirblur: { name: 'Directional blur', ps: [['radius', 'Length', 0, 120, .4, '', 30], ['amount', 'Angle', 0, 180, .5, '°', 0]] },
  ripple: { name: 'Ripple distort', ps: [["amount", "Strength", 0, 100, .4, "", 25], ["radius", "Size", 1, 100, .3, "", 40], ['speed', 'Speed', 0, 100, .5, '', 30]] },
  hue: { name: 'Hue shift', ps: [['amount', 'Angle', 0, 360, 1, '°', 90]] },
  sat: { name: 'Saturation', ps: [['amount', 'Amount', 0, 200, .7, '%', 130]] },
  bright: { name: 'Brightness', ps: [['amount', 'Amount', 0, 200, .7, '%', 120]] },
  bloom: { name: 'Bloom', ps: [['radius', 'Radius', 0, 100, .3, '', 30], ['amount', 'Intensity', 0, 200, .7, '%', 90], ['thresh', 'Threshold', 0, 100, .4, '%', 55]] },
  halftone: { name: 'Halftone', ps: [['radius', 'Dot size', 4, 60, .15, '', 14], ['amount', 'Density', 10, 300, .8, '%', 120]] },
  roughen: { name: 'Roughen edges', ps: [['amount', 'Border', 0, 60, .2, '', 12], ['radius', 'Scale', 1, 100, .3, '', 30], ['speed', 'Evolve', 0, 30, .1, ' fps', 0]] },
  rgbsplit: { name: 'RGB split', ps: [['radius', 'Offset', 0, 60, .2, '', 8], ['amount', 'Angle', 0, 360, 1, '°', 0]] },
  grain: { name: 'Film grain', ps: [['amount', 'Amount', 0, 100, .4, '%', 35], ['radius', 'Size', 1, 100, .3, '', 50]] },
  posterize: { name: 'Posterize colour', ps: [['amount', 'Levels', 2, 16, .06, '', 4]] },
  invert: { name: 'Invert', ps: [['amount', 'Amount', 0, 100, .5, '%', 100]] },
  duotone: { name: 'Duotone', ps: [['hue1', 'Shadow hue', 0, 360, 1, '°', 250], ['hue2', 'Highlight hue', 0, 360, 1, '°', 40], ['amount', 'Mix', 0, 100, .5, '%', 100]] },
  tint: { name: 'Tint', ps: [['hue1', 'Hue', 0, 360, 1, '°', 30], ['amount', 'Amount', 0, 100, .5, '%', 70]] },
  pixelate: { name: 'Pixelate', ps: [['radius', 'Block size', 2, 80, .2, '', 16]] },
  glitch: { name: 'Glitch', ps: [['amount', 'Strength', 0, 200, .6, '', 60], ['radius', 'Slices', 1, 100, .3, '', 30], ['speed', 'Rate', 0, 30, .1, ' fps', 12]] },
  longshadow: { name: 'Long shadow', ps: [['radius', 'Length', 0, 400, 1, '', 120], ['amount', 'Angle', 0, 360, 1, '°', 45], ['op', 'Opacity', 0, 100, .5, '%', 35]] },
  vignette: { name: 'Vignette', ps: [['amount', 'Amount', 0, 100, .5, '%', 60], ['radius', 'Size', 10, 100, .4, '%', 55]] },
  postime: { name: 'Posterize time', ps: [['amount', 'Frame rate', 1, 30, .08, ' fps', 8]] },
};
const HT_TILE = (c) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${c}" height="${c}"><defs><radialGradient id="g"><stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><rect width="${c}" height="${c}" fill="url(#g)"/></svg>`);
const hsl = (h, s = .75, L = .55) => { const k = (n) => (n + h / 30) % 12, a = s * Math.min(L, 1 - L); return [0, 8, 4].map((n) => L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))); };
const VIG = (sz) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><radialGradient id="g" cx="50%" cy="50%" r="75%"><stop offset="${(sz / 100 * .9).toFixed(2)}" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="1"/></radialGradient></defs><rect width="1920" height="1080" fill="url(#g)"/></svg>`);
const postT = (l, f) => { const e = !l.fxOff && l.fx.find((x) => x.on && x.id === 'postime'); if (!e) return f; const st = 30 / Math.max(1, e.amount || 8); return Math.floor(f / st) * st; };
const rippleBF = (e) => 0.05 / (1 + (e.radius ?? 30) * 0.12);
function fxDefs(l) {
  let out = '';
  if (l.type === 'shader') out += `<radialGradient id="shd-${l.id}" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${l.hue}"/><stop offset=".55" stop-color="#0f2a4a"/><stop offset="1" stop-color="#0c0a08"/></radialGradient>`;
  const on = l.fxOff ? [] : l.fx.map((e, j) => [e, j]).filter(([e]) => e.on && e.id !== 'postime');
  if (!on.length) return out;
  let body = '', src = 'SourceGraphic';
  on.forEach(([e, j], i) => {
    const R = e.radius ?? 10, A = e.amount ?? 50;
    if (e.id === 'glow') body += `<feGaussianBlur in="${src}" stdDeviation="${R / 2}" result="b${i}"/><feColorMatrix in="b${i}" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${(A / 50).toFixed(2)} 0" result="c${i}"/><feMerge result="r${i}"><feMergeNode in="c${i}"/><feMergeNode in="${src}"/></feMerge>`;
    else if (e.id === 'blur') body += `<feGaussianBlur in="${src}" stdDeviation="${R / 3}" result="r${i}"/>`;
    else if (e.id === 'shadow') body += `<feDropShadow in="${src}" dx="0" dy="${R / 2}" stdDeviation="${R / 2}" flood-opacity="${A / 100}" result="r${i}"/>`;
    else if (e.id === 'outline') body += `<feMorphology in="SourceAlpha" operator="dilate" radius="${R}" result="d${i}"/><feFlood flood-color="#ffffff" flood-opacity="${A / 100}" result="fl${i}"/><feComposite in="fl${i}" in2="d${i}" operator="in" result="o${i}"/><feMerge result="r${i}"><feMergeNode in="o${i}"/><feMergeNode in="${src}"/></feMerge>`;
    else if (e.id === 'dirblur') { const a = A * Math.PI / 180; body += `<feGaussianBlur in="${src}" stdDeviation="${(R * Math.abs(Math.cos(a)) / 3).toFixed(2)} ${(R * Math.abs(Math.sin(a)) / 3).toFixed(2)}" result="r${i}"/>`; }
    else if (e.id === 'ripple') { const bf = rippleBF(e); body += `<feTurbulence id="rt-${l.id}-${j}" type="fractalNoise" baseFrequency="${bf.toFixed(5)}" numOctaves="1" seed="3" result="t${i}"/><feDisplacementMap in="${src}" in2="t${i}" scale="${(A * 0.9).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="r${i}"/>`; }
    else if (e.id === 'hue') body += `<feColorMatrix in="${src}" type="hueRotate" values="${A}" result="r${i}"/>`;
    else if (e.id === 'sat') body += `<feColorMatrix in="${src}" type="saturate" values="${(A / 100).toFixed(2)}" result="r${i}"/>`;
    else if (e.id === 'bright') { const s = (A / 100).toFixed(2); body += `<feComponentTransfer in="${src}" result="r${i}"><feFuncR type="linear" slope="${s}"/><feFuncG type="linear" slope="${s}"/><feFuncB type="linear" slope="${s}"/></feComponentTransfer>`; }
    else if (e.id === 'bloom') { const th = (e.thresh ?? 55) / 100, sl = 1 / Math.max(.02, 1 - th); body += `<feComponentTransfer in="${src}" result="bt${i}"><feFuncR type="linear" slope="${sl.toFixed(3)}" intercept="${(-th * sl).toFixed(3)}"/><feFuncG type="linear" slope="${sl.toFixed(3)}" intercept="${(-th * sl).toFixed(3)}"/><feFuncB type="linear" slope="${sl.toFixed(3)}" intercept="${(-th * sl).toFixed(3)}"/></feComponentTransfer><feGaussianBlur in="bt${i}" stdDeviation="${(R / 2).toFixed(1)}" result="bb${i}"/><feComposite in="bb${i}" in2="${src}" operator="arithmetic" k2="${(A / 100).toFixed(2)}" k3="1" result="r${i}"/>`; }
    else if (e.id === 'halftone') { const c = Math.max(4, Math.round(R)); body += `<feColorMatrix in="${src}" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${(.2126 * A / 100).toFixed(3)} ${(.7152 * A / 100).toFixed(3)} ${(.0722 * A / 100).toFixed(3)} 0 0" result="hl${i}"/><feComposite in="hl${i}" in2="${src}" operator="in" result="hm${i}"/><feImage href="${HT_TILE(c)}" x="0" y="0" width="${c}" height="${c}" result="hi${i}"/><feTile in="hi${i}" result="ht${i}"/><feComposite in="ht${i}" in2="hm${i}" operator="arithmetic" k2="1" k3="1" k4="-1" result="hs${i}"/><feComponentTransfer in="hs${i}" result="hd${i}"><feFuncA type="linear" slope="14" intercept="0"/></feComponentTransfer><feComposite in="${src}" in2="hd${i}" operator="in" result="r${i}"/>`; }
    else if (e.id === 'roughen') body += `<feTurbulence id="rf-${l.id}-${j}" type="turbulence" baseFrequency="${(0.4 / (1 + (R * .2))).toFixed(4)}" numOctaves="2" seed="1" result="rn${i}"/><feDisplacementMap in="${src}" in2="rn${i}" scale="${A}" xChannelSelector="R" yChannelSelector="G" result="r${i}"/>`;
    else if (e.id === 'rgbsplit') { const a = A * Math.PI / 180, dx = (R * Math.cos(a)).toFixed(1), dy = (R * Math.sin(a)).toFixed(1); body += `<feOffset in="${src}" dx="${dx}" dy="${dy}" result="sr${i}"/><feOffset in="${src}" dx="${-dx}" dy="${-dy}" result="sb${i}"/><feColorMatrix in="sr${i}" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="cr${i}"/><feColorMatrix in="${src}" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="cg${i}"/><feColorMatrix in="sb${i}" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="cb${i}"/><feComposite in="cr${i}" in2="cg${i}" operator="arithmetic" k2="1" k3="1" result="rg${i}"/><feComposite in="rg${i}" in2="cb${i}" operator="arithmetic" k2="1" k3="1" result="r${i}"/>`; }
    else if (e.id === 'grain') body += `<feTurbulence id="rf-${l.id}-${j}" type="fractalNoise" baseFrequency="${(2.2 / (1 + R * .06)).toFixed(3)}" numOctaves="1" seed="1" result="gn${i}"/><feColorMatrix in="gn${i}" type="saturate" values="0" result="gg${i}"/><feComposite in="gg${i}" in2="${src}" operator="in" result="gi${i}"/><feComposite in="gi${i}" in2="${src}" operator="arithmetic" k2="${(A / 100 * 1.4).toFixed(2)}" k3="1" k4="${(-A / 100 * .7).toFixed(3)}" result="gm${i}"/><feComposite in="gm${i}" in2="${src}" operator="in" result="r${i}"/>`;
    else if (e.id === 'posterize') { const n = Math.max(2, Math.round(A)), tv = Array.from({ length: n }, (_, k) => (k / (n - 1)).toFixed(3)).join(' '); body += `<feComponentTransfer in="${src}" result="r${i}"><feFuncR type="discrete" tableValues="${tv}"/><feFuncG type="discrete" tableValues="${tv}"/><feFuncB type="discrete" tableValues="${tv}"/></feComponentTransfer>`; }
    else if (e.id === 'invert') { const k = A / 100; body += `<feComponentTransfer in="${src}" result="r${i}"><feFuncR type="table" tableValues="${k} ${1 - k}"/><feFuncG type="table" tableValues="${k} ${1 - k}"/><feFuncB type="table" tableValues="${k} ${1 - k}"/></feComponentTransfer>`; }
    else if (e.id === 'duotone') { const a = hsl(e.hue1 ?? 250, .7, .2), b = hsl(e.hue2 ?? 40, .9, .75), m = A / 100; body += `<feColorMatrix in="${src}" type="matrix" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0" result="dl${i}"/><feComponentTransfer in="dl${i}" result="dt${i}">${['R', 'G', 'B'].map((c, k) => `<feFunc${c} type="table" tableValues="${a[k].toFixed(3)} ${b[k].toFixed(3)}"/>`).join('')}</feComponentTransfer><feComposite in="dt${i}" in2="${src}" operator="arithmetic" k2="${m}" k3="${(1 - m).toFixed(3)}" result="r${i}"/>`; }
    else if (e.id === 'tint') { const c = hsl(e.hue1 ?? 200, .8, .55), m = A / 100, row = (k) => [0, 1, 2].map((j) => ((1 - m) * (j === k ? 1 : 0) + m * c[k] * [.2126, .7152, .0722][j] * 1.6).toFixed(3)).join(' ') + ' 0 0'; body += `<feColorMatrix in="${src}" type="matrix" values="${row(0)} ${row(1)} ${row(2)} 0 0 0 1 0" result="r${i}"/>`; }
    else if (e.id === 'pixelate') { const c = Math.max(2, Math.round(R)); body += `<feFlood x="${-2000 + c / 2}" y="${-2000 + c / 2}" width="1" height="1" flood-color="#000" result="pf${i}"/><feComposite in="pf${i}" x="-2000" y="-2000" width="${c}" height="${c}" result="pc${i}"/><feTile in="pc${i}" result="pt${i}"/><feComposite in="${src}" in2="pt${i}" operator="in" result="pi${i}"/><feMorphology in="pi${i}" operator="dilate" radius="${(c / 2).toFixed(1)}" result="r${i}"/>`; }
    else if (e.id === 'glitch') body += `<feTurbulence id="rf-${l.id}-${j}" type="fractalNoise" baseFrequency="0 ${(0.2 / (1 + R * .15)).toFixed(4)}" numOctaves="1" seed="1" result="gn${i}"/><feComponentTransfer in="gn${i}" result="gs${i}"><feFuncR type="discrete" tableValues=".5 .5 .5 .15 .5 .5 .85 .5 .5 .3 .5 .7 .5"/><feFuncG type="discrete" tableValues=".5"/></feComponentTransfer><feDisplacementMap in="${src}" in2="gs${i}" scale="${A}" xChannelSelector="R" yChannelSelector="G" result="r${i}"/>`;
    else if (e.id === 'longshadow') { const n = Math.max(4, Math.min(48, Math.round(R / 4))), a = A * Math.PI / 180; let offs = ''; for (let k = 1; k <= n; k++) offs += `<feOffset in="SourceAlpha" dx="${(Math.cos(a) * R * k / n).toFixed(1)}" dy="${(Math.sin(a) * R * k / n).toFixed(1)}" result="lo${i}_${k}"/>`; body += offs + `<feMerge result="lm${i}">${Array.from({ length: n }, (_, k) => `<feMergeNode in="lo${i}_${k + 1}"/>`).join('')}</feMerge><feFlood flood-color="#000" flood-opacity="${((e.op ?? 35) / 100).toFixed(2)}" result="lf${i}"/><feComposite in="lf${i}" in2="lm${i}" operator="in" result="ls${i}"/><feMerge result="r${i}"><feMergeNode in="ls${i}"/><feMergeNode in="${src}"/></feMerge>`; }
    else if (e.id === 'vignette') body += `<feImage href="${VIG(R)}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="none" result="vi${i}"/><feComponentTransfer in="vi${i}" result="va${i}"><feFuncA type="linear" slope="${(A / 100).toFixed(2)}"/></feComponentTransfer><feComposite in="va${i}" in2="${src}" operator="atop" result="r${i}"/>`;
    else if (e.id === 'postime') return;
    else body += `<feOffset in="${src}" dx="0" dy="0" result="r${i}"/>`;
    const mx = (e.mix ?? 100) / 100;
    if (mx < .995) { body += `<feComposite in="r${i}" in2="${src}" operator="arithmetic" k2="${mx.toFixed(3)}" k3="${(1 - mx).toFixed(3)}" result="mx${i}"/>`; src = 'mx' + i; return; }
    src = 'r' + i;
  });
  const reg = on.some(([e]) => ['halftone', 'pixelate', 'vignette'].includes(e.id)) ? 'filterUnits="userSpaceOnUse" x="-2000" y="-2000" width="5920" height="5080"' : 'x="-50%" y="-50%" width="200%" height="200%"';
  return out + `<filter id="fx-${l.id}" ${reg} color-interpolation-filters="sRGB">${body}</filter>`;
}

/* ---- procedural pose: keyframes + behaviours + duplicator ---- */
function noise1(x, seed) {
  const h = (n) => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const i = Math.floor(x), t = x - i, u = t * t * (3 - 2 * t);
  return h(i) * (1 - u) + h(i + 1) * u;
}
const REP_DEF = { on: true, mode: 'linear', count: 5, dx: 60, dy: 0, rot: 0, sc: 0, rad: 160, align: true, cols: 4, fade: 0, stag: 3 };
function pose(l, f, i) {
  const ff = l.rep && l.rep.on ? f - (l.rep.stag || 0) * i : f, v = (p, d) => (l.p[p] ? val(l.p[p], ff) : d);
  const q = { x: v('x', 0), y: v('y', 0), s: v('scale', 100), r: v('rot', 0), o: v('op', 100), ax: v('ax', 0), ay: v('ay', 0), ts: v('ts', 0), te: v('te', 100), fx: l.flipX ? -1 : 1, fy: l.flipY ? -1 : 1 };
  const t = f / FPS;
  for (const m of l.mods || []) {
    if (!m.on) continue;
    let d = 0;
    const tl = Math.max(0, t - (l.inP ?? 0) / FPS + i * (m.ph || 0));
    if (m.kind === 'wiggle') d = m.amp * noise1(t * m.freq + i * (m.ph || 0) * 3, m.seed || 1);
    else if (m.kind === 'jitter') d = m.amp * noise1(Math.floor(t * m.freq * 4 + i * (m.ph || 0) * 3) * 1.37, m.seed || 1);
    else if (m.kind === 'osc') d = m.amp * Math.sin(Math.PI * 2 * (t * m.freq + i * (m.ph || 0)));
    else if (m.kind === 'bounce') d = m.amp * Math.exp(-(m.dec ?? 4) * tl) * Math.cos(Math.PI * 2 * m.freq * tl);
    else if (m.kind === 'pulse') { const ph = (t * m.freq + i * (m.ph || 0)) % 1; d = m.amp * Math.exp(-ph * (m.dec ?? 6)); }
    else if (m.kind === 'orbit') { const a = Math.PI * 2 * (t * m.freq + i * (m.ph || 0)); q.x += m.amp * Math.cos(a); q.y += m.amp * Math.sin(a) * (m.ell ?? 100) / 100; continue; }
    else d = m.amp * t;
    const k = m.kind === 'spin' ? 'r' : { x: 'x', y: 'y', rot: 'r', scale: 's', op: 'o' }[m.tgt] || 'y';
    q[k] += d;
  }
  return q;
}
function repXf(l, q, i) {
  const R = l.rep, n = Math.max(1, R.count | 0);
  if (R.mode === 'radial') { const a = i / n * Math.PI * 2 - Math.PI / 2; q.x += Math.cos(a) * R.rad; q.y += Math.sin(a) * R.rad; if (R.align) q.r += i / n * 360; }
  else if (R.mode === 'grid') { const c = Math.max(1, R.cols | 0), rows = Math.ceil(n / c); q.x += ((i % c) - (c - 1) / 2) * R.dx; q.y += (Math.floor(i / c) - (rows - 1) / 2) * R.dy; }
  else { q.x += R.dx * i; q.y += R.dy * i; }
  q.r += R.rot * i; q.s *= Math.pow(Math.max(0, 1 + R.sc / 100), i); q.o *= Math.pow(Math.max(0, 1 - R.fade / 100), i);
}
function mat(q) { const m = new DOMMatrix(); m.translateSelf(q.x, q.y); m.rotateSelf(q.r); m.scaleSelf(Math.max(0, q.s) / 100 * (q.fx || 1), Math.max(0, q.s) / 100 * (q.fy || 1)); m.translateSelf(-q.ax, -q.ay); return m; }
const mstr = (m) => `matrix(${m.a.toFixed(5)} ${m.b.toFixed(5)} ${m.c.toFixed(5)} ${m.d.toFixed(5)} ${m.e.toFixed(3)} ${m.f.toFixed(3)})`;
function world(l, f, d = 0) { const own = mat(pose(l, f, 0)); return l.parent && lay(l.parent) && d < 8 ? relM(l, f, d).multiply(own) : own; }
/* A parented layer follows its parent's movement since the frame it was parented, so it keeps its look at that frame. */
function relM(l, f, d) {
  const p = lay(l.parent); let inv;
  try { inv = world(p, l.pt || 0, d + 1).inverse(); if (!isFinite(inv.a) || !isFinite(inv.e)) inv = new DOMMatrix(); } catch { inv = new DOMMatrix(); }
  return world(p, f, d + 1).multiply(inv);
}
const repN = (l) => (l.rep && l.rep.on ? Math.max(1, Math.min(60, Math.round(l.rep.count) || 1)) : 1);
let xfEls = {};
/* ---- Shader layers: WGSL on WebGPU, Shadertoy-style GLSL on WebGL2 ---- */
const SH_H_GLSL = `float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; } return v; }
`;
const SH_H_WGSL = `fn hash(q: vec2f) -> f32 { var p = fract(q * vec2f(123.34, 456.21)); p = p + dot(p, p + 45.32); return fract(p.x * p.y); }
fn vnoise(p: vec2f) -> f32 { let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2f(1.0, 0.0)), u.x), mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), u.x), u.y); }
fn fbm(q: vec2f) -> f32 { var p = q; var v = 0.0; var a = 0.5; for (var i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.02 + vec2f(1.7, 9.2); a *= 0.5; } return v; }
`;
const SHP = {
  liquid: { name: 'Liquid gradient', ps: ['Scale', 'Warp', 'Shadows', 'Brightness'], def: [.35, .5, .5, .5], c: ['#4f7cff', '#ff5ea8'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.y;
  float t = iTime * 0.15;
  vec2 p = uv * mix(0.5, 4.0, iParams.x);
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 1.3), fbm(p + 4.0 * q + vec2(8.3, 2.8) - t));
  float n = fbm(p + mix(0.0, 6.0, iParams.y) * r);
  vec3 col = mix(iColor1, iColor2, smoothstep(0.2, 0.8, n));
  col = mix(col, vec3(0.02, 0.02, 0.05), clamp(length(q) * iParams.z * 0.8, 0.0, 1.0) * 0.6);
  fragColor = vec4(col * mix(0.6, 1.4, iParams.w), 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = fragCoord / u.res.y;
  let t = u.time * 0.15;
  let p = uv * mix(0.5, 4.0, u.params.x);
  let q = vec2f(fbm(p + t), fbm(p + vec2f(5.2, 1.3) - t));
  let r = vec2f(fbm(p + 4.0 * q + vec2f(1.7, 9.2) + t * 1.3), fbm(p + 4.0 * q + vec2f(8.3, 2.8) - t));
  let n = fbm(p + mix(0.0, 6.0, u.params.y) * r);
  var col = mix(u.color1.rgb, u.color2.rgb, smoothstep(0.2, 0.8, n));
  col = mix(col, vec3f(0.02, 0.02, 0.05), clamp(length(q) * u.params.z * 0.8, 0.0, 1.0) * 0.6);
  return vec4f(col * mix(0.6, 1.4, u.params.w), 1.0);
}` },
  plasma: { name: 'Plasma', ps: ['Scale', 'Complexity', 'Rainbow', 'Brightness'], def: [.4, .4, .25, .5], c: ['#1b1f6b', '#36e0c8'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float sc = mix(2.0, 12.0, iParams.x), t = iTime;
  float v = sin(uv.x * sc + t) + sin((uv.y * sc + t) * 0.5) + sin((uv.x * sc + uv.y * sc + t) * 0.5);
  vec2 c = uv * sc * 0.5 + vec2(sin(t * 0.33), cos(t * 0.5)) * 2.0;
  v += sin(sqrt(dot(c, c) + 1.0) + t);
  v *= mix(0.5, 2.5, iParams.y);
  vec3 col = mix(iColor1, iColor2, 0.5 + 0.5 * sin(v * 3.14159));
  col += iParams.z * 0.5 * (0.5 + 0.5 * cos(v * 6.2831 + vec3(0.0, 2.0, 4.0)));
  fragColor = vec4(col * mix(0.6, 1.4, iParams.w), 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = (fragCoord - 0.5 * u.res) / u.res.y;
  let sc = mix(2.0, 12.0, u.params.x);
  let t = u.time;
  var v = sin(uv.x * sc + t) + sin((uv.y * sc + t) * 0.5) + sin((uv.x * sc + uv.y * sc + t) * 0.5);
  let c = uv * sc * 0.5 + vec2f(sin(t * 0.33), cos(t * 0.5)) * 2.0;
  v = v + sin(sqrt(dot(c, c) + 1.0) + t);
  v = v * mix(0.5, 2.5, u.params.y);
  var col = mix(u.color1.rgb, u.color2.rgb, 0.5 + 0.5 * sin(v * 3.14159));
  col = col + u.params.z * 0.5 * (0.5 + 0.5 * cos(v * 6.2831 + vec3f(0.0, 2.0, 4.0)));
  return vec4f(col * mix(0.6, 1.4, u.params.w), 1.0);
}` },
  aurora: { name: 'Aurora', ps: ['Spread', 'Softness', 'Intensity', 'Stars'], def: [.5, .5, .5, .6], c: ['#35f2a0', '#7a5cff'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime * 0.2;
  vec3 col = vec3(0.01, 0.02, 0.05) * (1.4 - uv.y);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y = 0.5 + 0.12 * fi * iParams.x + 0.3 * (fbm(vec2(uv.x * 2.5 + t + fi * 3.1, t * 0.5 + fi)) - 0.5);
    float d = uv.y - y;
    float band = exp(-d * d * mix(400.0, 40.0, iParams.y)) * (0.6 + 0.4 * fbm(vec2(uv.x * 14.0 + fi, t * 3.0)));
    col += mix(iColor1, iColor2, fi / 2.0) * band * mix(0.4, 1.6, iParams.z);
  }
  col += step(0.997, hash(floor(fragCoord / 2.0))) * iParams.w * (1.0 - uv.y);
  fragColor = vec4(col, 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = fragCoord / u.res;
  let t = u.time * 0.2;
  var col = vec3f(0.01, 0.02, 0.05) * (1.4 - uv.y);
  for (var i = 0; i < 3; i++) {
    let fi = f32(i);
    let y = 0.5 + 0.12 * fi * u.params.x + 0.3 * (fbm(vec2f(uv.x * 2.5 + t + fi * 3.1, t * 0.5 + fi)) - 0.5);
    let d = uv.y - y;
    let band = exp(-d * d * mix(400.0, 40.0, u.params.y)) * (0.6 + 0.4 * fbm(vec2f(uv.x * 14.0 + fi, t * 3.0)));
    col = col + mix(u.color1.rgb, u.color2.rgb, fi / 2.0) * band * mix(0.4, 1.6, u.params.z);
  }
  col = col + step(0.997, hash(floor(fragCoord / 2.0))) * u.params.w * (1.0 - uv.y);
  return vec4f(col, 1.0);
}` },
  tunnel: { name: 'Ring tunnel', ps: ['Ring density', 'Twist', 'Segments', 'Brightness'], def: [.4, .3, .4, .5], c: ['#ff7a3d', '#2a1a6b'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float r = max(length(uv), 0.001), a = atan(uv.y, uv.x);
  float z = 1.0 / r;
  float rings = 0.5 + 0.5 * sin(z * mix(2.0, 10.0, iParams.x) - iTime * 4.0);
  float seg = 0.5 + 0.5 * sin(a * floor(mix(2.0, 12.0, iParams.z)) + z * mix(0.0, 2.0, iParams.y) + iTime);
  vec3 col = mix(iColor2, iColor1, rings * (0.4 + 0.6 * seg));
  col *= clamp(r * 1.8, 0.0, 1.0) * mix(0.6, 1.4, iParams.w);
  fragColor = vec4(col, 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = (fragCoord - 0.5 * u.res) / u.res.y;
  let r = max(length(uv), 0.001);
  let a = atan2(uv.y, uv.x);
  let z = 1.0 / r;
  let rings = 0.5 + 0.5 * sin(z * mix(2.0, 10.0, u.params.x) - u.time * 4.0);
  let seg = 0.5 + 0.5 * sin(a * floor(mix(2.0, 12.0, u.params.z)) + z * mix(0.0, 2.0, u.params.y) + u.time);
  var col = mix(u.color2.rgb, u.color1.rgb, rings * (0.4 + 0.6 * seg));
  col = col * clamp(r * 1.8, 0.0, 1.0) * mix(0.6, 1.4, u.params.w);
  return vec4f(col, 1.0);
}` },
  cells: { name: 'Cells', ps: ['Cell count', 'Motion', 'Borders', 'Brightness'], def: [.3, .4, .6, .5], c: ['#ffd23f', '#3a86ff'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.y * mix(3.0, 14.0, iParams.x);
  vec2 i = floor(uv), f = fract(uv), mid = vec2(0.0);
  float md = 8.0, md2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(hash(i + g), hash(i + g + 17.3));
    o = 0.5 + 0.5 * sin(iTime * mix(0.2, 2.0, iParams.y) + 6.2831 * o);
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < md) { md2 = md; md = d; mid = i + g; } else if (d < md2) { md2 = d; }
  }
  float edge = sqrt(md2) - sqrt(md);
  vec3 col = mix(iColor1, iColor2, hash(mid));
  col *= 1.0 - iParams.z * (1.0 - smoothstep(0.0, 0.08, edge));
  fragColor = vec4(col * mix(0.6, 1.4, iParams.w), 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = fragCoord / u.res.y * mix(3.0, 14.0, u.params.x);
  let i = floor(uv);
  let f = fract(uv);
  var mid = vec2f(0.0);
  var md = 8.0;
  var md2 = 8.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let g = vec2f(f32(x), f32(y));
      var o = vec2f(hash(i + g), hash(i + g + 17.3));
      o = 0.5 + 0.5 * sin(u.time * mix(0.2, 2.0, u.params.y) + 6.2831 * o);
      let r = g + o - f;
      let d = dot(r, r);
      if (d < md) { md2 = md; md = d; mid = i + g; } else if (d < md2) { md2 = d; }
    }
  }
  let edge = sqrt(md2) - sqrt(md);
  var col = mix(u.color1.rgb, u.color2.rgb, hash(mid));
  col = col * (1.0 - u.params.z * (1.0 - smoothstep(0.0, 0.08, edge)));
  return vec4f(col * mix(0.6, 1.4, u.params.w), 1.0);
}` },
  synth: { name: 'Synth grid', ps: ['Horizon', 'Speed', 'Grid glow', 'Sun'], def: [.4, .4, .6, .8], c: ['#ff3fb4', '#5b2bff'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float hz = mix(-0.2, 0.15, iParams.x);
  float d = max(hz - uv.y, 0.001);
  vec2 g = vec2(uv.x / d, 1.0 / d + iTime * mix(0.5, 4.0, iParams.y)) * 0.5;
  vec2 gl = abs(fract(g) - 0.5) / max(fwidth(g), vec2(0.0001));
  float line = 1.0 - min(min(gl.x, gl.y), 1.0);
  vec3 sky = mix(iColor2 * 0.6, iColor2 * 0.12, smoothstep(hz, 0.5, uv.y));
  vec2 sp = uv - vec2(0.0, hz + 0.2);
  float sun = smoothstep(0.21, 0.2, length(sp)) * iParams.w;
  sun *= max(step(0.0, sp.y), step(0.35, fract(sp.y * 18.0 - iTime * 0.4)));
  sky = mix(sky, mix(iColor1, vec3(1.0, 0.85, 0.3), smoothstep(-0.2, 0.2, sp.y)), sun);
  vec3 ground = vec3(0.01, 0.0, 0.03) + iColor1 * line * mix(0.3, 1.6, iParams.z) * clamp(d * 5.0, 0.0, 1.0);
  fragColor = vec4(uv.y < hz ? ground : sky, 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = (fragCoord - 0.5 * u.res) / u.res.y;
  let hz = mix(-0.2, 0.15, u.params.x);
  let d = max(hz - uv.y, 0.001);
  let g = vec2f(uv.x / d, 1.0 / d + u.time * mix(0.5, 4.0, u.params.y)) * 0.5;
  let gl = abs(fract(g) - 0.5) / max(fwidth(g), vec2f(0.0001));
  let line = 1.0 - min(min(gl.x, gl.y), 1.0);
  var sky = mix(u.color2.rgb * 0.6, u.color2.rgb * 0.12, smoothstep(hz, 0.5, uv.y));
  let sp = uv - vec2f(0.0, hz + 0.2);
  var sun = smoothstep(0.21, 0.2, length(sp)) * u.params.w;
  sun = sun * max(step(0.0, sp.y), step(0.35, fract(sp.y * 18.0 - u.time * 0.4)));
  sky = mix(sky, mix(u.color1.rgb, vec3f(1.0, 0.85, 0.3), smoothstep(-0.2, 0.2, sp.y)), sun);
  let ground = vec3f(0.01, 0.0, 0.03) + u.color1.rgb * line * mix(0.3, 1.6, u.params.z) * clamp(d * 5.0, 0.0, 1.0);
  return vec4f(select(sky, ground, uv.y < hz), 1.0);
}` },
};
const shLang = (code) => (/@fragment|\bfn\s+\w+\s*\(|vec[234]f\b|\bu\.res\b/.test(code) && !/void\s+mainImage/.test(code) ? 'wgsl' : 'glsl');
const SH_GLSL_PRE = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution; uniform float iTime; uniform float iTimeDelta; uniform float iFrameRate; uniform int iFrame; uniform vec4 iMouse; uniform vec4 iDate; uniform float iSampleRate;
uniform vec4 iParams; uniform vec3 iColor1; uniform vec3 iColor2; uniform float iOpaque;
uniform sampler2D iChannel0; uniform sampler2D iChannel1; uniform sampler2D iChannel2; uniform sampler2D iChannel3; uniform vec3 iChannelResolution[4]; uniform float iChannelTime[4];
out vec4 shOut_;
`;
const SH_GLSL_POST = `
void main() { vec4 c = vec4(0.0, 0.0, 0.0, 1.0); mainImage(c, gl_FragCoord.xy); shOut_ = vec4(clamp(c.rgb, 0.0, 1.0), iOpaque > 0.5 ? 1.0 : clamp(c.a, 0.0, 1.0)); }`;
const SH_WGSL_PRE = `struct U { res: vec2f, time: f32, frame: f32, params: vec4f, color1: vec4f, color2: vec4f, mouse: vec4f, opaque: f32, delta: f32, pad0: f32, pad1: f32 };
@group(0) @binding(0) var<uniform> u: U;
`;
const SH_WGSL_POST = `
@vertex fn shVs_(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[vi], 0.0, 1.0);
}
@fragment fn shFs_(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let c = clamp(mainImage(vec2f(pos.x, u.res.y - pos.y)), vec4f(0.0), vec4f(1.0));
  let a = select(c.a, 1.0, u.opaque > 0.5);
  return vec4f(c.rgb * a, a);
}`;
const shPresetCode = (key, lang) => { const P = SHP[key] || SHP.liquid; return (lang === 'wgsl' ? SH_H_WGSL : SH_H_GLSL) + '\n' + P[lang]; };
const SH = {};
let gpuState = navigator.gpu ? 'pending' : 'none', gpuDev = null, gpuFmt = null;
if (navigator.gpu) {
  navigator.gpu.requestAdapter().then((a) => (a ? a.requestDevice() : null)).then((d) => {
    gpuDev = d; gpuState = d ? 'ok' : 'none'; if (d) { gpuFmt = navigator.gpu.getPreferredCanvasFormat(); d.lost.then(() => { gpuState = 'none'; gpuDev = null; }); }
    if (layers.some((l) => l.type === 'shader')) { for (const k in SH) delete SH[k]; buildCanvas(); renderRight(); }
  }).catch(() => { gpuState = 'none'; });
}
function shSource(l) {
  if (l.code) return { lang: shLang(l.code), code: l.code };
  const lang = gpuState === 'ok' ? 'wgsl' : 'glsl';
  return { lang, code: shPresetCode(l.preset || 'liquid', lang) };
}
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
function shUniforms(l, f, w, h) {
  const t = Math.max(0, f - (l.inP ?? 0)) / FPS * ((l.spd ?? 100) / 100);
  return { w, h, t, frame: Math.round(f), params: [l.sp0 ?? .5, l.sp1 ?? .5, l.sp2 ?? .5, l.sp3 ?? .5], c1: hexRgb(l.hue), c2: hexRgb(l.hue2 || '#ff5ea8'), opaque: l.opaque === false ? 0 : 1 };
}
let shNoiseData = null;
function shNoise() { if (!shNoiseData) { shNoiseData = new Uint8Array(256 * 256 * 4); let s = 1234567; for (let i = 0; i < shNoiseData.length; i++) { s = (s * 1103515245 + 12345) >>> 0; shNoiseData[i] = s >>> 24; } } return shNoiseData; }
function shBuildGl(rt, code) {
  const gl = rt.canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: true });
  if (!gl) { rt.err = 'This browser cannot run GLSL shaders (WebGL2 is unavailable).'; return; }
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const vs = mk(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }');
  const pre = SH_GLSL_PRE.split('\n').length - 1, fs = mk(gl.FRAGMENT_SHADER, SH_GLSL_PRE + code + SH_GLSL_POST);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    rt.err = (gl.getShaderInfoLog(fs) || 'Compile error').split('\n').filter(Boolean).slice(0, 6).map((ln) => ln.replace(/ERROR: 0:(\d+):/, (m, n) => `Line ${Math.max(1, n - pre)}:`)).join('\n');
    return;
  }
  const pg = gl.createProgram(); gl.attachShader(pg, vs); gl.attachShader(pg, fs); gl.bindAttribLocation(pg, 0, 'p'); gl.linkProgram(pg);
  if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) { rt.err = gl.getProgramInfoLog(pg) || 'Link error'; return; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, shNoise());
  gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  const U = {}; ['iResolution', 'iTime', 'iTimeDelta', 'iFrameRate', 'iFrame', 'iMouse', 'iDate', 'iParams', 'iColor1', 'iColor2', 'iOpaque', 'iChannel0', 'iChannel1', 'iChannel2', 'iChannel3', 'iChannelResolution', 'iSampleRate'].forEach((n) => { U[n] = gl.getUniformLocation(pg, n); });
  rt.draw = (q) => {
    gl.viewport(0, 0, q.w, q.h); gl.useProgram(pg);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (let k = 0; k < 4; k++) { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, tex); if (U['iChannel' + k]) gl.uniform1i(U['iChannel' + k], k); }
    if (U.iChannelResolution) gl.uniform3fv(U.iChannelResolution, [256, 256, 1, 256, 256, 1, 256, 256, 1, 256, 256, 1]);
    gl.uniform3f(U.iResolution, q.w, q.h, 1); gl.uniform1f(U.iTime, q.t); gl.uniform1f(U.iTimeDelta, 1 / FPS); gl.uniform1f(U.iFrameRate, FPS); gl.uniform1i(U.iFrame, q.frame);
    gl.uniform4f(U.iMouse, 0, 0, 0, 0); gl.uniform4f(U.iDate, 2026, 0, 1, q.t); gl.uniform1f(U.iSampleRate, 44100);
    gl.uniform4fv(U.iParams, q.params); gl.uniform3fv(U.iColor1, q.c1); gl.uniform3fv(U.iColor2, q.c2); gl.uniform1f(U.iOpaque, q.opaque);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  rt.ok = true;
}
async function shBuildGpu(rt, code) {
  if (gpuState !== 'ok') { rt.err = gpuState === 'pending' ? 'Starting WebGPU…' : 'This browser cannot run WGSL shaders (WebGPU is unavailable). Use a GLSL shader instead.'; return; }
  const dev = gpuDev, ctx = rt.canvas.getContext('webgpu');
  ctx.configure({ device: dev, format: gpuFmt, alphaMode: 'premultiplied' });
  const pre = SH_WGSL_PRE.split('\n').length - 1, mod = dev.createShaderModule({ code: SH_WGSL_PRE + code + SH_WGSL_POST });
  const info = await mod.getCompilationInfo(), errs = info.messages.filter((m) => m.type === 'error');
  if (errs.length) { rt.err = errs.slice(0, 6).map((m) => `Line ${Math.max(1, m.lineNum - pre)}: ${m.message}`).join('\n'); return; }
  let pipe;
  try { pipe = await dev.createRenderPipelineAsync({ layout: 'auto', vertex: { module: mod, entryPoint: 'shVs_' }, fragment: { module: mod, entryPoint: 'shFs_', targets: [{ format: gpuFmt }] }, primitive: { topology: 'triangle-list' } }); }
  catch (e) { rt.err = (e && e.message) || 'Pipeline error. Check that mainImage(fragCoord: vec2f) -> vec4f exists.'; return; }
  const ubuf = dev.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  const data = new Float32Array(24);
  rt.draw = (q) => {
    data.set([q.w, q.h, q.t, q.frame, ...q.params, ...q.c1, 1, ...q.c2, 1, 0, 0, 0, 0, q.opaque, 1 / FPS, 0, 0]);
    dev.queue.writeBuffer(ubuf, 0, data);
    const enc = dev.createCommandEncoder(), pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
    pass.setPipeline(pipe); pass.setBindGroup(0, bind); pass.draw(3); pass.end(); dev.queue.submit([enc.finish()]);
  };
  rt.ok = true;
}
function shRuntime(l) {
  const src = shSource(l), key = src.lang + '|' + gpuState + '|' + src.code;
  let rt = SH[l.id];
  if (rt && rt.key === key) return rt;
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; cv.className = 'shcv';
  rt = SH[l.id] = { key, lang: src.lang, canvas: cv, ok: false, err: '', draw: null };
  if (src.lang === 'wgsl') shBuildGpu(rt, src.code).then(() => { if (SH[l.id] === rt) { updateCanvas(); if (S.sel === l.id) renderRight(); if (S.dialog === 'shader') renderDialog(); } });
  else shBuildGl(rt, src.code);
  return rt;
}
function renderShader(l, f, w, h) {
  const rt = shRuntime(l); if (!rt.ok || !rt.draw) return rt;
  w = w || 1280; h = h || 720;
  if (rt.canvas.width !== w || rt.canvas.height !== h) { rt.canvas.width = w; rt.canvas.height = h; }
  try { rt.draw(shUniforms(l, f, w, h)); } catch (e) { rt.ok = false; rt.err = (e && e.message) || String(e); }
  return rt;
}
function mountShaders() {
  $$('foreignObject.shfo', stage).forEach((fo) => { const l = lay(fo.dataset.sh); if (!l) return; const rt = shRuntime(l); if (rt.canvas.parentNode !== fo) fo.appendChild(rt.canvas); });
}
function shaderLook(l) {
  const rt = SH[l.id], P = SHP[l.preset] || SHP.liquid, custom = !!l.code;
  const labels = custom ? ['Param 1', 'Param 2', 'Param 3', 'Param 4'] : P.ps;
  const status = !rt ? '' : rt.err ? `<p class="hint sherr" style="padding:0;color:var(--danger);white-space:pre-wrap">${esc(rt.err)}</p>` : `<p class="hint" style="padding:0">${rt.ok ? `Running ${rt.lang === 'wgsl' ? 'WGSL on WebGPU' : 'GLSL on WebGL'}` : 'Compiling…'}</p>`;
  return `<div class="kv"><span>Preset</span>${selH('shp', 0, [...(custom ? [['__custom', 'Custom code']] : []), ...Object.entries(SHP).map(([k, v]) => [k, v.name])], custom ? '__custom' : (l.preset || 'liquid'), 'Shader preset')}</div>`
    + status
    + grid2(labels.map((lb, k) => pf(l, 'lp', 0, 'sp' + k, lb, 0, 1, .005, '')).concat([pf(l, 'lp', 0, 'spd', 'Speed', 0, 400, 1, '%')]))
    + `<div class="two">${['hue', 'hue2'].map((k, i) => { const cv = l[k] || '#ffffff'; return `<button class="cchip" data-act="colour" data-key="${k}" aria-haspopup="dialog" aria-label="Colour ${i ? 'B' : 'A'} ${cv}"><span class="cc" style="background:${cv}"></span><span>Colour ${i ? 'B' : 'A'}</span></button>`; }).join('')}</div>`
    + `<div class="rowt"><span class="hint" style="padding:0">Opaque (ignore shader alpha)</span><button class="tog" data-act="shopaque" aria-pressed="${l.opaque !== false}" aria-label="Opaque"></button></div>`
    + `<div class="two"><button class="line-btn" data-act="shedit">Edit code</button><button class="line-btn" data-act="shimport">Import shader…</button></div>`;
}
function shaderDialog() {
  const l = lay(S.sel); if (!l || l.type !== 'shader') return '<h2>Shader</h2><p class="hint">Select a shader layer first.</p><div class="foot"><button class="primary" data-act="close">Close</button></div>';
  const rt = SH[l.id], imp = S.shImport, src = S.shDraft ?? (imp ? '' : shSource(l).code), lang = src.trim() ? shLang(src) : null;
  return `<h2>${imp ? 'Import shader' : 'Shader code'}</h2>
    ${imp ? `<p class="hint" style="padding:0">Paste a community shader. <b>Shadertoy</b>: open the shader, copy the code from its <i>Image</i> tab and paste it here. Single-pass shaders using iTime, iResolution and iMouse work best. Buffer tabs aren't supported, and iChannel0–3 get a noise texture. <b>WGSL</b> (WebGPU): write <code>fn mainImage(fragCoord: vec2f) -&gt; vec4f</code> using <code>u.res</code>, <code>u.time</code>, <code>u.params</code>, <code>u.color1</code> and <code>u.color2</code>.</p>` : ''}
    <textarea id="shcode" class="shcode" spellcheck="false" autocapitalize="off" autocorrect="off" aria-label="Shader code" placeholder="Paste GLSL (mainImage) or WGSL code">${esc(src)}</textarea>
    <div class="kv" style="min-height:0"><span>Language</span><b>${lang ? (lang === 'wgsl' ? 'WGSL · WebGPU' : 'GLSL · WebGL') : '—'}</b></div>
    ${lang === 'wgsl' && gpuState !== 'ok' ? '<p class="hint" style="padding:0;color:var(--danger)">WebGPU isn\'t available in this browser, so WGSL code can\'t run here.</p>' : ''}
    ${rt && rt.err && !imp ? `<p class="hint sherr" style="padding:0;color:var(--danger);white-space:pre-wrap">${esc(rt.err)}</p>` : ''}
    <div class="foot">${l.code ? '<button class="line-btn ghost" data-act="shrevert">Back to preset</button>' : ''}<button class="line-btn ghost" data-act="close">Cancel</button><button class="primary" data-act="shapply">Apply</button></div>`;
}

function buildCanvas() {
  let defs = layers.map(fxDefs).join('') + '<filter id="mtw" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter><filter id="mtk" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/></filter><filter id="mtl" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .2126 .7152 .0722 0 0" result="a"/><feComposite in="a" in2="SourceAlpha" operator="in"/></filter>';
  const srcOf = (l) => { const i = layers.indexOf(l); return l.matte && i > 0 ? layers[i - 1] : null; };
  const mSrc = new Set(layers.map(srcOf).filter(Boolean).map((x) => x.id));
  const W = '<rect x="-6000" y="-6000" width="14000" height="14000" fill="#fff"/>';
  layers.forEach((l) => { const m = srcOf(l); if (!m) return; const u = `<use href="#mg-${m.id}"`;
    defs += `<mask id="mt-${l.id}" maskUnits="userSpaceOnUse" x="-6000" y="-6000" width="14000" height="14000">${l.matte === 'alpha' ? u + ' filter="url(#mtw)"/>' : l.matte === 'alphainv' ? W + u + ' filter="url(#mtk)"/>' : l.matte === 'luma' ? u + '/>' : W + u + ' filter="url(#mtl)"/>'}</mask>`; });
  const hidden = [];
  const body = [...layers].reverse().map((l) => {
    const n = repN(l), sh = shapeSvg(l);
    const copies = Array.from({ length: n }, (_, k) => `<g class="xf" data-i="${n - 1 - k}">${sh}</g>`).join('');
    const bl = l.blend && l.blend !== 'normal' ? ` style="mix-blend-mode:${l.blend}"` : '';
    const mk = srcOf(l) ? ` mask="url(#mt-${l.id})"` : '';
    const gs = `<g data-id="${l.id}"${mSrc.has(l.id) ? ` id="mg-${l.id}"` : ''}${bl}${mk} ${!l.fxOff && l.fx.some((e) => e.on && e.id !== 'postime') ? `filter="url(#fx-${l.id})"` : ''} ${l.type === 'adjust' ? 'pointer-events="none"' : ''}>${copies}</g>`;
    if (mSrc.has(l.id)) { hidden.push(gs); return ''; }
    return mk ? `<g>${gs}</g>` : gs;
  }).join('');
  defs += hidden.join('');
  stage.innerHTML = `<svg viewBox="0 0 1920 1080" role="img" aria-label="Composition: Logo sting, 1920 by 1080"><defs>${defs}<filter id="onB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 .28  0 0 0 0 .32  0 0 0 1 0"/></filter><filter id="onA"><feColorMatrix type="matrix" values="0 0 0 0 .22  0 0 0 0 .86  0 0 0 0 .5  0 0 0 1 0"/></filter></defs><rect width="1920" height="1080" style="fill: ${compBg || 'var(--comp-bg)'}"/>${body}</svg>${guideHtml()}`;
  gEls = {}; xfEls = {};
  mountShaders();
  $$('g[data-id]', stage).forEach((g) => { gEls[g.dataset.id] = g; xfEls[g.dataset.id] = []; $$(':scope > .xf', g).forEach((x) => { xfEls[g.dataset.id][+x.dataset.i] = x; }); });
  updateCanvas();
}
function updateCanvas() {
  const F0 = S.f;
  for (const l of layers) {
    const f = postT(l, F0), t = f / FPS;
    const g = gEls[l.id], xs = xfEls[l.id]; if (!g || !xs) continue;
    const base = l.parent && lay(l.parent) ? relM(l, f, 0) : null;
    xs.forEach((xf, i) => {
      if (!xf) return;
      const q = pose(l, f, i); if (l.rep && l.rep.on) repXf(l, q, i);
      let m = mat(q); if (base) m = base.multiply(m);
      xf.setAttribute('transform', mstr(m));
      xf.setAttribute('opacity', Math.max(0, Math.min(1, q.o / 100)).toFixed(3));
      if (l.type === 'draw') drawXf(l, xf, i, f);
      const tp = xf.querySelector('.tp');
      if (tp) {
        const lo = Math.max(0, Math.min(q.ts, q.te)), hi = Math.min(100, Math.max(q.ts, q.te)), len = +tp.dataset.len || 100;
        if (lo <= .01 && hi >= 99.99) { if (tp.dataset.dash) tp.setAttribute('stroke-dasharray', tp.dataset.dash); else tp.removeAttribute('stroke-dasharray'); if (tp.dataset.doff) tp.setAttribute('stroke-dashoffset', tp.dataset.doff); else tp.removeAttribute('stroke-dashoffset'); tp.style.strokeOpacity = ''; }
        else { tp.setAttribute('stroke-dasharray', `${((hi - lo) / 100 * len).toFixed(2)} ${(len * 2).toFixed(1)}`); tp.setAttribute('stroke-dashoffset', (-lo / 100 * len).toFixed(2)); tp.style.strokeOpacity = hi - lo < .05 ? '0' : ''; }
      }
    });
    const vis = l.vis && (!S.solo.size || S.solo.has(l.id)) && F0 >= (l.inP ?? 0) && F0 < (l.outP ?? DUR);
    g.setAttribute('opacity', vis ? (lightboxOn() && l.id !== S.sel ? .2 : 1) : 0);
    if (l.type === 'shader' && vis) { const rt = renderShader(l, f); const ph = g.querySelector('.shph'); if (ph) ph.style.display = rt.ok ? 'none' : ''; }
    if (l.type === 'text' && (l.anims || []).length) applyTextAnims(l, g, f);
    l.fx.forEach((e, j) => {
      if (e.on && (e.id === 'roughen' || e.id === 'grain' || e.id === 'glitch')) { const tb = stage.querySelector(`#rf-${l.id}-${j}`); if (tb) tb.setAttribute('seed', e.id === 'grain' ? 1 + Math.floor(F0) % 97 : 1 + Math.floor(F0 * (e.speed || 0) / 30) % 997); }
      if (e.on && e.id === 'ripple') { const tb = stage.querySelector(`#rt-${l.id}-${j}`); if (tb) { const bf = rippleBF(e), sp = (e.speed ?? 30) * .12; tb.setAttribute('baseFrequency', `${(bf * (1 + .22 * Math.sin(t * sp))).toFixed(5)} ${(bf * (1 + .22 * Math.cos(t * sp * .83))).toFixed(5)}`); } }
    });
  }
  placeSel();
}
function layoutStage() {
  if (frozen) {
    const v = vp.getBoundingClientRect(), k = S.zoom / frozen.zoom, W = frozen.w * k, H = frozen.h * k;
    const cx = frozen.cx + S.pan[0] - frozen.pan[0], cy = frozen.cy + S.pan[1] - frozen.pan[1];
    Object.assign(stage.style, { width: W + 'px', height: H + 'px', left: (cx - W / 2 - v.left) + 'px', top: (cy - H / 2 - v.top) + 'px' });
    const pct = $('#zoom .pct'); if (pct) pct.textContent = Math.round(W / 1920 * 100) + '%';
    placeSel(); return;
  }
  const w = vp.clientWidth, h = vp.clientHeight;
  const fit = Math.min((w - 56) / 1920, (h - 56) / 1080);
  const sc = Math.max(.05, fit * S.zoom);
  const W = 1920 * sc, H = 1080 * sc;
  Object.assign(stage.style, { width: W + 'px', height: H + 'px', left: ((w - W) / 2 + S.pan[0]) + 'px', top: ((h - H) / 2 + S.pan[1]) + 'px' });
  const pct = $('#zoom .pct'); if (pct) pct.textContent = Math.round(sc * 100) + '%';
  placeSel();
}
function compPt(e) { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1920, (e.clientY - r.top) / r.height * 1080]; }
function selRect() {
  let r = null;
  for (const id of selIds()) {
    const l = lay(id), g = gEls[id]; if (!g || !l || !l.vis) continue;
    const b = g.getBoundingClientRect(); if (b.width < 1 && b.height < 1) continue;
    r = r ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) } : { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
  }
  if (r) { r.width = r.right - r.left; r.height = r.bottom - r.top; }
  return r;
}
// A layer's anchor point in composition space (follows parenting and behaviours).
const anchorAt = (l, f) => world(l, f).transformPoint(new DOMPoint(l.p.ax ? val(l.p.ax, f) : 0, l.p.ay ? val(l.p.ay, f) : 0));
// Convert a composition-space move into the layer's own (parent) space.
function toLocal(l, dx, dy, f = S.f) {
  if (l.parent && lay(l.parent)) { try { const inv = relM(l, f, 0).inverse(); if (isFinite(inv.a)) return [inv.a * dx + inv.c * dy, inv.b * dx + inv.d * dy]; } catch { /* keep comp delta */ } }
  return [dx, dy];
}
function placeSel() {
  const box = $('#selbox'), qb = $('#qbar'), anc = $('#anc'), v = vp.getBoundingClientRect(), dt = isDrawTool(S.tool), r = dt ? null : selRect();
  drawOverlay();
  $('#bbar').classList.toggle('show', dt && !S.playing);
  if (!r) { box.hidden = true; anc.hidden = true; qb.classList.remove('show'); return; }
  const multi = selIds().length > 1, l = lay(S.sel);
  box.hidden = false; box.classList.toggle('multi', multi);
  if (!multi && l) { const sr = stage.getBoundingClientRect(), ap = anchorAt(l, S.f); anc.hidden = false; anc.style.left = (sr.left - v.left + ap.x / 1920 * sr.width) + 'px'; anc.style.top = (sr.top - v.top + ap.y / 1080 * sr.height) + 'px'; } else anc.hidden = true;
  Object.assign(box.style, { left: (r.left - v.left - 4) + 'px', top: (r.top - v.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' });
  const show = isSelTool(S.tool) && !S.playing && !dragging;
  qb.classList.toggle('show', show);
  if (!show) return;
  const qw = qb.offsetWidth, qh = qb.offsetHeight;
  let x = r.left - v.left + r.width / 2 - qw / 2; x = Math.max(8, Math.min(v.width - qw - 8, x));
  let y = r.bottom - v.top + 14;
  if (y + qh > v.height - 8) y = r.top - v.top - qh - 40;
  if (y < 56) y = v.height - qh - 10;
  qb.style.left = x + 'px'; qb.style.top = y + 'px';
}

/* ---------- render: top bar ---------- */
function renderTop() {
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
  const cs = getComputedStyle(n), c = fitName.c || (fitName.c = document.createElement('canvas').getContext('2d'));
  c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  n.style.width = Math.ceil(c.measureText(n.value || ' ').width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 3) + 'px';
}
document.addEventListener('input', (e) => { if (e.target && e.target.id === 'pname') fitName(); if (e.target && e.target.id === 'shcode') S.shDraft = e.target.value; });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitName);
/* undo / redo live at the top of the left strip's lower group; keep their state current whenever history changes */
function syncHist() {
  const u = $('#lstrip [data-act="undo"]'), r = $('#lstrip [data-act="redo"]');
  if (u) { u.disabled = hi <= 0; u.title = 'Undo' + (lastLabel ? ' ' + lastLabel : ''); }
  if (r) r.disabled = hi >= hist.length - 1;
}

/* ---------- render: strips ---------- */
const TOOLS = [['select', 'Select', 'V'], ['hand', 'Hand', 'H'], ['pen', 'Pen', 'P']];
const SHAPES = [['rect', 'Rectangle', 'R'], ['ellipse', 'Ellipse', 'E'], ['polygon', 'Polygon', 'Y'], ['star', 'Star', 'S'], ['line', 'Line', 'L']];
function renderStrips() {
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

/* ---------- render: left panel ---------- */
const TYPE_ICON = { draw: 'brush', text: 'text', ellipse: 'ellipse', ring: 'ellipse', line: 'line', rect: 'rect', star: 'star', polygon: 'polygon', solid: 'solid', null: 'null', adjust: 'adjust', shader: 'shader', comp: 'comp', image: 'media', audio: 'audio' };
const TYPE_NAME = { draw: 'Drawing', text: 'Text', ellipse: 'Ellipse', ring: 'Ring', line: 'Line', rect: 'Rectangle', star: 'Star', polygon: 'Polygon', path: 'Path', audio: 'Audio', solid: 'Solid', null: 'Null', adjust: 'Adjustment', shader: 'Shader', comp: 'Composition', image: 'Image' };
const PRESETS = [
  { id: 'fadeIn', name: 'Fade In', cat: 'In', g: 'fade', d: '0.5 s · opacity' }, { id: 'slideUp', name: 'Slide In', cat: 'In', g: 'slide', d: '0.6 s · position + fade · uses Direction' },
  { id: 'scalePop', name: 'Scale Pop', cat: 'In', g: 'gpop', d: '0.6 s · back-out overshoot' }, { id: 'bounceIn', name: 'Bounce In', cat: 'In', g: 'gpop', d: '0.7 s · scale, settles twice' },
  { id: 'spinIn', name: 'Spin In', cat: 'In', g: 'spin', d: '0.8 s · rotation + fade' }, { id: 'wipe', name: 'Wipe On', cat: 'In', g: 'wipe', d: '0.5 s · scale X' },
  { id: 'draw', name: 'Draw On', cat: 'In', g: 'draw', d: '1 s · trims a stroke from 0 to 100' },
  { id: 'drop', name: 'Drop & Settle', cat: 'Emphasis', g: 'drop', d: '0.8 s · two bounces' }, { id: 'shake', name: 'Shake', cat: 'Emphasis', g: 'shake', d: '0.5 s · jolt · uses Direction' },
  { id: 'wobble', name: 'Wobble', cat: 'Emphasis', g: 'shake', d: '0.7 s · rotation sway' },
  { id: 'pulse', name: 'Pulse', cat: 'Loop', g: 'pulse', d: '1 s · scale 100 to 112' }, { id: 'float', name: 'Float', cat: 'Loop', g: 'float', d: 'Behaviour · gentle sine bob' },
  { id: 'wiggle', name: 'Wiggle', cat: 'Loop', g: 'shake', d: 'Behaviour · random drift' }, { id: 'spinLoop', name: 'Spin Forever', cat: 'Loop', g: 'spin', d: 'Behaviour · 90° per second' },
  { id: 'fadeOut', name: 'Fade Out', cat: 'Out', g: 'out', d: '0.5 s · opacity' }, { id: 'slideOut', name: 'Slide Out', cat: 'Out', g: 'out', d: '0.6 s · position + fade · uses Direction' }, { id: 'scaleOut', name: 'Scale Out', cat: 'Out', g: 'gpop', d: '0.5 s · shrink + fade' },
  { id: 'rippleRings', name: 'Ripple Rings', cat: 'Procedural', g: 'ripple', d: 'Duplicator · 5 staggered echoes' }, { id: 'fanOut', name: 'Fan Out', cat: 'Procedural', g: 'ripple', d: 'Duplicator · 8 around a circle' },
  { id: 'gridPop', name: 'Grid Pop', cat: 'Procedural', g: 'gpop', d: 'Duplicator · 5×3 grid, staggered' }, { id: 'wave', name: 'Wave', cat: 'Procedural', g: 'float', d: 'Duplicator + oscillate, phase per copy' },
];
const myPresets = () => store.get('myPresets', []);
function presetOpts() {
  const seg = (k, items, lbl) => `<div class="seg" role="group" aria-label="${lbl}">${items.map(([v, n]) => `<button data-act="popt" data-k="${k}" data-v="${v}" aria-pressed="${S[k] === v}" aria-label="${{ up: 'From below, moving up', down: 'From above, moving down', left: 'From the right, moving left', right: 'From the left, moving right' }[v] || n}">${n}</button>`).join('')}</div>`;
  const P = { pDur: S.pDur, pAmt: S.pAmt, pStag: S.pStag };
  return grid2([pf(P, 'po', 0, 'pDur', 'Duration', 25, 400, 1, '%', true), pf(P, 'po', 0, 'pAmt', 'Intensity', 10, 300, 1, '%', true)])
    + `<div class="sublbl">Direction of travel</div>` + seg('pDir', [['up', '↑'], ['down', '↓'], ['left', '←'], ['right', '→']], 'Direction')
    + `<div class="sublbl">Start</div>` + seg('pAt', [['head', 'Playhead'], ['in', 'Layer in'], ['out', 'Layer out']], 'Start')
    + grid2([pf(P, 'po', 0, 'pStag', 'Stagger', 0, 30, .1, ' f', true)])
    + `<p class="hint" style="padding:0">Stagger offsets each selected layer. Duration stretches timing, Intensity scales how far things move.</p>
      <button class="line-btn ghost" data-act="popreset" ${S.pDur !== 100 || S.pAmt !== 100 || S.pStag || S.pAt !== 'head' || S.pDir !== 'up' ? '' : 'disabled'}>${ic('reset', 's')}Reset options</button>`;
}
function presetsView() {
  const l = S.sel && lay(S.sel);
  const head = `<span class="chip-dot" style="background:rgb(var(--acc))"></span><div><h2>Presets</h2><div class="sub">Motion presets</div></div>`;
  const cats = ['All', 'In', 'Out', 'Emphasis', 'Loop', 'Procedural', 'Mine'], q = S.q.toLowerCase();
  const list = PRESETS.filter((p) => (S.cat === 'All' || p.cat === S.cat) && p.name.toLowerCase().includes(q));
  const mine = S.cat === 'All' || S.cat === 'Mine' ? myPresets().filter((p) => p.name.toLowerCase().includes(q)) : [];
  const body = `<label class="search">${ic('search', 's')}<input id="pq" placeholder="Search presets" aria-label="Search presets" value="${esc(S.q)}"></label>
      <div class="chips" role="group" aria-label="Preset category">${cats.map((c) => `<button class="chip ${S.cat === c ? 'on' : ''}" data-act="cat" data-v="${c}" aria-pressed="${S.cat === c}">${c}</button>`).join('')}</div>
      ${sec('popt', 'Apply options', presetOpts(), S.pDur !== 100 || S.pAmt !== 100 || S.pStag || S.pAt !== 'head' ? '<span class="count">custom</span>' : '')}
      <p class="hint">${l ? `Applies to <b style="color:var(--text)">${selIds().length > 1 ? selIds().length + ' layers' : esc(l.name)}</b> ${S.pAt === 'head' ? 'at ' + tc(S.f) : S.pAt === 'in' ? 'at the layer start' : 'ending at the layer end'}.` : 'Select a layer to apply a preset.'}</p>
      ${list.map((p) => `<button class="prow" data-act="preset" data-v="${p.id}" ${l ? '' : 'disabled'}><span class="glyph ${p.g}"><i></i></span><span>${p.name}<small>${p.d}</small></span></button>`).join('')}
      ${mine.map((p) => `<div class="prow2"><button class="prow" data-act="mypreset" data-v="${p.id}" ${l ? '' : 'disabled'}><span class="glyph gpop"><i></i></span><span>${esc(p.name)}<small>Saved by you</small></span></button><button class="ib" data-act="mypdel" data-v="${p.id}" aria-label="Delete ${esc(p.name)}">${ic('trash', 's')}</button></div>`).join('')}
      ${list.length + mine.length ? '' : '<p class="hint">No presets match.</p>'}
      <div style="padding:10px 12px 0;display:flex;gap:6px"><button class="line-btn" style="flex:1" ${l ? '' : 'disabled'} data-act="psave">${ic('plus', 's')}Save selection as preset</button></div>`;
  return { head, body };
}
function renderLeft() {
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

/* ---------- render: right panel ---------- */
function fldBox(l, p, axis) {
  const m = PROPS[p], v = val(l.p[p], S.f);
  return `<div class="fld" role="slider" tabindex="0" aria-label="${m.label}" aria-valuemin="${m.min}" aria-valuemax="${m.max}" aria-valuenow="${Math.round(v)}" data-l="${l.id}" data-p="${p}">${axis ? `<span class="axg" aria-hidden="true">${axis}</span>` : ''}<span class="v tc">${fmt(v, m)}</span></div>`;
}
function grpState(l, g) {
  const ps = GROUPS[g].ps, anim = ps.some((p) => animated(l.p[p])), on = anim && ps.some((p) => keyAt(l.p[p], S.f) >= 0);
  const ts = [...new Set(ps.flatMap((p) => animated(l.p[p]) ? l.p[p].keys.map((k) => k.t) : []))].sort((a, b) => a - b);
  return { anim, on, prev: ts.filter((t) => t < S.f - .5).pop(), next: ts.find((t) => t > S.f + .5) };
}
const kdLabel = (n, st2) => st2.anim ? (st2.on ? `Remove ${n} keyframe` : `Add ${n} keyframe`) : `Animate ${n}`;
function propRow(l, g) {
  const G = GROUPS[g], st2 = grpState(l, g);
  const extra = g === 'anchor' ? `<button class="lk" data-act="anchorpick" aria-haspopup="dialog" aria-label="Anchor point presets" title="Move the anchor to a corner, edge or the centre">Presets</button>` : '';
  return `<div class="prop ${st2.anim ? 'is-anim' : ''}" data-g="${g}"><div class="plbl"><span>${G.label}</span>${extra}</div><div class="pv">${G.ps.map((p, i) => fldBox(l, p, G.axes && G.axes[i])).join('')}</div>
    <div class="kc" role="group" aria-label="${G.label} keyframes">
      <button data-act="kprev" data-g="${g}" aria-label="Previous ${G.label} keyframe" title="Previous keyframe" ${st2.prev == null ? 'disabled' : ''}>${ic('left', 'xs')}</button>
      <button class="kd ${st2.anim ? 'anim' : ''} ${st2.on ? 'onkey' : ''}" data-act="kgroup" data-kd="${g}" data-g="${g}" aria-label="${kdLabel(G.label, st2)}" title="Tap: add or remove keyframe · hold: remove all animation">${ic('diamond')}</button>
      <button data-act="knext" data-g="${g}" aria-label="Next ${G.label} keyframe" title="Next keyframe" ${st2.next == null ? 'disabled' : ''}>${ic('right', 'xs')}</button>
    </div></div>`;
}
function clearAnim(l, g) {
  const G = GROUPS[g]; let n = 0;
  G.ps.forEach((p) => { const pr = l.p[p]; if (animated(pr)) { pr.v = val(pr, S.f); delete pr.keys; n++; } });
  if (!n) return;
  S.keys = S.keys.filter((k) => !(k.l === l.id && G.ps.includes(k.p)));
  commit('Remove animation'); updateCanvas(); renderRight(); renderTL(); renderTop(); toast(`Removed ${G.label} animation`, true);
}
const fmt = (v, m) => { const r = Math.round(v * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + (m.u || ''); };
const tc = (f) => `00:${String(Math.floor(f / FPS)).padStart(2, '0')}:${String(Math.floor(f % FPS)).padStart(2, '0')}`;
function sec(id, title, inner, extra = '') {
  const open = !S.collapsed.has(id);
  return `<div class="sec"><button class="sec-h" data-act="sec" data-v="${id}" aria-expanded="${open}">${title}${extra}${ic('down', 'xs chev')}</button>${open ? `<div class="sec-b">${inner}</div>` : ''}</div>`;
}
let keyClip = null;
function copyKeys() {
  const ks = S.keys.map((k) => { const l = lay(k.l), pr = l && l.p[k.p], key = pr && pr.keys && pr.keys[k.i]; return key ? { p: k.p, key: { ...key } } : null; }).filter(Boolean);
  if (!ks.length) return false;
  const t0 = Math.min(...ks.map((o) => o.key.t)); keyClip = ks.map((o) => ({ p: o.p, key: { ...o.key, t: o.key.t - t0 } }));
  renderTL(); toast(`Copied ${ks.length} keyframe${ks.length > 1 ? 's' : ''}`); return true;
}
function pasteKeys() {
  const ls = selIds().map(lay).filter((l) => l && !l.lock); if (!keyClip || !ls.length) return false;
  const at = Math.round(S.f), added = [];
  ls.forEach((l) => keyClip.forEach((o) => {
    const t = at + o.key.t; if (t > DUR - 1) return;
    let pr = l.p[o.p]; if (!pr) return;
    if (!pr.keys) { pr.keys = [{ t: 0, v: pr.v, e: 'ease' }]; delete pr.v; }
    const j = pr.keys.findIndex((k) => Math.round(k.t) === t); const nk = { ...o.key, t };
    if (j >= 0) pr.keys[j] = nk; else pr.keys.push(nk);
    pr.keys.sort((a, b) => a.t - b.t); added.push({ l: l.id, p: o.p, i: pr.keys.indexOf(nk) });
  }));
  if (!added.length) return false;
  S.keys = added; commit('Paste keyframes'); updateCanvas(); renderAll(); toast(`Pasted ${added.length} keyframe${added.length > 1 ? 's' : ''} at ${tc(at)}`, true); return true;
}
function selectedKeyObjs() { return S.keys.map((k) => { const l = lay(k.l); const pr = l && l.p[k.p]; return pr && pr.keys && pr.keys[k.i] ? pr.keys[k.i] : null; }).filter(Boolean); }
const EZ_SHORT = { out: 'Out', in: 'In', inout: 'In-out', back: 'Back', anticip: 'Antic.', bounce: 'Over' };
function easingBlock(compact) {
  const ks = selectedKeyObjs(), l = S.sel && lay(S.sel), lk = l ? TF.filter((p) => animated(l.p[p])).reduce((n, p) => n + l.p[p].keys.length, 0) : 0;
  if (!ks.length) return `<p class="hint" style="padding:0">Tap keyframes in the timeline to ease them. Hold a keyframe for quick presets.</p>`
    + `<button class="line-btn" data-act="keysall" ${lk ? '' : 'disabled'}>${ic('selall', 's')}Select all keyframes on ${l ? esc(l.name) : 'layer'}</button>`;
  const a = earr(ks[0]), cur = Array.isArray(ks[0].e) ? null : ks[0].e, hold = cur === 'hold';
  const pts = (x, y) => [12 + x * 256, 112 - y * 92];
  const [p0, p1, p2, p3] = [pts(0, 0), pts(a[0], a[1]), pts(a[2], a[3]), pts(1, 1)];
  const mixed = ks.some((k) => JSON.stringify(k.e) !== JSON.stringify(ks[0].e));
  return `<div class="ease-card">
    <svg class="curve" id="curve" viewBox="0 0 280 132" role="img" aria-label="Easing curve ${ename(ks[0])}" style="${hold ? 'opacity:.4;pointer-events:none' : ''}">
      <path class="grid" d="M12 20H268M12 112H268M12 20V112M268 20V112M140 20V112"/>
      ${hold ? `<path class="c" d="M${p0} H268 V20"/>` : `<line class="arm" x1="${p0[0]}" y1="${p0[1]}" x2="${p1[0]}" y2="${p1[1]}"/><line class="arm" x1="${p3[0]}" y1="${p3[1]}" x2="${p2[0]}" y2="${p2[1]}"/>
      <path class="c" d="M${p0} C${p1} ${p2} ${p3}"/>
      <circle class="hz" data-h="1" cx="${p1[0]}" cy="${p1[1]}" r="18"/><circle class="h" data-h="1" cx="${p1[0]}" cy="${p1[1]}" r="6.5"/>
      <circle class="hz" data-h="2" cx="${p2[0]}" cy="${p2[1]}" r="18"/><circle class="h" data-h="2" cx="${p2[0]}" cy="${p2[1]}" r="6.5"/>`}
    </svg>
    <div class="ezn" role="group" aria-label="Bezier values">${['X1', 'Y1', 'X2', 'Y2'].map((n, i) => `<label>${n}<input class="tc" data-ezv="${i}" inputmode="decimal" value="${a[i].toFixed(2)}" aria-label="Curve ${n}" ${hold ? 'disabled' : ''}></label>`).join('')}</div>
    <div class="sublbl">Presets</div>
    <div class="eases all" role="group" aria-label="Ease presets">${EASE_ROW.map((e) => `<button class="ez ${cur === e ? 'on' : ''}" data-act="ease" data-v="${e}" aria-pressed="${cur === e}" title="${EASE_NAMES[e]}" aria-label="${EASE_NAMES[e]}">${easeGlyph(EASES[e])}${EZ_SHORT[e] || EASE_NAMES[e]}</button>`).join('')}</div>
    <div class="three"><button class="line-btn" data-act="ezcopy" title="Copy this curve">${ic('copy', 's')}Copy</button><button class="line-btn" data-act="ezpaste" ${S.easeClip ? '' : 'disabled'} title="Paste the copied curve">Paste</button><button class="line-btn" data-act="ezrev" ${hold ? 'disabled' : ''} title="Mirror the curve (ease in ↔ ease out)">${ic('arrowH', 's')}Mirror</button></div>
    <button class="line-btn" data-act="keysall" ${lk > ks.length ? '' : 'disabled'}>${ic('selall', 's')}Select all keyframes (${lk})</button>
    ${compact ? '' : `<div class="kv"><span>${ks.length} keyframe${ks.length > 1 ? 's' : ''} · ${mixed ? 'Mixed' : ename(ks[0])}</span><span class="tc">${hold ? 'hold' : a.map((n) => n.toFixed(2)).join(', ')}</span></div>
    <p class="hint" style="padding:0">Hold keeps the value until the next keyframe, then jumps.</p>`}
  </div>`;
}
/* ---------- inspector building blocks ---------- */
const fmtv = (v, u) => { const r = Math.round((+v || 0) * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + (u || ''); };
// Plain (non-keyframed) parameter: o = 'lp' layer · 'fx' effect · 'rep' duplicator · 'mod' behaviour
function pf(obj, o, idx, key, label, min, max, step, u = '', int = false) {
  return `<div class="fld" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${Math.round(obj[key] ?? 0)}" data-o="${o}" data-i="${idx}" data-k="${key}" data-min="${min}" data-max="${max}" data-step="${step}" data-u="${u}" data-int="${int ? 1 : 0}"><span class="lb">${label}</span><span class="v tc">${fmtv(obj[key], u)}</span></div>`;
}
const grid2 = (items) => { const out = []; for (let i = 0; i < items.length; i += 2) out.push(`<div class="pair">${items[i]}${items[i + 1] || '<span></span>'}</div>`); return out.join(''); };
const selH = (name, idx, opts, cur, label) => `<select class="sel" data-sel="${name}" data-i="${idx}" aria-label="${label}">${opts.map(([v, n]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
const BLENDS = [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['soft-light', 'Soft light'], ['difference', 'Difference'], ['plus-lighter', 'Add']];
const isDesc = (cand, l) => { let c = cand, n = 0; while (c && n++ < 10) { if (c.parent === l.id) return true; c = lay(c.parent); } return false; };

function fxView(l) {
  const n = l.fx.length, nOn = l.fx.filter((e) => e.on).length;
  const head = `<span class="chip-dot" style="background:${l.hue}"></span><div style="min-width:0"><h2 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.name)}</h2><div class="sub">${n ? `${nOn} of ${n} effect${n === 1 ? '' : 's'} on` : 'No effects'}</div></div><span class="spacer"></span><button class="ib" data-act="addfx" aria-label="Add effect" aria-haspopup="menu">${ic('plus', 's')}</button>`;
  const rows = l.fx.map((e, i) => {
    const D = FXDEF[e.id] || FXDEF.glow;
    D.ps.forEach(([k, , , , , , def]) => { if (e[k] === undefined) e[k] = def; });
    if (e.mix === undefined) e.mix = 100;
    const shut = !!e.shut;
    return `<div class="fx ${shut ? 'shut' : ''} ${e.on ? '' : 'off'}"><div class="fx-h"><button class="tog" data-act="fxon" data-v="${i}" aria-pressed="${e.on}" aria-label="${e.on ? 'Disable' : 'Enable'} ${e.name}"></button>
      <button class="nmb" data-act="fxshut" data-v="${i}" aria-expanded="${!shut}" aria-label="${shut ? 'Expand' : 'Collapse'} ${e.name}">${ic('down', 'xs chev')}<span>${e.name}</span></button>
      <button class="ib" data-act="fxreset" data-v="${i}" aria-label="Reset ${e.name}" title="Reset to defaults">${ic('reset', 's')}</button>
      <button class="ib" data-act="fxmenu" data-v="${i}" aria-label="${e.name} options" aria-haspopup="menu" title="More">${ic('more', 's')}</button></div>
      ${shut ? '' : grid2(D.ps.map(([k, lb, mn, mx, sp, u]) => pf(e, 'fx', i, k, lb, mn, mx, sp, u)).concat(e.id === 'postime' ? [] : [pf(e, 'fx', i, 'mix', 'Mix', 0, 100, .5, '%', true)]))}</div>`;
  }).join('');
  const bar = n ? `<div class="fxbar"><span>Bypass all</span><button class="tog" data-act="fxbypass" aria-pressed="${!!l.fxOff}" aria-label="Bypass all effects"></button><span class="spacer"></span><button class="line-btn ghost" data-act="fxfold" style="min-height:30px">${l.fx.every((e) => e.shut) ? 'Expand all' : 'Collapse all'}</button></div>` : '';
  const body = bar + (l.fxOff && n ? '<p class="hint" style="padding-top:0;color:var(--acc-text)">All effects are bypassed. The settings are kept.</p>' : '') + (rows || `<p class="hint">No effects yet. Add Glow, Ripple distort, Hue shift and more with the plus button. Effects stack top to bottom.</p>`)
    + `${n > 1 ? '<p class="hint">Hold an effect, then drag to reorder, or use ⋯ to move it. Effects apply top to bottom. Mix blends each effect with what is beneath it.</p>' : ''}<div style="padding:10px 14px;display:grid;gap:6px"><button class="line-btn" data-act="addfx" style="justify-content:center">${ic('plus', 's')}Add effect</button>${n || fxClip ? `<div class="two-btn"><button class="line-btn" data-act="fxcopy" ${n ? '' : 'disabled'} title="Copy this effect stack">${ic('copy', 's')}Copy stack</button><button class="line-btn" data-act="fxpaste" ${fxClip ? '' : 'disabled'} title="Paste copied effects onto the selected layers">Paste stack</button></div>` : ''}</div>`;
  return { head, body };
}
let fxClip = null;

function normShape(l) {
  const D = { rect: { w: 280, h: 180, cr: 24 }, star: { n: 5, ir: 43 }, polygon: { n: 5 }, line: { w: 420 } }[l.type];
  if (D) for (const k in D) if (l[k] === undefined) l[k] = D[k];
  if (STROKABLE.includes(l.type) && l.sw === undefined) l.sw = 0;
  if (l.fop === undefined) l.fop = 100; if (l.sop === undefined) l.sop = 100; if (l.grad_r === undefined) l.grad_r = 70; if (l.wsp === undefined) l.wsp = 0;
  if (l.dash > 0 && l.dgap === undefined) l.dgap = Math.max(1, Math.round(l.dash * 1.2)); if (l.doff === undefined) l.doff = 0;
  if ((l.type === 'ring' || l.type === 'line') && l.sw === undefined) l.sw = l.type === 'ring' ? 14 : 12;
}
function repHtml(l) {
  const R = l.rep;
  if (!R) return `<p class="hint" style="padding:0">Make many copies of this layer: in a line, a circle or a grid. Each copy can fade, scale and start later (stagger) for ripple and burst effects.</p><button class="line-btn" data-act="repon">${ic('copy', 's')}Add duplicator</button>`;
  let h = `<div class="kv"><span>Duplicator</span><button class="tog" data-act="repon" aria-pressed="${R.on}" aria-label="Duplicator"></button></div>`;
  if (!R.on) return h;
  const it = [pf(R, 'rep', 0, 'count', 'Count', 1, 60, .12, '', true)];
  if (R.mode === 'linear') it.push(pf(R, 'rep', 0, 'dx', 'Offset X', -600, 600, 1), pf(R, 'rep', 0, 'dy', 'Offset Y', -600, 600, 1), pf(R, 'rep', 0, 'rot', 'Rotate step', -180, 180, .3, '°'), pf(R, 'rep', 0, 'sc', 'Scale step', -50, 150, .4, '%'));
  else if (R.mode === 'radial') it.push(pf(R, 'rep', 0, 'rad', 'Radius', 0, 900, 1.5), pf(R, 'rep', 0, 'rot', 'Rotate step', -180, 180, .3, '°'), pf(R, 'rep', 0, 'sc', 'Scale step', -50, 150, .4, '%'));
  else it.push(pf(R, 'rep', 0, 'cols', 'Columns', 1, 20, .1, '', true), pf(R, 'rep', 0, 'dx', 'Spacing X', 0, 500, 1), pf(R, 'rep', 0, 'dy', 'Spacing Y', 0, 500, 1), pf(R, 'rep', 0, 'sc', 'Scale step', -50, 150, .4, '%'));
  it.push(pf(R, 'rep', 0, 'fade', 'Fade', 0, 90, .4, '%'), pf(R, 'rep', 0, 'stag', 'Stagger', 0, 30, .06, ' f'));
  h += selH('repmode', 0, [['linear', 'Line'], ['radial', 'Circle'], ['grid', 'Grid']], R.mode, 'Duplicator layout') + grid2(it);
  if (R.mode === 'radial') h += `<div class="kv"><span>Rotate to follow circle</span><button class="tog" data-act="repalign" aria-pressed="${!!R.align}" aria-label="Align to circle"></button></div>`;
  return h + `<p class="hint" style="padding:0">Stagger delays each copy's animation by this many frames.</p>`;
}
const MOD_NAME = { wiggle: 'Wiggle', osc: 'Oscillate', spin: 'Spin', bounce: 'Bounce', pulse: 'Pulse', orbit: 'Orbit', jitter: 'Jitter', drift: 'Drift' };
const MOD_NOTGT = ['spin', 'orbit'], MOD_NOFREQ = ['spin', 'drift'];
const MOD_TGT = [['x', 'Position X'], ['y', 'Position Y'], ['rot', 'Rotation'], ['scale', 'Scale'], ['op', 'Opacity']];
function behHtml(l) {
  const mods = l.mods || [], rep = l.rep && l.rep.on;
  const list = mods.map((m, i) => {
    const it = [pf(m, 'mod', i, 'amp', m.kind === 'spin' ? 'Deg / sec' : m.kind === 'drift' ? 'Per second' : m.kind === 'orbit' ? 'Radius' : m.kind === 'bounce' ? 'Overshoot' : 'Amount', m.kind === 'spin' ? -720 : -400, m.kind === 'spin' ? 720 : 400, m.kind === 'spin' ? 1 : .5)];
    if (!MOD_NOFREQ.includes(m.kind)) it.push(pf(m, 'mod', i, 'freq', m.kind === 'pulse' ? 'Beats / sec' : 'Speed', 0, 10, .02, ' Hz'));
    if (m.kind === 'bounce' || m.kind === 'pulse') it.push(pf(m, 'mod', i, 'dec', m.kind === 'bounce' ? 'Settle' : 'Sharpness', 0, 20, .05));
    if (m.kind === 'orbit') it.push(pf(m, 'mod', i, 'ell', 'Ellipse', 0, 200, .5, '%'));
    if (m.kind === 'wiggle' || m.kind === 'jitter') it.push(pf(m, 'mod', i, 'seed', 'Seed', 1, 99, .1, '', true));
    if (rep && m.kind !== 'spin') it.push(pf(m, 'mod', i, 'ph', 'Offset / copy', -1, 1, .01));
    return `<div class="mod"><div class="fx-h"><button class="tog" data-act="modon" data-v="${i}" aria-pressed="${m.on}" aria-label="${m.on ? 'Disable' : 'Enable'} ${MOD_NAME[m.kind]}"></button>${MOD_NAME[m.kind]}<span class="spacer"></span><button class="ib" data-act="moddel" data-v="${i}" aria-label="Remove ${MOD_NAME[m.kind]}">${ic('trash', 's')}</button></div>${MOD_NOTGT.includes(m.kind) ? '' : selH('modtgt', i, MOD_TGT, m.tgt, 'Affects')}${grid2(it)}</div>`;
  }).join('');
  return (list || `<p class="hint" style="padding:0">Behaviours move a layer procedurally, with no keyframes: wiggle, jitter, oscillate, bounce in, pulse to a beat, orbit, drift or spin.</p>`)
    + `<div class="three">${['wiggle', 'jitter', 'osc', 'bounce', 'pulse', 'orbit', 'drift', 'spin'].map((k) => `<button class="line-btn" data-act="modadd" data-v="${k}">${ic('plus', 'xs')}${MOD_NAME[k]}</button>`).join('')}</div>`;
}
const mTag = (l) => { const i = layers.indexOf(l), b = layers[i + 1]; return l.matte && i > 0 ? '<small class="mtag">matted</small>' : b && b.matte ? '<small class="mtag">matte</small>' : ''; };
function advHtml(l) {
  if (l.inP == null) l.inP = 0; if (l.outP == null) l.outP = DUR;
  const timing = `<div class="sublbl" style="padding-top:0">Timing</div>` + grid2([pf(l, 'lp', 0, 'inP', 'In', 0, DUR - 1, .15, ' f', true), pf(l, 'lp', 0, 'outP', 'Out', 1, DUR, .15, ' f', true)])
    + `<div class="two-btn"><button class="line-btn" data-act="trimin" title="Start the layer at the playhead" aria-label="Set layer in point to the playhead">${ic('trimS', 's')}Set in</button><button class="line-btn" data-act="trimout" title="End the layer at the playhead" aria-label="Set layer out point to the playhead">${ic('trimE', 's')}Set out</button></div>
      <div class="kv"><span>Length</span><b class="tc">${tc(Math.max(0, l.outP - l.inP))}</b></div><div class="sublbl">Parent & matte</div>`;
  const opts = [['', 'None'], ...layers.filter((c) => c.id !== l.id && !isDesc(c, l)).map((c) => [c.id, c.name])];
  return timing + `<div class="kv"><span>Parent</span>${selH('parent', 0, opts, l.parent || '', 'Parent layer')}</div>
    <div class="kv"><span>Track matte</span>${selH('matte', 0, [['', 'None'], ['alpha', 'Alpha matte'], ['alphainv', 'Alpha inverted'], ['luma', 'Luma matte'], ['lumainv', 'Luma inverted']], layers.indexOf(l) > 0 ? (l.matte || '') : '', 'Track matte')}</div>
    <p class="hint" style="padding:0">${layers.indexOf(l) > 0 ? `Uses <b>${esc(layers[layers.indexOf(l) - 1].name)}</b>, the layer above, as the matte. That layer is hidden while it is used.` : 'Move a layer above this one to use it as a matte.'}</p>
    <p class="hint" style="padding:0">A child follows its parent's position, rotation and scale from the moment it is parented.</p>`;
}
function gradUi(l) {
  const cv = l.hue2 || '#ff5ea8';
  return `<div class="rowt"><span class="hint" style="padding:0">Gradient fill</span><button class="tog" data-act="gradon" aria-pressed="${!!l.grad}" aria-label="Gradient fill"></button></div>`
    + (l.grad ? `<div class="seg" role="group" aria-label="Gradient type">${[['linear', 'Linear'], ['radial', 'Radial']].map(([v, n]) => `<button data-act="gtype" data-v="${v}" aria-pressed="${(l.gtype || 'linear') === v}">${n}</button>`).join('')}</div>`
      + `<button class="cchip" data-act="colour" data-key="hue2" aria-haspopup="dialog" aria-label="Gradient end colour ${cv}"><span class="cc" style="background:${cv}"></span><span>To</span><span class="tc hex">${String(cv).toUpperCase()}</span></button>`.replace(/^/, '<div class="rowt">') + `<button class="ib" data-act="gswap" aria-label="Swap gradient colours" title="Swap colours">${ic('arrowH', 's')}</button></div>`
      + grid2([l.gtype === 'radial' ? pf(l, 'lp', 0, 'grad_r', 'Radius', 10, 150, .5, '%') : pf(l, 'lp', 0, 'gang', 'Angle', 0, 360, 1, '°')]) : '');
}
function propsView(l) {
  normShape(l);
  const multi = selIds().length > 1;
  const htog = (act, on, icn, lbl) => `<button class="ib ${on ? 'on' : ''}" data-act="${act}" data-v="${l.id}" aria-pressed="${on}" aria-label="${lbl}" title="${lbl}">${ic(icn, 's')}</button>`;
  const head = `<span class="chip-dot" style="background:${l.hue}"></span><div class="idn"><span class="ity" ${multi ? 'title="Edits apply to every selected layer"' : ''}>${multi ? selIds().length + ' layers · editing all' : (TYPE_NAME[l.type] || 'Layer') + ' layer'}</span><input class="lname" id="lname" value="${esc(l.name)}" aria-label="Layer name" placeholder="Layer name" enterkeyhint="done"></div>`
    + htog('vis', !l.vis, l.vis ? 'eye' : 'eyeoff', l.vis ? 'Hide layer' : 'Show layer')
    + htog('lock', !!l.lock, l.lock ? 'lock' : 'unlock', l.lock ? 'Unlock layer' : 'Lock layer')
    + htog('solo', S.solo.has(l.id), 'solo', S.solo.has(l.id) ? 'Stop soloing' : 'Solo: show only this layer');
  if (l.type === 'audio') {
    const a = aud[l.id];
    return { head, body: sec('app', 'Audio', grid2([pf(l, 'lp', 0, 'vol', 'Volume', 0, 100, .4, '%', true)])
        + `<div class="rowt"><span class="hint" style="padding:0">Mute</span><button class="tog" data-act="amute" aria-pressed="${!!l.mute}" aria-label="Mute"></button></div>`
        + `<div class="kv"><span>Length</span><b class="tc">${tc(Math.round((l.adur || 0) * FPS))}</b></div>`
        + (a ? '' : '<p class="hint" style="padding:0;color:var(--danger)">The audio file is not loaded. Import it again after a reload.</p>')
        + '<p class="hint" style="padding:0">Plays in the preview. Drag the clip in the timeline to move it, or its ends to trim. Exports are silent.</p>') };
  }
  // Transform: geometry only. Opacity moves to Layer; trim paths move to Stroke.
  const tf = ['pos', 'scale', 'rot', 'anchor'].map((g) => propRow(l, g)).join('')
    + `<div class="sublbl">Align to ${multi ? 'selection' : 'composition'}</div><div class="al6" role="group" aria-label="Align">${[['left', 'Left', 'alL'], ['hcenter', 'Centre', 'alC'], ['right', 'Right', 'alR'], ['top', 'Top', 'alT'], ['vcenter', 'Middle', 'alM'], ['bottom', 'Bottom', 'alB']].map(([v, nm, icn]) => `<button data-act="alignto" data-v="${v}" aria-label="Align ${nm.toLowerCase()}" title="Align ${nm.toLowerCase()}">${ic(icn, 's')}</button>`).join('')}</div>`
    + `<div class="three"><button class="line-btn" data-act="flipx" aria-pressed="${!!l.flipX}" style="${l.flipX ? 'color:var(--acc-text);box-shadow:var(--lit);background:var(--lit-bg)' : ''}" title="Flip horizontal">${ic('flipH', 's')}Flip H</button><button class="line-btn" data-act="flipy" aria-pressed="${!!l.flipY}" style="${l.flipY ? 'color:var(--acc-text);box-shadow:var(--lit);background:var(--lit-bg)' : ''}" title="Flip vertical">${ic('flipV', 's')}Flip V</button><button class="line-btn" data-act="tfreset" title="Reset position, scale, rotation and opacity">${ic('reset', 's')}Reset</button></div>`;
  const layerSec = propRow(l, 'op') + `<div class="kv"><span>Blend mode</span>${selH('blend', 0, BLENDS, l.blend || 'normal', 'Blend mode')}</div>`;
  const chip = (lbl, key) => { const cv = l[key] ?? '#ffffff'; return `<button class="cchip" data-act="colour" data-key="${key}" aria-haspopup="dialog" aria-label="${lbl} colour ${cv}"><span class="cc" style="background:${cv}"></span><span>${lbl}</span><span class="tc hex">${String(cv).toUpperCase()}</span></button>`; };
  const grpHead = (lbl, act, on) => `<div class="kv sh"><span class="sublbl">${lbl}</span><button class="tog" data-act="${act}" aria-pressed="${on}" aria-label="${lbl} on"></button></div>`;
  const capJoin = () => [selH('cap', 0, [['round', 'Round cap'], ['butt', 'Flat cap'], ['square', 'Square cap']], l.cap || 'round', 'Line cap'), selH('join', 0, [['round', 'Round join'], ['miter', 'Sharp join'], ['bevel', 'Bevel join']], l.join || 'round', 'Corner join')];
  const dashF = () => [pf(l, 'lp', 0, 'dash', 'Dash', 0, 120, .4, '')].concat(l.dash > 0 ? [pf(l, 'lp', 0, 'dgap', 'Gap', 1, 200, .4), pf(l, 'lp', 0, 'doff', 'Offset', -500, 500, 1)] : []);
  const trimRow = () => (hasStroke(l) ? propRow(l, 'trim') : '');
  let look, title = 'Appearance', paint = '', paintTitle = '';
  if (l.type === 'text') {
    if (l.lead === undefined) l.lead = 120;
    const WT = fontWeights(l).map((w) => [w, WNAME[w]]);
    const tb = (k, v, inner, lbl, on) => `<button data-act="tset" data-k="${k}" data-v="${v}" aria-label="${lbl}" title="${lbl}" aria-pressed="${on}" style="display:inline-flex;align-items:center;justify-content:center">${inner}</button>`;
    const al = l.align || 'center', tcs = l.tcase || 'none';
    title = 'Text';
    look = `<textarea class="txt" id="ltext" rows="2" aria-label="Text content">${esc(l.text)}</textarea>`
      + `<div class="pair fw">${selH('font', 0, FONTS.map((f) => [f[0], f[1]]), l.font || 'sys', 'Font')}${selH('tweight', 0, WT, snapW(l), 'Weight')}</div>`
      + `<div class="sublbl">Size & spacing</div>`
      + grid2([pf(l, 'lp', 0, 'size', 'Size', 8, 600, .6, '', true), pf(l, 'lp', 0, 'lead', 'Leading', 60, 300, .5, '%'), pf(l, 'lp', 0, 'track', 'Tracking', -30, 100, .2), pf(l, 'lp', 0, 'wsp', 'Word space', -40, 200, .3)])
      + `<div class="sublbl">Paragraph</div>`
      + `<div class="pair"><div class="seg" role="group" aria-label="Alignment">${[['left', 'alignL', 'Align left'], ['center', 'alignC', 'Align centre'], ['right', 'alignR', 'Align right']].map(([v, i, n]) => tb('align', v, ic(i, 's'), n, al === v)).join('')}</div>`
      + `<div class="seg" role="group" aria-label="Style">${tb('italic', '1', ic('italic', 's'), 'Italic', !!l.italic)}${tb('under', '1', ic('underline', 's'), 'Underline', !!l.under)}${tb('strike', '1', ic('strike', 's'), 'Strikethrough', !!l.strike)}</div></div>`
      + `<div class="seg" role="group" aria-label="Capitalisation">${[['none', 'Aa', 'As typed'], ['upper', 'AA', 'All caps'], ['lower', 'aa', 'Lowercase'], ['title', 'Tt', 'Title case']].map(([v, s, n]) => tb('tcase', v, s, n, tcs === v)).join('')}</div>`;
    paintTitle = 'Fill & outline';
    paint = `<div class="sublbl">Fill</div><div class="fillrow">${chip('Fill', 'hue')}${pf(l, 'lp', 0, 'fop', 'Opacity', 0, 100, .5, '%', true)}</div>` + gradUi(l)
      + `<div class="sublbl">Outline</div>` + (l.tsw > 0 ? `<div class="fillrow">${chip('Outline', 'tsc')}${pf(l, 'lp', 0, 'tsw', 'Width', 0, 40, .2)}</div>` : grid2([pf(l, 'lp', 0, 'tsw', 'Width', 0, 40, .2)]));
  } else if (['ellipse', 'ring', 'rect', 'star', 'polygon', 'line'].includes(l.type)) {
    const P = { rect: [['w', 'Width', 10, 1800, 1.5], ['h', 'Height', 10, 1200, 1.5], ['cr', 'Corner', 0, 200, .5]], ellipse: [['r', 'Radius', 2, 600, 1]], ring: [['r', 'Radius', 2, 600, 1]], star: [['n', 'Points', 3, 12, .08, '', 1], ['ir', 'Inner', 5, 95, .3, '%']], polygon: [['n', 'Sides', 3, 12, .08, '', 1]], line: [['w', 'Length', 20, 1800, 1.5]] }[l.type];
    const strokeOnly = l.type === 'ring' || l.type === 'line';
    if (!l.sc) l.sc = '#ffffff';
    title = 'Shape';
    look = grid2(P.map(([k, lb, mn, mx, sp, u, int]) => pf(l, 'lp', 0, k, lb, mn, mx, sp, u || '', !!int)));
    paintTitle = strokeOnly ? 'Stroke' : 'Fill & stroke';
    const strokeBody = `<div class="fillrow">${chip('Stroke', strokeOnly ? 'hue' : 'sc')}${pf(l, 'lp', 0, 'sop', 'Opacity', 0, 100, .5, '%', true)}</div>`
      + grid2([pf(l, 'lp', 0, 'sw', 'Width', 0, 80, .2)].concat(dashF(), strokeOnly ? [] : capJoin())) + trimRow();
    paint = strokeOnly ? strokeBody
      : grpHead('Fill', 'fillon', l.fill !== false) + (l.fill !== false ? `<div class="fillrow">${chip('Fill', 'hue')}${pf(l, 'lp', 0, 'fop', 'Opacity', 0, 100, .5, '%', true)}</div>` + gradUi(l) : '')
        + `<div class="sublbl">Stroke</div>` + strokeBody;
  } else if (l.type === 'path') {
    const tg = (act, on, lbl) => `<div class="rowt"><span class="hint" style="padding:0;color:var(--text)">${lbl}</span><button class="tog" data-act="${act}" aria-pressed="${on}" aria-label="${lbl}"></button></div>`;
    title = 'Path';
    look = tg('pathsm', !!l.smooth, 'Smooth curves') + tg('pathcl', !!l.closed, 'Closed path') + (l.closed ? tg('pathfill', l.fill === true, 'Fill shape') : '');
    paintTitle = 'Stroke';
    paint = `<div class="fillrow">${chip('Stroke', 'hue')}${pf(l, 'lp', 0, 'sop', 'Opacity', 0, 100, .5, '%', true)}</div>`
      + grid2([pf(l, 'lp', 0, 'sw', 'Width', 0, 80, .2)].concat(dashF(), capJoin())) + trimRow();
  } else if (l.type === 'shader') { title = 'Shader'; look = shaderLook(l); }
  else if (['solid', 'comp'].includes(l.type)) { title = 'Fill'; look = chip('Fill', 'hue'); }
  else if (l.type === 'draw') { title = 'Drawing'; look = drawHtml(l); }
  else look = `<p class="hint" style="padding:0">${TYPE_NAME[l.type]} layers have no fill or stroke.</p>`;
  const nm = (l.mods || []).length;
  const body = sec('tf', 'Transform', tf)
    + sec('cmp', 'Layer', layerSec)
    + sec('app', title, look)
    + (paint ? sec('fill', paintTitle, paint) : '')
    + (l.type === 'text' ? sec('tanim', 'Text animators', animHtml(l), (l.anims || []).length ? `<span class="count">${l.anims.length}</span>` : '') : '')
    + sec('rep', 'Duplicator', repHtml(l), l.rep && l.rep.on ? `<span class="count">${repN(l)} copies</span>` : '')
    + sec('beh', 'Behaviours', behHtml(l), nm ? `<span class="count">${nm}</span>` : '')
    + sec('adv', 'Timing & links', advHtml(l));
  return { head, body };
}

function renderRight() {
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
function updateFields() {
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

/* ---------- render: viewport floats ---------- */
/* Zoom number doubles as a scrubber: drag left/right to change zoom, tap to fit. */
$('#zoom').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.pct'); if (!b) return;
  e.stopPropagation(); e.preventDefault();
  b.setPointerCapture(e.pointerId);
  const x0 = e.clientX, z0 = Math.log(S.zoom); let moved = false;
  const mv = (ev) => {
    const dx = ev.clientX - x0;
    if (!moved && Math.abs(dx) < 5) return;
    moved = true; b.classList.add('drag');
    S.zoom = Math.max(.25, Math.min(6, Math.exp(z0 + dx * 0.012))); fitSelOn = false; layoutStage();
  };
  const up = () => {
    b.removeEventListener('pointermove', mv); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up);
    b.classList.remove('drag');
    if (moved) suppressClick = true;
  };
  b.addEventListener('pointermove', mv); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
});
function renderFloats() {
  $('#zoom').innerHTML = `<button class="ib" data-act="zoom" data-v="0.8" aria-label="Zoom out" title="Zoom out">${ic('zout', 's')}</button><button class="pct tc" data-act="fit" aria-label="Zoom level. Drag left or right to zoom. Tap to fit the selection, tap again to fit the workspace" title="Drag to zoom · tap to fit selection / workspace">100%</button><button class="ib" data-act="zoom" data-v="1.25" aria-label="Zoom in" title="Zoom in">${ic('zin', 's')}</button><span class="vsep"></span>
    <button class="ib ${S.snap ? 'on' : ''}" data-act="snap" aria-pressed="${S.snap}" aria-label="Snap" title="Snap">${ic('magnet', 's')}</button>
    <button class="ib ${S.guide === 'safe' ? 'on' : ''}" data-act="guide" data-v="${S.guide === 'safe' ? 'off' : 'safe'}" aria-pressed="${S.guide === 'safe'}" aria-label="Safe areas" title="Title and action safe areas">${ic('safe', 's')}</button>
    <button class="ib ${S.guide === 'thirds' ? 'on' : ''}" data-act="guide" data-v="${S.guide === 'thirds' ? 'off' : 'thirds'}" aria-pressed="${S.guide === 'thirds'}" aria-label="Thirds grid" title="Rule-of-thirds grid">${ic('grid', 's')}</button>`;
  const ql = S.sel && lay(S.sel), hasKeys = !!(ql && TF.some((p) => animated(ql.p[p])));
  $('#qbar').innerHTML = `<button class="qb" data-act="keyall">${ic('key', 's')}Keyframe</button>
    <button class="qb" data-act="qease" ${hasKeys ? '' : 'disabled'}>${ic('easing', 's')}Easing</button>
    <button class="qb" data-act="align" aria-haspopup="dialog">${ic('alC', 's')}Align</button>
    <button class="qb" data-act="dup">${ic('copy', 's')}Duplicate</button>
    <button class="qb" data-act="group">${ic('group', 's')}Pre-compose</button>
    <button class="qb" data-act="del">${ic('trash', 's')}Delete</button>`;
  if (S.tool === 'pen' && S.penPts.length) $('#qbar').innerHTML = `<button class="qb" data-act="pendone">${ic('key', 's')}Done</button><button class="qb" data-act="penclose" ${S.penPts.length > 2 ? '' : 'disabled'}>Close path</button><button class="qb" data-act="penundo">Undo point</button><button class="qb" data-act="pencancel">${ic('trash', 's')}Cancel</button>`;
  renderBrushBar();
  const hint = $('#toolhint');
  const msg = S.eyedrop ? 'Tap a layer to pick its colour' : isDrawTool(S.tool) ? null : { marquee: 'Drag a box to select layers · hold a layer to add or remove it', lasso: 'Draw around layers to select them', hand: 'Drag to pan · pinch to zoom', pen: 'Tap to add points · tap the first point to close', text: 'Tap the canvas to place text', rect: 'Tap to place a rectangle, or drag to size it', ellipse: 'Tap to place an ellipse, or drag out from the centre', polygon: 'Tap to place a polygon, or drag out from the centre', star: 'Tap to place a star, or drag out from the centre', line: 'Tap to place a line, or drag to draw it' }[S.tool];
  hint.hidden = !msg; if (msg) hint.textContent = msg;
  layoutStage();
}

/* ---------- render: timeline ---------- */
function tlHeight() {
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
function renderTL() {
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
const GCOL = { x: '#4aa8ff', y: '#bfe3f5', scale: '#4fd1c5', rot: '#ef6f7f', op: '#b9d65a', ax: '#a8b4c4', ay: '#8e9aaa', ts: '#e0b04a', te: '#c9915a' };
function graphHtml(l) {
  if (!l) return `<p class="hint">Select a layer to see its animation curves.</p>`;
  const ps = TF.filter((p) => animated(l.p[p]));
  if (!ps.length) return `<p class="hint">${esc(l.name)} has no animated properties yet. Tap the ${ic('diamond', 'xs')} in Properties to start.</p>`;
  const legend = ps.map((p) => `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:12px;font-size:var(--fs-xs);color:var(--muted)"><i style="width:10px;height:3px;border-radius:2px;background:${GCOL[p]}"></i>${PROPS[p].label}</span>`).join('');
  return `<div style="display:grid;grid-template-columns:var(--name) minmax(0,1fr) var(--gut);height:calc(100% - 4px);min-height:160px">
    <div style="padding:10px 12px">${legend}<div class="tc" id="gread" style="margin-top:8px;font-size:var(--fs-xs);color:var(--acc-text);min-height:16px"></div><p class="hint" style="padding:6px 0 0">Drag the graph to scrub. Drag a point to retime or change its value. Select a point to shape its ease with the handles.</p></div>
    <div style="position:relative;height:100%;min-height:160px"><svg class="graph" id="gsvg" aria-label="Value graph"></svg><span class="ph" style="top:0"></span></div><span></span></div>`;
}
/* Interactive graph editor: scrub, select/drag keyframes, drag ease handles. */
let gRO = null, gObs = null, GM = { W: 1, H: 1, T: 22, B: 22 }, GL = null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function gmap(l, p) {
  if (GL && GL[p]) return GL[p];
  const vs = l.p[p].keys.map((k) => k.v); let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const s = hi - lo; return { lo: lo - s * .15, hi: hi + s * .15 };
}
const gx = (f) => f / DUR * GM.W;
const gy = (m, v) => GM.T + (1 - (v - m.lo) / (m.hi - m.lo)) * (GM.H - GM.T - GM.B);
const gv = (m, y) => m.lo + (1 - (y - GM.T) / (GM.H - GM.T - GM.B)) * (m.hi - m.lo);
function drawGraph() {
  const svg = $('#gsvg'); if (!svg) return;
  const wrap = svg.parentElement;
  if (!gRO) gRO = new ResizeObserver(() => drawGraph());
  if (gObs !== wrap) { gRO.disconnect(); gRO.observe(wrap); gObs = wrap; }
  const l = S.sel && lay(S.sel); if (!l) return;
  const W = wrap.clientWidth, H = wrap.clientHeight; if (W < 20 || H < 20) return;
  GM = { W, H, T: 22, B: 22 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const ps = TF.filter((p) => animated(l.p[p]));
  const first = S.keys.find((k) => k.l === l.id);
  let curves = '', dots = '', arms = '', hands = '';
  for (const p of ps) {
    const ks = l.p[p].keys, m = gmap(l, p), c = GCOL[p];
    let d = ''; for (let f = 0; f <= DUR; f++) d += (f ? 'L' : 'M') + gx(f).toFixed(1) + ' ' + gy(m, val(l.p[p], f)).toFixed(1);
    curves += `<path d="${d}" stroke="${c}"/>`;
    ks.forEach((k, i) => {
      const on = S.keys.some((s) => s.l === l.id && s.p === p && s.i === i), cx = gx(k.t).toFixed(1), cy = gy(m, k.v).toFixed(1);
      dots += `<circle cx="${cx}" cy="${cy}" r="${on ? 7 : 5}" fill="${on ? '#fff' : c}" stroke="${on ? c : 'var(--surface)'}" stroke-width="${on ? 3 : 1.5}"/><circle data-gk="1" data-p="${p}" data-i="${i}" cx="${cx}" cy="${cy}" r="18" fill="transparent"><title>${PROPS[p].label} at ${tc(k.t)}</title></circle>`;
    });
    if (first && first.p === p && ks[first.i + 1]) {
      const k = ks[first.i], n = ks[first.i + 1], a = earr(k), x0 = gx(k.t), y0 = gy(m, k.v), dx = gx(n.t) - x0, dy = gy(m, n.v) - y0;
      if (Math.abs(dy) > 6) {
        [[1, a[0], a[1]], [2, a[2], a[3]]].forEach(([h, ax, ay]) => {
          const hx = (x0 + ax * dx).toFixed(1), hy = (y0 + ay * dy).toFixed(1), ex = h === 1 ? x0 : x0 + dx, ey = h === 1 ? y0 : y0 + dy;
          arms += `<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${hx}" y2="${hy}" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="3 3"/>`;
          hands += `<circle cx="${hx}" cy="${hy}" r="6.5" fill="var(--surface)" stroke="${c}" stroke-width="2"/><circle data-gh="${h}" data-p="${p}" data-i="${first.i}" cx="${hx}" cy="${hy}" r="18" fill="transparent"/>`;
        });
      }
    }
  }
  svg.innerHTML = `<path class="gl" d="M0 ${GM.T}H${W}M0 ${H - GM.B}H${W}"/>${curves}${arms}${dots}${hands}`;
}
function graphDown(e) {
  const gh = e.target.closest('[data-gh]'), gk = e.target.closest('[data-gk]');
  const l = S.sel && lay(S.sel); if (!l) return;
  if (S.playing) play(false);
  const svg = $('#gsvg'); if (!svg) return;
  e.preventDefault(); svg.setPointerCapture(e.pointerId);
  const pt = (ev) => { const r = svg.getBoundingClientRect(); return [(ev.clientX - r.left) * GM.W / r.width, (ev.clientY - r.top) * GM.H / r.height]; };
  const end = (mv, up) => { svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up); };
  const bind = (mv, up) => { svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up); };
  const read = $('#gread');
  if (gh) {
    const p = gh.dataset.p, h = +gh.dataset.gh, keys = l.p[p].keys, k0 = keys[+gh.dataset.i], n0 = keys[+gh.dataset.i + 1], m = gmap(l, p);
    if (!n0) return;
    const targets = [k0, ...selectedKeyObjs().filter((k) => k !== k0)];
    const x0 = gx(k0.t), y0 = gy(m, k0.v), dx = gx(n0.t) - x0, dy = gy(m, n0.v) - y0, a = [...earr(k0)];
    const mv = (ev) => {
      const [x, y] = pt(ev), cx = clamp((x - x0) / dx, 0, 1), cy = clamp((y - y0) / dy, -.8, 1.8);
      if (h === 1) { a[0] = cx; a[1] = cy; } else { a[2] = cx; a[3] = cy; }
      targets.forEach((k) => (k.e = [...a])); dragging = true;
      if (read) read.textContent = 'Ease ' + a.map((n) => n.toFixed(2)).join(', ');
      drawGraph(); updateCanvas();
    };
    const up = () => { end(mv, up); dragging = false; commit('Edit curve'); renderAll(); };
    bind(mv, up); return;
  }
  if (gk) {
    const p = gk.dataset.p, i = +gk.dataset.i, keys = l.p[p].keys, k = keys[i], m = gmap(l, p), me = { l: l.id, p, i };
    GL = { [p]: m };
    if (e.shiftKey) { const j = S.keys.findIndex((s) => s.l === me.l && s.p === p && s.i === i); j >= 0 ? S.keys.splice(j, 1) : S.keys.push(me); } else S.keys = [me];
    drawGraph();
    const sx = e.clientX, sy = e.clientY; let moved = false;
    const isLong = longPress(e, () => { end(mv, up); GL = null; seek(k.t); S.pop = { type: 'ease', x: sx, y: sy }; renderAll(); });
    const mv = (ev) => {
      if (isLong()) return;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      if (!moved) { moved = true; dragging = true; }
      const [x, y] = pt(ev);
      k.t = clamp(Math.round(x / GM.W * DUR), i > 0 ? keys[i - 1].t + 1 : 0, i < keys.length - 1 ? keys[i + 1].t - 1 : DUR - 1);
      k.v = clamp(gv(m, clamp(y, GM.T, GM.H - GM.B)), PROPS[p].min, PROPS[p].max);
      if (read) read.textContent = `${PROPS[p].label} ${fmt(k.v, PROPS[p])} · ${tc(k.t)}`;
      drawGraph(); updateCanvas(); updateFields();
    };
    const up = () => { end(mv, up); GL = null; dragging = false; if (isLong()) return; if (moved) { commit('Edit keyframe'); suppressClick = true; } renderAll(); };
    bind(mv, up); return;
  }
  const set = (ev) => seek(Math.round(pt(ev)[0] / GM.W * DUR));
  set(e);
  const up = () => { end(set, up); renderRight(); };
  bind(set, up);
}

/* ---------- render: popovers & dialogs ---------- */
function hexToHsv(hex) {
  const n = parseInt(String(hex).slice(1, 7), 16) || 0, r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
}
function hsvToHex(h, s2, v) { const f = (n) => { const k = (n + h / 60) % 6; return v - v * s2 * Math.max(0, Math.min(k, 4 - k, 1)); }; return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); }
let cp = null; // colour picker session: { h, s, v, dirty }
function cpApply(hexIn) {
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
function cpDrag(e, el) {
  if (!cp) return;
  e.preventDefault(); el.setPointerCapture(e.pointerId);
  const set = (ev) => { const r = el.getBoundingClientRect(), x = clamp((ev.clientX - r.left) / r.width, 0, 1), y = clamp((ev.clientY - r.top) / r.height, 0, 1); if (el.dataset.cp === 'sv') { cp.s = x; cp.v = 1 - y; } else cp.h = x * 359.9; cpApply(); };
  set(e);
  const up = () => { el.removeEventListener('pointermove', set); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  el.addEventListener('pointermove', set); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
function renderPop() {
  // closing the colour picker commits its live edits as one undo step
  if (cp && !(S.pop && S.pop.type === 'color')) { const d = cp.dirty && cp.key !== 'brush'; cp = null; if (d) { commit('Colour'); renderLeft(); renderTL(); renderTop(); renderRight(); } }
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
    if (!cp) cp = { ...hexToHsv(l[key] || '#ffffff'), key, dirty: false };
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
/* ---------- export: GIF + MP4 (all in the browser, no libraries) ---------- */
const EX = { fmt: 'MP4', res: { MP4: 1080, GIF: 540, PNG: 1080 }, fps: { MP4: 30, GIF: 15, PNG: 30 }, trans: false };
const EX_RES = { MP4: [['720p', 720], ['1080p', 1080], ['4K', 2160]], GIF: [['360p', 360], ['540p', 540], ['720p', 720]], PNG: [['720p', 720], ['1080p', 1080], ['4K', 2160]] };
const EX_FPS = { MP4: [24, 30, 60], GIF: [10, 15, 24, 30], PNG: [12, 24, 30] };
let exportJob = null;
const exName = () => ((($('#pname') || {}).value || 'Logo sting').trim().replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'export');
const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

/* Draw the composition at frame f into ctx (w x h). */
async function rasterFrame(f, w, h, ctx, transparent) {
  S.f = f; exporting = true; updateCanvas();
  const svg = stage.querySelector('svg').cloneNode(true);
  exporting = false;
  const bg = svg.querySelector(':scope > rect');
  if (bg) { if (transparent) bg.remove(); else { bg.removeAttribute('style'); bg.setAttribute('fill', compBg || getComputedStyle(document.documentElement).getPropertyValue('--comp-bg').trim() || '#15120f'); } }
  svg.querySelectorAll('foreignObject.shfo').forEach((fo) => {
    const l = lay(fo.dataset.sh), rt = l && l.vis ? renderShader(l, postT(l, f), Math.min(1920, w), Math.min(1080, h)) : null;
    if (rt && rt.ok) { const im = document.createElementNS('http://www.w3.org/2000/svg', 'image'); ['x', 'y', 'width', 'height'].forEach((k) => im.setAttribute(k, fo.getAttribute(k))); im.setAttribute('preserveAspectRatio', 'none'); im.setAttribute('href', rt.canvas.toDataURL('image/png')); fo.replaceWith(im); } else fo.remove();
  });
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.setAttribute('width', w); svg.setAttribute('height', h);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image(); img.src = url; await img.decode();
    ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
  } finally { URL.revokeObjectURL(url); }
}

/* ---- GIF ---- */
function medianCut(counts, n) {
  // counts: Map bin(6 bits per channel) -> pixels. Returns [[r,g,b] x n]
  const bins = [...counts.keys()].map((b) => ({ r: (b >> 12) & 63, g: (b >> 6) & 63, b: b & 63, n: counts.get(b) }));
  let boxes = [bins];
  const range = (bx) => { let a = [63, 63, 63], z = [0, 0, 0]; for (const c of bx) { const v = [c.r, c.g, c.b]; for (let i = 0; i < 3; i++) { if (v[i] < a[i]) a[i] = v[i]; if (v[i] > z[i]) z[i] = v[i]; } } return [z[0] - a[0], z[1] - a[1], z[2] - a[2]]; };
  while (boxes.length < n) {
    let bi = -1, best = 0;
    boxes.forEach((bx, i) => { if (bx.length < 2) return; const s = Math.max(...range(bx)) * Math.sqrt(bx.reduce((t, c) => t + c.n, 0)); if (s > best) { best = s; bi = i; } });
    if (bi < 0) break;
    const bx = boxes[bi], rg = range(bx), ch = rg.indexOf(Math.max(...rg)), key = ['r', 'g', 'b'][ch];
    bx.sort((p, q) => p[key] - q[key]);
    const tot = bx.reduce((t, c) => t + c.n, 0); let acc = 0, cut = 1;
    for (let i = 0; i < bx.length - 1; i++) { acc += bx[i].n; cut = i + 1; if (acc >= tot / 2) break; }
    boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut));
  }
  return boxes.map((bx) => { let t = 0, r = 0, g = 0, b = 0; for (const c of bx) { t += c.n; r += c.r * c.n; g += c.g * c.n; b += c.b * c.n; } t = t || 1; return [Math.min(255, Math.round(r / t * 4 + 2)), Math.min(255, Math.round(g / t * 4 + 2)), Math.min(255, Math.round(b / t * 4 + 2))]; });
}
function lzw(ix) {
  const out = [], MIN = 8, CLEAR = 256, EOI = 257;
  let cur = 0, nb = 0, size = MIN + 1, next = EOI + 1; const dict = new Map();
  const emit = (c) => { cur |= c << nb; nb += size; while (nb >= 8) { out.push(cur & 255); cur >>>= 8; nb -= 8; } };
  emit(CLEAR); let pre = ix[0];
  for (let i = 1; i < ix.length; i++) {
    const k = ix[i], key = pre * 256 + k, v = dict.get(key);
    if (v !== undefined) { pre = v; continue; }
    emit(pre);
    if (next === 4096) { emit(CLEAR); dict.clear(); next = EOI + 1; size = MIN + 1; }
    else { if (next >= (1 << size)) size++; dict.set(key, next++); }
    pre = k;
  }
  emit(pre); emit(EOI); if (nb > 0) out.push(cur & 255);
  return out;
}
class GifOut {
  constructor(w, h, pal, tIdx) {
    this.w = w; this.h = h; this.tIdx = tIdx; this.parts = [];
    const hd = [71, 73, 70, 56, 57, 97, w & 255, w >> 8, h & 255, h >> 8, 0xF7, 0, 0];
    const gp = new Uint8Array(768); pal.forEach((c, i) => { gp[i * 3] = c[0]; gp[i * 3 + 1] = c[1]; gp[i * 3 + 2] = c[2]; });
    this.parts.push(new Uint8Array(hd), gp, new Uint8Array([0x21, 0xFF, 11, 78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48, 3, 1, 0, 0, 0]));
  }
  frame(ix, delay) {
    const t = this.tIdx >= 0;
    this.parts.push(new Uint8Array([0x21, 0xF9, 4, ((t ? 2 : 1) << 2) | (t ? 1 : 0), delay & 255, delay >> 8, t ? this.tIdx : 0, 0, 0x2C, 0, 0, 0, 0, this.w & 255, this.w >> 8, this.h & 255, this.h >> 8, 0, 8]));
    const d = lzw(ix), blocks = [];
    for (let i = 0; i < d.length; i += 255) { const n = Math.min(255, d.length - i); blocks.push(n, ...d.slice(i, i + n)); }
    blocks.push(0); this.parts.push(Uint8Array.from(blocks));
  }
  done() { this.parts.push(new Uint8Array([0x3B])); return new Blob(this.parts, { type: 'image/gif' }); }
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u) => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, f.data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + sz;
  }
  const csz = cen.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
/* ---- Lottie (Bodymovin JSON) export: transforms are baked per frame so behaviours, parenting, duplicators and posterize time all match the preview ---- */
const LBM = { normal: 0, multiply: 1, screen: 2, overlay: 3, darken: 4, lighten: 5, 'color-dodge': 6, 'color-burn': 7, 'hard-light': 8, 'soft-light': 9, difference: 10, exclusion: 11, hue: 12, saturation: 13, color: 14, luminosity: 15 };
const LTT = { alpha: 1, alphainv: 2, luma: 3, lumainv: 4 };
const lrgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); const n = m ? parseInt(m[1], 16) : 0xffffff; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => Math.round(v * 1000) / 1000); };
const lr = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
function lprop(vals, ip) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (vals.every((v) => same(v, vals[0]))) return { a: 0, k: vals[0] };
  const k = []; let prev = null;
  vals.forEach((v, i) => {
    const nxt = vals[i + 1];
    if (prev !== null && nxt !== undefined && same(v, prev) && same(v, nxt)) { prev = v; return; }
    const dim = Array.isArray(v) ? v.length : 1, arr = (x) => (Array.isArray(v) ? Array(dim).fill(x) : [x]);
    k.push({ t: ip + i, s: Array.isArray(v) ? v : [v], i: { x: arr(1), y: arr(1) }, o: { x: arr(0), y: arr(0) } });
    prev = v;
  });
  delete k[k.length - 1].i; delete k[k.length - 1].o;
  return { a: 1, k };
}
function lgeom(l) {
  const sh = (P, closed, segs) => ({ ty: 'sh', ks: { a: 0, k: { c: closed, v: P.map((p) => [lr(p[0]), lr(p[1])]), i: segs ? segs.i : P.map(() => [0, 0]), o: segs ? segs.o : P.map(() => [0, 0]) } } });
  switch (l.type) {
    case 'rect': { const w = l.w || 280, h = l.h || 180; return { g: { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [w, h] }, r: { a: 0, k: Math.min(l.cr ?? 24, w / 2, h / 2) }, d: 1 }, bb: [w, h] }; }
    case 'ellipse': case 'ring': return { g: { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [l.r * 2, l.r * 2] }, d: 1 }, bb: [l.r * 2, l.r * 2] };
    case 'line': { const w = l.w || 420; return { g: sh([[-w / 2, 0], [w / 2, 0]], false), bb: [w, 1] }; }
    case 'star': case 'polygon': { const P = polyOf(l), xs = P.map((p) => p[0]), ys = P.map((p) => p[1]); return { g: sh(P, true), bb: [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)] }; }
    case 'path': {
      const P = l.pts || [], xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), bb = [Math.max(...xs) - Math.min(...xs) || 1, Math.max(...ys) - Math.min(...ys) || 1];
      if (!l.smooth || P.length < 3) return { g: sh(P, !!l.closed && P.length > 2), bb };
      const segs = pathSegs(l), n = P.length, ii = P.map(() => [0, 0]), oo = P.map(() => [0, 0]);
      segs.forEach((q, k) => { const a = k, b = (k + 1) % n; oo[a] = [lr(q[1][0] - q[0][0]), lr(q[1][1] - q[0][1])]; ii[b] = [lr(q[2][0] - q[3][0]), lr(q[2][1] - q[3][1])]; });
      return { g: sh(P, !!l.closed, { i: ii, o: oo }), bb };
    }
  }
  return null;
}
function lpaint(l, bb, trim, part) {
  const items = [], sw = l.type === 'ring' ? (l.sw ?? 14) : l.type === 'line' ? (l.sw ?? 12) : l.type === 'path' ? (l.sw ?? 8) : (l.sw || 0);
  const fillOn = l.type === 'path' ? l.fill === true && l.closed : !['ring', 'line'].includes(l.type) && l.fill !== false;
  if (fillOn && part !== 'stroke') {
    if (l.grad) {
      const a = (l.gang ?? 90) * Math.PI / 180, dx = Math.cos(a) * bb[0] / 2, dy = Math.sin(a) * bb[1] / 2, c1 = lrgb(l.hue), c2 = lrgb(l.hue2 || '#ff5ea8');
      items.push({ ty: 'gf', o: { a: 0, k: 100 }, r: 1, t: 1, s: { a: 0, k: [lr(-dx), lr(-dy)] }, e: { a: 0, k: [lr(dx), lr(dy)] }, g: { p: 2, k: { a: 0, k: [0, ...c1, 1, ...c2] } } });
    } else items.push({ ty: 'fl', c: { a: 0, k: [...lrgb(l.hue), 1] }, o: { a: 0, k: 100 }, r: 1 });
  }
  if (hasStroke(l) && sw > 0 && part !== 'fill') {
    const st = { ty: 'st', c: { a: 0, k: [...lrgb(l.type === 'ring' || l.type === 'path' || l.type === 'line' && !l.sw ? l.hue : (l.sc || '#ffffff')), 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: sw }, lc: { butt: 1, round: 2, square: 3 }[l.cap || 'round'], lj: { miter: 1, round: 2, bevel: 3 }[l.join || 'round'], ml: 4 };
    if (l.dash > 0 && !trim) st.d = [{ n: 'd', nm: 'dash', v: { a: 0, k: l.dash } }, { n: 'g', nm: 'gap', v: { a: 0, k: Math.round(l.dash * 1.2) } }, { n: 'o', nm: 'offset', v: { a: 0, k: 0 } }];
    items.push(st);
  }
  if (trim) items.unshift({ ty: 'tm', s: trim.s, e: trim.e, o: { a: 0, k: 0 }, m: 1 });
  return items;
}
async function exportLottie(job) {
  const warn = new Set(), out = [], assets = [], fonts = [];
  const tr = (q) => ({ x: q.x, y: q.y });
  let idx = 1;
  for (let li = 0; li < layers.length; li++) {
    const l = layers[li]; if (job.cancel) return null;
    if (!l.vis || ['audio', 'null', 'adjust', 'comp', 'shader', 'draw'].includes(l.type)) { if (['shader', 'adjust', 'comp', 'draw'].includes(l.type) && l.vis) warn.add(`${TYPE_NAME[l.type] || l.type} layers`); continue; }
    if (l.fx.some((e) => e.on && e.id !== 'postime')) warn.add('effects');
    if (l.type === 'text' && (l.anims || []).length) warn.add('per-character text animators');
    const ip = Math.max(0, Math.round(l.inP ?? 0)), op = Math.min(DUR, Math.round(l.outP ?? DUR)); if (op <= ip) continue;
    const n = repN(l), src = li > 0 && l.matte ? layers[li - 1] : null, isSrc = layers[li + 1] && layers[li + 1].matte && li + 1 < layers.length;
    for (let c = 0; c < n; c++) {
      const P = [], R = [], Sc = [], O = [], TS = [], TE = []; let ang = null;
      for (let f = ip; f < op; f++) {
        const ff = postT(l, f), q = pose(l, ff, c); if (l.rep && l.rep.on) repXf(l, q, c);
        let m = mat(q); if (l.parent && lay(l.parent)) m = relM(l, ff, 0).multiply(m);
        let a = Math.atan2(m.b, m.a) * 180 / Math.PI; if (ang !== null) { while (a - ang > 180) a -= 360; while (a - ang < -180) a += 360; } ang = a;
        P.push([lr(m.e), lr(m.f)]); R.push(lr(a)); const s = lr(Math.hypot(m.a, m.b) * 100), sy = m.a * m.d - m.b * m.c < 0 ? -s : s; Sc.push([s, sy]); O.push(lr(Math.max(0, Math.min(100, q.o)), 1));
        TS.push(lr(Math.max(0, Math.min(100, Math.min(q.ts, q.te))))); TE.push(lr(Math.max(0, Math.min(100, Math.max(q.ts, q.te)))));
      }
      const L = { ddd: 0, ind: idx++, nm: n > 1 ? `${l.name} ${c + 1}` : l.name, sr: 1, ip, op, st: 0, bm: LBM[l.blend || 'normal'] || 0, ao: 0,
        ks: { o: lprop(O, ip), r: lprop(R, ip), p: lprop(P, ip), a: { a: 0, k: [0, 0] }, s: lprop(Sc, ip) } };
      if (src && c === 0) L.tt = LTT[l.matte] || 1;
      if (isSrc) L.td = 1;
      if (l.type === 'text') {
        const F = FONTS.find((x) => x[0] === l.font) || FONTS[0], fam = F[2].split(',')[0].replace(/['"]/g, '').trim(), w = snapW(l), fname = `${F[0]}-${w}${l.italic ? 'i' : ''}`;
        const style = (WNAME[w] || 'Regular') + (l.italic ? ' Italic' : '');
        if (!fonts.some((x) => x.fName === fname)) fonts.push({ fName: fname, fFamily: fam === '-apple-system' ? 'SF Pro Display' : fam, fStyle: style, fWeight: String(w), ascent: 75 });
        let t = String(l.text ?? ''); if (l.tcase === 'upper') t = t.toUpperCase(); else if (l.tcase === 'lower') t = t.toLowerCase();
        const size = +l.size || 100, lines = t.split('\n').length, lh = size * (l.lead ?? 120) / 100;
        L.ty = 5; L.ks.a = { a: 0, k: [0, lr(-size * .35 + (lines - 1) * lh / 2)] };
        L.t = { d: { k: [{ s: { s: size, f: fname, t: t.replace(/\n/g, '\r'), j: { left: 0, right: 1, center: 2 }[l.align || 'center'], tr: Math.round((+l.track || 0) / size * 1000), lh: lr(lh), ls: 0, fc: lrgb(l.hue) }, t: 0 }] }, p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } }, a: [] };
        if (l.grad) warn.add('gradient text');
      } else if (l.type === 'solid') { L.ty = 1; L.sc = l.hue; L.sw = 1920; L.sh = 1080; L.ks.a = { a: 0, k: [960, 540] }; }
      else if (l.type === 'image') {
        let p = ''; try { const b = await (await fetch(l.src)).blob(); p = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); } catch { warn.add('an image that could not be read'); continue; }
        const id = 'img_' + assets.length; assets.push({ id, w: Math.round(l.w), h: Math.round(l.h), u: '', p, e: 1 });
        L.ty = 2; L.refId = id; L.ks.a = { a: 0, k: [lr(l.w / 2), lr(l.h / 2)] };
      } else {
        const G = lgeom(l); if (!G) continue;
        const trimmed = TS.some((v) => v > .01) || TE.some((v) => v < 99.99);
        const TR = { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } };
        L.ty = 4;
        if (trimmed) { /* trim paths only cut the stroke, as in the preview */
          const st = lpaint(l, G.bb, { s: lprop(TS, ip), e: lprop(TE, ip) }, 'stroke'), fl = lpaint(l, G.bb, null, 'fill');
          L.shapes = [st.length > 1 ? { ty: 'gr', nm: 'Stroke', it: [G.g, ...st, TR] } : null, fl.length ? { ty: 'gr', nm: 'Fill', it: [JSON.parse(JSON.stringify(G.g)), ...fl, TR] } : null].filter(Boolean);
        } else L.shapes = [{ ty: 'gr', nm: l.name, it: [G.g, ...lpaint(l, G.bb, null), TR] }];
      }
      out.push(L);
    }
    job.set((li + 1) / layers.length * 95, `Layer ${li + 1} of ${layers.length}`);
    await new Promise((r) => setTimeout(r, 0));
  }
  const doc = { v: '5.7.4', fr: FPS, ip: 0, op: DUR, w: 1920, h: 1080, nm: projName, ddd: 0, assets, layers: out, markers: markers.map((m) => ({ tm: m.f, cm: m.name, dr: 0 })) };
  if (fonts.length) doc.fonts = { list: fonts };
  job.warn = [...warn];
  return new Blob([JSON.stringify(doc)], { type: 'application/json' });
}
async function exportPng(job, w, h, fps, nF) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d');
  const base = exName(), files = [];
  for (let i = 0; i < nF; i++) {
    if (job.cancel) return null;
    await rasterFrame(Math.min(DUR, i * 30 / fps), w, h, ctx, EX.trans);
    const b = await new Promise((r) => cv.toBlob(r, 'image/png'));
    if (!b) throw new Error('Could not encode a frame. Try a lower resolution.');
    files.push({ name: `${base}_${String(i + 1).padStart(4, '0')}.png`, data: new Uint8Array(await b.arrayBuffer()) });
    job.set((i + 1) / nF * 95, `Frame ${i + 1} of ${nF}`);
  }
  job.set(98, 'Packing ZIP'); return zipStore(files);
}
async function exportGif(job, w, h, fps, nF) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d', { willReadFrequently: true });
  const trans = EX.trans, at = (i) => Math.min(DUR, i * 30 / fps);
  // pass 1: sample colours from ~12 frames
  const counts = new Map(), step = Math.max(1, Math.floor(nF / 12));
  for (let i = 0; i < nF; i += step) {
    if (job.cancel) return null;
    await rasterFrame(at(i), w, h, ctx, trans);
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let p = 0; p < d.length; p += 4 * 3) { if (trans && d[p + 3] < 128) continue; const b = ((d[p] >> 2) << 12) | ((d[p + 1] >> 2) << 6) | (d[p + 2] >> 2); counts.set(b, (counts.get(b) || 0) + 1); }
    job.set(Math.min(10, (i / nF) * 10), 'Choosing colours');
  }
  if (!counts.size) counts.set(0, 1);
  let pal = medianCut(counts, trans ? 255 : 256); if (trans) pal = [[0, 0, 0], ...pal]; while (pal.length < 256) pal.push([0, 0, 0]);
  const off = trans ? 1 : 0, map = new Int16Array(262144).fill(-1);
  const nearest = (r, g, b) => { let bi = off, bd = 1e9; for (let i = off; i < 256; i++) { const c = pal[i], dr = c[0] - r, dg = c[1] - g, db = c[2] - b, dd = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (dd < bd) { bd = dd; bi = i; } } return bi; };
  const gif = new GifOut(w, h, pal, trans ? 0 : -1), ix = new Uint8Array(w * h);
  let acc = 0;
  for (let i = 0; i < nF; i++) {
    if (job.cancel) return null;
    await rasterFrame(at(i), w, h, ctx, trans);
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let p = 0, q = 0; p < d.length; p += 4, q++) {
      if (trans && d[p + 3] < 128) { ix[q] = 0; continue; }
      const b = ((d[p] >> 2) << 12) | ((d[p + 1] >> 2) << 6) | (d[p + 2] >> 2); let v = map[b];
      if (v < 0) { v = nearest(d[p], d[p + 1], d[p + 2]); map[b] = v; } ix[q] = v;
    }
    const nx = Math.round((i + 1) * 100 / fps), delay = Math.max(2, nx - acc); acc = nx;
    gif.frame(ix, delay);
    job.set(10 + (i + 1) / nF * 90, `Frame ${i + 1} of ${nF}`);
    if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
  }
  return gif.done();
}

/* ---- MP4 (WebCodecs H.264 + a small muxer) ---- */
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >> 8) & 255, n & 255];
const box = (t, ...kids) => { const body = kids.flat(Infinity); return [...u32(8 + body.length), ...[...t].map((c) => c.charCodeAt(0)), ...body]; };
const fullbox = (t, ver, flags, ...kids) => box(t, ver, 0, 0, flags, ...kids);
function muxMp4(w, h, fps, avcC, samples) {
  const TS = 90000, dur = Math.round(samples.length * TS / fps), delta = Math.round(TS / fps);
  const Z12 = new Array(12).fill(0), mat = [...u32(0x10000), ...Z12, ...u32(0x10000), ...Z12, ...u32(0x40000000)];
  const sizes = samples.map((s) => s.data.length), sync = samples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean);
  const ftyp = box('ftyp', [...'isom'].map((c) => c.charCodeAt(0)), u32(512), [...'isomiso2avc1mp41'].map((c) => c.charCodeAt(0)));
  const mk = (off) => {
    const stbl = box('stbl',
      fullbox('stsd', 0, 0, u32(1), box('avc1', [0, 0, 0, 0, 0, 0], u16(1), u16(0), u16(0), u32(0), u32(0), u32(0), u16(w), u16(h), u32(0x480000), u32(0x480000), u32(0), u16(1), new Array(32).fill(0), u16(24), u16(0xFFFF), box('avcC', [...avcC]))),
      fullbox('stts', 0, 0, u32(1), u32(samples.length), u32(delta)),
      fullbox('stss', 0, 0, u32(sync.length), sync.map(u32)),
      fullbox('stsc', 0, 0, u32(1), u32(1), u32(samples.length), u32(1)),
      fullbox('stsz', 0, 0, u32(0), u32(sizes.length), sizes.map(u32)),
      fullbox('stco', 0, 0, u32(1), u32(off)));
    return box('moov',
      fullbox('mvhd', 0, 0, u32(0), u32(0), u32(TS), u32(dur), u32(0x10000), u16(0x100), u16(0), u32(0), u32(0), mat, new Array(24).fill(0), u32(2)),
      box('trak', fullbox('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(dur), u32(0), u32(0), u16(0), u16(0), u16(0), u16(0), mat, u32(w << 16), u32(h << 16)),
        box('mdia', fullbox('mdhd', 0, 0, u32(0), u32(0), u32(TS), u32(dur), u16(0x55C4), u16(0)),
          fullbox('hdlr', 0, 0, u32(0), [...'vide'].map((c) => c.charCodeAt(0)), u32(0), u32(0), u32(0), [...'VideoHandler'].map((c) => c.charCodeAt(0)), 0),
          box('minf', fullbox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), box('dinf', fullbox('dref', 0, 0, u32(1), fullbox('url ', 0, 1))), stbl))));
  };
  const moovLen = mk(0).length, off = ftyp.length + moovLen + 8, moov = mk(off);
  const total = samples.reduce((t, s) => t + s.data.length, 0);
  return new Blob([Uint8Array.from(ftyp), Uint8Array.from(moov), Uint8Array.from([...u32(8 + total), 109, 100, 97, 116]), ...samples.map((s) => s.data)], { type: 'video/mp4' });
}
async function exportMp4(job, w, h, fps, nF) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') throw new Error('MP4 export needs a browser with WebCodecs (Safari on iPadOS 16.4 or later, or recent Chrome).');
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d');
  const bitrate = Math.round(w * h * fps * 0.14);
  let cfg = null;
  for (const codec of [w * h > 2100000 ? 'avc1.640033' : 'avc1.64002A', 'avc1.4D4028', 'avc1.42E01F']) {
    const c = { codec, width: w, height: h, bitrate, framerate: fps, avc: { format: 'avc' } };
    try { const s = await VideoEncoder.isConfigSupported(c); if (s.supported) { cfg = s.config || c; cfg.avc = { format: 'avc' }; break; } } catch { /* try next */ }
  }
  if (!cfg) throw new Error(`This device can't encode ${w}×${h} H.264. Try a lower resolution.`);
  const samples = []; let avcC = null, err = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description) avcC = new Uint8Array(meta.decoderConfig.description instanceof ArrayBuffer ? meta.decoderConfig.description : meta.decoderConfig.description.buffer.slice(meta.decoderConfig.description.byteOffset, meta.decoderConfig.description.byteOffset + meta.decoderConfig.description.byteLength)); const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); samples.push({ data: d, key: chunk.type === 'key' }); },
    error: (e) => { err = e; },
  });
  enc.configure(cfg);
  for (let i = 0; i < nF; i++) {
    if (job.cancel) { try { enc.close(); } catch { /* closed */ } return null; }
    if (err) throw err;
    await rasterFrame(Math.min(DUR, i * 30 / fps), w, h, ctx, false);
    while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4));
    const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: i % Math.max(1, Math.round(fps)) === 0 }); vf.close();
    job.set((i + 1) / nF * 95, `Frame ${i + 1} of ${nF}`);
    if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
  }
  await enc.flush(); enc.close(); if (err) throw err;
  if (!avcC || !samples.length) throw new Error('The encoder returned no video. Try a lower resolution.');
  job.set(98, 'Writing file');
  return muxMp4(w, h, fps, avcC, samples);
}

async function runExport() {
  if (exportJob && exportJob.status === 'run') return;
  if (exportJob && exportJob.url) URL.revokeObjectURL(exportJob.url);
  if (S.playing) play(false);
  const fmt = EX.fmt, res = EX.res[fmt] || 1080, fps = EX.fps[fmt] || 30;
  const h = res % 2 ? res + 1 : res, w = Math.round(h * 16 / 9 / 2) * 2, nF = Math.round(DUR / 30 * fps);
  const job = exportJob = { status: 'run', p: 0, text: 'Starting', cancel: false, fmt, name: `${exName()}${fmt === 'PNG' ? '-png' : ''}.${{ GIF: 'gif', PNG: 'zip', Lottie: 'json' }[fmt] || 'mp4'}`, dims: fmt === 'Lottie' ? '1920×1080 vector' : `${w}×${h}`,
    set(p, t) { this.p = p; this.text = t; const bar = $('#dlg .prog i'); if (bar) { bar.style.width = p + '%'; $('#dlg .job .tc').textContent = Math.round(p) + '%'; $('#dlg .jtxt').textContent = t; } } };
  renderDialog();
  const f0 = S.f;
  try {
    const blob = fmt === 'Lottie' ? await exportLottie(job) : fmt === 'GIF' ? await exportGif(job, w, h, fps, nF) : fmt === 'PNG' ? await exportPng(job, w, h, fps, nF) : await exportMp4(job, w, h, fps, nF);
    if (job.cancel || !blob) { job.status = 'cancel'; }
    else { job.status = 'done'; job.p = 100; job.blob = blob; job.url = URL.createObjectURL(blob); job.size = blob.size; }
  } catch (e) { job.status = 'err'; job.msg = (e && e.message) || String(e); }
  S.f = f0; updateCanvas(); setPF && setPF();
  if (S.dialog === 'export') renderDialog();
}
const exSave = async () => {
  const j = exportJob; if (!j || !j.blob) return;
  let dl = null; try { dl = window.claude && await window.claude.use('downloads'); } catch { dl = null; }
  if (dl) { try { await dl.save({ filename: j.name, data: j.blob }); } catch (e) { if (e && e.code !== 'declined') toast('Could not save the file' + (e && e.message ? ': ' + e.message : '')); } return; }
  const a = document.createElement('a'); a.href = j.url; a.download = j.name; document.body.appendChild(a); a.click(); a.remove();
};

function exportDialog() {
  const fmt = EX.fmt, j = exportJob, run = j && j.status === 'run';
  const seg = (label, items, cur, act) => `<div class="seg" role="group" aria-label="${label}">${items.map(([t, v, dis]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${String(v) === String(cur)}" ${dis || run ? 'disabled' : ''} ${dis ? 'title="Not available yet"' : ''}>${t}</button>`).join('')}</div>`;
  const job = !j ? '' : j.status === 'run'
    ? `<div class="job"><div class="kv" style="min-height:0"><b>${esc(j.name)}</b><span class="tc">${Math.round(j.p)}%</span></div><div class="prog"><i style="width:${j.p}%"></i></div><span class="jtxt" style="color:var(--muted)">${esc(j.text)}</span></div>`
    : j.status === 'done'
      ? `<div class="job"><div class="kv" style="min-height:0"><b>${esc(j.name)}</b><span class="tc">${fmtSize(j.size)}</span></div>
          ${j.fmt === 'Lottie' ? `<span style="color:var(--muted)">Lottie JSON for web, iOS and Android players.${j.warn && j.warn.length ? ` Not included: ${esc(j.warn.join(', '))}.` : ' Everything in the composition was included.'}</span>` : j.fmt === 'PNG' ? '<span style="color:var(--muted)">ZIP of numbered PNG frames.</span>' : j.fmt === 'GIF' ? `<img src="${j.url}" alt="Exported GIF preview" style="border-radius:8px;max-height:150px;object-fit:contain;background:#0006">` : `<video src="${j.url}" controls muted loop playsinline style="border-radius:8px;max-height:150px;background:#0006"></video>`}
          <span style="color:var(--muted)">${j.dims} · ready. Tap Save to keep it.</span>
          <div style="display:flex;gap:6px"><button class="primary" data-act="exsave">Save file</button></div></div>`
      : j.status === 'err' ? `<div class="job"><span style="color:var(--danger)">${esc(j.msg)}</span></div>` : '';
  return `<h2>Export</h2>
      ${seg('Format', [['MP4', 'MP4'], ['GIF', 'GIF'], ['PNG seq', 'PNG'], ['Lottie', 'Lottie']], fmt, 'expfmt')}
      ${fmt === 'Lottie' ? '<p class="hint" style="padding:0">Vector animation at 1920×1080, 30 fps. Shapes, paths, text, images, trim paths, mattes and blend modes are kept, and motion is baked frame by frame. Effects and shader layers are left out.</p>' : `${seg('Resolution', EX_RES[fmt].map(([t, v]) => [t, v]), EX.res[fmt], 'expres')}
      ${seg('Frame rate', EX_FPS[fmt].map((v) => [v + ' fps', v]), EX.fps[fmt], 'expfps')}`}
      <div class="kv"><span>Range</span><b class="tc">00:00:00 – ${tc(DUR)}</b></div>
      <div class="kv"><span>Transparent background${fmt === 'MP4' ? ' (GIF and PNG only)' : fmt === 'Lottie' ? ' (always)' : ''}</span><button class="tog" data-act="exptrans" aria-pressed="${fmt === 'Lottie' || fmt !== 'MP4' && EX.trans}" aria-label="Transparent background" ${fmt === 'MP4' || fmt === 'Lottie' || run ? 'disabled' : ''}></button></div>
      ${job}
      <div class="foot">${run ? '<button class="line-btn ghost" data-act="excancel">Cancel</button>' : '<button class="line-btn ghost" data-act="close">Close</button><button class="primary" data-act="queue">' + (j && j.status === 'done' ? 'Export again' : 'Export') + '</button>'}</div>`;
}

function renderDialog() {
  let d = $('#dlg'); if (d) d.remove();
  if (!S.dialog) return;
  let inner = '';
  if (S.dialog === 'export') {
    inner = exportDialog();
  } else if (S.dialog === 'shader') {
    inner = shaderDialog();
  } else if (S.dialog === 'settings') {
    inner = `<h2>Project settings</h2>
      <div class="seg" role="group" aria-label="Duration">${[3, 5, 10, 15].map((d) => `<button data-act="setdur" data-v="${d}" aria-pressed="${DUR === d * FPS}">${d} s</button>`).join('')}</div>
      <div class="kv"><span>Size</span><b class="tc">1920 × 1080</b></div>
      <div class="kv"><span>Frame rate</span><b class="tc">30 fps</b></div>
      <div class="kv"><span>Storage</span><b>Autosaved on this device</b></div>
      <button class="line-btn" data-act="resetproj">${S.resetArm ? 'Tap again to erase and reset' : 'Reset to demo project'}</button>
      <div class="foot"><button class="primary" data-act="close">Done</button></div>`;
  } else {
    inner = `<h2>Help</h2>
      <table class="keys"><tbody>
      <tr><td>Two-finger tap</td><td>Undo · three-finger tap: Redo</td></tr><tr><td>Pinch on canvas</td><td>Zoom · drag with Hand to pan</td></tr>
      <tr><td>Drag the timeline handle</td><td>Peek or dope sheet</td></tr><tr><td>Hold a keyframe</td><td>Quick ease presets</td></tr>
      <tr><td>Hold a layer</td><td>Duplicate, pre-compose, move, delete</td></tr><tr><td>Space · K</td><td>Play/pause · Auto-key</td></tr>
      <tr><td>Shape panel</td><td>Duplicator copies, Behaviours wiggle/oscillate/spin, Parent and Blend</td></tr><tr><td>V H P R T</td><td>Select, Hand, Pen, Shape, Text</td></tr><tr><td>⌘Z · ⇧⌘Z</td><td>Undo · Redo</td></tr><tr><td>⌘A · ⌘D · ⌘G</td><td>Select all · Duplicate · Group</td></tr><tr><td>Delete</td><td>Delete selected keyframes, or the layer</td></tr></tbody></table>
      <div class="foot"><button class="primary" data-act="close">Done</button></div>`;
  }
  d = document.createElement('div'); d.id = 'dlg'; d.className = 'dlg-scrim'; d.dataset.act = 'scrimclose';
  d.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="${S.dialog === 'export' ? 'Export' : S.dialog === 'settings' ? 'Project settings' : 'Help'}" tabindex="-1">${inner}</div>`;
  app.appendChild(d); setTimeout(() => d.querySelector('.dlg').focus(), 0);
}
let toastTimer = 0;
function toast(msg, undoable) {
  let t = $('#toast'); if (t) t.remove(); clearTimeout(toastTimer);
  t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${undoable ? '<button data-act="undo">Undo</button>' : ''}`;
  app.appendChild(t); toastTimer = setTimeout(() => t.remove(), 3600);
}

/* ---------- layout ---------- */
function applyLayout() {
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
function renderAll() { applyLayout(); renderTop(); renderStrips(); renderLeft(); renderRight(); renderTL(); renderFloats(); renderPop(); setPF(); persist(); }
function persist() { store.set('left', S.left); store.set('right', S.right); store.set('tl', S.tl); store.set('collapsed', [...S.collapsed]); }
function setPF() { app.style.setProperty('--pf', (S.f / DUR).toFixed(5)); const t = $('#tcode'); if (t) t.textContent = tc(S.f); const sc = $('#scrub'); if (sc) sc.setAttribute('aria-valuenow', Math.round(S.f)); }
function seek(f) { S.f = Math.max(0, Math.min(DUR - 1, f)); setPF(); updateCanvas(); updateFields(); }
function applyTheme() {
  if (S.themePref === 'auto') { if (S.hostTheme) root.setAttribute('data-theme', S.hostTheme); else root.removeAttribute('data-theme'); }
  else root.setAttribute('data-theme', S.themePref);
  root.setAttribute('data-glow', S.glow); root.setAttribute('data-tint', S.tint);
  store.set('theme', S.themePref); store.set('glow', S.glow); store.set('tint', S.tint);
}

/* ---------- playback ---------- */
const aud = {};
function waveSvg(L) {
  const pk = L.wave || [], n = pk.length; if (!n) return '';
  const span = ((L.outP ?? DUR) - (L.inP ?? 0)) / Math.max(1, (L.adur || 1) * FPS), m = Math.max(2, Math.min(n, Math.round(n * span)));
  let d = ''; for (let i = 0; i < m; i++) { const x = (i / (m - 1) * 100).toFixed(2), h = Math.max(.04, pk[i]) * 46; d += `M${x} ${(50 - h).toFixed(1)}V${(50 + h).toFixed(1)}`; }
  return `<svg class="wave" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
}
function audioWindow(l) { const a = l.inP ?? 0, b = Math.min(l.outP ?? DUR, a + (l.adur || 0) * FPS); return [a, b]; }
function syncAudio(force) {
  for (const l of layers) {
    if (l.type !== 'audio') continue; const el = aud[l.id]; if (!el) continue;
    el.volume = Math.max(0, Math.min(1, (l.vol ?? 100) / 100)); el.muted = !!l.mute || !l.vis;
    const [a, b] = audioWindow(l), on = S.playing && S.f >= a && S.f < b;
    if (on) { const want = (S.f - a) / FPS; if (force || el.paused || Math.abs(el.currentTime - want) > .25) { el.currentTime = want; if (el.paused) el.play().catch(() => {}); } }
    else if (!el.paused) el.pause();
  }
  for (const id in aud) if (!lay(id) && !aud[id].paused) aud[id].pause();
}
function importAudio(file) {
  const url = URL.createObjectURL(file), el = new Audio(url); el.preload = 'auto';
  el.addEventListener('loadedmetadata', async () => {
    const adur = el.duration || 1; let wave = [];
    try {
      const AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), buf = await ac.decodeAudioData(await file.arrayBuffer()); ac.close && ac.close();
      const ch = buf.getChannelData(0), N = 400, step = Math.max(1, Math.floor(ch.length / N));
      for (let i = 0; i < N; i++) { let mx = 0; for (let j = i * step, e = Math.min(ch.length, j + step); j < e; j += 8) { const v = Math.abs(ch[j]); if (v > mx) mx = v; } wave.push(mx); }
      const top = Math.max(...wave, .01); wave = wave.map((v) => Math.round(v / top * 100) / 100);
    } catch { wave = []; }
    const id = 'a' + Date.now().toString(36);
    aud[id] = el;
    newLayer('audio', { id, name: file.name, src: url, adur, wave, vol: 100, mute: false, hue: '#8b7cf6', inP: 0, outP: Math.min(DUR, Math.round(adur * FPS)) });
    if (adur * FPS > DUR) toast(`Added ${file.name}. It runs past the end of the composition, so it is cut at ${tc(DUR)}.`);
  }, { once: true });
  el.addEventListener('error', () => toast('Could not read that audio file.'), { once: true });
}
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
function play(on) { S.playing = on ?? !S.playing; lastT = 0; cancelAnimationFrame(raf); if (S.playing) { foldStart('play'); raf = requestAnimationFrame(loop); } else { S.f = Math.round(S.f); foldEnd('play'); } syncAudio(true); renderTL(); setPF(); placeSel(); updateFields(); }

/* ---------- auto-fold ---------- */
// Panels fold while the user drags on the canvas or plays back. During drags the stage is frozen in
// screen space so the artwork never shifts under the finger; afterwards the frozen rect becomes zoom/pan.
let frozen = null, foldBy = null, unfoldTimer = 0;
function unfreeze() {
  if (!frozen) return;
  const r = stage.getBoundingClientRect(), v = vp.getBoundingClientRect();
  const fit = Math.min((v.width - 56) / 1920, (v.height - 56) / 1080);
  S.zoom = r.width / 1920 / fit;
  S.pan = [r.left - v.left - (v.width - r.width) / 2, r.top - v.top - (v.height - r.height) / 2];
  frozen = null; layoutStage();
}
function foldStart(kind) {
  if (!S.autoFold || foldBy || app.classList.contains('portrait') || !(S.left || S.right)) return;
  clearTimeout(unfoldTimer);
  if (kind === 'drag') { const r = stage.getBoundingClientRect(); frozen = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, pan: [...S.pan], zoom: S.zoom }; }
  else unfreeze();
  foldBy = kind; app.classList.add('folding');
}
function foldEnd(kind) {
  if (foldBy !== kind) return;
  foldBy = null; app.classList.remove('folding');
  if (frozen) unfoldTimer = setTimeout(unfreeze, 260);
}

/* ---------- actions ---------- */
let nameCount = {};
function newLayer(type, extra = {}) {
  nameCount[type] = (nameCount[type] || 0) + 1;
  const NEWD = { draw: { cels: [] }, rect: { w: 280, h: 180, cr: 24 }, star: { n: 5, ir: 43 }, polygon: { n: 5 }, line: { w: 420, sw: 12 }, ring: { r: 110, sw: 14 }, ellipse: { r: 90 } };
  const base = { draw: 'Drawing', path: 'Path', line: 'Line', ring: 'Ring', text: 'Text', rect: 'Rectangle', ellipse: 'Ellipse', star: 'Star', polygon: 'Polygon', solid: 'Solid', null: 'Null', adjust: 'Adjustment', shader: 'Shader', comp: 'Comp', image: 'Image' }[type];
  const hue = type === 'solid' ? '#2a211b' : HUES[(layers.length + 2) % HUES.length];
  const l = { id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: `${base} ${nameCount[type]}`, type, hue, vis: true, lock: false, fx: [], r: 90,
    text: 'Your text', size: 110, weight: 650, track: 0, ...(NEWD[type] || {}), p: { x: st(extra.x ?? 960), y: st(extra.y ?? 540), scale: st(100), rot: st(0), op: st(100), ax: st(0), ay: st(0), ts: st(0), te: st(100) }, ...extra };
  delete l.x; delete l.y; l.p.x = st(extra.x ?? 960); l.p.y = st(extra.y ?? 540);
  if (type === 'shader' && !extra.preset) { const P = SHP.liquid; Object.assign(l, { preset: 'liquid', name: P.name, hue: P.c[0], hue2: P.c[1], spd: 100, opaque: true }); P.def.forEach((v, k) => { l['sp' + k] = v; }); }
  if (type === 'text') l.name = 'Your text';
  layers.unshift(l); S.sel = l.id; S.keys = [];
  commit('Add ' + base); buildCanvas();
  if (!S.right && !app.classList.contains('portrait')) S.right = 'props';
  if (S.right !== 'props' && S.right !== 'effects') S.right = 'props';
  renderAll(); toast(`Added ${l.name}`, true);
  if (type === 'text') setTimeout(() => { const t = $('#ltext'); if (t) { t.focus(); t.select(); } }, 60);
}
function putKeys(l, p, ks) {
  const pr = l.p[p]; const old = animated(pr) ? pr.keys : [];
  const a = ks[0][0], b = ks[ks.length - 1][0];
  const keep = old.filter((k) => k.t < a || k.t > b);
  pr.keys = [...keep, ...ks.map(([t, v, e]) => ({ t, v, e: e || 'linear' }))].sort((x, y) => x.t - y.t); delete pr.v;
}
function applyPreset(id) {
  const ls = selIds().map(lay).filter((x) => x && !x.lock); if (!ls.length) { toast('Unlock the layer to apply a preset.'); return; }
  let ok = 0;
  ls.forEach((l, li) => { if (presetOn(l, id, li) !== false) ok++; });
  if (!ok) return;
  commit('Apply preset'); S.keys = []; ls.forEach((l) => S.open.add(l.id));
  buildCanvas(); renderAll(); toast(`${PRESETS.find((p) => p.id === id).name} applied to ${ls.length > 1 ? ls.length + ' layers' : ls[0].name}`, true);
}
function presetOn(l, id, li) {
  const f0 = Math.round(S.f), cx = val(l.p.x, f0), cy = val(l.p.y, f0), co = val(l.p.op, f0) || 100, cs = val(l.p.scale, f0) || 100, cr = val(l.p.rot, f0);
  const f = 0, ops = [], put = (p, ks) => ops.push([p, ks]);
  const D = S.pDir, dv = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[D] || [0, 1];
  const mod = (o) => { l.mods = l.mods || []; l.mods.push({ on: true, tgt: 'y', amp: 20, freq: .5, ph: 0, seed: 1 + Math.floor(Math.random() * 80), ...o }); S.collapsed.delete('beh'); };
  const rep = (o) => { l.rep = { ...REP_DEF, ...o, on: true }; S.collapsed.delete('rep'); };
  const P2 = {
    fadeIn: () => put('op', [[f, 0, 'out'], [f + 15, co]]),
    slideUp: () => { put('x', [[f, cx + dv[0] * 140, 'out'], [f + 18, cx]]); put('y', [[f, cy + dv[1] * 90, 'out'], [f + 18, cy]]); put('op', [[f, 0, 'out'], [f + 12, co]]); },
    scalePop: () => put('scale', [[f, 0, 'back'], [f + 18, cs]]),
    bounceIn: () => put('scale', [[f, 0, 'out'], [f + 10, cs * 1.15, 'inout'], [f + 16, cs * .92, 'inout'], [f + 22, cs]]),
    spinIn: () => { put('rot', [[f, cr - 180, 'out'], [f + 24, cr]]); put('op', [[f, 0, 'out'], [f + 12, co]]); },
    wipe: () => put('scale', [[f, 0, 'snap'], [f + 15, cs]]),
    draw: () => {
      if (!(l.type === 'ring' || l.type === 'line' || l.type === 'path' || STROKABLE.includes(l.type))) { if (ls1) toast('Draw On needs a shape, ring, line or path layer.'); return false; }
      if (!hasStroke(l)) { l.sw = 8; l.sc = l.sc || '#ffffff'; l.fill = false; }
      put('te', [[f, 0, 'inout'], [f + 30, 100]]);
    },
    drop: () => put('y', [[f, cy - 220, 'in'], [f + 12, cy, 'out'], [f + 18, cy - 50, 'in'], [f + 24, cy]]),
    shake: () => { const p = dv[0] ? 'x' : 'y', c = dv[0] ? cx : cy; put(p, [[f, c, 'snap'], [f + 3, c - 16, 'snap'], [f + 6, c + 14, 'snap'], [f + 9, c - 10, 'snap'], [f + 12, c + 6, 'snap'], [f + 15, c]]); },
    wobble: () => put('rot', [[f, cr, 'inout'], [f + 5, cr - 9, 'inout'], [f + 10, cr + 7, 'inout'], [f + 15, cr - 4, 'inout'], [f + 20, cr]]),
    pulse: () => put('scale', [[f, cs, 'inout'], [f + 15, cs * 1.12, 'inout'], [f + 30, cs]]),
    float: () => mod({ kind: 'osc', tgt: 'y', amp: 14 * S.pAmt / 100, freq: .5 }),
    wiggle: () => { mod({ kind: 'wiggle', tgt: 'x', amp: 24 * S.pAmt / 100, freq: 1.1 }); mod({ kind: 'wiggle', tgt: 'y', amp: 24 * S.pAmt / 100, freq: 1.3 }); },
    spinLoop: () => mod({ kind: 'spin', tgt: 'rot', amp: 90 * S.pAmt / 100 }),
    fadeOut: () => put('op', [[f, co, 'in'], [f + 15, 0]]),
    slideOut: () => { put('x', [[f, cx, 'in'], [f + 18, cx - dv[0] * 140]]); put('y', [[f, cy, 'in'], [f + 18, cy - dv[1] * 90]]); put('op', [[f + 6, co, 'in'], [f + 18, 0]]); },
    scaleOut: () => { put('scale', [[f, cs, 'anticip'], [f + 15, 0]]); put('op', [[f + 5, co, 'in'], [f + 15, 0]]); },
    rippleRings: () => rep({ mode: 'linear', count: 5, dx: 0, dy: 0, sc: 45, fade: 22, stag: 5 }),
    fanOut: () => rep({ mode: 'radial', count: 8, rad: 180, align: true, stag: 2 }),
    gridPop: () => rep({ mode: 'grid', count: 15, cols: 5, dx: 90, dy: 90, stag: 2 }),
    wave: () => { rep({ mode: 'linear', count: 7, dx: 70, dy: 0, stag: 2 }); mod({ kind: 'osc', tgt: 'y', amp: 40 * S.pAmt / 100, freq: .8, ph: .12 }); },
  };
  const ls1 = li === 0;
  if (P2[id]() === false) return false;
  if (!ops.length) return true;
  // timing: stretch by Duration, scale movement by Intensity around the layer's current value, then place in time
  const base = { x: cx, y: cy, scale: cs, op: co, rot: cr, te: 100, ts: 0 }, k = S.pDur / 100, amt = S.pAmt / 100;
  const len = Math.max(...ops.flatMap(([, ks]) => ks.map((q) => q[0]))) * k;
  const start = (S.pAt === 'in' ? (l.inP ?? 0) : S.pAt === 'out' ? (l.outP ?? DUR) - 1 - len : f0) + li * S.pStag;
  ops.forEach(([p, ks]) => {
    const b = base[p] ?? 0, m = PROPS[p];
    let last = -1; const out = ks.map(([t, v, e]) => [Math.max(0, Math.min(DUR - 1, Math.round(start + t * k))), clamp(b + (v - b) * amt, m.min, m.max), e]).filter((q) => q[0] > last && (last = q[0], true));
    if (out.length) putKeys(l, p, out);
  });
  return true;
}
function savePreset() {
  const l = S.sel && lay(S.sel); if (!l) return;
  const props = {}; let t0 = Infinity;
  TF.forEach((p) => { if (animated(l.p[p])) l.p[p].keys.forEach((k) => { t0 = Math.min(t0, k.t); }); });
  if (t0 === Infinity) t0 = 0;
  TF.forEach((p) => {
    if (!animated(l.p[p])) return;
    const k0 = l.p[p].keys[0].v;
    props[p] = l.p[p].keys.map((k) => ({ t: k.t - t0, v: p === 'x' || p === 'y' ? k.v - k0 : k.v, e: k.e }));
  });
  const copy = (o) => JSON.parse(JSON.stringify(o));
  if (!Object.keys(props).length && !(l.mods || []).length && !l.rep && !l.fx.length) { toast('Nothing to save yet. Add keyframes, behaviours, a duplicator or effects first.'); return; }
  const list = myPresets(); const n = list.length + 1;
  list.push({ id: 'u' + Date.now().toString(36), name: `${l.name} motion ${n}`, props, mods: copy(l.mods || []), rep: l.rep ? copy(l.rep) : null, fx: copy(l.fx) });
  store.set('myPresets', list); S.cat = 'Mine'; renderRight(); toast('Saved as a preset in Mine.');
}
function applyMine(id) {
  const l = S.sel && lay(S.sel), e = myPresets().find((p) => p.id === id); if (!l || !e) return;
  const f = Math.round(S.f), cx = val(l.p.x, f), cy = val(l.p.y, f), copy = (o) => JSON.parse(JSON.stringify(o));
  for (const p in e.props) putKeys(l, p, e.props[p].map((k) => [f + k.t, (p === 'x' ? cx : p === 'y' ? cy : 0) + k.v, k.e]));
  if (e.mods.length) { l.mods = [...(l.mods || []), ...copy(e.mods)]; S.collapsed.delete('beh'); }
  if (e.rep) { l.rep = copy(e.rep); S.collapsed.delete('rep'); }
  if (e.fx.length) l.fx = [...l.fx, ...copy(e.fx)];
  commit('Apply preset'); S.keys = []; S.open.add(l.id); buildCanvas(); renderAll(); toast(`${e.name} applied to ${l.name}`, true);
}

const A = {
  undo, redo,
  repon: () => { const l = lay(S.sel); if (!l) return; if (!l.rep) l.rep = { ...REP_DEF, on: true }; else l.rep.on = !l.rep.on; if (l.rep.on) S.collapsed.delete('rep'); commit('Duplicator'); buildCanvas(); renderRight(); renderTL(); },
  repalign: () => { const l = lay(S.sel); l.rep.align = !l.rep.align; commit('Duplicator'); updateCanvas(); renderRight(); },
  fillon: () => { const l = lay(S.sel); l.fill = l.fill === false; commit('Fill'); buildCanvas(); renderRight(); },
  modadd: (el) => {
    const l = lay(S.sel); if (!l) return; const kind = el.dataset.v; l.mods = l.mods || [];
    const base = { spin: { tgt: 'rot', amp: 90, freq: 1 }, wiggle: { tgt: 'x', amp: 30, freq: 1.2 }, jitter: { tgt: 'rot', amp: 8, freq: 2 }, bounce: { tgt: 'scale', amp: 40, freq: 1.6, dec: 4 }, pulse: { tgt: 'scale', amp: 15, freq: 2, dec: 6 }, orbit: { tgt: 'x', amp: 80, freq: .4, ell: 100 }, drift: { tgt: 'x', amp: 40, freq: 1 } }[kind] || { tgt: 'y', amp: 20, freq: .5 };
    l.mods.push({ kind, on: true, ph: 0, seed: 1 + Math.floor(Math.random() * 80), ...base }); commit('Add behaviour'); updateCanvas(); renderRight();
  },
  moddel: (el) => { const l = lay(S.sel); l.mods.splice(+el.dataset.v, 1); commit('Remove behaviour'); updateCanvas(); renderRight(); },
  modon: (el) => { const l = lay(S.sel), m = l.mods[+el.dataset.v]; m.on = !m.on; commit('Toggle behaviour'); updateCanvas(); renderRight(); },
  psave: () => savePreset(),
  mypreset: (el) => applyMine(el.dataset.v),
  mypdel: (el) => { store.set('myPresets', myPresets().filter((p) => p.id !== el.dataset.v)); renderRight(); toast('Preset deleted'); },
  menu: () => { S.pop = S.pop === 'menu' ? null : 'menu'; renderTop(); renderPop(); },
  insert: () => { S.pop = S.pop === 'insert' ? null : 'insert'; renderStrips(); renderPop(); },
  export: () => { S.dialog = 'export'; S.pop = null; renderPop(); renderDialog(); },
  settings: () => { S.dialog = 'settings'; S.pop = null; renderPop(); renderDialog(); },
  help: () => { S.dialog = 'help'; S.pop = null; renderPop(); renderDialog(); },
  close: () => { S.shDraft = null; S.shImport = false; if (exportJob && exportJob.status === 'run') exportJob.cancel = true; S.dialog = null; renderDialog(); },
  scrimclose: (el, e) => { if (e.target === el) A.close(); },
  queue: () => runExport(),
  amute: () => { const l = lay(S.sel); if (!l) return; l.mute = !l.mute; commit(l.mute ? 'Mute' : 'Unmute'); syncAudio(); renderRight(); },
  shopaque: () => { const l = lay(S.sel); if (!l) return; l.opaque = l.opaque === false; commit('Shader alpha'); updateCanvas(); renderRight(); },
  shedit: () => { S.shImport = false; S.shDraft = null; S.dialog = 'shader'; renderDialog(); },
  shimport: () => { S.shImport = true; S.shDraft = ''; S.dialog = 'shader'; renderDialog(); },
  shrevert: () => { const l = lay(S.sel); if (!l) return; delete l.code; commit('Shader preset'); S.dialog = null; S.shDraft = null; buildCanvas(); renderAll(); renderDialog(); },
  shapply: () => {
    const l = lay(S.sel), ta = $('#shcode'); if (!l || !ta) return;
    const code = ta.value.trim(); if (!code) { toast('Paste some shader code first.'); return; }
    if (!/mainImage/.test(code)) { toast('No mainImage function found. Shadertoy code needs mainImage; WGSL needs fn mainImage(fragCoord: vec2f) -> vec4f.'); return; }
    l.code = code; if (S.shImport) { const m = /^\s*\/\/\s*(.{2,40})$/m.exec(code); l.name = m ? m[1].trim() : 'Imported shader'; }
    commit(S.shImport ? 'Import shader' : 'Edit shader'); S.shImport = false; S.shDraft = code; buildCanvas(); renderAll();
    const rt = SH[l.id];
    if (rt && rt.ok) { S.dialog = null; S.shDraft = null; toast(`Shader running (${rt.lang === 'wgsl' ? 'WebGPU' : 'WebGL'})`); }
    renderDialog();
  },
  pendone: () => penFinish(false), penclose: () => penFinish(true), penundo: () => penUndo(),
  pencancel: () => { S.penPts = []; drawOverlay(); renderFloats(); },
  pathsm: () => { const l = lay(S.sel); if (!l) return; l.smooth = !l.smooth; commit('Smooth path'); buildCanvas(); renderRight(); },
  pathcl: () => { const l = lay(S.sel); if (!l) return; l.closed = !l.closed; if (!l.closed) l.fill = false; commit('Close path'); buildCanvas(); renderRight(); },
  pathfill: () => { const l = lay(S.sel); if (!l) return; l.fill = !(l.fill === true); commit('Path fill'); buildCanvas(); renderRight(); },
  copykeys: () => copyKeys(),
  pastekeys: () => pasteKeys(),
  excancel: () => { if (exportJob) exportJob.cancel = true; },
  exsave: () => exSave(),
  expfmt: (el) => { EX.fmt = el.dataset.v; renderDialog(); },
  expres: (el) => { EX.res[EX.fmt] = +el.dataset.v; renderDialog(); },
  expfps: (el) => { EX.fps[EX.fmt] = +el.dataset.v; renderDialog(); },
  exptrans: () => { EX.trans = !EX.trans; renderDialog(); },
  tool: (el) => { S.tool = el.dataset.v; if (S.tool !== 'pen' && S.penPts.length) { S.penPts = []; drawOverlay(); } if (SHAPES.some((s) => s[0] === S.tool)) S.shape = S.tool; if (isSelTool(S.tool)) S.selMode = S.tool; if (isDrawTool(S.tool)) S.drawMode = S.tool; renderStrips(); renderFloats(); },
  pickdraw: (el) => { S.drawMode = S.tool = el.dataset.v; S.pop = null; renderStrips(); renderPop(); renderFloats(); },
  bpre: (el) => { S.brush.pre = el.dataset.v; if (S.tool !== 'brush') { S.tool = S.drawMode = 'brush'; renderStrips(); } saveBrush(); renderFloats(); },
  btog: (el) => { const k = el.dataset.k; S.brush[k] = !S.brush[k]; saveBrush(); renderBrushBar(); toast(k === 'pr' ? (S.brush.pr ? 'Pressure changes width' : 'Pressure off') : (S.brush.tl ? 'Tilt the Pencil to shade' : 'Tilt off')); },
  bcolour: () => { S.pop = { type: 'color', key: 'brush' }; renderPop(); },
  celadd: () => addCel(false),
  celdup: () => addCel(true),
  celclear: () => { const l = lay(S.sel), i = l && celIdx(l, S.f); if (!l || i < 0) return; l.cels[i].strokes = []; l.cels[i].v = (l.cels[i].v || 0) + 1; commit('Clear cel'); updateCanvas(); renderRight(); renderTL(); toast('Cel cleared', true); },
  onion: () => { S.onion.on = !S.onion.on; saveOnion(); updateCanvas(); renderTL(); if (S.pop && S.pop.type === 'onion') renderPop(); },
  onionpop: (el) => { const r = el.getBoundingClientRect(); S.pop = { type: 'onion', x: r.left + r.width / 2, y: r.top + 360 }; renderPop(); },
  onset: (el) => { const k = el.dataset.k; if (k === 'tint' || k === 'lb') S.onion[k] = !S.onion[k]; else S.onion[k] = +el.dataset.v; if (k !== 'lb' && k !== 'tint') S.onion.on = true; saveOnion(); updateCanvas(); renderTL(); renderPop(); },
  celop: (el) => {
    const P0 = S.pop, l = lay(P0.l), c = l && (l.cels || []).find((x) => x.id === P0.id); S.pop = null; if (!c) { renderPop(); return; }
    if (el.dataset.v === 'del') { l.cels = l.cels.filter((x) => x !== c); commit('Delete cel'); toast('Cel deleted', true); }
    else { const f = freeFrame(l, c.f + 1); if (f < 0) { toast('No free frame after this cel.'); renderPop(); return; } insertCel(l, f, el.dataset.v === 'dup' ? c.strokes : []); commit(el.dataset.v === 'dup' ? 'Duplicate cel' : 'Blank cel'); seek(f); }
    renderPop(); updateCanvas(); renderTL(); renderRight();
  },
  picksel: (el) => { S.selMode = S.tool = el.dataset.v; S.pop = null; renderStrips(); renderPop(); renderFloats(); },
  pickshape: (el) => { S.shape = S.tool = el.dataset.v; S.pop = null; renderStrips(); renderPop(); renderFloats(); },
  left: (el) => { const v = el.dataset.v; S.left = S.left === v ? null : v; if (S.left && app.classList.contains('portrait')) S.right = null; S.pop = null; renderAll(); },
  right: (el) => { const v = el.dataset.v; S.right = S.right === v ? null : v; if (S.right && app.classList.contains('portrait')) S.left = null; if (S.right && !app.classList.contains('portrait') && S.left && app.clientWidth - 96 - 576 < 520) S.left = null; S.pop = null; renderAll(); },
  sel: (el) => { const id = el.dataset.v; S.multi.clear(); if (S.sel !== id) S.keys = []; S.sel = id; if (app.classList.contains('portrait') && el.classList.contains('lrow')) { S.left = null; } renderAll(); },
  vis: (el, e) => { e.stopPropagation(); const l = lay(el.dataset.v); l.vis = !l.vis; commit('Visibility'); updateCanvas(); renderLeft(); renderTL(); if (el.closest('#rpanel')) renderRight(); },
  lock: (el, e) => { e.stopPropagation(); const l = lay(el.dataset.v); l.lock = !l.lock; commit('Lock'); renderLeft(); if (el.closest('#rpanel')) renderRight(); },
  solo: (el, e) => { e.stopPropagation(); const id = el.dataset.v; S.solo.has(id) ? S.solo.delete(id) : S.solo.add(id); updateCanvas(); renderLeft(); renderRight(); toast(S.solo.size ? `Solo: showing ${S.solo.size} layer${S.solo.size > 1 ? 's' : ''}` : 'Solo off'); },
  allvis: () => { const on = !layers.every((l) => l.vis); layers.forEach((l) => { l.vis = on; }); commit(on ? 'Show all' : 'Hide all'); updateCanvas(); renderLeft(); renderTL(); },
  unlockall: () => { layers.forEach((l) => { l.lock = false; }); commit('Unlock all'); renderLeft(); toast('All layers unlocked'); },
  lqclear: () => { S.lq = ''; renderLeft(); },
  acat: (el) => { S.acat = el.dataset.v; renderLeft(); },
  selall: () => { if (!layers.length) return; S.multi = new Set(layers.map((l) => l.id)); S.sel = layers[0].id; S.keys = []; renderAll(); toast(`${layers.length} layers selected`); },
  lmove: (el) => { const l = lay(S.sel); if (!l) return; const i = layers.indexOf(l), j = i + +el.dataset.v; if (j < 0 || j >= layers.length) return; layers.splice(i, 1); layers.splice(j, 0, l); commit('Reorder'); buildCanvas(); renderAll(); },
  flipx: () => { const ls = selIds().map(lay); ls.forEach((l) => { l.flipX = !l.flipX; }); commit('Flip horizontal'); updateCanvas(); renderRight(); },
  flipy: () => { const ls = selIds().map(lay); ls.forEach((l) => { l.flipY = !l.flipY; }); commit('Flip vertical'); updateCanvas(); renderRight(); },
  tfreset: () => {
    const ls = selIds().map(lay).filter((l) => l && !l.lock); if (!ls.length) return;
    const D = { x: 960, y: 540, scale: 100, rot: 0, op: 100 };
    ls.forEach((l) => { for (const p in D) l.p[p] = st(D[p]); l.flipX = l.flipY = false; });
    S.keys = S.keys.filter((k) => !(ls.some((l) => l.id === k.l) && k.p in D));
    commit('Reset transform'); updateCanvas(); renderAll(); toast('Transform reset: centred, 100%, 0°, fully opaque', true);
  },
  gtype: (el) => { const l = lay(S.sel); if (!l) return; l.gtype = el.dataset.v; commit('Gradient type'); buildCanvas(); renderRight(); },
  gswap: () => { const l = lay(S.sel); if (!l) return; const a = l.hue; l.hue = l.hue2 || '#ff5ea8'; l.hue2 = a; commit('Swap gradient'); buildCanvas(); renderAll(); },
  trimin: () => { const l = lay(S.sel); if (!l) return; l.inP = Math.min(Math.round(S.f), (l.outP ?? DUR) - 1); commit('Layer in'); buildCanvas(); renderRight(); renderTL(); },
  trimout: () => { const l = lay(S.sel); if (!l) return; l.outP = Math.max(Math.round(S.f) + 1, (l.inP ?? 0) + 1); commit('Layer out'); buildCanvas(); renderRight(); renderTL(); },
  fxshut: (el) => { const l = lay(S.sel), e = l && l.fx[+el.dataset.v]; if (!e) return; e.shut = !e.shut; saveProj(); renderRight(); },
  fxfold: () => { const l = lay(S.sel); if (!l) return; const shut = !l.fx.every((e) => e.shut); l.fx.forEach((e) => { e.shut = shut; }); saveProj(); renderRight(); },
  fxreset: (el) => { const l = lay(S.sel), e = l && l.fx[+el.dataset.v]; if (!e) return; FXDEF[e.id].ps.forEach(([k, , , , , , def]) => { e[k] = def; }); e.mix = 100; commit('Reset effect'); buildCanvas(); renderRight(); toast(`${e.name} reset`, true); },
  fxmenu: (el) => { const r = el.getBoundingClientRect(); S.pop = { type: 'fxm', i: +el.dataset.v, x: r.right, y: r.bottom }; renderPop(); },
  fxbypass: () => { const l = lay(S.sel); if (!l) return; l.fxOff = !l.fxOff; commit(l.fxOff ? 'Bypass effects' : 'Enable effects'); buildCanvas(); renderRight(); },
  fxcopy: () => { const l = lay(S.sel); if (!l || !l.fx.length) return; fxClip = JSON.parse(JSON.stringify(l.fx)); renderRight(); toast(`Copied ${l.fx.length} effect${l.fx.length > 1 ? 's' : ''}`); },
  fxpaste: () => { if (!fxClip) return; const ls = selIds().map(lay).filter((l) => l && !l.lock); ls.forEach((l) => { l.fx = [...l.fx, ...JSON.parse(JSON.stringify(fxClip))]; }); commit('Paste effects'); buildCanvas(); renderAll(); toast(`Pasted ${fxClip.length} effect${fxClip.length > 1 ? 's' : ''}`, true); },
  fxdup: () => { const l = lay(S.sel), i = S.pop && S.pop.i; if (!l || l.fx[i] == null) return; l.fx.splice(i + 1, 0, JSON.parse(JSON.stringify(l.fx[i]))); S.pop = null; commit('Duplicate effect'); buildCanvas(); renderAll(); },
  fxmv: (el) => { const l = lay(S.sel), i = S.pop && S.pop.i, j = i + +el.dataset.v; if (!l || j < 0 || j >= l.fx.length) return; const [x] = l.fx.splice(i, 1); l.fx.splice(j, 0, x); S.pop = null; commit('Reorder effects'); buildCanvas(); renderAll(); },
  fxsolo: () => { const l = lay(S.sel), i = S.pop && S.pop.i; if (!l) return; l.fx.forEach((e, j) => { e.on = j === i; }); l.fxOff = false; S.pop = null; commit('Solo effect'); buildCanvas(); renderAll(); toast(`Only ${l.fx[i].name} is on`, true); },
  keysall: () => { const l = S.sel && lay(S.sel); if (!l) return; S.keys = TF.filter((p) => animated(l.p[p])).flatMap((p) => l.p[p].keys.map((k, i) => ({ l: l.id, p, i }))); S.open.add(l.id); renderAll(); },
  keysdel: () => {
    if (!S.keys.length) return; const n = S.keys.length;
    const hold = {}; S.keys.forEach((k) => { const l = lay(k.l), pr = l && l.p[k.p]; if (pr) hold[k.l + ':' + k.p] = val(pr, S.f); });
    [...S.keys].sort((a, b) => b.i - a.i).forEach((k) => { const l = lay(k.l), pr = l && l.p[k.p]; if (!pr || !pr.keys || !pr.keys[k.i]) return; pr.keys.splice(k.i, 1); if (!pr.keys.length) { delete pr.keys; pr.v = hold[k.l + ':' + k.p]; } });
    S.keys = []; commit('Delete keyframes'); updateCanvas(); renderAll(); toast(`Deleted ${n} keyframe${n > 1 ? 's' : ''}`, true);
  },
  ezcopy: () => { const k = selectedKeyObjs()[0]; if (!k) return; S.easeClip = Array.isArray(k.e) ? [...k.e] : k.e; renderRight(); toast(`Copied ${ename(k)} curve`); },
  ezpaste: () => { if (!S.easeClip) return; selectedKeyObjs().forEach((k) => { k.e = Array.isArray(S.easeClip) ? [...S.easeClip] : S.easeClip; }); commit('Paste easing'); updateCanvas(); renderAll(); },
  ezrev: () => { const ks = selectedKeyObjs(); if (!ks.length) return; ks.forEach((k) => { const a = earr(k); k.e = [1 - a[2], 1 - a[3], 1 - a[0], 1 - a[1]].map((n) => Math.round(n * 100) / 100); }); commit('Mirror easing'); updateCanvas(); renderAll(); },
  popt: (el) => { S[el.dataset.k] = el.dataset.v; renderRight(); },
  popreset: () => { Object.assign(S, { pDur: 100, pAmt: 100, pDir: 'up', pAt: 'head', pStag: 0 }); renderRight(); },
  compbg: (el) => { compBg = el.dataset.v || null; saveProj(); buildCanvas(); renderRight(); },
  guide: (el) => { S.guide = el.dataset.v; store.set('guide', S.guide); buildCanvas(); renderRight(); renderFloats(); },
  loopt: () => { S.loop = !S.loop; renderTL(); toast(S.loop ? 'Loop on' : 'Loop off: playback stops at the end'); },
  wareset: () => { S.wa = [0, DUR]; renderTL(); },
  twirl: (el, e) => { e.stopPropagation(); const id = el.dataset.v; S.open.has(id) ? S.open.delete(id) : S.open.add(id); renderTL(); },
  cat: (el) => { S.cat = el.dataset.v; renderRight(); },
  preset: (el) => applyPreset(el.dataset.v),
  sec: (el) => { const v = el.dataset.v; S.collapsed.has(v) ? S.collapsed.delete(v) : S.collapsed.add(v); renderRight(); persist(); },
  kf: (el, e) => { e.stopPropagation(); const l = lay(el.dataset.l); toggleKey(l, el.dataset.p); updateCanvas(); renderRight(); renderTL(); renderTop(); },
  hue: (el) => { const l = lay(S.sel); l.hue = el.dataset.v; commit('Colour'); buildCanvas(); renderAll(); },
  tset: (el) => { const l = lay(S.sel); if (!l) return; const k = el.dataset.k; if (k === 'italic' || k === 'under' || k === 'strike') l[k] = !l[k]; else l[k] = el.dataset.v; commit('Text style'); buildCanvas(); renderRight(); },
  weight: (el) => { const l = lay(S.sel); l.weight = +el.dataset.v; commit('Weight'); buildCanvas(); renderRight(); },
  ease: (el) => { const e = el.dataset.v; selectedKeyObjs().forEach((k) => (k.e = e)); commit('Easing'); if (el.dataset.close) { S.pop = null; renderPop(); } renderRight(); renderTL(); renderTop(); updateCanvas(); toast(`Easing set to ${EASE_NAMES[e]}`); },
  qease: (el) => {
    const l = S.sel && lay(S.sel); if (!l) return;
    if (!S.keys.length) {
      const ks = []; TF.forEach((p) => { const i = keyAt(l.p[p], S.f); if (i >= 0) ks.push({ l: l.id, p, i }); });
      if (!ks.length) { toast('Move the playhead onto a keyframe to ease it, or tap Keyframe first.'); return; }
      S.keys = ks;
    }
    const r = el.getBoundingClientRect(); S.pop = { type: 'ease', x: r.left + r.width / 2, y: r.top }; renderAll();
  },
  play: () => play(),
  autokey: () => { S.autoKey = !S.autoKey; renderTL(); toast(S.autoKey ? 'Auto-key on: edits at the playhead make keyframes.' : 'Auto-key off'); },
  tlmode: (el) => { S.tlMode = el.dataset.v; renderTL(); },
  marker: () => { markers.push({ f: Math.round(S.f), name: 'Marker ' + (markers.length + 1) }); markers.sort((a, b) => a.f - b.f); commit('Add marker'); renderTL(); renderRight(); toast('Marker added at ' + tc(S.f) + '. Rename it in the Composition panel.'); },
  mkjump: (el) => { const m = markers[+el.dataset.v]; if (m) { if (S.playing) play(false); seek(m.f); } },
  mkdel: (el) => { markers.splice(+el.dataset.v, 1); commit('Delete marker'); renderTL(); renderRight(); },
  toast: (el) => toast(el.dataset.v),
  zoom: (el) => { S.zoom = Math.max(.25, Math.min(6, S.zoom * +el.dataset.v)); layoutStage(); },
  fit: () => {
    /* One control for both: tap fits the selection (when there is one); tap again returns to the whole workspace. */
    if (S.sel && gEls[S.sel] && !fitSelOn) { A.fitsel(); return; }
    fitSelOn = false; S.zoom = 1; S.pan = [0, 0]; layoutStage();
  },
  zslide: (el) => { S.zoom = Math.max(.25, Math.min(6, Math.exp(+el.value))); layoutStage(); },
  fitsel: () => {
    const g = S.sel && gEls[S.sel]; if (!g) return A.fit();
    S.zoom = 1; S.pan = [0, 0]; layoutStage(); fitSelOn = true;
    const r = g.getBoundingClientRect(), s = stage.getBoundingClientRect();
    const k = Math.min(4, Math.min(vp.clientWidth / (r.width * 1.6), vp.clientHeight / (r.height * 1.6)));
    S.zoom *= k; S.pan = [0, 0]; layoutStage();
    const s2 = stage.getBoundingClientRect(), cx = (r.left + r.width / 2 - s.left) / s.width, cy = (r.top + r.height / 2 - s.top) / s.height;
    const v = vp.getBoundingClientRect();
    S.pan = [v.width / 2 - (s2.left - v.left + cx * s2.width), v.height / 2 - (s2.top - v.top + cy * s2.height)]; layoutStage();
  },
  snap: () => { S.snap = !S.snap; renderFloats(); },
  keyall: () => { const ls = targets(); let n = 0; ls.forEach((l) => KEYALL.forEach((p) => { const pr = l.p[p]; if (!animated(pr)) { pr.keys = [{ t: Math.round(S.f), v: pr.v, e: 'ease' }]; delete pr.v; n++; } else if (keyAt(pr, S.f) < 0) { pr.keys.push({ t: Math.round(S.f), v: val(pr, S.f), e: 'ease' }); pr.keys.sort((a, b) => a.t - b.t); n++; } })); if (!ls.length) return; commit('Keyframe'); ls.forEach((l) => S.open.add(l.id)); renderAll(); toast(`Keyed ${n} properties on ${ls.length > 1 ? ls.length + ' layers' : ls[0].name} at ${tc(S.f)}`, true); },
  align: () => { S.pop = { type: 'align' }; renderPop(); },
  dup: () => { const ls = targets(); if (!ls.length) return; const ids = []; ls.forEach((l) => { const c = JSON.parse(JSON.stringify(l)); c.id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); (c.cels || []).forEach((x) => { x.id = celId(); }); c.name = l.name + ' copy'; layers.splice(layers.indexOf(l), 0, c); ids.push(c.id); }); S.multi = new Set(ids); S.sel = ids[0]; S.pop = null; commit('Duplicate'); buildCanvas(); renderAll(); toast(`Duplicated ${ls.length > 1 ? ls.length + ' layers' : ls[0].name}`, true); },
  group: () => {
    const ls = targets(); if (!ls.length) return;
    if (ls.length === 1) { const l = ls[0]; if (!l.comp) { l.comp = true; l.name = l.name + ' comp'; } S.pop = null; commit('Pre-compose'); buildCanvas(); renderAll(); toast('Pre-composed into ' + l.name + '. Double-tap to open it.', true); return; }
    const sr = stage.getBoundingClientRect(), r = selRect(), cx = r ? (r.left + r.width / 2 - sr.left) / sr.width * 1920 : 960, cy = r ? (r.top + r.height / 2 - sr.top) / sr.height * 1080 : 540;
    const at = Math.min(...ls.map((l) => layers.indexOf(l))); nameCount.group = (nameCount.group || 0) + 1;
    const g = { id: 'l' + Date.now().toString(36), name: `Group ${nameCount.group}`, type: 'comp', comp: true, hue: HUES[0], vis: true, lock: false, fx: [], kids: ls.map((l) => l.name), p: { x: st(Math.round(cx)), y: st(Math.round(cy)), scale: st(100), rot: st(0), op: st(100), ax: st(0), ay: st(0), ts: st(0), te: st(100) } };
    layers = layers.filter((l) => !ls.includes(l)); layers.splice(at, 0, g); S.multi.clear(); S.sel = g.id; S.keys = []; S.pop = null;
    commit('Pre-compose'); buildCanvas(); renderAll(); toast(`Grouped ${ls.length} layers into ${g.name}. Double-tap to open it.`, true);
  },
  del: () => { const ls = targets(); if (!ls.length) return; layers = layers.filter((x) => !ls.includes(x)); S.sel = null; S.multi.clear(); S.keys = []; S.pop = null; commit('Delete'); buildCanvas(); renderAll(); toast(`Deleted ${ls.length > 1 ? ls.length + ' layers' : ls[0].name}`, true); },
  move: (el) => { const l = lay(S.pop.id), i = layers.indexOf(l), j = i + +el.dataset.v; if (j >= 0 && j < layers.length) { layers.splice(i, 1); layers.splice(j, 0, l); commit('Reorder'); buildCanvas(); } S.pop = null; renderAll(); },
  add: (el) => { S.pop = null; newLayer(el.dataset.v); if (el.dataset.v === 'draw') { S.tool = S.drawMode; renderStrips(); renderFloats(); } },
  addfx: () => { S.pop = { type: 'fx' }; renderPop(); },
  fxadd: (el) => { const l = lay(S.sel); const id = el.dataset.v, D = FXDEF[id], e = { id, name: D.name, on: true }; D.ps.forEach(([k, , , , , , def]) => { e[k] = def; }); l.fx.push(e); S.pop = null; commit('Add effect'); buildCanvas(); renderAll(); },
  fxon: (el) => { const l = lay(S.sel); const e = l.fx[+el.dataset.v]; e.on = !e.on; commit('Toggle effect'); buildCanvas(); renderRight(); },
  fxdel: (el) => { const l = lay(S.sel); l.fx.splice(+el.dataset.v, 1); S.pop = null; renderPop(); commit('Remove effect'); buildCanvas(); renderRight(); },
  theme: (el) => { S.themePref = el.dataset.v; applyTheme(); renderPop(); },
  glow: () => { S.glow = S.glow === 'soft' ? 'full' : 'soft'; applyTheme(); renderPop(); },
  tint: (el) => { S.tint = el.dataset.v; applyTheme(); renderPop(); },
  perf: () => { S.perf = !S.perf; $('#hud').hidden = !S.perf; $('#hud').textContent = `60 fps · ${layers.length} layers · frame ${Math.floor(S.f)}`; renderPop(); },
  mb: () => { S.mb = !S.mb; renderPop(); toast(S.mb ? 'Motion blur preview on' : 'Motion blur preview off'); },
  pp: () => { S.portraitPreview = !S.portraitPreview; S.pop = null; renderAll(); setTimeout(() => { applyLayout(); layoutStage(); }, 260); },
  kprev: (el) => { const l = S.sel && lay(S.sel); if (!l) return; const st2 = grpState(l, el.dataset.g); if (st2.prev != null) { if (S.playing) play(false); seek(st2.prev); renderTL(); } },
  knext: (el) => { const l = S.sel && lay(S.sel); if (!l) return; const st2 = grpState(l, el.dataset.g); if (st2.next != null) { if (S.playing) play(false); seek(st2.next); renderTL(); } },
  kgroup: (el) => {
    const l = S.sel && lay(S.sel); if (!l) return;
    const g = el.dataset.g, G = GROUPS[g], st2 = grpState(l, g), f = Math.round(S.f);
    if (st2.on) {
      G.ps.forEach((p) => { const pr = l.p[p], i = keyAt(pr, S.f); if (i >= 0) { const v = pr.keys[i].v; pr.keys.splice(i, 1); if (!pr.keys.length) { delete pr.keys; pr.v = v; } } });
      S.keys = S.keys.filter((k) => !(k.l === l.id && G.ps.includes(k.p))); commit('Remove keyframe');
    } else {
      G.ps.forEach((p) => { const pr = l.p[p]; if (!animated(pr)) { pr.keys = [{ t: f, v: pr.v, e: 'ease' }]; delete pr.v; } else { pr.keys.push({ t: f, v: val(pr, S.f), e: 'ease' }); pr.keys.sort((a, b) => a.t - b.t); } });
      commit(st2.anim ? 'Add keyframe' : 'Animate ' + G.label);
      if (!st2.anim) toast(`${G.label} is animated. Edits at the playhead now make keyframes.`);
    }
    S.open.add(l.id); updateCanvas(); renderRight(); renderTL(); renderTop();
  },
  anchorpick: () => { S.pop = { type: 'anchor' }; renderPop(); },
  anchor: (el) => {
    const l = S.sel && lay(S.sel), g = l && gEls[l.id]; if (!g) return;
    const bb = g.querySelector('.xf').getBBox(), [fx2, fy] = el.dataset.v.split(',').map(Number), f = S.f;
    const ax0 = val(l.p.ax, f), ay0 = val(l.p.ay, f), nax = Math.round(bb.x + fx2 * bb.width), nay = Math.round(bb.y + fy * bb.height);
    const sc = val(l.p.scale, f) / 100, r = val(l.p.rot, f) * Math.PI / 180, dx = (nax - ax0) * sc, dy = (nay - ay0) * sc;
    setVal(l, 'x', val(l.p.x, f) + dx * Math.cos(r) - dy * Math.sin(r)); setVal(l, 'y', val(l.p.y, f) + dx * Math.sin(r) + dy * Math.cos(r));
    setVal(l, 'ax', nax); setVal(l, 'ay', nay);
    S.pop = null; commit('Anchor point'); updateCanvas(); renderAll(); toast('Anchor moved. The layer stays in place.', true);
  },
  colour: (el) => { S.pop = { type: 'color', key: el.dataset.key || 'hue' }; renderPop(); },
  cpsw: (el) => { if (!cp) return; Object.assign(cp, hexToHsv(el.dataset.v)); cpApply(el.dataset.v); },
  eyedrop: () => { S.eyedrop = cp ? (cp.key || 'hue') : 'hue'; S.pop = null; renderPop(); renderFloats(); },
  autofold: () => { S.autoFold = !S.autoFold; store.set('autofold', S.autoFold); renderPop(); },
  alignto: (el) => alignTo(el.dataset.v),
  msel: () => { const id = S.pop && S.pop.id; S.pop = null; if (id) toggleMember(id, S.ctxPrev || []); },
  step: (el) => { if (S.playing) play(false); seek(Math.round(S.f) + +el.dataset.v); renderTL(); },
  animadd: (el) => { const l = lay(S.sel); const t = el.dataset.v, d = ANIMS[t]; l.anims = [...(l.anims || []), { type: t, start: Math.round(S.f), stagger: d[2], dur: d[1] || 1 }]; S.collapsed.delete('tanim'); commit('Add text animator'); buildCanvas(); renderRight(); renderTL(); toast(`${d[0]} starts at ${tc(S.f)}. Press play to see it.`, true); },
  animdel: (el) => { const l = lay(S.sel); l.anims.splice(+el.dataset.v, 1); commit('Remove text animator'); buildCanvas(); renderRight(); renderTL(); },
  animstart: (el) => { const l = lay(S.sel); l.anims[+el.dataset.v].start = Math.round(S.f); commit('Move text animator'); updateCanvas(); renderRight(); renderTL(); },
  flip: (el) => { const on = el.getAttribute('aria-pressed') !== 'true'; el.setAttribute('aria-pressed', on); },
  setdur: (el) => {
    const old = DUR; DUR = +el.dataset.v * FPS;
    layers.forEach((l) => { if (l.outP != null && (l.outP >= old || l.outP > DUR)) delete l.outP; if (l.inP != null && l.inP >= DUR) l.inP = 0; });
    markers.forEach((m) => { m.f = Math.min(m.f, DUR - 1); });
    S.wa = [0, DUR]; S.f = Math.min(S.f, DUR - 1);
    commit('Duration'); buildCanvas(); renderAll(); renderDialog(); toast(`Duration ${DUR / FPS} s`);
  },
  resetproj: () => { if (!S.resetArm) { S.resetArm = true; renderDialog(); return; } try { localStorage.removeItem('rfp-project'); } catch { /* ignore */ } location.reload(); },
  gradon: () => { const l = lay(S.sel); if (!l) return; l.grad = !l.grad; if (!l.hue2) l.hue2 = '#ff5ea8'; if (l.gang == null) l.gang = 90; commit('Gradient'); buildCanvas(); renderRight(); },
  flipseg: (el) => { $$('button', el.parentElement).forEach((b) => b.setAttribute('aria-pressed', b === el)); },
};

/* ---------- v6 (ported from v5): selection, handles, motion path, text animators, timeline gestures ---------- */
const targets = () => (S.pop && S.pop.id ? [S.pop.id] : selIds()).map(lay).filter(Boolean);
function toggleMember(id, prev) {
  const set = new Set(prev); set.has(id) ? set.delete(id) : set.add(id);
  S.multi = set; S.sel = set.has(id) ? id : ([...set][0] || null); S.keys = [];
  renderAll(); const n = selIds().length; toast(n > 1 ? `${n} layers selected` : n ? `${lay(S.sel).name} selected` : 'Selection cleared');
}
// Apply a Transform edit to the primary layer; other selected layers get the same change as a delta.
function applyProp(l, p, v) {
  const old = val(l.p[p], S.f); setVal(l, p, v);
  if (l.id !== S.sel) return;
  const d = v - old; if (!d) return;
  selIds().filter((id) => id !== l.id).map(lay).forEach((o) => { if (o && o.p[p] && !o.lock) setVal(o, p, clamp(val(o.p[p], S.f) + d, PROPS[p].min, PROPS[p].max)); });
}
function pip(pt, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
let areaSvg = '';

/* ================= v7: frame-by-frame drawing ================= */
// A drawing layer holds cels; each cel holds from its frame until the next cel (exposure).
// Strokes are stored as data in layer space and rasterised once per edit with Canvas2D.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
let exporting = false;
const celId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const brushCur = () => (S.tool === 'erase' ? S.brush.er : S.brush.P[S.brush.pre]);
const saveBrush = () => store.set('brush', S.brush);
const saveOnion = () => store.set('onion', S.onion);
const lightboxOn = () => { const s = S.sel && lay(S.sel); return !!(S.onion.lb && s && s.type === 'draw' && !S.playing && !exporting); };
function celIdx(l, f) { const c = l.cels || []; let k = -1; for (let i = 0; i < c.length; i++) if (c[i].f <= f + 1e-6) k = i; return k; }
function freeFrame(l, f) { while (f < DUR && (l.cels || []).some((c) => c.f === f)) f++; return f < DUR ? f : -1; }
function insertCel(l, f, strokes) { l.cels = l.cels || []; const c = { id: celId(), f, strokes: JSON.parse(JSON.stringify(strokes || [])), v: 0 }; l.cels.push(c); l.cels.sort((a, b) => a.f - b.f); return c; }
function addCel(dup) {
  const l = S.sel && lay(S.sel); if (!l || l.type !== 'draw') return;
  if (S.playing) play(false);
  const i = celIdx(l, S.f), cur = i >= 0 ? l.cels[i] : null, f = freeFrame(l, Math.round(S.f));
  if (f < 0) { toast('No free frame left at the end of the timeline.'); return; }
  insertCel(l, f, dup && cur ? cur.strokes : []); commit(dup ? 'Duplicate cel' : 'Blank cel');
  seek(f); renderTL(); renderRight(); toast(`${dup ? 'Duplicated cel' : 'New blank cel'} at ${tc(f)}`, true);
}

/* ---- rasteriser ---- */
const RC = document.createElement('canvas'); RC.width = 1920; RC.height = 1080;
const rx = RC.getContext('2d', { willReadFrequently: true });
const SC = document.createElement('canvas'); SC.width = 1920; SC.height = 1080;
const sx = SC.getContext('2d', { willReadFrequently: true });
const celCache = new WeakMap();
const hash = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
function dab(s, p, alt) {
  const tf = Math.max(0, 1 - alt / 1.5708), sz = s.sz;
  switch (s.k === 'erase' ? 'erase' : s.pre) {
    case 'pencil': return { w: sz * (0.3 + 0.7 * p) * (1 + tf * 3), a: (0.55 + 0.45 * p) * (1 - tf * 0.6), grain: 1 };
    case 'marker': return { w: sz * (1 + tf), a: 1 };
    case 'air': return { w: sz * (0.5 + 0.5 * p) * (1 + tf), a: 0.05 + 0.2 * p, soft: 1 };
    case 'erase': return { w: sz * (0.4 + 0.6 * p), a: 1 };
    default: return { w: sz * (0.12 + 0.88 * Math.pow(p, 1.3)), a: 1 };
  }
}
function stamp(ctx, x, y, d, col, am) {
  const r = Math.max(0.35, d.w / 2);
  let a = d.a * am; if (d.grain) a *= 0.7 + 0.3 * hash(x, y);
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  if (d.soft) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; }
  else ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
// Stamps the stroke's points from st.i onwards (st carries progress so a live stroke can continue).
function stampStroke(ctx, s, st, am = 1) {
  const P = s.pts, col = s.k === 'erase' ? '#000' : s.c; if (!P.length) return;
  if (!st.started) { const d = dab(s, P[0][2], P[0][3]); stamp(ctx, P[0][0], P[0][1], d, col, am); st.started = true; st.i = 1; st.acc = 0; st.w = d.w; }
  for (; st.i < P.length; st.i++) {
    const a = P[st.i - 1], b = P[st.i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]); let d0 = 0;
    for (let guard = 0; guard < 4000; guard++) {
      const need = Math.max(0.6, st.w * (s.pre === 'air' && s.k !== 'erase' ? 0.22 : 0.16)) - st.acc;
      if (d0 + need > seg) { st.acc += seg - d0; break; }
      d0 += need; st.acc = 0; const u = seg ? d0 / seg : 1;
      const p = a[2] + (b[2] - a[2]) * u, al = a[3] + (b[3] - a[3]) * u, d = dab(s, p, al);
      stamp(ctx, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, d, col, am); st.w = d.w;
    }
  }
}
function floodFill(ctx, s) {
  const W = 1920, H = 1080, px = Math.round(s.x + 960), py = Math.round(s.y + 540);
  if (px < 0 || py < 0 || px >= W || py >= H) return null;
  const src = ctx.getImageData(0, 0, W, H).data, i0 = (py * W + px) * 4;
  const t = [src[i0], src[i0 + 1], src[i0 + 2], src[i0 + 3]], emptySeed = t[3] < 60;
  const match = (i) => emptySeed ? src[i + 3] < 110 : Math.abs(src[i] - t[0]) + Math.abs(src[i + 1] - t[1]) + Math.abs(src[i + 2] - t[2]) + Math.abs(src[i + 3] - t[3]) < 90;
  const mask = new Uint8Array(W * H), stack = [px, py]; let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
  while (stack.length) {
    const y = stack.pop(); let x = stack.pop();
    while (x >= 0 && !mask[y * W + x] && match((y * W + x) * 4)) x--;
    x++; let up = false, dn = false;
    while (x < W && !mask[y * W + x] && match((y * W + x) * 4)) {
      mask[y * W + x] = 1; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (y > 0) { const m = !mask[(y - 1) * W + x] && match(((y - 1) * W + x) * 4); if (m && !up) { stack.push(x, y - 1); up = true; } else if (!m) up = false; }
      if (y < H - 1) { const m = !mask[(y + 1) * W + x] && match(((y + 1) * W + x) * 4); if (m && !dn) { stack.push(x, y + 1); dn = true; } else if (!m) dn = false; }
      x++;
    }
  }
  if (!n || (emptySeed && n > W * H * 0.97)) return null; // the area isn't closed: don't flood the whole cel
  const hx = s.c.replace('#', ''), R = parseInt(hx.slice(0, 2), 16), G = parseInt(hx.slice(2, 4), 16), B = parseInt(hx.slice(4, 6), 16);
  const out = sx.createImageData(W, H), o = out.data;
  for (let y = Math.max(0, y0 - 2); y <= Math.min(H - 1, y1 + 2); y++) for (let x = Math.max(0, x0 - 2); x <= Math.min(W - 1, x1 + 2); x++) {
    let on = mask[y * W + x];
    if (!on) for (let dy = -2; dy <= 2 && !on; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W && mask[yy * W + xx]) { on = 1; break; } }
    if (on) { const j = (y * W + x) * 4; o[j] = R; o[j + 1] = G; o[j + 2] = B; o[j + 3] = 255; }
  }
  sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, W, H); sx.putImageData(out, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'destination-over'; ctx.globalAlpha = 1; ctx.drawImage(SC, 0, 0); ctx.restore();
  return [x0 - 962, y0 - 542, x1 - 958, y1 - 538];
}
function paintStroke(ctx, s) {
  if (s.k === 'fill') return floodFill(ctx, s);
  ctx.setTransform(1, 0, 0, 1, 960, 540);
  if (s.k === 'erase') { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; stampStroke(ctx, s, {}, s.op / 100); ctx.restore(); return null; }
  sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, 1920, 1080); sx.setTransform(1, 0, 0, 1, 960, 540); sx.globalAlpha = 1;
  stampStroke(sx, s, {});
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = s.op / 100; ctx.drawImage(SC, 0, 0); ctx.restore();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const m = s.sz * 2.2 + 4;
  s.pts.forEach((p) => { x0 = Math.min(x0, p[0] - m); y0 = Math.min(y0, p[1] - m); x1 = Math.max(x1, p[0] + m); y1 = Math.max(y1, p[1] + m); });
  return [x0, y0, x1, y1];
}
function rasterCel(c) {
  rx.setTransform(1, 0, 0, 1, 0, 0); rx.globalAlpha = 1; rx.globalCompositeOperation = 'source-over'; rx.clearRect(0, 0, 1920, 1080);
  let bb = null;
  for (const s of c.strokes) { const b = paintStroke(rx, s); if (b && s.k !== 'erase') bb = bb ? [Math.min(bb[0], b[0]), Math.min(bb[1], b[1]), Math.max(bb[2], b[2]), Math.max(bb[3], b[3])] : b; }
  rx.setTransform(1, 0, 0, 1, 0, 0);
  const e = { sig: c.strokes.length + ':' + (c.v || 0), url: BLANK, x: 0, y: 0, w: 0, h: 0 };
  if (bb) {
    const X0 = Math.max(0, Math.floor(bb[0] + 960)), Y0 = Math.max(0, Math.floor(bb[1] + 540)), X1 = Math.min(1920, Math.ceil(bb[2] + 960)), Y1 = Math.min(1080, Math.ceil(bb[3] + 540));
    if (X1 > X0 && Y1 > Y0) {
      const cc = document.createElement('canvas'); cc.width = X1 - X0; cc.height = Y1 - Y0; cc.getContext('2d').drawImage(RC, X0, Y0, cc.width, cc.height, 0, 0, cc.width, cc.height);
      Object.assign(e, { url: cc.toDataURL('image/png'), x: X0 - 960, y: Y0 - 540, w: cc.width, h: cc.height });
      e.img = new Image(); e.img.src = e.url;
    }
  }
  celCache.set(c, e); return e;
}
function celRaster(c) { const e = celCache.get(c); return e && e.sig === c.strokes.length + ':' + (c.v || 0) ? e : rasterCel(c); }
const setImg = (im, e, op) => { im.setAttribute('href', e.url); im.setAttribute('x', e.x); im.setAttribute('y', e.y); im.setAttribute('width', e.w); im.setAttribute('height', e.h); if (op != null) im.setAttribute('opacity', op); };

/* ---- per-frame: exposed cel + onion skins ---- */
function drawXf(l, xf, i, f) {
  const im = xf.querySelector('image.cel'), on = xf.querySelector('.onion'); if (!im) return;
  const cels = l.cels || [];
  let k = celIdx(l, f);
  if (S.flip != null && l.id === S.sel && !exporting) k = clamp(S.flip, 0, cels.length - 1);
  if (k >= 0 && cels[k]) setImg(im, celRaster(cels[k])); else setImg(im, { url: BLANK, x: 0, y: 0, w: 0, h: 0 });
  im.style.visibility = liveHide === l.id && i === 0 ? 'hidden' : '';
  if (!on) return;
  const O = S.onion, show = i === 0 && O.on && l.id === S.sel && !S.playing && !exporting && k >= 0;
  let key = '', parts = [];
  if (show) {
    const add = (j, d, before) => { const c = cels[j]; if (!c) return; const e = celRaster(c); if (!e.w) return; const op = (O.op / 100) * Math.pow(0.6, d - 1); parts.push([e, op.toFixed(3), O.tint ? (before ? 'onB' : 'onA') : '']); key += e.url.length + ':' + e.x + ':' + e.y + ':' + op.toFixed(3) + (before ? 'b' : 'a') + O.tint + '|'; };
    for (let d = O.nb; d >= 1; d--) add(k - d, d, true);
    for (let d = 1; d <= O.na; d++) add(k + d, d, false);
  }
  if (on.dataset.key === key) return;
  on.dataset.key = key;
  on.innerHTML = parts.map(([e, op, fl]) => `<image href="${e.url}" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" opacity="${op}" preserveAspectRatio="none"${fl ? ` filter="url(#${fl})"` : ''}/>`).join('');
}

/* ---- live strokes ---- */
let liveHide = null;
const ink = $('#ink'), ictx = ink.getContext('2d');
function inkSetup(l) {
  const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  ink.width = Math.round(W * dpr); ink.height = Math.round(H * dpr); ink.style.width = W + 'px'; ink.style.height = H + 'px';
  const sr = stage.getBoundingClientRect(), k = sr.width / 1920;
  ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, ink.width, ink.height);
  ictx.beginPath(); ictx.rect(sr.left * dpr, sr.top * dpr, sr.width * dpr, sr.height * dpr); ictx.clip();
  const m = new DOMMatrix([dpr, 0, 0, dpr, 0, 0]).translate(sr.left, sr.top).scale(k).multiply(world(l, S.f));
  ictx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
}
function inkClear() { ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, ink.width, ink.height); ictx.restore && 0; ink.width = ink.width; ink.style.opacity = ''; }
function drawTarget() {
  let l = S.sel && lay(S.sel);
  if (l && l.type === 'draw' && !l.lock && l.vis) return l;
  nameCount.draw = (nameCount.draw || 0) + 1;
  l = { id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: 'Drawing ' + nameCount.draw, type: 'draw', hue: HUES[(layers.length + 2) % HUES.length], vis: true, lock: false, fx: [], cels: [],
    p: { x: st(960), y: st(540), scale: st(100), rot: st(0), op: st(100), ax: st(0), ay: st(0), ts: st(0), te: st(100) } };
  layers.unshift(l); S.sel = l.id; S.multi = new Set(); S.keys = []; buildCanvas(); renderLeft(); renderTL(); renderRight();
  toast('Started a new drawing layer', false);
  return l;
}
function localPt(l, e) { const [cx, cy] = compPt(e); let inv; try { inv = world(l, S.f).inverse(); } catch { inv = new DOMMatrix(); } const q = inv.transformPoint(new DOMPoint(cx, cy)); return [q.x, q.y]; }
function penData(e) {
  const pen = e.pointerType === 'pen', B = S.brush;
  let p = pen ? (e.pressure || 0.5) : 0.6; if (!B.pr) p = 0.6;
  let alt = 1.5708;
  if (pen && B.tl) { if (typeof e.altitudeAngle === 'number') alt = e.altitudeAngle; else if (e.tiltX || e.tiltY) { const tx = Math.tan(e.tiltX * Math.PI / 180), ty = Math.tan(e.tiltY * Math.PI / 180); alt = Math.PI / 2 - Math.atan(Math.hypot(tx, ty)); } }
  return [Math.round(p * 100) / 100, Math.round(alt * 100) / 100];
}
function drawDown(e) {
  if (S.playing) play(false);
  S.flip = null;
  const tool = S.tool;
  if (tool === 'erase') { const l0 = S.sel && lay(S.sel); if (!l0 || l0.type !== 'draw' || celIdx(l0, S.f) < 0) { toast('Nothing to erase on this frame.'); return; } }
  const l = drawTarget(), [x, y] = localPt(l, e);
  let k = celIdx(l, S.f), c = k >= 0 ? l.cels[k] : null;
  const newCel = !c; if (newCel) c = insertCel(l, Math.round(S.f), []);
  if (tool === 'fill') {
    c.strokes.push({ k: 'fill', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, c: S.brush.c }); c.v = (c.v || 0) + 1;
    const before = celCache.get(c); rasterCel(c);
    const e2 = celCache.get(c);
    if ((before && e2.url === before.url) || !e2.w) { c.strokes.pop(); c.v++; if (newCel) l.cels = l.cels.filter((x) => x !== c); toast('That area is not closed. Close the shape, then fill.'); celRaster(c); updateCanvas(); return; }
    commit('Fill'); updateCanvas(); renderTL(); renderRight(); return;
  }
  const B = S.brush, cur = brushCur(), [p, alt] = penData(e);
  const s = { k: tool === 'erase' ? 'erase' : 'brush', pre: B.pre, c: B.c, sz: cur.sz, op: cur.op, pts: [[Math.round(x * 10) / 10, Math.round(y * 10) / 10, p, alt]] };
  const stt = {}; let cancelled = false, folded = false;
  inkSetup(l);
  if (s.k === 'erase') { const er = celRaster(c); liveHide = l.id; updateCanvas(); ictx.save(); ictx.globalAlpha = 1; if (er.img && er.w) ictx.drawImage(er.img, er.x, er.y, er.w, er.h); ictx.restore(); ictx.globalCompositeOperation = 'destination-out'; stampStroke(ictx, s, stt, s.op / 100); }
  else { ink.style.opacity = s.op / 100; stampStroke(ictx, s, stt); }
  dragging = true;
  const mv = (ev) => {
    if (cancelled) return;
    if (ptrs.size > 1) { cancelled = true; inkClear(); return; }
    if (!folded && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 4) { folded = true; foldStart('drag'); }
    const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
    for (const q of (evs.length ? evs : [ev])) { const [qx, qy] = localPt(l, q), [qp, qa] = penData(q); const last = s.pts[s.pts.length - 1]; if (Math.hypot(qx - last[0], qy - last[1]) < 0.4) continue; s.pts.push([Math.round(qx * 10) / 10, Math.round(qy * 10) / 10, qp, qa]); }
    stampStroke(ictx, s, stt, s.k === 'erase' ? s.op / 100 : 1);
  };
  const up = () => {
    vp.removeEventListener('pointermove', mv); vp.removeEventListener('pointerup', up); vp.removeEventListener('pointercancel', up);
    dragging = false; liveHide = null; foldEnd('drag');
    if (cancelled) { inkClear(); if (newCel && !c.strokes.length) l.cels = l.cels.filter((x) => x !== c); updateCanvas(); return; }
    c.strokes.push(s); c.v = (c.v || 0) + 1; rasterCel(c);
    inkClear(); commit(s.k === 'erase' ? 'Erase' : 'Brush stroke'); updateCanvas(); renderTL(); renderRight();
  };
  vp.addEventListener('pointermove', mv); vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
}

/* ---- brush bar ---- */
let lastBarTool = null;
function renderBrushBar() {
  const B = S.brush, t = S.tool, el = $('#bbar'); if (!el) return;
  if (!isDrawTool(t)) { lastBarTool = t; el.innerHTML = ''; el.classList.remove('show'); return; }
  // picking a drawing tool in portrait folds the inspector sheet so the canvas is clear (it can be reopened while drawing)
  if (lastBarTool !== t && !isDrawTool(lastBarTool) && app.classList.contains('portrait') && S.right) { S.right = null; applyLayout(); renderRight(); renderStrips(); }
  lastBarTool = t;
  const cur = brushCur();
  el.innerHTML = (t === 'brush' ? `<div class="seg" role="group" aria-label="Brush">${BPRE.map(([id, n]) => `<button data-act="bpre" data-v="${id}" aria-pressed="${B.pre === id}" title="${n}">${ic(id === 'marker' ? 'hilite' : id, 'xs')}${n}</button>`).join('')}</div>` : `<div class="seg" role="group" aria-label="Tool">${DRAWMODES.map(([id, n]) => `<button data-act="pickdraw" data-v="${id}" aria-pressed="${t === id}">${ic(id, 'xs')}${n}</button>`).join('')}</div>`)
    + (t !== 'fill' ? pf(cur, 'br', 0, 'sz', 'Size', 1, 240, .3) + pf(cur, 'br', 0, 'op', 'Opacity', 5, 100, .4, '%') : '')
    + (t !== 'erase' ? `<button class="bcol" data-act="bcolour" style="background:${B.c}" aria-label="Brush colour ${B.c}" aria-haspopup="dialog" title="Colour"></button>` : '')
    + (t !== 'fill' ? `<span class="vsep"></span><button class="ib ${B.pr ? 'on' : ''}" data-act="btog" data-k="pr" aria-pressed="${B.pr}" aria-label="Pressure" title="Pencil pressure">${ic('press', 's')}</button><button class="ib ${B.tl ? 'on' : ''}" data-act="btog" data-k="tl" aria-pressed="${B.tl}" aria-label="Tilt" title="Pencil tilt">${ic('tilt', 's')}</button>` : '');
  el.classList.toggle('show', !S.playing);
}

/* ---- inspector ---- */
function drawHtml(l) {
  const cels = l.cels || [], k = celIdx(l, S.f), c = cels[k];
  const len = c ? ((cels[k + 1] ? cels[k + 1].f : (l.outP ?? DUR)) - c.f) : 0;
  return `<div class="kv"><span>Cels</span><b class="tc">${cels.length}</b></div>
    <div class="kv"><span>At playhead</span><b class="tc">${c ? `Cel ${k + 1} · holds ${len} f` : 'No cel yet'}</b></div>
    <div class="three"><button class="line-btn" data-act="celadd">${ic('celadd', 'xs')}Blank</button><button class="line-btn" data-act="celdup" ${c ? '' : 'disabled'}>${ic('copy', 'xs')}Duplicate</button><button class="line-btn" data-act="celclear" ${c && c.strokes.length ? '' : 'disabled'}>${ic('trash', 'xs')}Clear</button></div>
    <button class="line-btn" data-act="onionpop" aria-haspopup="dialog">${ic('onion', 's')}Onion skin · ${S.onion.on ? `${S.onion.nb} before, ${S.onion.na} after` : 'off'}</button>
    <p class="hint" style="padding:0">Draw with the brush (B). Each cel holds until the next one. Step frames with the arrows under the canvas, then add a cel.</p>`;
}

/* ---- timeline cels ---- */
function celBlocks(L) {
  const cels = L.cels || [], k = L.id === S.sel ? celIdx(L, S.f) : -1;
  return cels.map((c, i) => { const end = cels[i + 1] ? cels[i + 1].f : (L.outP ?? DUR); return `<span class="celblk ${c.strokes.length ? '' : 'empty'} ${i === k ? 'on' : ''}" data-cel="${c.id}" style="left:${c.f / DUR * 100}%;width:${Math.max(0, end - c.f) / DUR * 100}%" title="Cel ${i + 1} · ${tc(c.f)} · drag to retime, hold for options"></span>`; }).join('');
}
function celDown(e, el) {
  e.stopPropagation(); e.preventDefault();
  const trk = el.closest('.ttrack'), l = lay(trk.dataset.l), c = l && (l.cels || []).find((x) => x.id === el.dataset.cel); if (!c) return;
  if (S.playing) play(false);
  const x0 = e.clientX, W = trk.clientWidth, f0 = c.f, i = l.cels.indexOf(c), prev = l.cels[i - 1], next = l.cels[i + 1];
  const lo = prev ? prev.f + 1 : 0, hi = next ? next.f - 1 : DUR - 1; let moved = false;
  const isLong = longPress(e, () => { S.sel = l.id; S.pop = { type: 'cel', l: l.id, id: c.id, x: e.clientX, y: e.clientY }; renderAll(); });
  const mv = (ev) => {
    if (isLong()) return;
    const dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 6) return;
    moved = true; dragging = true;
    const nf = clamp(f0 + Math.round(dx / W * DUR), lo, hi);
    if (nf !== c.f) { c.f = nf; S.sel = l.id; seek(nf); renderTL(); const b = $(`[data-cel="${c.id}"]`); if (b) b.classList.add('drag'); }
  };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); dragging = false;
    if (isLong()) return;
    if (moved) { if (c.f !== f0) { commit('Retime cel'); toast(`Cel moved to ${tc(c.f)}`, true); } suppressClick = true; renderAll(); return; }
    S.sel = l.id; S.multi = new Set(); seek(c.f); renderAll();
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
// Hold to see the previous cel in place; drag left or right while holding to flip through cels.
function flipDrag(e) {
  e.preventDefault();
  const l = S.sel && lay(S.sel); if (!l || l.type !== 'draw' || (l.cels || []).length < 2) { toast('Flip needs at least two cels.'); return; }
  if (S.playing) play(false);
  const k = Math.max(0, celIdx(l, S.f)), x0 = e.clientX, n = l.cels.length;
  S.flip = Math.max(0, k - 1); updateCanvas();
  const mv = (ev) => { const nf = clamp(k - 1 + Math.round((ev.clientX - x0) / 26), 0, n - 1); if (nf !== S.flip) { S.flip = nf; updateCanvas(); } };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); S.flip = null; updateCanvas(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}

function drawOverlay() {
  const svg = $('#ovl'); if (!svg) return;
  const v = vp.getBoundingClientRect(); svg.setAttribute('viewBox', `0 0 ${v.width} ${v.height}`);
  let out = '';
  const l = S.sel && lay(S.sel);
  if (l && l.vis && !S.playing && selIds().length === 1 && (animated(l.p.x) || animated(l.p.y))) {
    const sr = stage.getBoundingClientRect(), X = (x) => sr.left - v.left + x / 1920 * sr.width, Y = (y) => sr.top - v.top + y / 1080 * sr.height;
    const ts = [...new Set(['x', 'y'].flatMap((p) => animated(l.p[p]) ? l.p[p].keys.map((k) => k.t) : []))].sort((a, b) => a - b);
    if (ts.length > 1) { let d = ''; for (let f = ts[0]; f <= ts[ts.length - 1]; f++) { const q = anchorAt(l, f); d += (f === ts[0] ? 'M' : 'L') + X(q.x).toFixed(1) + ' ' + Y(q.y).toFixed(1); } out += `<path class="mp" d="${d}"/>`; }
    ts.forEach((t) => { const q = anchorAt(l, t), cx = X(q.x).toFixed(1), cy = Y(q.y).toFixed(1); out += `<circle class="mpd ${Math.abs(t - S.f) < .5 ? 'on' : ''}" cx="${cx}" cy="${cy}" r="6"/><circle data-mp="${t}" cx="${cx}" cy="${cy}" r="18" fill="transparent"><title>Position keyframe at ${tc(t)} · drag to move, hold to ease</title></circle>`; });
  }
  if (S.tool === 'pen' && S.penPts.length) {
    const sr = stage.getBoundingClientRect(), X = (x) => sr.left - v.left + x / 1920 * sr.width, Y = (y) => sr.top - v.top + y / 1080 * sr.height;
    out += `<path class="mp" style="stroke-dasharray:none;stroke-width:2.5" d="${S.penPts.map((q, i) => (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join('')}"/>`;
    S.penPts.forEach((q, i) => { out += `<circle class="mpd ${i === 0 ? 'on' : ''}" cx="${X(q[0]).toFixed(1)}" cy="${Y(q[1]).toFixed(1)}" r="${i === 0 ? 8 : 5}"/>`; });
  }
  svg.innerHTML = out + areaSvg;
}
function areaSelect(e) {
  const v = vp.getBoundingClientRect(), lasso = S.tool === 'lasso', pts = [[e.clientX - v.left, e.clientY - v.top]], add = e.shiftKey ? selIds() : [];
  let moved = false;
  const mv = (ev) => {
    const q = [ev.clientX - v.left, ev.clientY - v.top];
    if (!moved && Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) < 4) return; moved = true; dragging = true;
    if (lasso) pts.push(q); else pts[1] = q;
    if (lasso) areaSvg = `<path class="area" d="M${pts.map((r) => r[0].toFixed(1) + ' ' + r[1].toFixed(1)).join('L')}Z"/>`;
    else { const [a, b] = pts; areaSvg = `<rect class="area" x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(a[0] - b[0])}" height="${Math.abs(a[1] - b[1])}"/>`; }
    drawOverlay();
  };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    dragging = false; areaSvg = '';
    if (!moved) { const g = e.target.closest('g[data-id]'), L = g && lay(g.dataset.id); S.multi.clear(); S.sel = L && !L.lock ? L.id : null; S.keys = []; renderAll(); return; }
    const hit = layers.filter((l) => l.vis && !l.lock && gEls[l.id] && !['solid', 'shader', 'adjust'].includes(l.type) && S.f >= (l.inP ?? 0) && S.f < (l.outP ?? DUR)).filter((l) => {
      const b = gEls[l.id].getBoundingClientRect(); if (b.width < 1 && b.height < 1) return false;
      const r = { l: b.left - v.left, t: b.top - v.top, r: b.right - v.left, b: b.bottom - v.top };
      if (!lasso) { const [a, c] = [pts[0], pts[1] || pts[0]]; return r.l < Math.max(a[0], c[0]) && r.r > Math.min(a[0], c[0]) && r.t < Math.max(a[1], c[1]) && r.b > Math.min(a[1], c[1]); }
      return pts.length > 2 && pip([(r.l + r.r) / 2, (r.t + r.b) / 2], pts);
    }).map((l) => l.id);
    const ids = [...new Set([...add, ...hit])];
    S.multi = new Set(ids); S.sel = ids[0] || null; S.keys = []; renderAll();
    toast(ids.length ? `${ids.length} layer${ids.length > 1 ? 's' : ''} selected` : 'Nothing inside the selection');
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
// Corner handles scale and the knob rotates, around the anchor (one layer) or the selection centre (several).
function handleDrag(e, el) {
  e.preventDefault(); e.stopPropagation();
  const kind = el.dataset.hd, ls = selIds().map(lay).filter((l) => l && !l.lock); if (!ls.length) return;
  const sr = stage.getBoundingClientRect(), toComp = (x, y) => [(x - sr.left) / sr.width * 1920, (y - sr.top) / sr.height * 1080];
  const multi = ls.length > 1, r = selRect();
  const a0p = multi ? null : anchorAt(ls[0], S.f);
  const c = multi ? toComp(r.left + r.width / 2, r.top + r.height / 2) : [a0p.x, a0p.y];
  const st0 = ls.map((l) => { const w = anchorAt(l, S.f); return { l, x: val(l.p.x, S.f), y: val(l.p.y, S.f), s: val(l.p.scale, S.f), r: val(l.p.rot, S.f), wx: w.x, wy: w.y }; });
  const p0 = toComp(e.clientX, e.clientY), d0 = Math.max(4, Math.hypot(p0[0] - c[0], p0[1] - c[1])), a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
  const badge = $('#spd'); let moved = false;
  const mv = (ev) => {
    const q = toComp(ev.clientX, ev.clientY);
    if (!moved) { moved = true; dragging = true; foldStart('drag'); }
    let k = 1, dth = 0;
    if (kind === 's') k = Math.max(.01, Math.hypot(q[0] - c[0], q[1] - c[1]) / d0);
    else { dth = (Math.atan2(q[1] - c[1], q[0] - c[0]) - a0) * 180 / Math.PI; if (dth > 180) dth -= 360; if (dth < -180) dth += 360; if (S.snap) dth = Math.round((st0[0].r + dth) / 15) * 15 - st0[0].r; }
    const rad = dth * Math.PI / 180, co = Math.cos(rad), si = Math.sin(rad);
    st0.forEach((o) => {
      if (kind === 's') setVal(o.l, 'scale', clamp(o.s * k, 0, 1000)); else setVal(o.l, 'rot', o.r + dth);
      if (multi) { const vx = o.wx - c[0], vy = o.wy - c[1], [lx, ly] = toLocal(o.l, c[0] + k * (vx * co - vy * si) - o.wx, c[1] + k * (vx * si + vy * co) - o.wy); setVal(o.l, 'x', o.x + lx); setVal(o.l, 'y', o.y + ly); }
    });
    updateCanvas(); updateFields();
    const a = app.getBoundingClientRect(); badge.hidden = false; badge.textContent = kind === 's' ? Math.round(st0[0].s * k) + '%' : Math.round(st0[0].r + dth) + '°';
    badge.style.left = (ev.clientX - a.left + 14) + 'px'; badge.style.top = (ev.clientY - a.top - 34) + 'px';
  };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); dragging = false; badge.hidden = true; foldEnd('drag'); if (moved) { commit(kind === 's' ? 'Scale' : 'Rotate'); renderAll(); } };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
// Motion-path dots: drag to move that Position keyframe, tap to jump to it, hold for ease presets.
function mpDrag(e, dot) {
  e.preventDefault(); e.stopPropagation();
  const l = S.sel && lay(S.sel); if (!l) return;
  const t = +dot.dataset.mp, sr = stage.getBoundingClientRect(), x0 = val(l.p.x, t), y0 = val(l.p.y, t), sx = e.clientX, sy = e.clientY; let moved = false;
  const isLong = longPress(e, () => { const ks = []; ['x', 'y'].forEach((p) => { const i = keyAt(l.p[p], t); if (i >= 0) ks.push({ l: l.id, p, i }); }); S.keys = ks; seek(t); S.pop = { type: 'ease', x: sx, y: sy }; renderAll(); });
  const mv = (ev) => {
    if (isLong()) return; if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return; moved = true; dragging = true;
    const f = S.f; S.f = t;
    const [lx, ly] = toLocal(l, (ev.clientX - sx) / sr.width * 1920, (ev.clientY - sy) / sr.height * 1080, t);
    const nx = Math.round(x0 + lx), ny = Math.round(y0 + ly);
    if (animated(l.p.x) || nx !== Math.round(x0)) setVal(l, 'x', nx, true); if (animated(l.p.y) || ny !== Math.round(y0)) setVal(l, 'y', ny, true);
    S.f = f; updateCanvas(); updateFields();
  };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); dragging = false; if (isLong()) return; if (moved) { commit('Move position keyframe'); renderAll(); } else { if (S.playing) play(false); seek(t); renderAll(); } };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
function alignTo(v) {
  const ls = selIds().map(lay).filter((l) => l && !l.lock && gEls[l.id]); if (!ls.length) return;
  const sr = stage.getBoundingClientRect();
  const boxes = ls.map((l) => { const r = gEls[l.id].getBoundingClientRect(); return { l: (r.left - sr.left) / sr.width * 1920, r: (r.right - sr.left) / sr.width * 1920, t: (r.top - sr.top) / sr.height * 1080, b: (r.bottom - sr.top) / sr.height * 1080 }; });
  const U = ls.length > 1 ? { l: Math.min(...boxes.map((b) => b.l)), r: Math.max(...boxes.map((b) => b.r)), t: Math.min(...boxes.map((b) => b.t)), b: Math.max(...boxes.map((b) => b.b)) } : { l: 0, r: 1920, t: 0, b: 1080 };
  const shift = (l, dx, dy) => { if (!dx && !dy) return; const [lx, ly] = toLocal(l, dx, dy); setVal(l, 'x', Math.round(val(l.p.x, S.f) + lx)); setVal(l, 'y', Math.round(val(l.p.y, S.f) + ly)); };
  if (v === 'dh' || v === 'dv') {
    const h = v === 'dh', o = ls.map((l, i) => ({ l, c: h ? (boxes[i].l + boxes[i].r) / 2 : (boxes[i].t + boxes[i].b) / 2 })).sort((a, b) => a.c - b.c);
    const c0 = o[0].c, c1 = o[o.length - 1].c; o.forEach((q, i) => { const d = c0 + (c1 - c0) * i / (o.length - 1) - q.c; h ? shift(q.l, d, 0) : shift(q.l, 0, d); });
  } else ls.forEach((l, i) => { const b = boxes[i]; shift(l, v === 'left' ? U.l - b.l : v === 'right' ? U.r - b.r : v === 'hcenter' ? (U.l + U.r - b.l - b.r) / 2 : 0, v === 'top' ? U.t - b.t : v === 'bottom' ? U.b - b.b : v === 'vcenter' ? (U.t + U.b - b.t - b.b) / 2 : 0); });
  S.pop = null; commit('Align'); updateCanvas(); renderAll();
  toast(v === 'dh' || v === 'dv' ? `Distributed ${ls.length} layers` : `Aligned to ${ls.length > 1 ? 'selection' : 'composition'}`, true);
}
function animHtml(l) {
  const list = (l.anims || []).map((a, i) => `<div class="mod"><div class="fx-h" style="font-size:var(--fs-s)">${ANIMS[a.type][0]}<span class="tc" style="color:var(--muted);font-weight:400;font-size:var(--fs-xs)">from ${tc(a.start)}</span><span class="spacer"></span>
      <button class="ib" data-act="animstart" data-v="${i}" aria-label="Start ${ANIMS[a.type][0]} at the playhead" title="Start at playhead">${ic('marker', 's')}</button><button class="ib" data-act="animdel" data-v="${i}" aria-label="Remove ${ANIMS[a.type][0]}">${ic('trash', 's')}</button></div>
      ${a.type === 'wave' ? '' : grid2([a.type === 'track' ? '' : pf(a, 'an', i, 'stagger', 'Stagger', 0, 20, .05, ' f'), pf(a, 'an', i, 'dur', 'Duration', 1, 60, .1, ' f')].filter(Boolean))}</div>`).join('');
  return list + `<div class="chips" style="padding:4px 0 0;flex-wrap:wrap">${Object.entries(ANIMS).map(([k, [n]]) => `<button class="chip" data-act="animadd" data-v="${k}">＋ ${n}</button>`).join('')}</div>
    <p class="hint" style="padding:2px 0 0">Animators start at the playhead and move each character in turn.</p>`;
}
function applyTextAnims(l, g, f) {
  const eo = bez(EASES.out), size = +l.size || 100;
  $$(':scope > .xf', g).forEach((xf) => {
    const ts = xf.querySelectorAll('tspan[data-ci]'), n = ts.length; if (!n) return;
    const op = new Array(n).fill(1), off = new Array(n).fill(0); let track = +l.track || 0;
    for (const a of l.anims) {
      if (a.type === 'track') { const u = clamp((f - a.start) / Math.max(1, a.dur), 0, 1); track += (1 - eo(u)) * size * .6; continue; }
      for (let i = 0; i < n; i++) {
        const t0 = a.start + i * a.stagger, u = clamp((f - t0) / Math.max(1, a.dur), 0, 1);
        if (a.type === 'fade') op[i] *= eo(u);
        else if (a.type === 'type') op[i] *= f >= t0 ? 1 : 0;
        else if (a.type === 'rise') { const k = eo(u); op[i] *= k; off[i] += (1 - k) * size * .45; }
        else if (a.type === 'wave' && f >= a.start) off[i] += Math.sin((f - a.start) * .25 - i * .55) * size * .12;
      }
    }
    ts.forEach((sp, i) => { sp.setAttribute('fill-opacity', op[i].toFixed(3)); sp.setAttribute('baseline-shift', (-off[i]).toFixed(2)); });
    const tx = xf.querySelector('text'); if (tx) tx.setAttribute('letter-spacing', track.toFixed(2));
  });
}
function jumpKey(dir) {
  const ids = selIds().length ? selIds() : layers.map((l) => l.id);
  const ts = [...new Set(ids.map(lay).filter(Boolean).flatMap((l) => TF.flatMap((p) => animated(l.p[p]) ? l.p[p].keys.map((k) => k.t) : [])))].sort((a, b) => a - b);
  const t = dir < 0 ? ts.filter((x) => x < S.f - .5).pop() : ts.find((x) => x > S.f + .5);
  if (t == null) { toast(dir < 0 ? 'No earlier keyframe' : 'No later keyframe'); return; }
  if (S.playing) play(false); seek(t); renderTL(); renderRight();
}
function tcDrag(e) {
  e.preventDefault(); const x0 = e.clientX, f0 = Math.round(S.f); if (S.playing) play(false);
  const mv = (ev) => seek(clamp(f0 + Math.round((ev.clientX - x0) / 6), 0, DUR - 1));
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); renderTL(); renderRight(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
function waDrag(e, i) {
  e.preventDefault(); e.stopPropagation();
  const mv = (ev) => { const r = $('#scrub').getBoundingClientRect(), f = Math.round((ev.clientX - r.left) / r.width * DUR); S.wa[i] = i ? clamp(f, S.wa[0] + 5, DUR) : clamp(f, 0, S.wa[1] - 5); renderTL(); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); toast(`Loop ${tc(S.wa[0])} – ${tc(S.wa[1])}`); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
function trimDrag(e, el, trk) {
  e.preventDefault(); e.stopPropagation();
  const L = lay(trk.dataset.l); if (!L) return; const side = el.dataset.trim, bar = trk.querySelector('.bar'); let moved = false;
  const mv = (ev) => {
    moved = true; const r = trk.getBoundingClientRect(), f = Math.round((ev.clientX - r.left) / r.width * DUR);
    if (side === 'in') L.inP = clamp(f, 0, (L.outP ?? DUR) - 1); else L.outP = clamp(f, (L.inP ?? 0) + 1, DUR);
    bar.style.left = (L.inP ?? 0) / DUR * 100 + '%'; bar.style.right = (DUR - (L.outP ?? DUR)) / DUR * 100 + '%'; updateCanvas();
  };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); if (moved) { commit('Trim layer'); renderAll(); toast(`${L.name} plays ${tc(L.inP ?? 0)} – ${tc(L.outP ?? DUR)}`, true); } };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
// Dope-sheet track: drag on empty space = keyframe marquee; hold the layer bar, then drag = slide the layer in time.
function trackDown(e, trk) {
  const rows = $('#tlrows'); if (!rows) return;
  const L = trk.dataset.l && lay(trk.dataset.l), bar = e.target.closest('.bar');
  const x0 = e.clientX, y0 = e.clientY; let mode = null, sl = null;
  const isLong = bar && L ? longPress(e, () => {
    mode = 'slide'; sl = { inP: L.inP ?? 0, outP: L.outP ?? DUR, keys: TF.flatMap((p) => animated(L.p[p]) ? L.p[p].keys.map((k) => [k, k.t]) : []), anims: (L.anims || []).map((a) => [a, a.start]) };
    trk.closest('.trow').classList.add('sliding'); toast('Drag to slide ' + L.name + ' in time');
  }) : () => false;
  const box = document.createElement('div'); box.className = 'kmq';
  const mv = (ev) => {
    if (mode === 'slide') {
      const w = trk.clientWidth, d = clamp(Math.round((ev.clientX - x0) / w * DUR), -sl.inP, DUR - sl.outP);
      L.inP = sl.inP + d; L.outP = sl.outP + d; sl.keys.forEach(([k, t]) => (k.t = t + d)); sl.anims.forEach(([a, s0]) => (a.start = s0 + d));
      const b = trk.querySelector('.bar'); b.style.left = L.inP / DUR * 100 + '%'; b.style.right = (DUR - L.outP) / DUR * 100 + '%';
      trk.querySelectorAll('.dk').forEach((dk) => (dk.style.transform = `translateX(${d / DUR * w}px)`)); updateCanvas(); return;
    }
    if (isLong()) return;
    if (!mode) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; mode = 'mq'; rows.appendChild(box); }
    const rr = rows.getBoundingClientRect();
    Object.assign(box.style, { left: Math.min(x0, ev.clientX) - rr.left + rows.scrollLeft + 'px', top: Math.min(y0, ev.clientY) - rr.top + rows.scrollTop + 'px', width: Math.abs(ev.clientX - x0) + 'px', height: Math.abs(ev.clientY - y0) + 'px' });
  };
  const up = (ev) => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    if (mode === 'slide') { commit('Slide layer'); renderAll(); toast(`${L.name} now starts at ${tc(L.inP)}`, true); return; }
    if (mode !== 'mq') return;
    box.remove(); suppressClick = true;
    const X1 = Math.min(x0, ev.clientX), X2 = Math.max(x0, ev.clientX), Y1 = Math.min(y0, ev.clientY), Y2 = Math.max(y0, ev.clientY);
    const inside = (dk) => { const b = dk.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2; return cx >= X1 && cx <= X2 && cy >= Y1 && cy <= Y2; };
    const sel = [], has = (l, p, i) => sel.some((q) => q.l === l && q.p === p && q.i === i);
    $$('#tlrows .dk[data-dk="one"]').forEach((dk) => { if (inside(dk) && !has(dk.dataset.l, dk.dataset.p, +dk.dataset.i)) sel.push({ l: dk.dataset.l, p: dk.dataset.p, i: +dk.dataset.i }); });
    $$('#tlrows .dk[data-dk="agg"]').forEach((dk) => { if (!inside(dk)) return; const LL = lay(dk.dataset.l), t = +dk.dataset.t; TF.forEach((p) => { const i = keyAt(LL.p[p], t); if (i >= 0 && !has(LL.id, p, i)) sel.push({ l: LL.id, p, i }); }); });
    S.keys = sel; if (sel[0] && !selIds().includes(sel[0].l)) { S.sel = sel[0].l; S.multi.clear(); }
    renderAll(); toast(sel.length ? `${sel.length} keyframes selected` : 'No keyframes in that area');
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
  const el = e.target.closest('[data-act]');
  if (S.pop && !e.target.closest('.pop') && !(el && ['menu', 'insert', 'addfx', 'colour', 'anchorpick', 'bcolour', 'onionpop', 'align'].includes(el.dataset.act))) { S.pop = null; renderPop(); renderTop(); renderStrips(); if (!el) return; }
  if (!el || el.tagName === 'LABEL') return;
  const f = A[el.dataset.act]; if (f) f(el, e);
});
$('#scrim').addEventListener('click', () => { S.left = null; renderAll(); });
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.sel) {
    const l = S.sel && lay(S.sel); if (!l) return; const k = t.dataset.sel, i = +t.dataset.i;
    if (k === 'font') { l.font = t.value; l.weight = snapW(l); commit('Font'); renderRight(); buildCanvas(); }
    else if (k === 'tweight') { l.weight = +t.value; commit('Weight'); buildCanvas(); }
    else if (k === 'cap' || k === 'join') { l[k] = t.value; commit('Stroke ' + k); buildCanvas(); }
    else if (k === 'shp') { if (t.value !== '__custom') { const P = SHP[t.value]; l.preset = t.value; delete l.code; l.hue = P.c[0]; l.hue2 = P.c[1]; P.def.forEach((v, j) => { l['sp' + j] = v; }); if (/^(Shader|Liquid gradient|Plasma|Aurora|Ring tunnel|Cells|Synth grid)( \d+)?$/.test(l.name)) l.name = P.name; commit('Shader preset'); buildCanvas(); renderAll(); } return; }
    else if (k === 'matte') { if (layers.indexOf(l) < 1) { toast('There is no layer above to use as a matte.'); renderRight(); return; } l.matte = t.value || null; commit(l.matte ? 'Track matte' : 'Remove matte'); buildCanvas(); renderAll(); return; }
    else if (k === 'blend') { l.blend = t.value; commit('Blend mode'); buildCanvas(); }
    else if (k === 'parent') { l.parent = t.value || null; l.pt = Math.round(S.f); commit('Parent'); updateCanvas(); renderLeft(); }
    else if (k === 'repmode' && l.rep) { l.rep.mode = t.value; commit('Duplicator layout'); buildCanvas(); renderRight(); }
    else if (k === 'modtgt' && l.mods && l.mods[i]) { l.mods[i].tgt = t.value; commit('Behaviour target'); updateCanvas(); }
    return;
  }
  if (t.dataset && t.dataset.ezv != null) {
    const ks = selectedKeyObjs(); if (!ks.length) return; const i = +t.dataset.ezv, a = [...earr(ks[0])];
    const v = parseFloat(t.value); if (isNaN(v)) { renderRight(); return; }
    a[i] = i % 2 ? clamp(v, -1, 2) : clamp(v, 0, 1); ks.forEach((k) => { k.e = [...a]; });
    commit('Edit curve'); updateCanvas(); renderRight(); renderTL(); return;
  }
  if (t.matches('[data-media]') && t.files && t.files[0]) {
    const file = t.files[0]; S.pop = null;
    if (file.type.startsWith('audio/')) { renderPop(); importAudio(file); return; }
    if (!file.type.startsWith('image/')) { renderPop(); toast(`Imported ${file.name}. Video playback is not part of this prototype.`); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, 900 / img.width, 600 / img.height); newLayer('image', { src: url, w: img.width * k, h: img.height * k, name: file.name, hue: HUES[4] }); };
    img.src = url;
  }
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'lq' || t.id === 'aq') { S[t.id] = t.value; const pos = t.selectionStart; renderLeft(); const n = $('#' + t.id); n.focus(); n.setSelectionRange(pos, pos); }
  if (t.id === 'pq') { S.q = t.value; const pos = t.selectionStart; renderRight(); const n = $('#pq'); n.focus(); n.setSelectionRange(pos, pos); }
  if (t.id === 'cphex' && cp && /^#[0-9a-f]{6}$/i.test(t.value)) { Object.assign(cp, hexToHsv(t.value)); cpApply(t.value.toLowerCase()); }
  if (t.id === 'lname') { const l = lay(S.sel); if (l) l.name = t.value; }
  if (t.id === 'pname') { projName = t.value; saveProj(); }
  if (t.dataset && t.dataset.mkn != null && markers[+t.dataset.mkn]) { markers[+t.dataset.mkn].name = t.value; }
  if (t.id === 'ltext') { const l = lay(S.sel); l.text = t.value || ' '; l.name = ((t.value || 'Text').split('\n')[0] || 'Text').slice(0, 32); buildCanvas(); }
});
document.addEventListener('focusout', (e) => {
  if (e.target.id === 'lname') { const l = lay(S.sel); if (l) { if (!l.name.trim()) l.name = TYPE_NAME[l.type] || 'Layer'; commit('Rename layer'); renderLeft(); renderTL(); renderRight(); } }
  if (e.target.dataset && e.target.dataset.mkn != null) { commit('Rename marker'); renderTL(); } if (e.target.id === 'ltext') { commit('Edit text'); renderLeft(); renderTL(); renderTop(); } });

let dragging = false, suppressClick = false, fitSelOn = false;
// Long press helper: fires cb after 450 ms unless the pointer moves or lifts.
function longPress(e, cb) {
  const sx = e.clientX, sy = e.clientY; let done = false;
  const tm = setTimeout(() => { done = true; suppressClick = true; cb(); cleanup(); }, 450);
  const mv = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) cleanup(); };
  const cleanup = () => { clearTimeout(tm); removeEventListener('pointermove', mv); removeEventListener('pointerup', cleanup); removeEventListener('pointercancel', cleanup); };
  addEventListener('pointermove', mv); addEventListener('pointerup', cleanup); addEventListener('pointercancel', cleanup);
  return () => done;
}
document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-ctx],[data-dk],#shapebtn,#selbtn,#brushbtn,[data-onion],[data-flip],[data-cel],#vp,[data-kj],.fld,.bar')) e.preventDefault(); });

document.addEventListener('pointerdown', (e) => {
  const t = e.target;
  // shapes flyout on the rail
  if (t.closest('#shapebtn')) { longPress(e, () => { S.pop = { type: 'shapes' }; renderPop(); }); return; }
  if (t.closest('#selbtn')) { longPress(e, () => { S.pop = { type: 'selmodes' }; renderPop(); }); return; }
  if (t.closest('#brushbtn')) { longPress(e, () => { S.pop = { type: 'drawmodes' }; renderPop(); }); return; }
  const onb = t.closest('[data-onion]'); if (onb) { longPress(e, () => { const r = onb.getBoundingClientRect(); S.pop = { type: 'onion', x: r.left + r.width / 2, y: r.top }; renderPop(); }); return; }
  if (t.closest('[data-flip]')) return flipDrag(e);
  const cb = t.closest('[data-cel]'); if (cb) return celDown(e, cb);
  const hdl = t.closest('#selbox [data-hd]'); if (hdl) return handleDrag(e, hdl);
  const mpd = t.closest('[data-mp]'); if (mpd) return mpDrag(e, mpd);
  const kj = t.closest('[data-kj]'); if (kj) { longPress(e, () => jumpKey(+kj.dataset.kj)); return; }
  if (t.closest('#tcode')) return tcDrag(e);
  const wa = t.closest('[data-wa]'); if (wa) return waDrag(e, +wa.dataset.wa);
  // timeline height handle
  if (t.closest('#tlh')) return tlDrag(e);
  if (t.closest('#sheetgrab')) return sheetDrag(e);
  if (t.closest('#scrub')) return scrubDrag(e, $('#scrub'));
  if (t.closest('#gsvg')) return graphDown(e);
  const cpz = t.closest('[data-cp]'); if (cpz) return cpDrag(e, cpz);
  const kdb = t.closest('[data-kd]'); if (kdb) { const g = kdb.dataset.kd; longPress(e, () => { const l = S.sel && lay(S.sel); if (l) clearAnim(l, g); }); return; }
  const dk = t.closest('[data-dk]'); if (dk) return keyDown(e, dk);
  const trk = t.closest('#tlrows .ttrack'); if (trk) { const tr = t.closest('[data-trim]'); return tr ? trimDrag(e, tr, trk) : trackDown(e, trk); }
  const fl = t.closest('.fld'); if (fl && !t.closest('input')) return fieldDrag(e, fl);
  const hd = t.closest('#curve [data-h]'); if (hd) return curveDrag(e, +hd.dataset.h);
  const gr = t.closest('[data-grip]'); if (gr) return layerDrag(e, gr);
  const fxEl = t.closest('.fx'); if (fxEl && !t.closest('button, .fld, input, textarea')) return fxReorder(e, fxEl);
  const ctx = t.closest('[data-ctx]'); if (ctx && !t.closest('button')) return layerHold(e, ctx);
  if (t.closest('#vp') && !t.closest('.float')) return canvasDown(e);
});

/* Hold-and-drag reorder. Hold ~0.4 s to lift the item, drag to move it, release to drop.
   groups: arrays of elements that move together; from: index of the held group.
   onDone(from, to) runs when the order changed; onTap(x, y) when released in place after a hold. */
let reorderLive = false;
document.addEventListener('touchmove', (ev) => { if (reorderLive && ev.cancelable) ev.preventDefault(); }, { passive: false });
function holdReorder(e, groups, from, o) {
  if (e.button > 0 || from < 0) return;
  const n = groups.length, sx = e.clientX, sy = e.clientY;
  let lx = sx, ly = sy, lifted = false, to = from, geo = null;
  const tm = setTimeout(() => {
    lifted = true; reorderLive = true; dragging = true; suppressClick = true;
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch { /* unsupported */ } }
    geo = groups.map((g) => { const a = g[0].getBoundingClientRect(), b = g[g.length - 1].getBoundingClientRect(); return { top: a.top, h: b.bottom - a.top }; });
    groups.forEach((g, i) => g.forEach((x) => x.classList.add(i === from ? 'rz-lift' : 'rz-shift')));
  }, 380);
  const clear = () => { groups.forEach((g) => g.forEach((x) => { x.classList.remove('rz-lift', 'rz-shift'); x.style.transform = ''; })); };
  const stop = () => { clearTimeout(tm); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel); reorderLive = false; };
  const mv = (ev) => {
    lx = ev.clientX; ly = ev.clientY;
    if (!lifted) { if (Math.hypot(lx - sx, ly - sy) > 8) stop(); return; }
    const lo = geo[0].top - geo[from].top, hi = geo[n - 1].top + geo[n - 1].h - geo[from].top - geo[from].h;
    const dy = clamp(ly - sy, lo, hi);
    groups[from].forEach((x) => (x.style.transform = `translateY(${dy}px)`));
    const c = geo[from].top + geo[from].h / 2 + dy;
    to = geo.findIndex((g) => c < g.top + g.h); if (to < 0) to = n - 1;
    groups.forEach((g, i) => { if (i === from) return; const t2 = from < to && i > from && i <= to ? -geo[from].h : from > to && i >= to && i < from ? geo[from].h : 0; g.forEach((x) => (x.style.transform = t2 ? `translateY(${t2}px)` : '')); });
  };
  const finish = () => { const was = lifted; stop(); dragging = false; clear(); if (was) setTimeout(() => { suppressClick = false; }, 80); return was; };
  const cancel = () => { finish(); };
  const up = () => {
    if (!finish()) return;
    if (to !== from) o.onDone(from, to);
    else if (Math.hypot(lx - sx, ly - sy) < 6 && o.onTap) o.onTap(lx, ly);
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
}
function layerHold(e, row) {
  const tl = row.classList.contains('trow'), list = row.parentElement;
  const heads = $$(tl ? '.trow:not(.sub)' : '.lrow', list), id = row.dataset.ctx, prevSel = selIds();
  const groups = heads.map((h) => { const g = [h]; if (tl) for (let s = h.nextElementSibling; s && s.classList.contains('sub'); s = s.nextElementSibling) g.push(s); return g; });
  holdReorder(e, groups, heads.indexOf(row), {
    onDone: (a, b) => { const l = lay(heads[a].dataset.ctx), j = layers.indexOf(lay(heads[b].dataset.ctx)); layers.splice(layers.indexOf(l), 1); layers.splice(j, 0, l); S.sel = l.id; commit('Reorder layers'); buildCanvas(); renderAll(); toast('Moved ' + l.name, true); },
    onTap: (x, y) => { S.ctxPrev = prevSel; if (!prevSel.includes(id)) { S.sel = id; S.multi.clear(); } S.pop = { type: 'ctx', id, x, y }; renderAll(); },
  });
}
function fxReorder(e, fx) {
  const l = S.sel && lay(S.sel); if (!l) return;
  const items = $$('.fx', fx.parentElement);
  holdReorder(e, items.map((x) => [x]), items.indexOf(fx), {
    onDone: (a, b) => { const [x] = l.fx.splice(a, 1); l.fx.splice(b, 0, x); commit('Reorder effects'); buildCanvas(); renderAll(); toast('Moved ' + x.name, true); },
  });
}
function layerDrag(e, grip) {
  const row = grip.closest('.lrow'), list = row.parentElement, rows = $$('.lrow', list), from = rows.indexOf(row);
  if (from < 0) return;
  e.preventDefault(); grip.setPointerCapture(e.pointerId);
  const hs = rows.map((r) => r.offsetHeight), tops = rows.map((r) => r.offsetTop), n = rows.length;
  const lo = tops[0] - tops[from], hi = tops[n - 1] + hs[n - 1] - tops[from] - hs[from];
  const y0 = e.clientY; let to = from, moved = false;
  const mv = (ev) => {
    let dy = ev.clientY - y0;
    if (!moved && Math.abs(dy) < 4) return;
    if (!moved) { moved = true; dragging = true; row.classList.add('lift'); rows.forEach((r) => { if (r !== row) r.classList.add('shift'); }); }
    dy = clamp(dy, lo, hi); row.style.transform = `translateY(${dy}px)`;
    const c = tops[from] + hs[from] / 2 + dy;
    to = rows.findIndex((r, i) => c < tops[i] + hs[i]); if (to < 0) to = n - 1;
    rows.forEach((r, i) => { if (i === from) return; r.style.transform = from < to && i > from && i <= to ? `translateY(${-hs[from]}px)` : from > to && i >= to && i < from ? `translateY(${hs[from]}px)` : ''; });
  };
  const up = () => {
    grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
    dragging = false;
    if (moved && to !== from) { const l = lay(rows[from].dataset.v), j = layers.indexOf(lay(rows[to].dataset.v)); layers.splice(layers.indexOf(l), 1); layers.splice(j, 0, l); S.sel = l.id; commit('Reorder layers'); buildCanvas(); renderAll(); toast('Moved ' + l.name, true); }
    else renderLeft();
  };
  grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
}
function tlDrag(e) {
  const h0 = tlHeight(), y0 = e.clientY, hd = $('#tlh'); let moved = false;
  app.classList.remove('anim'); hd.classList.add('drag'); hd.setPointerCapture(e.pointerId);
  const mv = (ev) => { const dy = y0 - ev.clientY; if (Math.abs(dy) > 4) moved = true; S.tlPx = Math.max(58, Math.min(app.clientHeight * .78, h0 + dy)); app.style.setProperty('--tlh', S.tlPx + 'px'); if ((S.tlPx > 90) !== ($('.tl-body') !== null)) renderTL(); layoutStage(); };
  const up = () => {
    hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up);
    const H = app.clientHeight, cur = S.tlPx ?? h0;
    if (!moved) S.tl = S.tl === 'peek' ? 'mid' : 'peek';
    else { const opts = [['peek', 58], ['mid', H * .4], ['tall', H * .64]]; S.tl = opts.reduce((a, b) => (Math.abs(b[1] - cur) < Math.abs(a[1] - cur) ? b : a))[0]; }
    S.tlPx = null; app.classList.add('anim'); renderAll(); setTimeout(layoutStage, 240);
  };
  hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
}
function sheetDrag(e) {
  const y0 = e.clientY, g = $('#sheetgrab'); let moved = false; g.setPointerCapture(e.pointerId);
  const mv = (ev) => { if (Math.abs(ev.clientY - y0) > 6) moved = true; };
  const up = (ev) => {
    g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up);
    const dy = ev.clientY - y0;
    if (!moved) S.full = !S.full; else if (dy < -30) S.full = true; else if (dy > 30) { if (S.full) S.full = false; else S.right = null; }
    renderAll();
  };
  g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up);
}
function scrubDrag(e, el) {
  if (S.playing) play(false);
  el.setPointerCapture(e.pointerId);
  const set = (ev) => { const r = el.getBoundingClientRect(); seek(Math.round((ev.clientX - r.left) / r.width * DUR)); };
  set(e); const mv = (ev) => set(ev);
  const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); renderRight(); };
  el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
}
function keyDown(e, dk) {
  e.stopPropagation();
  const L = lay(dk.dataset.l);
  const pick = () => {
    if (dk.dataset.dk === 'one') { const k = { l: L.id, p: dk.dataset.p, i: +dk.dataset.i }; const has = S.keys.findIndex((s) => s.l === k.l && s.p === k.p && s.i === k.i); if (e.shiftKey) { has >= 0 ? S.keys.splice(has, 1) : S.keys.push(k); } else S.keys = [k]; }
    else { const t = +dk.dataset.t; S.keys = TF.flatMap((p) => animated(L.p[p]) ? L.p[p].keys.map((k, i) => ({ k, i, p })).filter((o) => Math.abs(o.k.t - t) < .5).map((o) => ({ l: L.id, p: o.p, i: o.i })) : []); }
    S.sel = L.id;
  };
  const isLong = longPress(e, () => { pick(); seek(+(dk.dataset.t ?? L.p[dk.dataset.p].keys[+dk.dataset.i].t)); const r = dk.getBoundingClientRect(); S.pop = { type: 'ease', x: r.left + r.width / 2, y: r.top }; renderAll(); });
  // drag to retime
  const x0 = e.clientX, track = dk.parentElement; let moved = false;
  const mv = (ev) => {
    if (isLong()) return;
    const dx = ev.clientX - x0; if (Math.abs(dx) < 6 && !moved) return;
    if (!moved) { moved = true; pick(); }
    const df = Math.round(dx / track.clientWidth * DUR);
    dk.style.transform = `translateX(${df / DUR * track.clientWidth}px)`; dk.dataset.df = df;
  };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
    if (isLong()) return;
    if (!moved) { pick(); renderAll(); return; }
    const df = +(dk.dataset.df || 0);
    if (df) {
      for (const s of S.keys) { const k = lay(s.l).p[s.p].keys[s.i]; k.t = Math.max(0, Math.min(DUR - 1, k.t + df)); }
      for (const s of S.keys) { const pr = lay(s.l).p[s.p]; const k = pr.keys[s.i]; pr.keys.sort((a, b) => a.t - b.t); s.i = pr.keys.indexOf(k); }
      commit('Move keyframes'); updateCanvas();
    }
    suppressClick = true; renderAll();
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
// Relative scrub: each point of horizontal travel changes the value by the property's step.
// Moving the finger further above the field speeds it up (×2/×5/×10), further below slows it (×0.5/×0.2/×0.1).
function fieldDrag(e, fl) {
  e.preventDefault();
  const o = fl.dataset.o, isObj = o != null, isOpt = o === 'po' || o === 'br' || o === 'on';
  const l = isOpt ? {} : lay(isObj ? S.sel : fl.dataset.l); if (!l) return;
  const p = fl.dataset.p, key = fl.dataset.k, ii = +fl.dataset.i, isInt = fl.dataset.int === '1';
  const tgt = () => (o === 'br' ? brushCur() : o === 'on' ? S.onion : isOpt ? S : o === 'fx' ? l.fx[ii] : o === 'rep' ? l.rep : o === 'mod' ? (l.mods || [])[ii] : o === 'an' ? (l.anims || [])[ii] : l);
  if (isObj && !tgt()) return;
  const m = isObj ? { step: +fl.dataset.step || .5, min: +fl.dataset.min, max: +fl.dataset.max, u: fl.dataset.u || '', label: fl.getAttribute('aria-label') } : PROPS[p];
  const getV = () => (isObj ? tgt()[key] : val(l.p[p], S.f));
  const setV = (nv) => { if (isObj) { tgt()[key] = isInt ? Math.round(nv) : nv; if (key === 'inP' || key === 'outP') { l.inP = Math.min(l.inP ?? 0, (l.outP ?? DUR) - 1); } if (isOpt) { if (o === 'br') saveBrush(); else if (o === 'on') { saveOnion(); updateCanvas(); } return; } if (o === 'mod') updateCanvas(); else buildCanvas(); } else { applyProp(l, p, nv); updateCanvas(); } };
  let v = getV();
  const r0 = fl.getBoundingClientRect(), cy0 = r0.top + r0.height / 2, x0 = e.clientX; let lastX = e.clientX, moved = false;
  const badge = $('#spd');
  fl.setPointerCapture(e.pointerId);
  const mv = (ev) => {
    if (!moved && Math.abs(ev.clientX - x0) < 4) return;
    if (!moved) { moved = true; fl.classList.add('drag'); dragging = true; lastX = ev.clientX; return; }
    const dy = ev.clientY - cy0, ad = Math.abs(dy);
    const speed = ad <= 24 ? 1 : dy < 0 ? (ad >= 120 ? 10 : ad >= 80 ? 5 : ad >= 40 ? 2 : 1) : (ad >= 120 ? .1 : ad >= 80 ? .2 : ad >= 40 ? .5 : 1);
    v = clamp(v + (ev.clientX - lastX) * m.step * speed * (ev.altKey ? .25 : 1), m.min, m.max); lastX = ev.clientX;
    setV(v);
    fl.querySelector('.v').textContent = fmt(isInt ? Math.round(v) : v, m);
    const a = app.getBoundingClientRect();
    if (speed !== 1) { badge.hidden = false; badge.textContent = '×' + speed; badge.style.left = (ev.clientX - a.left + 14) + 'px'; badge.style.top = (ev.clientY - a.top - 34) + 'px'; } else badge.hidden = true;
  };
  const up = () => {
    fl.removeEventListener('pointermove', mv); fl.removeEventListener('pointerup', up); fl.removeEventListener('pointercancel', up);
    fl.classList.remove('drag'); dragging = false; badge.hidden = true;
    if (moved) { if (isOpt) { renderRight(); renderBrushBar(); if (S.pop && S.pop.type === 'onion') renderPop(); return; } commit('Edit ' + m.label); renderTop(); renderTL(); renderRight(); placeSel(); return; }
    // tap: type an exact value
    const span = fl.querySelector('.v'), cur = getV();
    const inp = document.createElement('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.value = Math.round(cur * 10) / 10; inp.setAttribute('aria-label', fl.getAttribute('aria-label'));
    span.replaceWith(inp); inp.focus(); inp.select();
    const done = (ok) => { if (ok) { const nv = parseFloat(inp.value); if (!isNaN(nv)) { setV(clamp(nv, m.min, m.max)); if (!isOpt) commit('Edit'); } } renderBrushBar(); if (S.pop && S.pop.type === 'onion') renderPop(); renderRight(); renderTL(); renderTop(); };
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); inp.onblur = null; done(true); } if (ev.key === 'Escape') { inp.onblur = null; done(false); } });
    inp.onblur = () => done(true);
  };
  fl.addEventListener('pointermove', mv); fl.addEventListener('pointerup', up); fl.addEventListener('pointercancel', up);
}
function curveDrag(e, h) {
  const svg = $('#curve'); svg.setPointerCapture(e.pointerId);
  const ks = selectedKeyObjs(); if (!ks.length) return;
  const a = [...earr(ks[0])];
  const mv = (ev) => {
    const r = svg.getBoundingClientRect(); const x = ((ev.clientX - r.left) / r.width * 280 - 12) / 256, y = (112 - (ev.clientY - r.top) / r.height * 132) / 92;
    const cx = Math.max(0, Math.min(1, x)), cy = Math.max(-.8, Math.min(1.8, y));
    if (h === 1) { a[0] = cx; a[1] = cy; } else { a[2] = cx; a[3] = cy; }
    ks.forEach((k) => (k.e = [...a]));
    const p1 = [12 + a[0] * 256, 112 - a[1] * 92], p2 = [12 + a[2] * 256, 112 - a[3] * 92];
    svg.querySelector('.c').setAttribute('d', `M12,112 C${p1} ${p2} 268,20`);
    const arms = svg.querySelectorAll('.arm'); arms[0].setAttribute('x2', p1[0]); arms[0].setAttribute('y2', p1[1]); arms[1].setAttribute('x2', p2[0]); arms[1].setAttribute('y2', p2[1]);
    svg.querySelectorAll(`[data-h="1"]`).forEach((c) => { c.setAttribute('cx', p1[0]); c.setAttribute('cy', p1[1]); });
    svg.querySelectorAll(`[data-h="2"]`).forEach((c) => { c.setAttribute('cx', p2[0]); c.setAttribute('cy', p2[1]); });
    updateCanvas();
  };
  const up = () => { svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); commit('Edit curve'); renderRight(); renderTL(); renderTop(); };
  svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up);
}
// Canvas: select/move, hand pan, pinch zoom, place shapes and text.
const ptrs = new Map(); let pinch0 = null, penSeen = false;
addEventListener('pointerdown', (e) => { suppressClick = false; if (e.pointerType === 'pen') penSeen = true; }, true); // a stale suppress flag from a drag that ended off-target must not eat the next tap
function penFinish(close) {
  const P = S.penPts; S.penPts = [];
  if (P.length < 2) { drawOverlay(); renderFloats(); if (P.length) toast('A path needs at least two points'); return; }
  const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]), cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2), cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
  S.tool = 'select'; S.selMode = 'select';
  newLayer('path', { x: cx, y: cy, pts: P.map((q) => [q[0] - cx, q[1] - cy]), closed: !!close && P.length > 2, smooth: false, fill: false, sw: 8 });
}
function penUndo() { S.penPts.pop(); drawOverlay(); renderFloats(); }
function canvasDown(e) {
  ptrs.set(e.pointerId, [e.clientX, e.clientY]); vp.setPointerCapture(e.pointerId);
  if (ptrs.size === 2) { foldStart('drag'); const [a, b] = [...ptrs.values()], v = vp.getBoundingClientRect(); pinch0 = { d: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), z: S.zoom, pan: [...S.pan], c: [(a[0] + b[0]) / 2 - v.left, (a[1] + b[1]) / 2 - v.top] }; dragging = false; return; }
  if (S.eyedrop) {
    const g = e.target.closest('g[data-id]'), src = g && lay(g.dataset.id), dst = S.sel && lay(S.sel);
    const key = typeof S.eyedrop === 'string' ? S.eyedrop : 'hue'; S.eyedrop = false; renderFloats();
    if (key === 'brush' && src) { S.brush.c = src.hue; saveBrush(); renderBrushBar(); toast(`Brush colour ${String(src.hue).toUpperCase()} from ${src.name}`); return; }
    if (src && dst) { dst[key] = src.hue; commit('Pick colour'); buildCanvas(); renderAll(); toast(`Picked ${String(src.hue).toUpperCase()} from ${src.name}`, true); }
    else toast('No layer there. Tap the eyedropper and try again.');
    return;
  }
  if (isDrawTool(S.tool) && e.button !== 1) { if (e.pointerType === 'touch' && penSeen) return panStart(e); return drawDown(e); }
  const [cx, cy] = compPt(e);
  if (S.tool === 'text') { newLayer('text', { x: Math.round(cx), y: Math.round(cy) }); S.tool = 'select'; renderStrips(); renderFloats(); return; }
  if (['rect', 'ellipse', 'star', 'polygon', 'line'].includes(S.tool)) return shapeDrag(e, cx, cy);
  if (S.tool === 'pen') {
    if (ptrs.size > 1) return;
    const [px, py] = compPt(e), P = S.penPts;
    if (P.length > 2 && Math.hypot(px - P[0][0], py - P[0][1]) < 28 / Math.max(.2, S.zoom)) { penFinish(true); return; }
    P.push([Math.round(px), Math.round(py)]); drawOverlay(); renderFloats(); return;
  }
  if (S.tool === 'hand' || e.button === 1) return panStart(e);
  const inBox = (() => { const b = $('#selbox'); if (b.hidden) return false; const r = b.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; })();
  if ((S.tool === 'marquee' || S.tool === 'lasso') && !inBox) return areaSelect(e);
  const g = e.target.closest('g[data-id]'); let L = g && lay(g.dataset.id);
  if (S.tool !== 'select' && inBox) L = lay(S.sel);
  const prev = selIds();
  if (L && e.shiftKey) { toggleMember(L.id, prev); return; }
  if (!L || L.lock) { if (S.sel) { S.sel = null; S.multi.clear(); S.keys = []; renderAll(); } return; }
  if (!prev.includes(L.id)) { S.sel = L.id; S.multi.clear(); S.keys = []; renderAll(); }
  else if (S.sel !== L.id) { S.sel = L.id; renderAll(); }
  const start = selIds().map(lay).filter((x) => x && !x.lock).map((l) => [l, val(l.p.x, S.f), val(l.p.y, S.f)]);
  const isLong = longPress(e, () => toggleMember(L.id, prev));
  let moved = false;
  const mv = (ev) => {
    if (ptrs.size > 1 || isLong()) return;
    const [nx, ny] = compPt(ev); let dx = nx - cx, dy = ny - cy;
    if (!moved && Math.hypot(dx, dy) < 4) return; if (!moved) foldStart('drag'); moved = true; dragging = true;
    let sx = false, sy = false;
    if (S.snap && !L.parent && start.length === 1) { const x = start[0][1] + dx, y = start[0][2] + dy; if (Math.abs(x - 960) < 14) { dx += 960 - x; sx = true; } if (Math.abs(y - 540) < 14) { dy += 540 - y; sy = true; } }
    const sr = stage.getBoundingClientRect(), vr = vp.getBoundingClientRect();
    $('#gv').style.display = sx ? 'block' : 'none'; $('#gv').style.left = (sr.left - vr.left + sr.width / 2) + 'px';
    $('#gh').style.display = sy ? 'block' : 'none'; $('#gh').style.top = (sr.top - vr.top + sr.height / 2) + 'px';
    start.forEach(([l, x0, y0]) => { const [lx, ly] = toLocal(l, dx, dy); setVal(l, 'x', Math.round(x0 + lx)); setVal(l, 'y', Math.round(y0 + ly)); });
    updateCanvas(); updateFields();
  };
  const up = () => { vp.removeEventListener('pointermove', mv); vp.removeEventListener('pointerup', up); vp.removeEventListener('pointercancel', up); dragging = false; foldEnd('drag'); $('#gv').style.display = $('#gh').style.display = 'none'; if (isLong()) return; if (moved) { commit(start.length > 1 ? `Move ${start.length} layers` : 'Move'); renderAll(); } else placeSel(); };
  vp.addEventListener('pointermove', mv); vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
}
// Click-drag with a shape tool sizes the new shape: rectangles corner to corner, round shapes from the centre out, lines end to end. A plain tap places the default size.
function shapeDrag(e, cx, cy) {
  const type = S.tool; let L = null, moved = false;
  const apply = (nx, ny) => {
    const dx = nx - cx, dy = ny - cy;
    if (type === 'rect') { L.w = Math.max(8, Math.round(Math.abs(dx))); L.h = Math.max(8, Math.round(Math.abs(dy))); L.cr = Math.min(L.cr ?? 24, L.w / 2, L.h / 2); setVal(L, 'x', Math.round(cx + dx / 2)); setVal(L, 'y', Math.round(cy + dy / 2)); }
    else if (type === 'line') { L.w = Math.max(8, Math.round(Math.hypot(dx, dy))); setVal(L, 'rot', Math.round(Math.atan2(dy, dx) * 180 / Math.PI)); setVal(L, 'x', Math.round(cx + dx / 2)); setVal(L, 'y', Math.round(cy + dy / 2)); }
    else L.r = Math.max(4, Math.round(Math.hypot(dx, dy)));
  };
  const mv = (ev) => {
    if (ptrs.size > 1) return;
    const [nx, ny] = compPt(ev);
    if (!moved) { if (Math.hypot(nx - cx, ny - cy) < 6) return; moved = true; dragging = true; newLayer(type, { x: Math.round(cx), y: Math.round(cy) }); L = lay(S.sel); }
    apply(nx, ny); buildCanvas(); updateFields();
  };
  const up = () => {
    vp.removeEventListener('pointermove', mv); vp.removeEventListener('pointerup', up); vp.removeEventListener('pointercancel', up); dragging = false;
    if (!moved) newLayer(type, { x: Math.round(cx), y: Math.round(cy) });
    else { hist[hi] = JSON.stringify(layers); lastLabel = 'Add ' + L.name; renderAll(); }
    S.tool = 'select'; renderStrips(); renderFloats();
  };
  vp.addEventListener('pointermove', mv); vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
}
function panStart(e) {
  const p0 = [...S.pan], x0 = e.clientX, y0 = e.clientY;
  let moved = false;
  const mv = (ev) => { if (ptrs.size > 1) return; if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return; if (!moved) { moved = true; foldStart('drag'); } S.pan = [p0[0] + ev.clientX - x0, p0[1] + ev.clientY - y0]; layoutStage(); };
  const up = () => { vp.removeEventListener('pointermove', mv); vp.removeEventListener('pointerup', up); foldEnd('drag'); };
  vp.addEventListener('pointermove', mv); vp.addEventListener('pointerup', up);
}
vp.addEventListener('pointermove', (e) => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (pinch0 && ptrs.size === 2) { const [a, b] = [...ptrs.values()], v = vp.getBoundingClientRect(); const z = Math.max(.25, Math.min(6, pinch0.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0.d)), k = z / pinch0.z; const cx = (a[0] + b[0]) / 2 - v.left, cy = (a[1] + b[1]) / 2 - v.top, mx = v.width / 2, my = v.height / 2; S.zoom = z; S.pan = [cx - mx - (pinch0.c[0] - mx - pinch0.pan[0]) * k, cy - my - (pinch0.c[1] - my - pinch0.pan[1]) * k]; layoutStage(); } });
const endPtr = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null; if (!ptrs.size) foldEnd('drag'); };
vp.addEventListener('pointerup', endPtr); vp.addEventListener('pointercancel', endPtr);
vp.addEventListener('wheel', (e) => { e.preventDefault(); if (e.ctrlKey || e.metaKey) S.zoom = Math.max(.25, Math.min(6, S.zoom * (e.deltaY < 0 ? 1.08 : .92))); else S.pan = [S.pan[0] - e.deltaX, S.pan[1] - e.deltaY]; layoutStage(); }, { passive: false });
vp.addEventListener('dblclick', (e) => { const g = e.target.closest('g[data-id]'); const L = g && lay(g.dataset.id); if (L && L.type === 'text') { S.right = 'props'; S.collapsed.delete('app'); renderAll(); setTimeout(() => { const t = $('#ltext'); if (t) { t.focus(); t.select(); } }, 80); } });

addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '');
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (S.tool === 'pen' && S.penPts.length && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.key === 'Enter' ? penFinish(false) : (S.penPts = [], drawOverlay(), renderFloats()); return; }
  if (e.key === 'Escape') { if (S.dialog) A.close(); else if (S.pop) { S.pop = null; renderPop(); renderTop(); renderStrips(); } else { S.keys = []; renderAll(); } return; }
  if (typing) return;
  const ar = document.activeElement && document.activeElement.closest && document.activeElement.closest('.lrow[data-v]');
  if (e.altKey && ar && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    const l = lay(ar.dataset.v), i = layers.indexOf(l), j = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (l && j >= 0 && j < layers.length) { layers.splice(i, 1); layers.splice(j, 0, l); commit('Reorder layers'); buildCanvas(); renderAll(); const nr = $(`#lpanel .lrow[data-v="${l.id}"]`); if (nr) nr.focus(); }
    return;
  }
  if (mod && k === 'c' && S.keys.length) { e.preventDefault(); copyKeys(); return; }
  if (mod && k === 'v' && keyClip && S.sel) { e.preventDefault(); pasteKeys(); return; }
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'a') { e.preventDefault(); A.selall(); return; }
  if (mod && k === 'd' && S.sel) { e.preventDefault(); A.dup(); return; }
  if (mod && k === 'g' && S.sel) { e.preventDefault(); A.group(); return; }
  if (S.dialog) return;
  if (e.key === ' ') { e.preventDefault(); play(); return; }
  if (e.key === '?') { A.help(); return; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); if (S.playing) play(false); seek(Math.round(S.f) + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)); return; }
  const map = { b: 'brush', x: 'erase', g: 'fill', v: 'select', m: 'marquee', q: 'lasso', h: 'hand', p: 'pen', t: 'text', r: 'rect', e: 'ellipse', y: 'polygon', s: 'star', l: 'line' };
  if (!mod && map[k]) { S.tool = map[k]; if (S.tool !== 'pen' && S.penPts.length) { S.penPts = []; drawOverlay(); } if (SHAPES.some((s) => s[0] === S.tool)) S.shape = S.tool; if (isSelTool(S.tool)) S.selMode = S.tool; if (isDrawTool(S.tool)) S.drawMode = S.tool; renderStrips(); renderFloats(); return; }
  if (!mod && k === 'k') { A.autokey(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.keys.length) { A.keysdel(); } else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { A.del(); }
});
// two-finger tap = undo, three-finger tap = redo (touch only)
let tapStart = null;
addEventListener('touchstart', (e) => { if (e.touches.length >= 2) tapStart = { n: e.touches.length, t: performance.now() }; }, { passive: true });
addEventListener('touchend', (e) => { if (tapStart && e.touches.length === 0) { if (performance.now() - tapStart.t < 260 && pinch0 === null) { tapStart.n === 2 ? undo() : tapStart.n === 3 && redo(); } tapStart = null; } }, { passive: true });

new ResizeObserver(() => { applyLayout(); layoutStage(); }).observe(app);
new ResizeObserver(() => layoutStage()).observe(vp);

if (S.sel && !lay(S.sel)) S.sel = layers[0] ? layers[0].id : null;
applyTheme(); buildCanvas(); renderAll();
requestAnimationFrame(() => { layoutStage(); placeSel(); });
})();
