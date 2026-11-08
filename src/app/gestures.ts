// Multi-finger tap shortcuts for the editor (iPad convention): two-finger tap = undo, three-finger tap = redo.
// A "tap" means every finger lifted within TAP_MS and none travelled more than SLOP px, so pinch-zoom, pans and
// slider drags never trigger it. Touch only — Apple Pencil and mouse are ignored.
import { redo, undo } from './state';

const TAP_MS = 300, SLOP = 14;

export function installGestures(): () => void {
  const down = new Map<number, { x: number; y: number }>();
  let t0 = 0, most = 0, moved = false;
  const reset = () => { down.clear(); most = 0; moved = false; };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    if (down.size === 0) { t0 = performance.now(); most = 0; moved = false; }
    down.set(e.pointerId, { x: e.clientX, y: e.clientY });
    most = Math.max(most, down.size);
  };
  const onMove = (e: PointerEvent) => {
    const s = down.get(e.pointerId);
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > SLOP) moved = true;
  };
  const onUp = (e: PointerEvent) => {
    if (!down.delete(e.pointerId) || down.size > 0) return;
    const fire = !moved && most >= 2 && performance.now() - t0 < TAP_MS;
    const n = most; reset();
    if (!fire) return;
    if (n === 2) undo(); else if (n === 3) redo();
  };
  const onCancel = (e: PointerEvent) => { if (down.has(e.pointerId)) reset(); };
  addEventListener('pointerdown', onDown, true); addEventListener('pointermove', onMove, true);
  addEventListener('pointerup', onUp, true); addEventListener('pointercancel', onCancel, true);
  return () => {
    removeEventListener('pointerdown', onDown, true); removeEventListener('pointermove', onMove, true);
    removeEventListener('pointerup', onUp, true); removeEventListener('pointercancel', onCancel, true);
  };
}
