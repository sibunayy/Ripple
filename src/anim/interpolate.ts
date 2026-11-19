import { layers } from '../model/project';
import { bez, earr } from './easing';

export const lay = (id) => layers.find((l) => l.id === id);
export const animated = (pr) => !!(pr && pr.keys && pr.keys.length);
export function val(pr, f) {
  if (!animated(pr)) return pr.v;
  const k = pr.keys;
  if (f <= k[0].t) return k[0].v;
  if (f >= k[k.length - 1].t) return k[k.length - 1].v;
  for (let i = 0; i < k.length - 1; i++) if (f >= k[i].t && f <= k[i + 1].t) { const a = k[i], b = k[i + 1]; if (a.e === 'hold') return f >= b.t ? b.v : a.v; const t = (f - a.t) / (b.t - a.t || 1); return a.v + (b.v - a.v) * bez(earr(a))(t); }
  return k[0].v;
}
export const keyAt = (pr, f) => animated(pr) ? pr.keys.findIndex((k) => Math.abs(k.t - f) < .5) : -1;
