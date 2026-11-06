// Preset animations (spec §7.13): data-driven keyframe templates applied relative to a layer's current values.
import { evalProp } from './interp';
import { DEFAULT_EASE, allProps, propOf, withProp, type Ease, type Layer, type Prop } from '../model/layer';
import { createEffect, paramKey } from '../render/effects';

export type Spec = number | { add: number } | { mul: number };
export type Val = Spec | Spec[];
export interface PKey { t: number; v: Val; ease?: Ease }
/** prop is a transform key, a layer prop key, or `fx:@<effectType>:<param>` (the effect is added if missing). */
export interface PTarget { prop: string; keys: PKey[] }
export interface Preset {
  id: string; name: string; category: 'In' | 'Out' | 'Emphasis' | 'Loop' | 'Shape' | 'Style' | 'Custom';
  duration: number; // seconds
  anchor?: 'in' | 'out';
  targets: PTarget[];
  trim?: boolean;
}

const A = (n: number): Spec => ({ add: n }), M = (n: number): Spec => ({ mul: n }), SAME = A(0), ONE = M(1);
const EO: Ease = [0.16, 1, 0.3, 1], EI: Ease = [0.7, 0, 0.84, 0], EIO: Ease = [0.65, 0, 0.35, 1], BACK: Ease = [0.34, 1.56, 0.64, 1];
const op = (a: number, b: number, d: number, e: Ease = EO): PTarget => ({ prop: 'opacity', keys: [{ t: 0, v: a, ease: e }, { t: d, v: b }] });

export const BUILTIN_PRESETS: Preset[] = [
  { id: 'fade-in', name: 'Fade In', category: 'In', duration: 0.6, targets: [op(0, 100, 0.6)] },
  { id: 'slide-up-in', name: 'Slide Up', category: 'In', duration: 0.7, targets: [op(0, 100, 0.5), { prop: 'position', keys: [{ t: 0, v: [SAME, A(120)], ease: EO }, { t: 0.7, v: [SAME, SAME] }] }] },
  { id: 'slide-left-in', name: 'Slide From Right', category: 'In', duration: 0.7, targets: [op(0, 100, 0.5), { prop: 'position', keys: [{ t: 0, v: [A(200), SAME], ease: EO }, { t: 0.7, v: [SAME, SAME] }] }] },
  { id: 'scale-pop', name: 'Scale Pop', category: 'In', duration: 0.5, targets: [op(0, 100, 0.2), { prop: 'scale', keys: [{ t: 0, v: [M(0), M(0)], ease: BACK }, { t: 0.5, v: [ONE, ONE] }] }] },
  { id: 'drop-bounce', name: 'Drop Bounce', category: 'In', duration: 0.9, targets: [op(0, 100, 0.15), { prop: 'position', keys: [{ t: 0, v: [SAME, A(-400)], ease: { fn: 'bounce', mode: 'out' } }, { t: 0.9, v: [SAME, SAME] }] }] },
  { id: 'elastic-pop', name: 'Elastic Pop', category: 'In', duration: 1, targets: [{ prop: 'scale', keys: [{ t: 0, v: [M(0), M(0)], ease: { fn: 'elastic', mode: 'out' } }, { t: 1, v: [ONE, ONE] }] }, op(0, 100, 0.15)] },
  { id: 'rotate-in', name: 'Rotate In', category: 'In', duration: 0.8, targets: [op(0, 100, 0.4), { prop: 'rotation', keys: [{ t: 0, v: A(-90), ease: EO }, { t: 0.8, v: SAME }] }, { prop: 'scale', keys: [{ t: 0, v: [M(0.4), M(0.4)], ease: EO }, { t: 0.8, v: [ONE, ONE] }] }] },
  { id: 'blur-in', name: 'Blur In', category: 'In', duration: 0.8, targets: [op(0, 100, 0.5), { prop: 'fx:@gaussianBlur:radius', keys: [{ t: 0, v: 40, ease: EO }, { t: 0.8, v: 0 }] }] },
  { id: 'fade-out', name: 'Fade Out', category: 'Out', duration: 0.6, anchor: 'out', targets: [op(100, 0, 0.6, EI)] },
  { id: 'slide-down-out', name: 'Slide Down', category: 'Out', duration: 0.7, anchor: 'out', targets: [op(100, 0, 0.7, EI), { prop: 'position', keys: [{ t: 0, v: [SAME, SAME], ease: EI }, { t: 0.7, v: [SAME, A(120)] }] }] },
  { id: 'scale-out', name: 'Scale Out', category: 'Out', duration: 0.5, anchor: 'out', targets: [{ prop: 'scale', keys: [{ t: 0, v: [ONE, ONE], ease: EI }, { t: 0.5, v: [M(0), M(0)] }] }, op(100, 0, 0.5, EI)] },
  { id: 'spin-out', name: 'Spin Out', category: 'Out', duration: 0.8, anchor: 'out', targets: [{ prop: 'rotation', keys: [{ t: 0, v: SAME, ease: EI }, { t: 0.8, v: A(180) }] }, op(100, 0, 0.8, EI)] },
  { id: 'pulse', name: 'Pulse', category: 'Emphasis', duration: 0.6, targets: [{ prop: 'scale', keys: [{ t: 0, v: [ONE, ONE], ease: EIO }, { t: 0.3, v: [M(1.15), M(1.15)], ease: EIO }, { t: 0.6, v: [ONE, ONE] }] }] },
  { id: 'heartbeat', name: 'Heartbeat', category: 'Emphasis', duration: 1, targets: [{ prop: 'scale', keys: [{ t: 0, v: [ONE, ONE], ease: EO }, { t: 0.15, v: [M(1.18), M(1.18)], ease: EIO }, { t: 0.3, v: [ONE, ONE], ease: EO }, { t: 0.45, v: [M(1.12), M(1.12)], ease: EIO }, { t: 0.7, v: [ONE, ONE] }] }] },
  { id: 'shake', name: 'Shake', category: 'Emphasis', duration: 0.5, targets: [{ prop: 'position', keys: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ t: i * 0.0625, v: [A(i === 8 ? 0 : (i % 2 ? 18 : -18) * (1 - i / 9)), SAME] as Spec[], ease: 'linear' as Ease })) }] },
  { id: 'tada', name: 'Tada', category: 'Emphasis', duration: 1, targets: [{ prop: 'scale', keys: [{ t: 0, v: [ONE, ONE] }, { t: 0.1, v: [M(0.9), M(0.9)] }, { t: 0.2, v: [M(0.9), M(0.9)] }, { t: 0.3, v: [M(1.1), M(1.1)] }, { t: 0.7, v: [M(1.1), M(1.1)] }, { t: 1, v: [ONE, ONE] }] },
    { prop: 'rotation', keys: [{ t: 0, v: SAME }, { t: 0.2, v: A(-3) }, { t: 0.35, v: A(3) }, { t: 0.5, v: A(-3) }, { t: 0.65, v: A(3) }, { t: 0.8, v: A(-3) }, { t: 1, v: SAME }] }] },
  { id: 'jello', name: 'Jello', category: 'Emphasis', duration: 0.9, targets: [{ prop: 'rotation', keys: [{ t: 0, v: SAME, ease: EO }, { t: 0.2, v: A(12) }, { t: 0.4, v: A(-8) }, { t: 0.6, v: A(4) }, { t: 0.8, v: A(-2) }, { t: 0.9, v: SAME }] }] },
  { id: 'glow-pulse', name: 'Glow Pulse', category: 'Emphasis', duration: 1, targets: [{ prop: 'fx:@glow:intensity', keys: [{ t: 0, v: 0, ease: EIO }, { t: 0.5, v: 220, ease: EIO }, { t: 1, v: 0 }] }] },
  { id: 'float', name: 'Float', category: 'Loop', duration: 2, targets: [{ prop: 'position', keys: [{ t: 0, v: [SAME, SAME], ease: EIO }, { t: 1, v: [SAME, A(-20)], ease: EIO }, { t: 2, v: [SAME, SAME] }] }] },
  { id: 'spin', name: 'Spin', category: 'Loop', duration: 2, targets: [{ prop: 'rotation', keys: [{ t: 0, v: SAME, ease: 'linear' }, { t: 2, v: A(360) }] }] },
  { id: 'breathe', name: 'Breathe', category: 'Loop', duration: 2, targets: [{ prop: 'scale', keys: [{ t: 0, v: [ONE, ONE], ease: EIO }, { t: 1, v: [M(1.06), M(1.06)], ease: EIO }, { t: 2, v: [ONE, ONE] }] }] },
  { id: 'draw-on', name: 'Draw On', category: 'Shape', duration: 1.2, trim: true, targets: [{ prop: 'trim.end', keys: [{ t: 0, v: 0, ease: EIO }, { t: 1.2, v: 100 }] }] },
  { id: 'draw-off', name: 'Draw Off', category: 'Shape', duration: 1.2, trim: true, targets: [{ prop: 'trim.start', keys: [{ t: 0, v: 0, ease: EIO }, { t: 1.2, v: 100 }] }] },
];

const resolve = (v: Val, base: number | number[]): number | number[] => {
  const one = (s: Spec, b: number) => (typeof s === 'number' ? s : 'add' in s ? b + s.add : b * s.mul);
  return Array.isArray(v) ? v.map((s, i) => one(s, (base as number[])[i] ?? 0)) : Array.isArray(base) ? base.map((b) => one(v, b)) : one(v, base);
};

/** Apply a preset to a layer starting at `startFrame` (or ending at the layer's out point for Out presets). */
export function applyPreset(l: Layer, pr: Preset, startFrame: number, fps: number, mkId: () => string, comp: { width: number; height: number }): Layer {
  let layer = l;
  const frames = Math.round(pr.duration * fps);
  const start = pr.anchor === 'out' ? Math.max(0, l.out - frames) : startFrame;
  for (const tg of pr.targets) {
    let key = tg.prop;
    const m = /^fx:@(\w+):(\w+)$/.exec(tg.prop);
    if (m) {
      let e = layer.effects?.find((x) => x.type === m[1]);
      if (!e) {
        const c = createEffect(m[1]!, comp, mkId()); if (!c) continue;
        layer = { ...layer, effects: [...(layer.effects ?? []), c.effect], props: { ...layer.props, ...c.props } }; e = c.effect;
      }
      key = paramKey(e.id, m[2]!);
    }
    const cur = propOf(layer, key); if (!cur) continue;
    const base = evalProp(cur as Prop<number | number[]>, start);
    const keys = tg.keys.map((k) => ({ t: start + Math.round(k.t * fps), v: resolve(k.v, base), ease: k.ease ?? DEFAULT_EASE }));
    layer = withProp(layer, key, { keys });
  }
  if (pr.trim && layer.shape) layer = { ...layer, shape: { ...layer.shape, trim: true } };
  return layer;
}

/** Capture a layer's keyframes as a reusable preset (times relative to the earliest key; absolute values). */
export function presetFromLayer(l: Layer, name: string, fps: number, id: string): Preset | null {
  const animated = allProps(l).filter(([, p]) => 'keys' in p);
  if (!animated.length) return null;
  const t0 = Math.min(...animated.map(([, p]) => (p as { keys: { t: number }[] }).keys[0]!.t));
  let end = 0;
  const targets: PTarget[] = [];
  for (const [k, p] of animated) {
    let prop = k;
    const m = /^fx:([^:]+):(\w+)$/.exec(k);
    if (m) { const e = l.effects?.find((x) => x.id === m[1]); if (!e) continue; prop = `fx:@${e.type}:${m[2]}`; }
    const keys = (p as { keys: { t: number; v: number | number[]; ease: Ease }[] }).keys.map((kf) => {
      const t = (kf.t - t0) / fps; end = Math.max(end, t);
      return { t, v: (Array.isArray(kf.v) ? kf.v.slice() : kf.v) as Val, ease: kf.ease };
    });
    targets.push({ prop, keys });
  }
  return { id, name, category: 'Custom', duration: Math.max(0.1, end), targets, trim: !!l.shape?.trim };
}
