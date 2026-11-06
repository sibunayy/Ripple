// Keyframe interpolation (spec §7.6). Pure; no DOM.
import { DEFAULT_EASE, type Ease, type Keyframe, type Prop } from '../model/layer';
import { applyEaseFn } from './easings';

type V = number | number[];

/** Solve CSS-style cubic-bezier(x1,y1,x2,y2) for y at progress x (Newton, bisection fallback). */
export function bezierEase(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (s: number) => ((ax * s + bx) * s + cx) * s;
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  let s = x;
  for (let i = 0; i < 8; i++) {
    const err = sx(s) - x;
    if (Math.abs(err) < 1e-6) return ((ay * s + by) * s + cy) * s;
    const d = dx(s);
    if (Math.abs(d) < 1e-6) break;
    s -= err / d;
  }
  let lo = 0, hi = 1;
  s = x;
  for (let i = 0; i < 24; i++) {
    const v = sx(s);
    if (Math.abs(v - x) < 1e-6) break;
    if (v < x) lo = s; else hi = s;
    s = (lo + hi) / 2;
  }
  return ((ay * s + by) * s + cy) * s;
}

export function applyEase(e: Ease, u: number): number {
  if (e === 'linear') return u;
  if (e === 'hold') return 0;
  if (!Array.isArray(e)) return applyEaseFn(e, u);
  return bezierEase(e[0], e[1], e[2], e[3], u);
}

const mix = <T extends V>(a: T, b: T, k: number): T =>
  (typeof a === 'number'
    ? a + ((b as number) - a) * k
    : (a as number[]).map((x, i) => x + (((b as number[])[i] ?? x) - x) * k)) as T;

export const isAnimated = <T>(p: Prop<T>): p is { keys: Keyframe<T>[] } => 'keys' in p;

export function evalProp<T extends V>(p: Prop<T>, t: number): T {
  if (!isAnimated(p)) return p.value;
  const k = p.keys;
  const first = k[0]!, last = k[k.length - 1]!;
  if (t <= first.t) return first.v;
  if (t >= last.t) return last.v;
  let i = 0;
  while (i < k.length - 2 && t >= k[i + 1]!.t) i++;
  const a = k[i]!, b = k[i + 1]!;
  if (a.ease === 'hold') return a.v;
  return mix(a.v, b.v, applyEase(a.ease, (t - a.t) / (b.t - a.t)));
}

export const hasKeyAt = <T>(p: Prop<T>, t: number): boolean => isAnimated(p) && p.keys.some((k) => k.t === t);

/** Set (or add) a keyframe at t. Existing keys keep their easing. */
export function setKey<T extends V>(p: Prop<T>, t: number, v: T): Prop<T> {
  const keys = isAnimated(p) ? p.keys : [];
  const existing = keys.find((k) => k.t === t);
  const next = existing
    ? keys.map((k) => (k === existing ? { ...k, v } : k))
    : [...keys, { t, v, ease: DEFAULT_EASE } as Keyframe<T>].sort((a, b) => a.t - b.t);
  return { keys: next };
}

export function removeKey<T extends V>(p: Prop<T>, t: number): Prop<T> {
  if (!isAnimated(p)) return p;
  const keys = p.keys.filter((k) => k.t !== t);
  return keys.length ? { keys } : { value: evalProp(p, t) };
}

/** Stopwatch: static → animated with a key at t; animated → static at its value at t. */
export function toggleAnimated<T extends V>(p: Prop<T>, t: number): Prop<T> {
  return isAnimated(p) ? { value: evalProp(p, t) } : setKey(p, t, p.value);
}

/** Write a value: static props change directly; animated props auto-key at t. */
export const writeProp = <T extends V>(p: Prop<T>, t: number, v: T): Prop<T> =>
  isAnimated(p) ? setKey(p, t, v) : { value: v };
