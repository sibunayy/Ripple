// Runtime media cache: decoded images and video elements for the renderer (spec §7.10).
// Everything loads lazily and asynchronously; `mediaRev` bumps whenever something becomes drawable so the viewer redraws.
import { signal } from '@preact/signals';
import { getAssetBlob } from '../io/assets';
import { hasSolo, isShown, type Layer } from '../model/layer';
import type { Comp } from '../model/project';

export const mediaRev = signal(0);

interface ImgEntry { bm: ImageBitmap | null; state: 'loading' | 'ready' | 'error' }
interface VidEntry { el: HTMLVideoElement; url: string; state: 'loading' | 'ready' | 'error' }
const images = new Map<string, ImgEntry>();
const videos = new Map<string, VidEntry>();

export function imageFor(hash: string): ImageBitmap | null {
  let e = images.get(hash);
  if (!e) {
    e = { bm: null, state: 'loading' }; images.set(hash, e);
    const entry = e;
    void getAssetBlob(hash).then((b) => (b ? createImageBitmap(b) : Promise.reject(new Error('missing asset'))))
      .then((bm) => { entry.bm = bm; entry.state = 'ready'; mediaRev.value++; })
      .catch(() => { entry.state = 'error'; });
  }
  return e.bm;
}

/** Returns the video element once it can draw a frame (readyState ≥ 2), else null (and starts loading). */
export function videoFor(hash: string): HTMLVideoElement | null {
  let e = videos.get(hash);
  if (!e) {
    const el = document.createElement('video');
    el.muted = true; el.playsInline = true; el.preload = 'auto'; el.loop = false;
    e = { el, url: '', state: 'loading' }; videos.set(hash, e);
    const entry = e;
    void getAssetBlob(hash).then((b) => {
      if (!b) { entry.state = 'error'; return; }
      entry.url = URL.createObjectURL(b); el.src = entry.url;
    });
    el.addEventListener('loadeddata', () => { entry.state = 'ready'; mediaRev.value++; });
    el.addEventListener('seeked', () => { mediaRev.value++; });
    el.addEventListener('error', () => { entry.state = 'error'; });
  }
  return e.el.readyState >= 2 ? e.el : null;
}

/** Source time (s) of a video layer at comp frame t. */
export const videoTime = (l: Layer, t: number, fps: number) => Math.max(0, (l.media?.start ?? 0) + ((t - l.in) / fps) * (l.media?.speed ?? 1));

export function seekVideo(el: HTMLVideoElement, sec: number): Promise<void> {
  const target = Math.min(sec, Math.max(0, (el.duration || sec) - 0.001));
  if (Math.abs(el.currentTime - target) < 1e-3 && el.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { el.removeEventListener('seeked', done); resolve(); };
    el.addEventListener('seeked', done); el.currentTime = target;
    setTimeout(done, 2000); // never hang an export on a stuck decoder
  });
}

/** Preview sync: play active videos while the clock runs, seek them while scrubbing. Call before each draw. */
export function syncVideos(layers: readonly Layer[], comps: Record<string, Comp>, t: number, fps: number, playing: boolean, depth = 0) {
  const anySolo = hasSolo(layers);
  for (const l of layers) {
    const active = isShown(l, t, anySolo);
    if (l.type === 'precomp' && l.precomp && depth < 4) {
      const c = comps[l.precomp.comp];
      if (c && active) syncVideos(c.layers, comps, (t - l.in) * (c.fps / fps) + l.precomp.offset, c.fps, playing, depth + 1);
      continue;
    }
    if (l.type !== 'video' || !l.media) continue;
    const el = videoFor(l.media.asset);
    if (!el) continue;
    if (!active) { if (!el.paused) el.pause(); continue; }
    const want = videoTime(l, t, fps);
    if (playing) {
      el.playbackRate = Math.max(0.0625, Math.min(16, l.media.speed || 1));
      if (el.paused || Math.abs(el.currentTime - want) > 0.3) { el.currentTime = want; void el.play().catch(() => undefined); }
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - want) > 0.5 / fps) el.currentTime = want;
    }
  }
}

/** Export: make every media source drawable at exactly frame t (images decoded, videos seeked). */
export async function prepareMedia(layers: readonly Layer[], comps: Record<string, Comp>, t: number, fps: number, depth = 0): Promise<void> {
  const anySolo = hasSolo(layers);
  for (const l of layers) {
    if (!isShown(l, t, anySolo)) continue;
    if (l.type === 'precomp' && l.precomp && depth < 4) {
      const c = comps[l.precomp.comp];
      if (c) await prepareMedia(c.layers, comps, (t - l.in) * (c.fps / fps) + l.precomp.offset, c.fps, depth + 1);
    } else if (l.type === 'image' && l.media) {
      for (let i = 0; i < 200 && !imageFor(l.media.asset) && images.get(l.media.asset)?.state === 'loading'; i++) await new Promise((r) => setTimeout(r, 10));
    } else if (l.type === 'video' && l.media) {
      for (let i = 0; i < 400 && !videoFor(l.media.asset) && videos.get(l.media.asset)?.state === 'loading'; i++) await new Promise((r) => setTimeout(r, 10));
      const el = videoFor(l.media.asset);
      if (el) await seekVideo(el, videoTime(l, t, fps));
    }
  }
}

export function releaseMedia() {
  for (const e of images.values()) e.bm?.close();
  for (const e of videos.values()) { e.el.pause(); e.el.removeAttribute('src'); e.el.load(); if (e.url) URL.revokeObjectURL(e.url); }
  images.clear(); videos.clear();
}
