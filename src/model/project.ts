// Document model (spec §5).
import type { Layer } from './layer';

export type ColorRGBA = [number, number, number, number]; // 0–1, sRGB

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  duration: number; // frames
  bg: ColorRGBA;
  colorSpace: 'srgb' | 'display-p3';
  linearLight: boolean;
}

export interface AssetMeta { hash: string; name: string; kind: 'image' | 'video' | 'svg'; mime: string; width: number; height: number; duration?: number; size: number }
export interface Marker { id: string; t: number; name: string }

/** A nested composition (precomp target). The root comp is `Project.layers` + `Project.settings`. */
export interface Comp { id: string; name: string; width: number; height: number; fps: number; duration: number; layers: Layer[] }

export interface Project {
  v: 3;
  id: string;
  name: string;
  created: number;
  modified: number;
  settings: ProjectSettings;
  /** Root composition layers, top layer first. (Nested comps arrive with precomps in M4.) */
  layers: Layer[];
  markers: Marker[];
  /** Preview/export range [in, out) in frames; null = whole duration. */
  workArea: [number, number] | null;
  /** Nested comps by id (precomps). */
  comps: Record<string, Comp>;
  /** Imported media by content hash. */
  assets: Record<string, AssetMeta>;
}

export const SIZE_PRESETS = [
  { name: 'HD 1080p', width: 1920, height: 1080 },
  { name: '4K UHD', width: 3840, height: 2160 },
  { name: 'Square', width: 1080, height: 1080 },
  { name: 'Vertical', width: 1080, height: 1920 },
  { name: 'Lottie', width: 512, height: 512 },
] as const;

export const FPS_PRESETS = [24, 25, 30, 50, 60] as const;

export const MAX_DIMENSION = 8192;
export const MAX_FPS = 120;

export const newId = (): string => {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 12);
};

export function createProject(name = 'Untitled', now = Date.now()): Project {
  return {
    v: 3,
    id: newId(),
    name,
    created: now,
    modified: now,
    settings: {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 300,
      bg: [0.07, 0.07, 0.09, 1],
      colorSpace: 'srgb',
      linearLight: false,
    },
    layers: [],
    markers: [],
    workArea: null,
    comps: {},
    assets: {},
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Clamp user-entered settings to supported ranges. */
export function sanitizeSettings(s: ProjectSettings): ProjectSettings {
  return {
    ...s,
    width: clamp(Math.round(s.width) || 1920, 16, MAX_DIMENSION),
    height: clamp(Math.round(s.height) || 1080, 16, MAX_DIMENSION),
    fps: clamp(s.fps || 30, 1, MAX_FPS),
    duration: clamp(Math.round(s.duration) || 1, 1, 1_000_000),
  };
}

export const toHex = (c: ColorRGBA): string =>
  '#' + c.slice(0, 3).map((x) => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, '0')).join('');

export const fromHex = (hex: string, a = 1): ColorRGBA => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0, a];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
};

export const timecode = (frames: number, fps: number): string => {
  const f = Math.round(fps);
  const s = Math.floor(frames / f);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(Math.floor(frames % f))}`;
};

/** Fill in fields missing from projects saved by older versions. */
export const migrate = (p: Project): Project => ({ ...p, v: 3, layers: p.layers ?? [], markers: p.markers ?? [], workArea: p.workArea ?? null, comps: p.comps ?? {}, assets: p.assets ?? {} });

/** Effective work range [in, out), clamped to the current duration. */
export function workRange(p: Pick<Project, 'workArea' | 'settings'>): [number, number] {
  const d = p.settings.duration;
  if (!p.workArea) return [0, d];
  const a = Math.min(Math.max(0, p.workArea[0]), d - 1);
  return [a, Math.min(d, Math.max(a + 1, p.workArea[1]))];
}
