// Fonts (spec §7.8): bundled families are loaded lazily as FontFaces; imported fonts live in IndexedDB.
import { signal } from '@preact/signals';
import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import serif from '@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2?url';
import mono from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';
import display from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url';
import { deleteFont, loadFonts, saveFont } from '../io/store';

export interface FontEntry { family: string; css: string; kind: 'bundled' | 'imported' | 'system' }

const BUNDLED: [string, string, string][] = [
  ['Inter', inter, 'Inter, system-ui, sans-serif'],
  ['Source Serif 4', serif, '"Source Serif 4", Georgia, serif'],
  ['JetBrains Mono', mono, '"JetBrains Mono", ui-monospace, monospace'],
  ['Space Grotesk', display, '"Space Grotesk", system-ui, sans-serif'],
];

export const fonts = signal<FontEntry[]>([
  ...BUNDLED.map(([family, , css]) => ({ family, css, kind: 'bundled' as const })),
  { family: 'System UI', css: 'system-ui, sans-serif', kind: 'system' },
]);
/** Bumped whenever a font finishes loading so the viewer redraws with real glyph metrics. */
export const fontRev = signal(0);

const added = new Set<string>();
async function register(family: string, source: string | ArrayBuffer) {
  if (added.has(family) || typeof FontFace === 'undefined') return;
  added.add(family);
  const face = new FontFace(family, typeof source === 'string' ? `url(${source})` : source, { weight: '100 900' });
  try { await face.load(); document.fonts.add(face); fontRev.value++; } catch (e) { console.warn('font failed', family, e); added.delete(family); }
}

/** Load bundled + previously imported fonts. Call once at startup. */
export async function initFonts() {
  await Promise.all(BUNDLED.map(([family, url]) => register(family, url)));
  try {
    const stored = await loadFonts();
    for (const f of stored) await register(f.family, await f.blob.arrayBuffer());
    fonts.value = [...fonts.value.filter((x) => x.kind !== 'imported'), ...stored.map((f) => ({ family: f.family, css: `"${f.family}", sans-serif`, kind: 'imported' as const }))];
  } catch { /* IndexedDB unavailable: bundled fonts still work */ }
}

/** Import a .ttf/.otf/.woff/.woff2 file. Returns the CSS family name. */
export async function importFont(file: File): Promise<string> {
  const family = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/["\\]/g, '').trim() || 'Imported font';
  await register(family, await file.arrayBuffer());
  await saveFont(family, file);
  fonts.value = [...fonts.value.filter((x) => x.family !== family), { family, css: `"${family}", sans-serif`, kind: 'imported' }];
  return `"${family}", sans-serif`;
}

export async function removeFont(family: string) {
  await deleteFont(family);
  fonts.value = fonts.value.filter((x) => x.family !== family);
}
