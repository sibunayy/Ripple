// @ts-nocheck
import { DUR } from '../model/project';
import { store } from '../core/store';
import { lay } from '../anim/interpolate';
import { S } from '../state/state';
import { commit } from '../state/history';
import { tc } from '../ui/inspector/controls';
import { renderRight } from '../ui/inspector/index';
import { renderTL } from '../ui/timeline';
import { toast } from '../ui/toast';
import { seek } from '../ui/layout';
import { play } from '../playback/loop';

/* ================= v7: frame-by-frame drawing ================= */
// A drawing layer holds cels; each cel holds from its frame until the next cel (exposure).
// Strokes are stored as data in layer space and rasterised once per edit with Canvas2D.
export const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export let exporting = false;
export const celId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const brushCur = () => (S.tool === 'erase' ? S.brush.er : S.brush.P[S.brush.pre]);
export const saveBrush = () => store.set('brush', S.brush);
export const saveOnion = () => store.set('onion', S.onion);
export const lightboxOn = () => { const s = S.sel && lay(S.sel); return !!(S.onion.lb && s && s.type === 'draw' && !S.playing && !exporting); };
export function celIdx(l, f) { const c = l.cels || []; let k = -1; for (let i = 0; i < c.length; i++) if (c[i].f <= f + 1e-6) k = i; return k; }
export function freeFrame(l, f) { while (f < DUR && (l.cels || []).some((c) => c.f === f)) f++; return f < DUR ? f : -1; }
export function insertCel(l, f, strokes) { l.cels = l.cels || []; const c = { id: celId(), f, strokes: JSON.parse(JSON.stringify(strokes || [])), v: 0 }; l.cels.push(c); l.cels.sort((a, b) => a.f - b.f); return c; }
export function addCel(dup) {
  const l = S.sel && lay(S.sel); if (!l || l.type !== 'draw') return;
  if (S.playing) play(false);
  const i = celIdx(l, S.f), cur = i >= 0 ? l.cels[i] : null, f = freeFrame(l, Math.round(S.f));
  if (f < 0) { toast('No free frame left at the end of the timeline.'); return; }
  insertCel(l, f, dup && cur ? cur.strokes : []); commit(dup ? 'Duplicate cel' : 'Blank cel');
  seek(f); renderTL(); renderRight(); toast(`${dup ? 'Duplicated cel' : 'New blank cel'} at ${tc(f)}`, true);
}
export function setExporting(v) { return (exporting = v); }
