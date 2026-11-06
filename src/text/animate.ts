// Text animators (spec §7.8): range selector over characters / words / lines driving per-unit transforms.
// Pure helpers; the rasteriser applies the resulting per-glyph transforms.
import type { Prop } from '../model/layer';
export type AnimUnit = 'chars' | 'words' | 'lines';
export type AnimShape = 'square' | 'ramp' | 'triangle' | 'round' | 'smooth';
export interface TextAnimator { id: string; name: string; unit: AnimUnit; shape: AnimShape; colorOn?: boolean }

/** Unit index for every character of `text` (newlines get -1) and the unit count. */
export function unitMap(text: string, unit: AnimUnit): { idx: number[]; count: number } {
  const idx: number[] = []; let c = -1, line = 0, inWord = false, count = 0;
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ch === '\n') { idx.push(-1); line++; inWord = false; if (unit === 'lines') count = line + 1; continue; }
    if (unit === 'chars') { c++; idx.push(c); count = c + 1; }
    else if (unit === 'lines') { idx.push(line); count = line + 1; }
    else { const isSp = /\s/.test(ch); if (isSp) { inWord = false; idx.push(c < 0 ? 0 : c); } else { if (!inWord) { c++; inWord = true; } idx.push(c); } count = Math.max(count, c + 1); }
  }
  return { idx, count: Math.max(1, count) };
}

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/**
 * Influence 0–1 of the range selector on unit `i` of `n`. The window is [start+offset, end+offset] (percent of the
 * unit range). `ramp`/`smooth`: 0 before the window, 1 after (so sweeping the window left→right reveals units);
 * `square`: 1 inside; `triangle`/`round`: peak in the middle of the window.
 */
export function influence(i: number, n: number, start: number, end: number, offset: number, shape: AnimShape): number {
  const x = n <= 1 ? 0.5 : (i + 0.5) / n;
  let a = (start + offset) / 100, b = (end + offset) / 100;
  if (b < a) [a, b] = [b, a];
  const w = Math.max(b - a, 1e-6), mid = (a + b) / 2;
  switch (shape) {
    case 'square': return x >= a && x <= b ? 1 : 0;
    case 'ramp': return Math.min(1, Math.max(0, (x - a) / w));
    case 'smooth': return smooth((x - a) / w);
    case 'triangle': return Math.max(0, 1 - Math.abs(x - mid) / (w / 2));
    case 'round': { const t = Math.abs(x - mid) / (w / 2); return t >= 1 ? 0 : Math.cos((t * Math.PI) / 2) ** 2; }
  }
}

export interface Template { id: string; label: string; unit: AnimUnit; shape: AnimShape; start: number; end: number; props: Record<string, number | number[]>; secondsPer: number; minSeconds: number }
/** Quick "animate in" setups: the offset is keyframed from -100 → 100 so the window sweeps across the text. */
export const TEMPLATES: Template[] = [
  { id: 'chars', label: 'Fade by character', unit: 'chars', shape: 'ramp', start: 0, end: 25, props: { opacity: 0 }, secondsPer: 0.05, minSeconds: 0.6 },
  { id: 'rise', label: 'Rise by character', unit: 'chars', shape: 'smooth', start: 0, end: 30, props: { opacity: 0, position: [0, 40] }, secondsPer: 0.06, minSeconds: 0.8 },
  { id: 'words', label: 'Pop by word', unit: 'words', shape: 'ramp', start: 0, end: 40, props: { opacity: 0, scale: [0, 0] }, secondsPer: 0.25, minSeconds: 0.8 },
  { id: 'lines', label: 'Reveal by line', unit: 'lines', shape: 'ramp', start: 0, end: 60, props: { opacity: 0, position: [0, 60] }, secondsPer: 0.4, minSeconds: 0.8 },
  { id: 'typewriter', label: 'Typewriter', unit: 'chars', shape: 'ramp', start: 0, end: 1, props: { opacity: 0 }, secondsPer: 0.06, minSeconds: 0.6 },
  { id: 'wave', label: 'Wave', unit: 'chars', shape: 'triangle', start: 0, end: 30, props: { position: [0, -36] }, secondsPer: 0.08, minSeconds: 1.2 },
];

export const animatorProps = (id: string, start: number, end: number, p: Record<string, number | number[]>): Record<string, Prop<any>> => ({
  [`ta:${id}:start`]: { value: start }, [`ta:${id}:end`]: { value: end }, [`ta:${id}:offset`]: { value: 0 },
  [`ta:${id}:position`]: { value: p.position ?? [0, 0] }, [`ta:${id}:scale`]: { value: p.scale ?? [100, 100] },
  [`ta:${id}:rotation`]: { value: p.rotation ?? 0 }, [`ta:${id}:opacity`]: { value: p.opacity ?? 100 },
  [`ta:${id}:color`]: { value: [1, 0.4, 0.4, 1] },
});

