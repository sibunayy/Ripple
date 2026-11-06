import { useRef } from 'preact/hooks';

interface Props {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; digits?: number;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** Numeric field: drag the label horizontally to scrub (touch/pen friendly), or tap the box to type. */
export function NumField({ label, value, onChange, step = 1, min = -1e6, max = 1e6, digits = 1 }: Props) {
  const drag = useRef<{ x: number; v: number } | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <label class="num">
      <span class="lbl" onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, v: value };
      }} onPointerMove={(e) => {
        const d = drag.current; if (!d) return;
        onChange(clamp(round(d.v + (e.clientX - d.x) * step * (e.shiftKey ? 0.1 : 1), digits)));
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>{label}</span>
      <input type="number" inputMode="decimal" step={step} value={round(value, digits)}
        onChange={(e) => { const v = (e.target as HTMLInputElement).valueAsNumber; if (Number.isFinite(v)) onChange(clamp(v)); }} />
    </label>
  );
}
