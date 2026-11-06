// Layer model (spec §5). M1: solid + null layers with animatable 2D transforms.
import { newId, type ColorRGBA, type ProjectSettings } from './project';
import type { BlendMode } from '../render/blend';

export type Vec2 = [number, number];
/** Easing of the segment AFTER a keyframe: linear, hold, cubic-bezier [x1, y1, x2, y2] (CSS-style) or a function curve. */
export type EaseFn = { fn: 'elastic' | 'bounce'; mode: 'in' | 'out' | 'inout' };
export type Ease = 'linear' | 'hold' | [number, number, number, number] | EaseFn;
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
/** Any animatable property: a transform key or an entry of `Layer.props` (e.g. 'fill.color', 'trim.end'). */
export type PropKey = string;

/** Bezier node: position plus in/out handles RELATIVE to the node. Zero handles = corner. */
export interface PathNode { p: Vec2; i: Vec2; o: Vec2 }
/** `keys` animates node positions/handles (same node count in every key); absent = static. */
export interface PathKey { t: number; nodes: PathNode[] }
export interface BezPath { nodes: PathNode[]; closed: boolean; keys?: PathKey[] }

export type MaskMode = 'none' | 'add' | 'subtract' | 'intersect' | 'lighten' | 'darken' | 'difference';
/** Mask path lives in layer space. Opacity/feather/expansion are animatable props `mask:<id>:opacity|feather|expansion`. */
export interface Mask { id: string; name: string; mode: MaskMode; invert: boolean; path: BezPath }
export type MatteMode = 'alpha' | 'alphaInv' | 'luma' | 'lumaInv';
export interface Matte { layer: string; mode: MatteMode }
/** One effect in a layer's stack. Parameters are animatable props `fx:<id>:<param>`; `data` holds non-animatable state (curve points). */
export interface Effect { id: string; type: string; enabled: boolean; data?: unknown }
/** Image/video layers reference a content-addressed asset (Project.assets). Video: `start` = source offset (s), `speed` = playback rate. */
export interface MediaRef { asset: string; start: number; speed: number }
export interface PrecompRef { comp: string; offset: number }

export interface GradStop { at: number; c: ColorRGBA }
/** Fill/stroke paint. Solid colour is the animatable prop 'fill.color' / 'stroke.color'; gradients are static in M3. */
export interface Paint { kind: 'solid' | 'linear' | 'radial'; stops: GradStop[]; from: Vec2; to: Vec2 }
export interface StrokeStyle { cap: 'butt' | 'round' | 'square'; join: 'miter' | 'round' | 'bevel'; dash: number; gap: number; paint: Paint }

export type ShapeKind = 'rect' | 'ellipse' | 'polygon' | 'star' | 'path';
export interface ShapeContent {
  kind: ShapeKind;
  path?: BezPath; // kind === 'path'
  fill: Paint | null;
  stroke: StrokeStyle | null;
  trim: boolean;
  repeater: boolean;
}
export interface TextContent {
  text: string;
  font: string; // CSS family
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
}

export interface Layer {
  id: string;
  name: string;
  type: 'solid' | 'null' | 'shape' | 'text' | 'precomp' | 'adjustment' | 'image' | 'video';
  parent?: string;
  in: number; // frames, inclusive
  out: number; // frames, exclusive
  visible: boolean;
  size: Vec2; // layer-space size in px (solid fill / null bounds)
  color: ColorRGBA; // solid fill (unused by null)
  transform: Transform;
  /** Extra animatable properties (shape/text parameters), keyed by name. */
  props?: Record<string, Prop<any>>;
  shape?: ShapeContent;
  text?: TextContent;
  blend?: BlendMode;
  masks?: Mask[];
  matte?: Matte;
  /** Use the layer directly below as an alpha matte (without hiding it). */
  clip?: boolean;
  effects?: Effect[];
  precomp?: PrecompRef;
  media?: MediaRef;
  motionBlur?: boolean;
}

export const DEFAULT_EASE: Ease = [0.42, 0, 0.58, 1];

const PALETTE: ColorRGBA[] = [
  [0.49, 0.61, 1, 1], [1, 0.42, 0.42, 1], [0.35, 0.85, 0.6, 1],
  [1, 0.78, 0.3, 1], [0.78, 0.5, 1, 1], [0.3, 0.8, 0.95, 1],
];

export function createLayer(type: Layer['type'], s: ProjectSettings, index: number, name?: string): Layer {
  const full = type === 'solid' || type === 'adjustment' || type === 'precomp';
  const size: Vec2 = full ? [s.width, s.height] : [100, 100];
  const label = { solid: 'Solid', null: 'Null', adjustment: 'Adjustment', precomp: 'Precomp', shape: 'Shape', text: 'Text', image: 'Image', video: 'Video' }[type];
  return {
    id: newId(),
    name: name ?? `${label} ${index + 1}`,
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

/** Property accessors that span transform + extra props. */
export const propOf = (l: Layer, k: PropKey): Prop<any> | undefined =>
  (l.transform as unknown as Record<string, Prop<any> | undefined> | undefined)?.[k] ?? l.props?.[k];
export const withProp = (l: Layer, k: PropKey, p: Prop<any>): Layer =>
  k in l.transform ? { ...l, transform: { ...l.transform, [k]: p } } : { ...l, props: { ...l.props, [k]: p } };
/** All props of a layer (transform first). */
export const allProps = (l: Layer): [PropKey, Prop<any>][] =>
  [...Object.entries(l.transform), ...Object.entries(l.props ?? {})] as [PropKey, Prop<any>][];

const v = <T,>(value: T): Prop<T> => ({ value });
const GRAD_DEFAULT = (): Paint => ({ kind: 'solid', stops: [{ at: 0, c: [1, 1, 1, 1] }, { at: 1, c: [0, 0, 0, 1] }], from: [-100, 0], to: [100, 0] });

export function createShapeLayer(kind: ShapeKind, s: ProjectSettings, index: number, at: Vec2, path?: BezPath): Layer {
  const color = PALETTE[index % PALETTE.length]!;
  const props: Record<string, Prop<any>> = {
    'fill.color': v(color), 'fill.opacity': v(100),
    'stroke.color': v<ColorRGBA>([1, 1, 1, 1]), 'stroke.width': v(6), 'stroke.opacity': v(100),
    'trim.start': v(0), 'trim.end': v(100), 'trim.offset': v(0),
    'rep.copies': v(3), 'rep.position': v<Vec2>([60, 0]), 'rep.rotation': v(0), 'rep.scale': v<Vec2>([100, 100]),
    'rep.opacityStart': v(100), 'rep.opacityEnd': v(100),
  };
  if (kind === 'rect') { props['shape.size'] = v<Vec2>([240, 160]); props['shape.round'] = v(0); }
  if (kind === 'ellipse') props['shape.size'] = v<Vec2>([200, 200]);
  if (kind === 'polygon') { props['shape.points'] = v(5); props['shape.outer'] = v(110); }
  if (kind === 'star') { props['shape.points'] = v(5); props['shape.outer'] = v(120); props['shape.inner'] = v(50); }
  const label = { rect: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star', path: 'Path' }[kind];
  const open = kind === 'path' && path && !path.closed;
  return {
    id: newId(), name: `${label} ${index + 1}`, type: 'shape', in: 0, out: s.duration, visible: true,
    size: [0, 0], color,
    transform: { anchor: v<Vec2>([0, 0]), position: v(at), scale: v<Vec2>([100, 100]), rotation: v(0), opacity: v(100) },
    props,
    shape: {
      kind, path,
      fill: open ? null : { ...GRAD_DEFAULT() },
      stroke: open ? { cap: 'round', join: 'round', dash: 0, gap: 0, paint: GRAD_DEFAULT() } : null,
      trim: false, repeater: false,
    },
  };
}

export function createTextLayer(s: ProjectSettings, index: number, at: Vec2): Layer {
  return {
    id: newId(), name: `Text ${index + 1}`, type: 'text', in: 0, out: s.duration, visible: true,
    size: [0, 0], color: [1, 1, 1, 1],
    transform: { anchor: v<Vec2>([0, 0]), position: v(at), scale: v<Vec2>([100, 100]), rotation: v(0), opacity: v(100) },
    props: { 'fill.color': v<ColorRGBA>([1, 1, 1, 1]), 'text.size': v(96), 'text.tracking': v(0), 'text.leading': v(120) },
    text: { text: 'Text', font: 'Inter, system-ui, sans-serif', align: 'left', bold: false, italic: false },
    shape: { kind: 'path', fill: GRAD_DEFAULT(), stroke: null, trim: false, repeater: false },
  };
}
