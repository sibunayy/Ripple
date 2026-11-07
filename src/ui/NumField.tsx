import { useRef } from 'preact/hooks';

interface Props {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; digits?: number; aria?: string;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** Numeric field: drag the label horizontally to scrub (touch/pen friendly), or tap the box to type. */
export function NumField({ label, value, onChange, step = 1, min = -1e6, max = 1e6, digits = 1, aria }: Props) {
  const drag = useRef<{ x: number; v: number } | null>(null);
  const span = useRef<[number, number] | null>(null); // slider range, frozen while a slider drag is in progress
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  // Bounded props use their own limits; unbounded ones get a window around the current value.
  const lo = min > -1e5 ? min : null, hi = max < 1e5 ? max : null;
  const w = Math.max(100 * step, Math.ceil(Math.abs(value)) * 2);
  const live: [number, number] = lo !== null && hi !== null ? [lo, hi] : lo !== null ? [lo, lo + w * 2] : hi !== null ? [hi - w * 2, hi] : [value - w, value + w];
  const [a, b] = span.current ?? live;
  return (
    <label class="num">
      <span class="lbl" onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, v: value };
      }} onPointerMove={(e) => {
        const d = drag.current; if (!d) return;
        onChange(clamp(round(d.v + (e.clientX - d.x) * step * (e.shiftKey ? 0.1 : 1), digits)));
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>{label}</span>
      <input type="number" inputMode="decimal" aria-label={aria || label || 'Value'} step={step} value={round(value, digits)}
        onChange={(e) => { const v = (e.target as HTMLInputElement).valueAsNumber; if (Number.isFinite(v)) onChange(clamp(v)); }} />
      <input class="slide" type="range" aria-label={`${aria || label || 'Value'} slider`} min={a} max={b} step={step} value={Math.min(b, Math.max(a, value))}
        onPointerDown={() => { span.current = live; }} onPointerUp={() => { span.current = null; }} onPointerCancel={() => { span.current = null; }}
        onInput={(e) => onChange(clamp(round(Number((e.target as HTMLInputElement).value), digits)))} />
    </label>
  );
}
