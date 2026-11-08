import { signal } from '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { Icon, type IconName } from './Icon';

export interface MenuItem { label: string; icon?: IconName; danger?: boolean; disabled?: boolean; onSelect: () => void }
const menu = signal<{ x: number; y: number; items: MenuItem[]; at: number } | null>(null);

export const openMenu = (x: number, y: number, items: MenuItem[]) => { menu.value = { x, y, items, at: performance.now() }; };
export const closeMenu = () => { menu.value = null; };

const LONG_MS = 450, SLOP = 8;
let timer = 0, sx = 0, sy = 0;
const cancel = () => { if (timer) { clearTimeout(timer); timer = 0; } };

/**
 * Props that open a context menu on long-press (touch / Pencil) or right-click (mouse). Capture-phase pointer handlers are
 * used so they compose with an element's own drag handlers instead of replacing them.
 */
export function contextProps(build: () => MenuItem[]) {
  const open = (x: number, y: number) => { const items = build(); if (items.length) openMenu(x, y, items); };
  return {
    onPointerDownCapture: (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || !e.isPrimary) return;
      cancel(); sx = e.clientX; sy = e.clientY;
      timer = window.setTimeout(() => { timer = 0; open(sx, sy); }, LONG_MS);
    },
    onPointerMoveCapture: (e: PointerEvent) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > SLOP) cancel(); },
    onPointerUpCapture: cancel,
    onPointerCancelCapture: cancel,
    onContextMenu: (e: MouseEvent) => { e.preventDefault(); cancel(); open(e.clientX, e.clientY); },
  };
}

/** Mounted once (Editor). Renders the open menu, clamped to the viewport; closes on outside press or Escape. */
export function ContextMenuHost() {
  const m = menu.value, ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { // layout effect: listeners must exist as soon as the menu is visible
    if (!m) return;
    const off = (e: Event) => { if (!ref.current?.contains(e.target as Node)) closeMenu(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    addEventListener('pointerdown', off, true); addEventListener('keydown', esc);
    ref.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    return () => { removeEventListener('pointerdown', off, true); removeEventListener('keydown', esc); };
  }, [m]);
  if (!m) return null;
  const w = 200, h = m.items.length * 46 + 8;
  const x = Math.max(8, Math.min(m.x, innerWidth - w - 8)), y = Math.max(8, Math.min(m.y, innerHeight - h - 8));
  return (
    <div class="ctxmenu" role="menu" ref={ref} style={{ left: `${x}px`, top: `${y}px` }} onContextMenu={(e) => e.preventDefault()}>
      {m.items.map((it) => (
        <button key={it.label} role="menuitem" class={it.danger ? 'danger' : ''} disabled={it.disabled}
          // The finger that opened the menu is still lifting: ignore the click it may generate on the first item.
          onClick={() => { if (performance.now() - m.at < 350) return; closeMenu(); it.onSelect(); }}>
          {it.icon && <Icon name={it.icon} size={18} />}{it.label}
        </button>
      ))}
    </div>
  );
}
