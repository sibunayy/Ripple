import { root } from '../core/dom';
import { DUR } from '../model/project';
import { store } from '../core/store';
import { lay } from '../anim/interpolate';

/* ---------- state ---------- */
const state = {
  tool: 'select', shape: 'rect', left: store.get('left', null), right: store.get('right', 'props'), sel: 'logo', keys: [], f: 42, playing: false,
  tl: store.get('tl', 'peek'), tlPx: null, full: false, autoKey: false, snap: true, zoom: 1, pan: [0, 0], perf: false, mb: false,
  open: new Set(['logo']), tlMode: 'dope', pop: null, dialog: null, cat: 'All', q: '', collapsed: new Set(store.get('collapsed', ['blend', 'masks', 'trim', 'repeat'])),
  portraitPreview: false, toast: null, hostTheme: root.getAttribute('data-theme'), themePref: store.get('theme', 'auto'), glow: store.get('glow', 'full'), tint: store.get('tint', 'classic'),
  autoFold: store.get('autofold', true), eyedrop: false, penPts: [],
  selMode: 'select', multi: new Set<string>(), wa: [0, DUR], ctxPrev: null,
  drawMode: 'brush', flip: null,
  brush: Object.assign({ pre: 'ink', c: '#f4efe9', pr: true, tl: true, P: { pencil: { sz: 6, op: 90 }, ink: { sz: 10, op: 100 }, marker: { sz: 22, op: 75 }, air: { sz: 70, op: 45 } }, er: { sz: 34, op: 100 } }, store.get('brush', {})),
  onion: Object.assign({ on: true, nb: 2, na: 1, op: 45, tint: true, lb: false }, store.get('onion', {})),
  solo: new Set<string>(), guide: store.get('guide', 'off'), loop: true, lq: '', acat: 'All', aq: '',
  pDur: 100, pAmt: 100, pDir: 'up', pAt: 'head', pStag: 0, easeClip: null,
};
/** Fields the app adds to S later (shader dialog draft and import, the two-tap reset arm). */
interface LateState { shDraft?: any; shImport?: any; resetArm?: any }
export const S: typeof state & LateState = state;
// Multi-selection: S.multi only counts while it contains the primary S.sel, so single-select code stays valid.
export const selIds = () => (S.sel && S.multi.size > 1 && S.multi.has(S.sel)) ? [...S.multi].filter((id) => lay(id)) : (S.sel && lay(S.sel) ? [S.sel] : []);
export const isDrawTool = (t) => t === 'brush' || t === 'erase' || t === 'fill';
export const DRAWMODES = [['brush', 'Brush', 'B'], ['erase', 'Eraser', 'X'], ['fill', 'Fill', 'G']];
export const BPRE = [['pencil', 'Pencil'], ['ink', 'Ink'], ['marker', 'Marker'], ['air', 'Airbrush']];
export const isSelTool = (t) => t === 'select' || t === 'marquee' || t === 'lasso';
export const SELMODES = [['select', 'Select', 'V'], ['marquee', 'Marquee', 'M'], ['lasso', 'Lasso', 'Q']];
export const ANIMS = { fade: ['Fade by character', 8, 2], type: ['Typewriter', 1, 2], rise: ['Rise by character', 12, 2], wave: ['Wave', 0, 0], track: ['Tracking in', 24, 0] };
if (!store.get('collapsedV', 0)) { S.collapsed.add('more'); store.set('collapsedV', 1); store.set('collapsed', [...S.collapsed]); }
if (!store.get('collapsedV3', 0)) { S.collapsed.add('rep'); S.collapsed.add('beh'); store.set('collapsedV3', 1); store.set('collapsed', [...S.collapsed]); }
if (!store.get('collapsedV2', 0)) { S.collapsed.add('adv'); store.set('collapsedV2', 1); store.set('collapsed', [...S.collapsed]); }
