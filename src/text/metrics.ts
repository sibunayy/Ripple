// Text layout & measurement (spec §7.8). Uses a shared 2D context when available; falls back to a width estimate (tests/SSR).
import type { Layer } from '../model/layer';
import { evalProp } from '../anim/interp';

let ctx: CanvasRenderingContext2D | null | undefined;
const getCtx = () => {
  if (ctx === undefined) {
    try { ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null; } catch { ctx = null; }
  }
  return ctx;
};

export interface TextStyle { size: number; tracking: number; leading: number }
export const textStyle = (l: Layer, t: number): TextStyle => ({
  size: Math.max(1, evalProp(l.props?.['text.size'] ?? { value: 96 }, t)),
  tracking: evalProp(l.props?.['text.tracking'] ?? { value: 0 }, t),
  leading: evalProp(l.props?.['text.leading'] ?? { value: 120 }, t),
});

export const fontString = (l: Layer, size: number) => {
  const x = l.text!;
  return `${x.italic ? 'italic ' : ''}${x.bold ? '700 ' : '400 '}${size}px ${x.font}`;
};

export interface TextLayout { lines: { text: string; x: number; y: number; w: number }[]; w: number; h: number }

export function layoutText(l: Layer, t: number): TextLayout {
  const x = l.text!, st = textStyle(l, t);
  const c = getCtx();
  if (c) { c.font = fontString(l, st.size); (c as unknown as { letterSpacing: string }).letterSpacing = `${st.tracking / 1000 * st.size}px`; }
  const lh = (st.size * st.leading) / 100;
  const raw = x.text.split('\n');
  const widths = raw.map((s) => (c ? c.measureText(s).width : s.length * st.size * 0.56));
  const w = Math.max(0, ...widths);
  const lines = raw.map((text, i) => ({
    text, y: i * lh, w: widths[i]!,
    x: x.align === 'left' ? 0 : x.align === 'center' ? (w - widths[i]!) / 2 : w - widths[i]!,
  }));
  return { lines, w, h: raw.length * lh };
}
