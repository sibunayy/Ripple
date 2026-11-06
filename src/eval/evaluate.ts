// Evaluate a layer stack at time t (spec §6.1 step 1): resolve animated props, parenting, visibility.
// layers[0] is the TOP layer (After Effects convention).
import { evalProp } from '../anim/interp';
import { compose, decompose, IDENT, invert, mul, apply, type Mat } from './affine';
import { hitLayer, layerBox } from '../shape/geometry';
import type { Layer, TransformKey, Vec2 } from '../model/layer';

export interface Resolved {
  layer: Layer;
  world: Mat;
  opacity: number; // 0–1, not inherited from parents
  active: boolean; // visible and within in/out at t
}

export const MAX_PARENT_DEPTH = 64;

export const localMatrix = (l: Layer, t: number): Mat => {
  const tr = l.transform;
  return compose(evalProp(tr.position, t), evalProp(tr.rotation, t), evalProp(tr.scale, t), evalProp(tr.anchor, t));
};

export function evaluate(layers: readonly Layer[], t: number): Resolved[] {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const worldCache = new Map<string, Mat>();
  const world = (l: Layer, depth: number): Mat => {
    const hit = worldCache.get(l.id);
    if (hit) return hit;
    const local = localMatrix(l, t);
    const parent = l.parent && depth < MAX_PARENT_DEPTH ? byId.get(l.parent) : undefined;
    const w = parent ? mul(world(parent, depth + 1), local) : local;
    worldCache.set(l.id, w);
    return w;
  };
  return layers.map((layer) => ({
    layer,
    world: world(layer, 0),
    opacity: Math.min(1, Math.max(0, evalProp(layer.transform.opacity, t) / 100)),
    active: layer.visible && t >= layer.in && t < layer.out,
  }));
}

/** World corners of the layer rectangle (for outlines). */
export function corners(r: Resolved, t = 0): Vec2[] {
  const [x0, y0, x1, y1] = layerBox(r.layer, t);
  return ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Vec2[]).map(([x, y]) => apply(r.world, x, y));
}

/** Topmost active layer under (x, y) in comp coordinates. */
export function hitTest(resolved: readonly Resolved[], x: number, y: number, t = 0, slop = 6): string | null {
  for (const r of resolved) {
    if (!r.active) continue;
    const inv = invert(r.world);
    if (!inv) continue;
    const [lx, ly] = apply(inv, x, y);
    if (hitLayer(r.layer, t, lx, ly, slop / Math.max(1e-6, Math.sqrt(Math.abs(r.world[0]! * r.world[3]! - r.world[1]! * r.world[2]!))))) return r.layer.id;
  }
  return null;
}

/** Would parenting child → parent create a cycle (or self-parent)? */
export function wouldCycle(layers: readonly Layer[], childId: string, parentId: string): boolean {
  const byId = new Map(layers.map((l) => [l.id, l]));
  let cur: string | undefined = parentId;
  for (let i = 0; cur && i <= MAX_PARENT_DEPTH; i++) {
    if (cur === childId) return true;
    cur = byId.get(cur)?.parent;
  }
  return false;
}

const isStatic = (l: Layer) => (Object.keys(l.transform) as TransformKey[]).every((k) => !('keys' in l.transform[k]));

/**
 * Re-parent keeping the visual position at time t. Compensation needs static transforms
 * (decomposing animated props would bake keys); animated children just re-link ("jump").
 */
export function reparent(layers: readonly Layer[], childId: string, parentId: string | undefined, t: number): Layer[] {
  if (parentId && wouldCycle(layers, childId, parentId)) return layers.slice();
  const resolved = evaluate(layers, t);
  const child = resolved.find((r) => r.layer.id === childId);
  if (!child) return layers.slice();
  let { layer } = child;
  const parentWorld = parentId ? resolved.find((r) => r.layer.id === parentId)?.world ?? IDENT : IDENT;
  const inv = invert(parentWorld);
  if (isStatic(layer) && inv) {
    const d = decompose(mul(inv, child.world), (layer.transform.anchor as { value: Vec2 }).value);
    layer = { ...layer, transform: { ...layer.transform, position: { value: d.position }, rotation: { value: d.rotation }, scale: { value: d.scale } } };
  }
  const next: Layer = { ...layer };
  if (parentId) next.parent = parentId; else delete next.parent;
  return layers.map((l) => (l.id === childId ? next : l));
}
