import { DUR, FPS, layers } from '../model/project';
import { lay } from '../anim/interpolate';
import { S } from '../state/state';
import { tc } from '../ui/inspector/controls';
import { toast } from '../ui/toast';
import { newLayer } from '../actions/layers';

/* ---------- playback ---------- */
export const aud = {};
export function waveSvg(L) {
  const pk = L.wave || [], n = pk.length; if (!n) return '';
  const span = ((L.outP ?? DUR) - (L.inP ?? 0)) / Math.max(1, (L.adur || 1) * FPS), m = Math.max(2, Math.min(n, Math.round(n * span)));
  let d = ''; for (let i = 0; i < m; i++) { const x = (i / (m - 1) * 100).toFixed(2), h = Math.max(.04, pk[i]) * 46; d += `M${x} ${(50 - h).toFixed(1)}V${(50 + h).toFixed(1)}`; }
  return `<svg class="wave" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
}
function audioWindow(l) { const a = l.inP ?? 0, b = Math.min(l.outP ?? DUR, a + (l.adur || 0) * FPS); return [a, b]; }
export function syncAudio(force?) {
  for (const l of layers) {
    if (l.type !== 'audio') continue; const el = aud[l.id]; if (!el) continue;
    el.volume = Math.max(0, Math.min(1, (l.vol ?? 100) / 100)); el.muted = !!l.mute || !l.vis;
    const [a, b] = audioWindow(l), on = S.playing && S.f >= a && S.f < b;
    if (on) { const want = (S.f - a) / FPS; if (force || el.paused || Math.abs(el.currentTime - want) > .25) { el.currentTime = want; if (el.paused) el.play().catch(() => {}); } }
    else if (!el.paused) el.pause();
  }
  for (const id in aud) if (!lay(id) && !aud[id].paused) aud[id].pause();
}
export function importAudio(file) {
  const url = URL.createObjectURL(file), el = new Audio(url); el.preload = 'auto';
  el.addEventListener('loadedmetadata', async () => {
    const adur = el.duration || 1; let wave = [];
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext, ac = new AC(), buf = await ac.decodeAudioData(await file.arrayBuffer()); ac.close && ac.close();
      const ch = buf.getChannelData(0), N = 400, step = Math.max(1, Math.floor(ch.length / N));
      for (let i = 0; i < N; i++) { let mx = 0; for (let j = i * step, e = Math.min(ch.length, j + step); j < e; j += 8) { const v = Math.abs(ch[j]); if (v > mx) mx = v; } wave.push(mx); }
      const top = Math.max(...wave, .01); wave = wave.map((v) => Math.round(v / top * 100) / 100);
    } catch { wave = []; }
    const id = 'a' + Date.now().toString(36);
    aud[id] = el;
    newLayer('audio', { id, name: file.name, src: url, adur, wave, vol: 100, mute: false, hue: '#8b7cf6', inP: 0, outP: Math.min(DUR, Math.round(adur * FPS)) });
    if (adur * FPS > DUR) toast(`Added ${file.name}. It runs past the end of the composition, so it is cut at ${tc(DUR)}.`);
  }, { once: true });
  el.addEventListener('error', () => toast('Could not read that audio file.'), { once: true });
}
