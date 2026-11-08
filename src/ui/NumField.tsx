import { useRef, useState } from 'preact/hooks';

interface Props {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; digits?: number; aria?: string;
  /** Value restored by a double-tap (optional). */
  def?: number;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const TAP_PX = 5, FINE_PX = 56, DOUBLE_MS = 300;

/**
 * Slider-in-field numeric control: the whole pill is the slider. Drag horizontally to change the value
 * (move the finger/pen away vertically for fine control, Shift on desktop), tap to type an exact number,
 * double-tap to reset when a default is known. Arrow keys nudge it for keyboard / switch users.
 */
export function NumField({ label, value, onChange, step = 1, min = -1e6, max = 1e6, digits = 1, aria, def }: Props) {
  const [editing, setEditing] = useState(false);
  const drag = useRef<object | null>(null);
  const lastTap = useRef(0);
  const name = aria || label || 'Value';
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const lo = min > -1e5 ? min : null, hi = max < 1e5 ? max : null;
  const bounded = lo !== null && hi !== null;
  const pct = bounded ? ((Math.min(hi, Math.max(lo, value)) - lo) / (hi - lo || 1)) * 100 : null;

  const commit = (v: number) => { if (Number.isFinite(v)) onChange(clamp(round(v, digits))); };

  if (editing) {
    return (
      <label class="num editing">
        {label && <span class="lbl">{label}</span>}
        <input type="number" inputMode="decimal" aria-label={name} step={step} value={round(value, digits)} autoFocus
          ref={(el) => { if (el && document.activeElement !== el) { el.focus(); el.select(); } }}
          onChange={(e) => commit((e.target as HTMLInputElement).valueAsNumber)}
          onKeyDown={(e) => {
            const el = e.target as HTMLInputElement;
            if (e.key === 'Escape') el.value = String(round(value, digits)); // revert so the blur below commits nothing
            if (e.key === 'Enter' || e.key === 'Escape') el.blur();
          }}
          onBlur={() => setEditing(false)} />
      </label>
    );
  }

  // Document-level listeners rather than pointer capture: the field's DOM node can be replaced by the parent's
  // re-render mid-drag (every edit commits a new document), which would silently drop captured moves.
  const onDown = (e: PointerEvent) => {
    if (e.button > 0 || drag.current) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const d = { x: e.clientX, raw: value, moved: false, w: box.width || 120, top: box.top, bottom: box.bottom, id: e.pointerId };
    drag.current = d;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== d.id) return;
      const dx = ev.clientX - d.x;
      if (!d.moved && Math.abs(dx) < TAP_PX) return;
      d.moved = true;
      const away = Math.max(0, d.top - ev.clientY, ev.clientY - d.bottom);
      const fine = ev.shiftKey ? 0.1 : away > FINE_PX ? (away > FINE_PX * 3 ? 0.01 : 0.1) : 1;
      // Bounded props sweep their whole range across the pill; unbounded ones move `step` per pixel.
      const perPx = bounded ? (hi - lo) / Math.max(d.w, 120) : step;
      d.raw = clamp(d.raw + dx * perPx * fine);
      d.x = ev.clientX;
      commit(d.raw);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== d.id) return;
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end);
      drag.current = null;
      if (ev.type === 'pointercancel' || d.moved) return;
      const now = performance.now();
      if (def !== undefined && now - lastTap.current < DOUBLE_MS) { lastTap.current = 0; commit(def); return; }
      lastTap.current = now;
      setEditing(true);
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key, m = e.shiftKey ? 10 : 1;
    if (k === 'ArrowRight' || k === 'ArrowUp') commit(value + step * m);
    else if (k === 'ArrowLeft' || k === 'ArrowDown') commit(value - step * m);
    else if (k === 'Home' && lo !== null) commit(lo);
    else if (k === 'End' && hi !== null) commit(hi);
    else if (k === 'Enter') setEditing(true);
    else return;
    e.preventDefault();
  };

  return (
    <div class="num" role="slider" tabIndex={0} aria-label={name} aria-valuenow={round(value, digits)} aria-valuemin={lo ?? undefined} aria-valuemax={hi ?? undefined}
      onPointerDown={onDown} onKeyDown={onKey}>
      {pct !== null && <i class="fill" style={{ width: `${pct}%` }} />}
      {label && <span class="lbl">{label}</span>}
      <span class="val">{round(value, digits)}</span>
    </div>
  );
}
