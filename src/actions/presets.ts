import { DUR } from '../model/project';
import { store } from '../core/store';
import { PROPS, TF } from '../model/schema';
import { animated, lay, val } from '../anim/interpolate';
import { S, selIds } from '../state/state';
import { commit } from '../state/history';
import { buildCanvas } from '../render/stage';
import { STROKABLE, hasStroke } from '../render/shapes';
import { REP_DEF } from '../anim/pose';
import { PRESETS, myPresets } from '../ui/presets';
import { renderRight } from '../ui/inspector/index';
import { clamp } from '../ui/graph';
import { toast } from '../ui/toast';
import { renderAll } from '../ui/layout';

function putKeys(l, p, ks) {
  const pr = l.p[p]; const old = animated(pr) ? pr.keys : [];
  const a = ks[0][0], b = ks[ks.length - 1][0];
  const keep = old.filter((k) => k.t < a || k.t > b);
  pr.keys = [...keep, ...ks.map(([t, v, e]) => ({ t, v, e: e || 'linear' }))].sort((x, y) => x.t - y.t); delete pr.v;
}
export function applyPreset(id) {
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
export function savePreset() {
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
export function applyMine(id) {
  const l = S.sel && lay(S.sel), e = myPresets().find((p) => p.id === id); if (!l || !e) return;
  const f = Math.round(S.f), cx = val(l.p.x, f), cy = val(l.p.y, f), copy = (o) => JSON.parse(JSON.stringify(o));
  for (const p in e.props) putKeys(l, p, e.props[p].map((k) => [f + k.t, (p === 'x' ? cx : p === 'y' ? cy : 0) + k.v, k.e]));
  if (e.mods.length) { l.mods = [...(l.mods || []), ...copy(e.mods)]; S.collapsed.delete('beh'); }
  if (e.rep) { l.rep = copy(e.rep); S.collapsed.delete('rep'); }
  if (e.fx.length) l.fx = [...l.fx, ...copy(e.fx)];
  commit('Apply preset'); S.keys = []; S.open.add(l.id); buildCanvas(); renderAll(); toast(`${e.name} applied to ${l.name}`, true);
}
