// UI-only state for the editor shell (never part of the document or history).
import { effect, signal } from '@preact/signals';

const stored = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try { const v = localStorage.getItem(key) as T | null; return v && allowed.includes(v) ? v : fallback; } catch { return fallback; }
};

/** Viewer snaps layer edges/centres to the comp and other layers while dragging. */
export const snapEnabled = signal(true);

/** Left presets drawer. Open by default on wide screens, closed on portrait iPads. */
export const drawerOpen = signal(typeof window === 'undefined' ? true : window.innerWidth > 1100);

export const easingOpen = signal(false);

export type Theme = 'auto' | 'dark' | 'light';
export const theme = signal<Theme>(stored('rf-theme', ['auto', 'dark', 'light'] as const, 'auto'));
export const cycleTheme = () => {
  theme.value = theme.value === 'auto' ? 'dark' : theme.value === 'dark' ? 'light' : 'auto';
};
export const themeLabel = () => (theme.value === 'auto' ? 'Auto' : theme.value === 'dark' ? 'Dark' : 'Light');

// Apply the chosen appearance. `auto` follows the OS (plain CSS media query).
if (typeof document !== 'undefined') {
  effect(() => {
    const t = theme.value;
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try { localStorage.setItem('rf-theme', t); } catch { /* storage unavailable */ }
  });
}
