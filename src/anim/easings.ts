// Easing library (spec §7.6): 8 polynomial/analytic families × In/Out/InOut as cubic-beziers, plus
// Elastic and Bounce as function curves = 30 curves, plus Linear and Hold.
import type { Ease, EaseFn } from '../model/layer';

const B = (a: number, b: number, c: number, d: number): Ease => [a, b, c, d];
type Triple = [Ease, Ease, Ease];
const FAMILIES: [string, Triple][] = [
  ['Sine', [B(0.12, 0, 0.39, 0), B(0.61, 1, 0.88, 1), B(0.37, 0, 0.63, 1)]],
  ['Quad', [B(0.11, 0, 0.5, 0), B(0.5, 1, 0.89, 1), B(0.45, 0, 0.55, 1)]],
  ['Cubic', [B(0.32, 0, 0.67, 0), B(0.33, 1, 0.68, 1), B(0.65, 0, 0.35, 1)]],
  ['Quart', [B(0.5, 0, 0.75, 0), B(0.25, 1, 0.5, 1), B(0.76, 0, 0.24, 1)]],
  ['Quint', [B(0.64, 0, 0.78, 0), B(0.22, 1, 0.36, 1), B(0.83, 0, 0.17, 1)]],
  ['Expo', [B(0.7, 0, 0.84, 0), B(0.16, 1, 0.3, 1), B(0.87, 0, 0.13, 1)]],
  ['Circ', [B(0.55, 0, 1, 0.45), B(0, 0.55, 0.45, 1), B(0.85, 0, 0.15, 1)]],
  ['Back', [B(0.36, 0, 0.66, -0.56), B(0.34, 1.56, 0.64, 1), B(0.68, -0.6, 0.32, 1.6)]],
  ['Elastic', [{ fn: 'elastic', mode: 'in' }, { fn: 'elastic', mode: 'out' }, { fn: 'elastic', mode: 'inout' }]],
  ['Bounce', [{ fn: 'bounce', mode: 'in' }, { fn: 'bounce', mode: 'out' }, { fn: 'bounce', mode: 'inout' }]],
];

export interface EasingPreset { name: string; group: string; ease: Ease }
export const EASINGS: EasingPreset[] = [
  { name: 'Linear', group: 'Basic', ease: 'linear' },
  { name: 'Hold', group: 'Basic', ease: 'hold' },
  { name: 'Ease In/Out', group: 'Basic', ease: [0.42, 0, 0.58, 1] },
  ...FAMILIES.flatMap(([name, t]) => (['In', 'Out', 'InOut'] as const).map((m, i) => ({ name: `${name} ${m}`, group: name, ease: t[i]! }))),
];

const bounceOut = (x: number) => {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) { x -= 1.5 / d; return n * x * x + 0.75; }
  if (x < 2.5 / d) { x -= 2.25 / d; return n * x * x + 0.9375; }
  x -= 2.625 / d; return n * x * x + 0.984375;
};
const C4 = (2 * Math.PI) / 3, C5 = (2 * Math.PI) / 4.5;
const elastic = (m: EaseFn['mode'], x: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (m === 'in') return -(2 ** (10 * x - 10)) * Math.sin((x * 10 - 10.75) * C4);
  if (m === 'out') return 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * C4) + 1;
  return x < 0.5
    ? -(2 ** (20 * x - 10) * Math.sin((20 * x - 11.125) * C5)) / 2
    : (2 ** (-20 * x + 10) * Math.sin((20 * x - 11.125) * C5)) / 2 + 1;
};
const bounce = (m: EaseFn['mode'], x: number) =>
  m === 'in' ? 1 - bounceOut(1 - x) : m === 'out' ? bounceOut(x) : x < 0.5 ? (1 - bounceOut(1 - 2 * x)) / 2 : (1 + bounceOut(2 * x - 1)) / 2;

export const applyEaseFn = (e: EaseFn, u: number): number =>
  u <= 0 ? 0 : u >= 1 ? 1 : e.fn === 'elastic' ? elastic(e.mode, u) : bounce(e.mode, u);

/** Sample any ease for previews (progress 0–1 → eased 0–1, may over/undershoot). */
export { applyEase as sampleEase } from './interp';
