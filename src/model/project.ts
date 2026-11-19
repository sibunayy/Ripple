import { an, st } from './schema';
import type { Layer, Marker } from './types';

export const FPS = 30; export let DUR = 150; export let projName = 'Logo sting'; export let compBg: string | null = null;
export const HUES = ['#4aa8ff', '#bfe3f5', '#4fd1c5', '#ef6f7f', '#b9d65a', '#7f9bd6'];
export let layers: Layer[] = [
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
export const markers: Marker[] = [{ f: 30, name: 'Logo hit' }, { f: 86, name: 'Tagline' }];
try {
  const pj = JSON.parse(localStorage.getItem('rfp-project') || 'null');
  if (pj && Array.isArray(pj.layers) && pj.layers.length) {
    layers = pj.layers.filter((l) => !(l.src && String(l.src).startsWith('blob:')));
    markers.splice(0, markers.length, ...(pj.markers || []));
    DUR = pj.dur || 150; if (pj.name) projName = pj.name; if (pj.bg) compBg = pj.bg;
  }
} catch { /* no saved project */ }
export function saveProj() {
  try { localStorage.setItem('rfp-project', JSON.stringify({ layers, markers, dur: DUR, name: projName, bg: compBg })); const sv = document.querySelector('.save'); if (sv) sv.classList.remove('off'); } catch { const sv = document.querySelector('.save'); if (sv) sv.classList.add('off'); }
}
export function setLayers(v) { return (layers = v); }
export function setCompBg(v) { return (compBg = v); }
export function setDUR(v) { return (DUR = v); }
export function setProjName(v) { return (projName = v); }
