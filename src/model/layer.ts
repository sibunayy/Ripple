// Layer model (spec §5). M1: solid + null layers with animatable 2D transforms.
import { newId, type ColorRGBA, type ProjectSettings } from './project';

export type Vec2 = [number, number];
/** 'linear' | 'hold' | cubic-bezier control points [x1, y1, x2, y2] (CSS-style). */
export type Ease = 'linear' | 'hold' | [number, number, number, number];
export interface Keyframe<T> { t: number; v: T; ease: Ease }
export type Prop<T> = { value: T } | { keys: Keyframe<T>[] };

export interface Transform {
  anchor: Prop<Vec2>;
  position: Prop<Vec2>;
  scale: Prop<Vec2>; // percent
  rotation: Prop<number>; // degrees
  opacity: Prop<number>; // percent 0–100
}
export type TransformKey = keyof Transform;

export interface Layer {
  id: string;
  name: string;
  type: 'solid' | 'null';
  parent?: string;
  in: number; // frames, inclusive
  out: number; // frames, exclusive
  visible: boolean;
  size: Vec2; // layer-space size in px (solid fill / null bounds)
  color: ColorRGBA; // solid fill (unused by null)
  transform: Transform;
}

export const DEFAULT_EASE: Ease = [0.42, 0, 0.58, 1];

const PALETTE: ColorRGBA[] = [
  [0.49, 0.61, 1, 1], [1, 0.42, 0.42, 1], [0.35, 0.85, 0.6, 1],
  [1, 0.78, 0.3, 1], [0.78, 0.5, 1, 1], [0.3, 0.8, 0.95, 1],
];

export function createLayer(type: Layer['type'], s: ProjectSettings, index: number, name?: string): Layer {
  const size: Vec2 = type === 'solid' ? [s.width, s.height] : [100, 100];
  return {
    id: newId(),
    name: name ?? (type === 'solid' ? `Solid ${index + 1}` : `Null ${index + 1}`),
    type,
    in: 0,
    out: s.duration,
    visible: true,
    size,
    color: PALETTE[index % PALETTE.length]!,
    transform: {
      anchor: { value: [size[0] / 2, size[1] / 2] },
      position: { value: [s.width / 2, s.height / 2] },
      scale: { value: [100, 100] },
      rotation: { value: 0 },
      opacity: { value: 100 },
    },
  };
}
