// Keyframe-level operations on layer stacks (spec §7.6). Pure: every function returns new layers.
import { isAnimated, removeKey } from './interp';
import { allProps, propOf, withProp as withPropL, type Ease, type Keyframe, type Layer, type Prop, type PropKey } from '../model/layer';

export interface KeyRef { layer: string; prop: PropKey; t: number }
type AnyKey = Keyframe<number | number[]>;
type AnyProp = Prop<number | number[]>;

export const sameKey = (a: KeyRef, b: KeyRef) => a.layer === b.layer && a.prop === b.prop && a.t === b.t;
const groupKey = (r: KeyRef) => `${r.layer}\0${r.prop}`;

const getProp = (l: Layer, k: PropKey) => propOf(l, k) as AnyProp;
const withProp = (l: Layer, k: PropKey, p: AnyProp): Layer => withPropL(l, k, p);

/** Apply fn to each (layer, prop) group that has refs. Untouched layers keep identity. */
function mapGroups(layers: Layer[], refs: KeyRef[], fn: (p: { keys: AnyKey[] }, ts: Set<number>) => AnyProp): Layer[] {
  const groups = new Map<string, { layer: string; prop: PropKey; ts: Set<number> }>();
  for (const r of refs) {
    const g = groups.get(groupKey(r)) ?? { layer: r.layer, prop: r.prop, ts: new Set<number>() };
    g.ts.add(r.t); groups.set(groupKey(r), g);
  }
  return layers.map((l) => {
    let out = l;
    for (const g of groups.values()) {
      if (g.layer !== l.id) continue;
      const p = getProp(out, g.prop);
      if (isAnimated(p)) out = withProp(out, g.prop, fn(p, g.ts));
    }
    return out;
  });
}

/** True if a key exists for the ref. */
export const keyExists = (layers: readonly Layer[], r: KeyRef): boolean => {
  const p = propOf(layers.find((l) => l.id === r.layer) ?? ({} as Layer), r.prop) as AnyProp | undefined;
  return !!p && isAnimated(p) && p.keys.some((k) => k.t === r.t);
};

export const pruneRefs = (layers: readonly Layer[], refs: KeyRef[]) => refs.filter((r) => keyExists(layers, r));

/** Shift selected keys by dt frames (clamped to [0, maxT]). Moved keys replace unselected keys they land on. */
export function moveKeys(layers: Layer[], refs: KeyRef[], dt: number, maxT = Infinity): { layers: Layer[]; refs: KeyRef[] } {
  if (!dt || !refs.length) return { layers, refs };
  const newRefs: KeyRef[] = [];
  const out = mapGroups(layers, refs, (p, ts) => {
    const moved = new Map<number, AnyKey>();
    for (const k of p.keys) if (ts.has(k.t)) {
      const t = Math.min(maxT, Math.max(0, k.t + dt));
      if (!moved.has(t)) moved.set(t, { ...k, t });
    }
    const kept = p.keys.filter((k) => !ts.has(k.t) && !moved.has(k.t));
    return { keys: [...kept, ...moved.values()].sort((a, b) => a.t - b.t) };
  });
  for (const r of refs) {
    const t = Math.min(maxT, Math.max(0, r.t + dt));
    if (!newRefs.some((n) => sameKey(n, { ...r, t }))) newRefs.push({ ...r, t });
  }
  return { layers: out, refs: newRefs };
}

export function deleteKeys(layers: Layer[], refs: KeyRef[]): Layer[] {
  return layers.map((l) => {
    let out = l;
    for (const r of refs) {
      if (r.layer !== l.id) continue;
      const p = getProp(out, r.prop);
      if (isAnimated(p)) out = withProp(out, r.prop, removeKey(p, r.t) as AnyProp);
    }
    return out;
  });
}

export const setEaseOnKeys = (layers: Layer[], refs: KeyRef[], ease: Ease): Layer[] =>
  mapGroups(layers, refs, (p, ts) => ({ keys: p.keys.map((k) => (ts.has(k.t) ? { ...k, ease } : k)) }));

/** Set one component (or the whole number) of a key's value. */
export function setKeyValue(layers: Layer[], r: KeyRef, comp: number, value: number): Layer[] {
  return mapGroups(layers, [r], (p, ts) => ({
    keys: p.keys.map((k) => {
      if (!ts.has(k.t)) return k;
      if (typeof k.v === 'number') return { ...k, v: value };
      const v = k.v.slice(); v[comp] = value; return { ...k, v };
    }),
  }));
}

export interface ClipEntry { prop: PropKey; dt: number; v: number | number[]; ease: Ease }

export function copyKeys(layers: readonly Layer[], refs: KeyRef[]): ClipEntry[] {
  if (!refs.length) return [];
  const t0 = Math.min(...refs.map((r) => r.t));
  const out: ClipEntry[] = [];
  for (const r of refs) {
    const p = propOf(layers.find((l) => l.id === r.layer) ?? ({} as Layer), r.prop) as AnyProp | undefined;
    const k = p && isAnimated(p) ? p.keys.find((x) => x.t === r.t) : undefined;
    if (k) out.push({ prop: r.prop, dt: r.t - t0, v: Array.isArray(k.v) ? k.v.slice() : k.v, ease: k.ease });
  }
  return out;
}

/** Paste clip entries onto one layer at time t. Existing keys at the same time are replaced. */
export function pasteKeys(layers: Layer[], layerId: string, clip: ClipEntry[], t: number, maxT = Infinity): { layers: Layer[]; refs: KeyRef[] } {
  const refs: KeyRef[] = [];
  const out = layers.map((l) => {
    if (l.id !== layerId) return l;
    let cur = l;
    for (const c of clip) {
      const at = Math.min(maxT, t + c.dt);
      const p = getProp(cur, c.prop);
      const keys = (isAnimated(p) ? p.keys : []).filter((k) => k.t !== at);
      keys.push({ t: at, v: Array.isArray(c.v) ? c.v.slice() : c.v, ease: c.ease });
      keys.sort((a, b) => a.t - b.t);
      cur = withProp(cur, c.prop, { keys });
      refs.push({ layer: layerId, prop: c.prop, t: at });
    }
    return cur;
  });
  return { layers: out, refs };
}

/** Nearest keyframe time strictly after/before t across the given layers' animated props. */
export function nextKeyTime(layers: readonly Layer[], ids: readonly string[], t: number, dir: 1 | -1): number | null {
  let best: number | null = null;
  for (const l of layers) {
    if (!ids.includes(l.id)) continue;
    for (const [, p] of allProps(l) as [string, AnyProp][]) {
      if (!isAnimated(p)) continue;
      for (const k of p.keys) if (dir > 0 ? k.t > t : k.t < t) if (best === null || (dir > 0 ? k.t < best : k.t > best)) best = k.t;
    }
  }
  return best;
}
