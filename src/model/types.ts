// The RippleFlow document model (HANDOFF section 7). These types describe the data the prototype
// already saves in localStorage under rfp-project; they add no fields and change no values.

/** An easing name ('linear', 'out', 'back', …) or a cubic bezier [x1, y1, x2, y2]. */
export type Ease = string | number[];

/** One keyframe: frame number, value and the easing into the next key. */
export interface Key { t: number; v: number; e?: Ease }

/** A property is static ({ v }) or animated ({ keys }). */
export interface Prop { v?: number; keys?: Key[] }

/** The keyframable transform properties every layer has. */
export type PropName = 'x' | 'y' | 'scale' | 'rot' | 'op' | 'ax' | 'ay' | 'ts' | 'te';

export type LayerType =
  | 'text' | 'rect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'ring' | 'path'
  | 'solid' | 'null' | 'adjust' | 'shader' | 'comp' | 'image' | 'audio' | 'draw';

/** One effect in a layer's stack. Settings are named per effect (radius, amount, …). */
export interface Effect { id: string; name: string; on: boolean; mix?: number; [setting: string]: any }

/** Duplicator settings. */
export interface Repeater { on: boolean; mode?: string; n?: number; [setting: string]: any }

/** A behaviour (wiggle, jitter, oscillate, bounce, pulse, orbit, drift, spin). */
export interface Modifier { kind: string; tgt: string; amp: number; freq: number; on?: boolean; [setting: string]: any }

/** A text animator (fade, typewriter, rise, wave, tracking). */
export interface TextAnim { type: string; start: number; stagger?: number; dur?: number; [setting: string]: any }

/** A brush stroke on a drawing cel. Each point is [x, y, pressure, altitude]. */
export interface Stroke { k?: string; pts?: number[][]; c?: string; pre?: string; [setting: string]: any }

/** One drawing on a frame-by-frame layer, shown from frame f until the next cel. */
export interface Cel { id: string; f: number; strokes: Stroke[]; [setting: string]: any }

/** A path point (pen tool). */
export interface PathPoint { x: number; y: number; [handle: string]: any }

export interface Layer {
  id: string;
  name: string;
  type: LayerType | string;
  hue: string;
  hue2?: string;
  vis: boolean;
  lock: boolean;
  fx: Effect[];
  fxOff?: boolean;
  /** Transform properties by name (x, y, scale, rot, op, ax, ay, ts, te). */
  p: Record<string, Prop>;
  // Timing and links
  inP?: number; outP?: number; parent?: string | null; pt?: number; matte?: string | null; blend?: string;
  flipX?: boolean; flipY?: boolean;
  // Procedural
  rep?: Repeater; mods?: Modifier[]; anims?: TextAnim[];
  // Text
  text?: string; size?: number; weight?: number; font?: string; track?: number; lead?: number; wsp?: number;
  fop?: number; tsw?: number; tsc?: string; align?: string; tcase?: string; italic?: boolean; under?: boolean; strike?: boolean;
  // Shapes and paths
  w?: number; h?: number; r?: number; cr?: number; n?: number; ir?: number;
  sw?: number; sc?: string; sop?: number; dash?: number; dgap?: number; doff?: number; cap?: string; join?: string;
  fill?: boolean; grad?: boolean; gtype?: string; gang?: number; grad_r?: number;
  pts?: PathPoint[]; closed?: boolean; smooth?: boolean;
  // Drawing
  cels?: Cel[];
  // Shader
  preset?: string; code?: string; lang?: string; sp0?: number; sp1?: number; sp2?: number; sp3?: number; spd?: number; opaque?: boolean;
  // Media (image and audio)
  src?: string; adur?: number; wave?: number[]; vol?: number; mute?: boolean;
  // Comp / group
  comp?: boolean; kids?: string[];
}

export interface Marker { f: number; name: string }

/** What rfp-project holds. */
export interface Project { layers: Layer[]; markers: Marker[]; dur: number; name: string; bg: string | null }
