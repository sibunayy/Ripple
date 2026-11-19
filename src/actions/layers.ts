// @ts-nocheck
import { $, app } from '../core/dom';
import { HUES, layers } from '../model/project';
import { st } from '../model/schema';
import { S } from '../state/state';
import { commit } from '../state/history';
import { buildCanvas } from '../render/stage';
import { SHP } from '../shader/presets';
import { toast } from '../ui/toast';
import { renderAll } from '../ui/layout';

/* ---------- actions ---------- */
export let nameCount = {};
export function newLayer(type, extra = {}) {
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
