// Time-based playback clock (spec §6.2): frames advance with wall-clock time, never slower than real time.
import { signal } from '@preact/signals';
import { current, playhead } from './state';
import { workRange } from '../model/project';

export const playing = signal(false);
let raf = 0, t0 = 0, f0 = 0;

const tick = (now: number) => {
  const p = current.peek();
  if (!p || !playing.peek()) return;
  const { fps } = p.settings;
  const [a, b] = workRange(p);
  let f = f0 + ((now - t0) / 1000) * fps;
  if (f >= b) { f = a + ((f - b) % (b - a)); f0 = f; t0 = now; } // loop within the work area
  playhead.value = f;
  raf = requestAnimationFrame(tick);
};

export function play() {
  const p = current.peek(); if (!p || playing.peek()) return;
  const [a, b] = workRange(p);
  if (playhead.peek() >= b - 1 || playhead.peek() < a) playhead.value = a;
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
