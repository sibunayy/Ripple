// Time-based playback clock (spec §6.2): frames advance with wall-clock time, never slower than real time.
import { signal } from '@preact/signals';
import { current, playhead } from './state';

export const playing = signal(false);
let raf = 0, t0 = 0, f0 = 0;

const tick = (now: number) => {
  const p = current.peek();
  if (!p || !playing.peek()) return;
  const { fps, duration } = p.settings;
  let f = f0 + ((now - t0) / 1000) * fps;
  if (f >= duration) { f = f % duration; f0 = f; t0 = now; } // loop
  playhead.value = f;
  raf = requestAnimationFrame(tick);
};

export function play() {
  const p = current.peek(); if (!p || playing.peek()) return;
  if (playhead.peek() >= p.settings.duration - 1) playhead.value = 0;
  f0 = playhead.peek(); t0 = performance.now();
  playing.value = true;
  raf = requestAnimationFrame(tick);
}

export function pause() {
  if (!playing.peek()) return;
  playing.value = false;
  cancelAnimationFrame(raf);
  playhead.value = Math.round(playhead.peek());
}

export const togglePlay = () => (playing.peek() ? pause() : play());

export function seek(frame: number) {
  const p = current.peek(); if (!p) return;
  const f = Math.min(p.settings.duration - 1, Math.max(0, Math.round(frame)));
  if (playing.peek()) { f0 = f; t0 = performance.now(); }
  playhead.value = f;
}
export const step = (d: number) => { pause(); seek(playhead.peek() + d); };
