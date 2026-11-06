// Effect framework (spec §7.3, §7.9). Per-pixel colour effects fuse into ONE generated shader per run of
// consecutive effects ("uber-shader", cached by signature); neighbourhood/distort effects are single passes;
// blur/glow/drop-shadow are multi-pass. All parameters are animatable props `fx:<id>:<key>`.
import { evalProp } from '../anim/interp';
import type { Effect, Layer, Prop, Vec2 } from '../model/layer';
import type { ColorRGBA } from '../model/project';
import type { Ctx, GLRenderer, RT } from './gl';
import { FULLSCREEN_VS } from './gl';

export type ParamKind = 'number' | 'color' | 'vec2' | 'select';
export interface ParamDef { key: string; label: string; kind: ParamKind; def: number | ColorRGBA | Vec2; min?: number; max?: number; step?: number; options?: string[]; center?: boolean }
export interface EffectDef {
  type: string; name: string; category: 'Colour' | 'Blur' | 'Stylise' | 'Distort' | 'Generate';
  params: ParamDef[];
  /** 'pixel' fuses; 'spatial' = single generated pass sampling S(uv); 'custom' = multi-pass in `run`. */
  mode: 'pixel' | 'spatial' | 'custom';
  glsl?: string;
  /** Pixel effect that expects display-referred (sRGB) values even when compositing in linear light. */
  perceptual?: boolean;
  lut?: boolean;
  run?: (r: GLRenderer, rt: RT, v: Values, ctx: Ctx, e: Effect) => RT;
}
export type Values = Record<string, number | number[]>;

const N = (key: string, label: string, def: number, min: number, max: number, step = 1): ParamDef => ({ key, label, kind: 'number', def, min, max, step });
const C = (key: string, label: string, def: ColorRGBA): ParamDef => ({ key, label, kind: 'color', def });
const V = (key: string, label: string, def: Vec2 = [0, 0], center = true): ParamDef => ({ key, label, kind: 'vec2', def, center });

export const COLOR_GLSL = `
uniform vec2 u_res; uniform float u_time; uniform int u_linear;
vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
vec3 rgb2hsl(vec3 c){ float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), l = (mx + mn) * 0.5, d = mx - mn, h = 0.0, s = 0.0;
  if (d > 1e-5) { s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
    h = mx == c.r ? (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0) : mx == c.g ? (c.b - c.r) / d + 2.0 : (c.r - c.g) / d + 4.0; h /= 6.0; }
  return vec3(h, s, l); }
float hue2(float p, float q, float t){ t = fract(t); if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t; if (t < 0.5) return q; if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0; return p; }
vec3 hsl2rgb(vec3 c){ if (c.y < 1e-5) return vec3(c.z); float q = c.z < 0.5 ? c.z * (1.0 + c.y) : c.z + c.y - c.z * c.y, p = 2.0 * c.z - q;
  return vec3(hue2(p, q, c.x + 1.0 / 3.0), hue2(p, q, c.x), hue2(p, q, c.x - 1.0 / 3.0)); }
vec2 P(vec2 pos){ return vec2(pos.x / u_res.x, 1.0 - pos.y / u_res.y); }
vec2 D(float deg, float dist){ float a = radians(deg); return vec2(cos(a), -sin(a)) * dist / u_res; }
`;

export const EFFECTS: EffectDef[] = [
  // ---- colour (per-pixel, fusable) ----
  { type: 'brightnessContrast', name: 'Brightness & Contrast', category: 'Colour', mode: 'pixel', perceptual: true, params: [N('brightness', 'Brightness', 0, -100, 100), N('contrast', 'Contrast', 0, -100, 100)],
    glsl: 'c.rgb = (c.rgb - 0.5) * (1.0 + $contrast / 100.0) + 0.5 + $brightness / 100.0; return c;' },
  { type: 'exposure', name: 'Exposure', category: 'Colour', mode: 'pixel', params: [N('exposure', 'Exposure', 0, -5, 5, 0.05), N('offset', 'Offset', 0, -1, 1, 0.01), N('gamma', 'Gamma', 1, 0.1, 4, 0.01)],
    glsl: 'c.rgb = pow(max(c.rgb * exp2($exposure) + $offset, 0.0), vec3(1.0 / $gamma)); return c;' },
  { type: 'hueSaturation', name: 'Hue / Saturation', category: 'Colour', mode: 'pixel', perceptual: true, params: [N('hue', 'Hue', 0, -180, 180), N('saturation', 'Saturation', 0, -100, 100), N('lightness', 'Lightness', 0, -100, 100)],
    glsl: 'vec3 h = rgb2hsl(clamp(c.rgb, 0.0, 1.0)); h.x = fract(h.x + $hue / 360.0); h.y = clamp(h.y * (1.0 + $saturation / 100.0), 0.0, 1.0); h.z = clamp(h.z + $lightness / 200.0, 0.0, 1.0); c.rgb = hsl2rgb(h); return c;' },
  { type: 'levels', name: 'Levels', category: 'Colour', mode: 'pixel', perceptual: true, params: [N('inBlack', 'Input black', 0, 0, 100), N('inWhite', 'Input white', 100, 0, 100), N('gamma', 'Gamma', 1, 0.1, 4, 0.01), N('outBlack', 'Output black', 0, 0, 100), N('outWhite', 'Output white', 100, 0, 100)],
    glsl: 'c.rgb = clamp((c.rgb - $inBlack / 100.0) / max($inWhite / 100.0 - $inBlack / 100.0, 1e-4), 0.0, 1.0); c.rgb = pow(c.rgb, vec3(1.0 / $gamma)); c.rgb = mix(vec3($outBlack / 100.0), vec3($outWhite / 100.0), c.rgb); return c;' },
  { type: 'curves', name: 'Curves', category: 'Colour', mode: 'pixel', perceptual: true, lut: true, params: [],
    glsl: 'c.rgb = vec3(texture($lut, vec2(clamp(c.r, 0.0, 1.0), 0.5)).r, texture($lut, vec2(clamp(c.g, 0.0, 1.0), 0.5)).g, texture($lut, vec2(clamp(c.b, 0.0, 1.0), 0.5)).b); return c;' },
  { type: 'tint', name: 'Tint', category: 'Colour', mode: 'pixel', perceptual: true, params: [C('black', 'Map black to', [0, 0, 0, 1]), C('white', 'Map white to', [1, 1, 1, 1]), N('amount', 'Amount', 100, 0, 100)],
    glsl: 'c.rgb = mix(c.rgb, mix($black.rgb, $white.rgb, luma(c.rgb)), $amount / 100.0); return c;' },
  { type: 'gradientMap', name: 'Tritone', category: 'Colour', mode: 'pixel', perceptual: true, params: [C('shadow', 'Shadows', [0.05, 0.05, 0.3, 1]), C('mid', 'Midtones', [0.8, 0.3, 0.5, 1]), C('high', 'Highlights', [1, 0.95, 0.6, 1]), N('amount', 'Amount', 100, 0, 100)],
    glsl: 'float l = luma(c.rgb); vec3 m = l < 0.5 ? mix($shadow.rgb, $mid.rgb, l * 2.0) : mix($mid.rgb, $high.rgb, (l - 0.5) * 2.0); c.rgb = mix(c.rgb, m, $amount / 100.0); return c;' },
  { type: 'invert', name: 'Invert', category: 'Colour', mode: 'pixel', perceptual: true, params: [N('amount', 'Amount', 100, 0, 100)], glsl: 'c.rgb = mix(c.rgb, 1.0 - c.rgb, $amount / 100.0); return c;' },
  { type: 'threshold', name: 'Threshold', category: 'Colour', mode: 'pixel', perceptual: true, params: [N('level', 'Level', 50, 0, 100)], glsl: 'c.rgb = vec3(step($level / 100.0, luma(c.rgb))); return c;' },
  { type: 'posterize', name: 'Posterize', category: 'Colour', mode: 'pixel', perceptual: true, params: [N('levels', 'Levels', 4, 2, 32)], glsl: 'c.rgb = floor(c.rgb * $levels + 0.5) / $levels; return c;' },
  { type: 'vibrance', name: 'Vibrance', category: 'Colour', mode: 'pixel', perceptual: true, params: [N('amount', 'Vibrance', 40, -100, 100)],
    glsl: 'float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); c.rgb = mix(vec3(luma(c.rgb)), c.rgb, 1.0 + $amount / 100.0 * (1.0 - sat)); return c;' },
  { type: 'temperature', name: 'Temperature & Tint', category: 'Colour', mode: 'pixel', perceptual: true, params: [N('temp', 'Temperature', 0, -100, 100), N('tint', 'Tint', 0, -100, 100)],
    glsl: 'c.rgb += vec3($temp / 300.0, -$tint / 400.0, -$temp / 300.0); return c;' },
  { type: 'fill', name: 'Fill', category: 'Colour', mode: 'pixel', params: [C('color', 'Colour', [1, 0.3, 0.3, 1]), N('amount', 'Amount', 100, 0, 100)], glsl: 'c.rgb = mix(c.rgb, $color.rgb, $amount / 100.0); return c;' },
  // ---- stylise ----
  { type: 'noise', name: 'Noise / Grain', category: 'Stylise', mode: 'pixel', params: [N('amount', 'Amount', 20, 0, 100), N('size', 'Grain size', 1, 1, 100, 0.5), N('seed', 'Seed / evolution', 0, 0, 1000)],
    glsl: 'vec2 q = floor(uv * u_res / max($size, 1.0)); c.rgb += (hash12(q + $seed * 17.0) - 0.5) * $amount / 100.0; return c;' },
  { type: 'vignette', name: 'Vignette', category: 'Stylise', mode: 'pixel', params: [N('amount', 'Amount', 60, 0, 100), N('size', 'Size', 55, 0, 100), N('softness', 'Softness', 50, 1, 100)],
    glsl: 'float d = distance(uv, vec2(0.5)) * 1.4142; c.rgb *= 1.0 - smoothstep($size / 100.0, $size / 100.0 + $softness / 100.0, d) * $amount / 100.0; return c;' },
  { type: 'scanlines', name: 'Scanlines', category: 'Stylise', mode: 'pixel', params: [N('spacing', 'Spacing', 6, 2, 60), N('strength', 'Strength', 30, 0, 100)],
    glsl: 'float s = 0.5 + 0.5 * sin(uv.y * u_res.y * 6.2831853 / $spacing); c.rgb *= 1.0 - (1.0 - s) * $strength / 100.0; return c;' },
  { type: 'ramp', name: 'Gradient Ramp', category: 'Generate', mode: 'pixel', params: [V('from', 'Start', [0, 0], false), V('to', 'End', [0, 540], false), C('a', 'Start colour', [0.1, 0.1, 0.4, 1]), C('b', 'End colour', [0.9, 0.3, 0.5, 1]), N('amount', 'Amount', 100, 0, 100)],
    glsl: 'vec2 q = vec2(uv.x * u_res.x, (1.0 - uv.y) * u_res.y), d = $to - $from; float t = clamp(dot(q - $from, d) / max(dot(d, d), 1e-4), 0.0, 1.0); vec4 g = mix($a, $b, t); float k = $amount / 100.0 * g.a; c.rgb = mix(c.rgb, g.rgb, k); c.a = mix(c.a, 1.0, k); return c;' },
  // ---- distort / blur (single generated pass; S(uv) samples premultiplied input) ----
  { type: 'pixelate', name: 'Pixelate', category: 'Stylise', mode: 'spatial', params: [N('size', 'Block size', 12, 1, 200)], glsl: 'vec2 g = vec2($size) / u_res; return S((floor(uv / g) + 0.5) * g);' },
  { type: 'chromatic', name: 'Chromatic Aberration', category: 'Stylise', mode: 'spatial', params: [N('amount', 'Amount', 8, 0, 100, 0.5), N('angle', 'Angle', 0, -180, 180)],
    glsl: 'vec2 o = D($angle, $amount); vec4 r = S(uv + o), g = S(uv), b = S(uv - o); return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));' },
  { type: 'directionalBlur', name: 'Directional Blur', category: 'Blur', mode: 'spatial', params: [N('angle', 'Angle', 0, -180, 180), N('length', 'Length', 40, 0, 500)],
    glsl: 'vec4 acc = vec4(0.0); for (int i = 0; i < 25; i++) acc += S(uv + D($angle, $length) * (float(i) / 24.0 - 0.5)); return acc / 25.0;' },
  { type: 'radialBlur', name: 'Radial (Zoom) Blur', category: 'Blur', mode: 'spatial', params: [V('center', 'Centre'), N('amount', 'Amount', 20, 0, 100)],
    glsl: 'vec2 c0 = P($center); vec4 acc = vec4(0.0); for (int i = 0; i < 24; i++) acc += S(c0 + (uv - c0) * (1.0 - $amount / 100.0 * float(i) / 23.0)); return acc / 24.0;' },
  { type: 'waveWarp', name: 'Wave Warp', category: 'Distort', mode: 'spatial', params: [N('amplitude', 'Amplitude', 20, 0, 300), N('wavelength', 'Wavelength', 120, 4, 1500), N('phase', 'Phase', 0, -720, 720), N('angle', 'Direction', 0, -180, 180)],
    glsl: 'float a = radians($angle); vec2 q = uv * u_res; float w = sin(dot(q, vec2(cos(a), -sin(a))) * 6.2831853 / $wavelength + radians($phase)); vec2 off = vec2(-sin(a), -cos(a)) * w * $amplitude; return S(uv + off / u_res);' },
  { type: 'ripple', name: 'Ripple', category: 'Distort', mode: 'spatial', params: [V('center', 'Centre'), N('radius', 'Radius', 500, 1, 3000), N('amplitude', 'Amplitude', 14, 0, 100), N('wavelength', 'Wavelength', 70, 4, 600), N('phase', 'Phase', 0, -720, 720)],
    glsl: 'vec2 c0 = P($center), d = (uv - c0) * u_res; float r = length(d); float f = smoothstep($radius, 0.0, r); float w = sin(r * 6.2831853 / $wavelength - radians($phase)) * $amplitude * f; vec2 dir = r > 0.0 ? d / r : vec2(0.0); return S(uv + dir * w / u_res);' },
  { type: 'twirl', name: 'Twirl', category: 'Distort', mode: 'spatial', params: [V('center', 'Centre'), N('radius', 'Radius', 400, 1, 3000), N('angle', 'Angle', 120, -720, 720)],
    glsl: 'vec2 c0 = P($center), d = (uv - c0) * u_res; float r = length(d); float a = radians($angle) * smoothstep($radius, 0.0, r); d = vec2(cos(a) * d.x - sin(a) * d.y, sin(a) * d.x + cos(a) * d.y); return S(c0 + d / u_res);' },
  { type: 'bulge', name: 'Bulge / Pinch', category: 'Distort', mode: 'spatial', params: [V('center', 'Centre'), N('radius', 'Radius', 400, 1, 3000), N('amount', 'Amount', 60, -100, 100)],
    glsl: 'vec2 c0 = P($center), d = (uv - c0) * u_res; float r = length(d) / $radius; if (r < 1.0) d *= 1.0 - $amount / 100.0 * (1.0 - r * r); return S(c0 + d / u_res);' },
  { type: 'turbulent', name: 'Turbulent Displace', category: 'Distort', mode: 'spatial', params: [N('amount', 'Amount', 30, 0, 300), N('size', 'Size', 120, 4, 1000), N('evolution', 'Evolution', 0, 0, 1000, 0.5)],
    glsl: 'vec2 q = uv * u_res / $size + $evolution * 0.05; vec2 off = (vec2(vnoise(q), vnoise(q + 17.3)) - 0.5) * 2.0 * $amount; return S(uv + vec2(off.x, -off.y) / u_res);' },
  // ---- multi-pass ----
  { type: 'gaussianBlur', name: 'Gaussian Blur', category: 'Blur', mode: 'custom', params: [N('radius', 'Blurriness', 20, 0, 250, 0.5), { key: 'dir', label: 'Direction', kind: 'select', def: 0, options: ['Both', 'Horizontal', 'Vertical'] }],
    run: (r, rt, v, ctx) => r.blur(rt, (v.radius as number) * ctx.k * 0.5, v.dir === 1 ? 'h' : v.dir === 2 ? 'v' : 'hv') },
  { type: 'glow', name: 'Glow', category: 'Stylise', mode: 'custom', params: [N('threshold', 'Threshold', 55, 0, 100), N('radius', 'Radius', 30, 0, 250, 0.5), N('intensity', 'Intensity', 100, 0, 400), C('color', 'Tint', [1, 1, 1, 1])],
    run: (r, rt, v, ctx) => r.glow(rt, v.threshold as number / 100, (v.radius as number) * ctx.k * 0.5, v.intensity as number / 100, v.color as number[]) },
  { type: 'dropShadow', name: 'Drop Shadow', category: 'Stylise', mode: 'custom', params: [C('color', 'Colour', [0, 0, 0, 1]), N('opacity', 'Opacity', 70, 0, 100), N('angle', 'Direction', 90, -180, 180), N('distance', 'Distance', 24, 0, 400), N('softness', 'Softness', 20, 0, 200, 0.5)],
    run: (r, rt, v, ctx) => r.dropShadow(rt, v.color as number[], (v.opacity as number) / 100, v.angle as number, (v.distance as number) * ctx.k, (v.softness as number) * ctx.k * 0.5) },
];
export const EFFECT_BY_TYPE = new Map(EFFECTS.map((e) => [e.type, e]));

export const paramKey = (id: string, key: string) => `fx:${id}:${key}`;

/** Build a new effect plus its animatable props for a layer (comp size is used to centre position params). */
export function createEffect(type: string, comp: { width: number; height: number }, id: string): { effect: Effect; props: Record<string, Prop<any>> } | null {
  const def = EFFECT_BY_TYPE.get(type); if (!def) return null;
  const props: Record<string, Prop<any>> = {};
  for (const p of def.params) {
    let v: unknown = p.def;
    if (p.kind === 'vec2' && p.center) v = [comp.width / 2, comp.height / 2];
    props[paramKey(id, p.key)] = { value: v };
  }
  const effect: Effect = { id, type, enabled: true };
  if (type === 'curves') effect.data = defaultCurves();
  return { effect, props };
}

// ---- curves ---------------------------------------------------------------------------------------------

export interface Curves { master: Vec2[]; r: Vec2[]; g: Vec2[]; b: Vec2[] }
export const defaultCurves = (): Curves => ({ master: [[0, 0], [1, 1]], r: [[0, 0], [1, 1]], g: [[0, 0], [1, 1]], b: [[0, 0], [1, 1]] });

/** Monotone cubic (Fritsch–Carlson) through the points, sampled to n entries in 0–1. */
export function curveLUT(points: Vec2[], n = 256): Float32Array {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const out = new Float32Array(n);
  if (pts.length < 2) { for (let i = 0; i < n; i++) out[i] = i / (n - 1); return out; }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), m = pts.length - 1;
  const d = Array.from({ length: m }, (_, i) => (ys[i + 1]! - ys[i]!) / Math.max(1e-6, xs[i + 1]! - xs[i]!));
  const t = new Array<number>(pts.length);
  t[0] = d[0]!; t[m] = d[m - 1]!;
  for (let i = 1; i < m; i++) t[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
  for (let i = 0; i < m; i++) {
    if (d[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i]! / d[i]!, b = t[i + 1]! / d[i]!, s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * d[i]!; t[i + 1] = k * b * d[i]!; }
  }
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    let k = 0; while (k < m - 1 && x > xs[k + 1]!) k++;
    if (x <= xs[0]!) { out[i] = ys[0]!; continue; }
    if (x >= xs[m]!) { out[i] = ys[m]!; continue; }
    const h = xs[k + 1]! - xs[k]!, u = (x - xs[k]!) / h, u2 = u * u, u3 = u2 * u;
    out[i] = Math.min(1, Math.max(0, (2 * u3 - 3 * u2 + 1) * ys[k]! + (u3 - 2 * u2 + u) * h * t[k]! + (-2 * u3 + 3 * u2) * ys[k + 1]! + (u3 - u2) * h * t[k + 1]!));
  }
  return out;
}
/** 256×1 RGBA8 table: per-channel curve applied after the master curve. */
export function curvesTable(c: Curves): Uint8Array {
  const m = curveLUT(c.master), r = curveLUT(c.r), g = curveLUT(c.g), b = curveLUT(c.b), out = new Uint8Array(256 * 4);
  const at = (l: Float32Array, v: number) => l[Math.round(Math.min(1, Math.max(0, v)) * 255)]!;
  for (let i = 0; i < 256; i++) { out[i * 4] = Math.round(at(r, m[i]!) * 255); out[i * 4 + 1] = Math.round(at(g, m[i]!) * 255); out[i * 4 + 2] = Math.round(at(b, m[i]!) * 255); out[i * 4 + 3] = 255; }
  return out;
}

// ---- generated shaders ----------------------------------------------------------------------------------

const subst = (code: string, i: number) => code.replace(/\$(\w+)/g, (_, k) => `u${i}_${k}`);
const uniformDecl = (def: EffectDef, i: number) => [
  ...def.params.map((p) => `uniform ${p.kind === 'color' ? 'vec4' : p.kind === 'vec2' ? 'vec2' : p.kind === 'select' ? 'int' : 'float'} u${i}_${p.key};`),
  ...(def.lut ? [`uniform sampler2D u${i}_lut;`] : []),
].join('\n');

interface Built { prog: ReturnType<GLRenderer['program']>; defs: EffectDef[] }
const shaderCache = new WeakMap<GLRenderer, Map<string, Built>>();

function build(r: GLRenderer, defs: EffectDef[]): Built {
  const sig = defs.map((d) => d.type).join('+');
  let m = shaderCache.get(r); if (!m) shaderCache.set(r, (m = new Map()));
  const hit = m.get(sig); if (hit) return hit;
  const head = `#version 300 es\nprecision highp float;\nin vec2 v_uv; uniform sampler2D u_src; out vec4 o;\n${COLOR_GLSL}\nvec4 S(vec2 uv){ return texture(u_src, uv); }\n`;
  let body = '', main: string;
  const names = ['u_src', 'u_res', 'u_time', 'u_linear'];
  defs.forEach((d, i) => {
    body += uniformDecl(d, i) + '\n';
    for (const p of d.params) names.push(`u${i}_${p.key}`);
    if (d.lut) names.push(`u${i}_lut`);
    if (d.mode === 'pixel') {
      body += `vec4 fx${i}(vec4 c, vec2 uv){ ${subst(d.glsl!.replace(/\$lut/g, `$lut`), i)} }\n`;
      body += d.perceptual ? `vec4 w${i}(vec4 c, vec2 uv){ if (u_linear == 1) { vec4 q = fx${i}(vec4(toSrgb(c.rgb), c.a), uv); return vec4(toLin(max(q.rgb, 0.0)), q.a); } return fx${i}(c, uv); }\n` : `vec4 w${i}(vec4 c, vec2 uv){ return fx${i}(c, uv); }\n`;
    } else body += `vec4 fx${i}(vec2 uv){ ${subst(d.glsl!, i)} }\n`;
  });
  if (defs[0]!.mode === 'pixel') {
    main = `void main(){ vec4 s = texture(u_src, v_uv); vec4 c = vec4(s.a > 0.0 ? s.rgb / s.a : vec3(0.0), s.a);\n` +
      defs.map((_, i) => `c = w${i}(c, v_uv);`).join('\n') + `\n c.rgb = clamp(c.rgb, 0.0, 1.0); o = vec4(c.rgb * c.a, c.a); }`;
  } else main = `void main(){ o = fx0(v_uv); }`;
  const built = { prog: r.program(FULLSCREEN_VS, head + body + main, names), defs };
  m.set(sig, built);
  return built;
}

const lutTex = new WeakMap<GLRenderer, Map<string, WebGLTexture>>();
function curveTexture(r: GLRenderer, e: Effect): WebGLTexture {
  const gl = r.gl, c = (e.data as Curves) ?? defaultCurves();
  let m = lutTex.get(r); if (!m) lutTex.set(r, (m = new Map()));
  let t = m.get(e.id);
  if (!t) { t = gl.createTexture()!; m.set(e.id, t); }
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, curvesTable(c));
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]] as const) gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t;
}

const valuesOf = (l: Layer, e: Effect, def: EffectDef, t: number): Values => {
  const v: Values = {};
  for (const p of def.params) {
    const pr = l.props?.[paramKey(e.id, p.key)] as Prop<any> | undefined;
    v[p.key] = pr ? evalProp(pr, t) : (p.def as number);
  }
  return v;
};

function setUniforms(r: GLRenderer, built: Built, vals: Values[], effects: Effect[], ctx: Ctx, rt: RT) {
  const gl = r.gl, u = built.prog.u;
  gl.uniform1i(u.u_src!, 0);
  gl.uniform2f(u.u_res!, ctx.cw, ctx.ch); gl.uniform1f(u.u_time!, ctx.t / ctx.fps); gl.uniform1i(u.u_linear!, r.linear ? 1 : 0);
  let unit = 1;
  built.defs.forEach((d, i) => {
    for (const p of d.params) {
      const loc = u[`u${i}_${p.key}`]!, v = vals[i]![p.key]!;
      if (p.kind === 'number') gl.uniform1f(loc, v as number);
      else if (p.kind === 'select') gl.uniform1i(loc, v as number);
      else if (p.kind === 'vec2') gl.uniform2f(loc, (v as number[])[0]!, (v as number[])[1]!);
      else { let c = v as number[]; if (r.linear) c = [...srgbToLin(c.slice(0, 3)), c[3]!]; gl.uniform4f(loc, c[0]!, c[1]!, c[2]!, c[3]!); }
    }
    if (d.lut) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, curveTexture(r, effects[i]!)); gl.uniform1i(u[`u${i}_lut`]!, unit++); }
  });
  void rt;
}
const srgbToLin = (c: number[]) => c.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));

/** Run a layer's effect stack over `rt` (consumed); returns the resulting RT. */
export function effectsInput(r: GLRenderer, l: Layer, rt: RT, ctx: Ctx): RT {
  const fx = (l.effects ?? []).filter((e) => e.enabled && EFFECT_BY_TYPE.has(e.type));
  let cur = rt;
  for (let i = 0; i < fx.length;) {
    const def = EFFECT_BY_TYPE.get(fx[i]!.type)!;
    if (def.mode === 'pixel') { // fuse the whole run of consecutive pixel effects
      let j = i; while (j < fx.length && EFFECT_BY_TYPE.get(fx[j]!.type)!.mode === 'pixel') j++;
      const run = fx.slice(i, j), defs = run.map((e) => EFFECT_BY_TYPE.get(e.type)!);
      const built = build(r, defs), vals = run.map((e, k) => valuesOf(l, e, defs[k]!, ctx.t));
      const out = r.getRT(cur.w, cur.h);
      r.runPass(built.prog, out, [cur.tex], () => setUniforms(r, built, vals, run, ctx, cur));
      r.release(cur); cur = out; i = j;
    } else if (def.mode === 'spatial') {
      const built = build(r, [def]), vals = [valuesOf(l, fx[i]!, def, ctx.t)];
      const out = r.getRT(cur.w, cur.h);
      r.runPass(built.prog, out, [cur.tex], () => setUniforms(r, built, vals, [fx[i]!], ctx, cur));
      r.release(cur); cur = out; i++;
    } else { cur = def.run!(r, cur, valuesOf(l, fx[i]!, def, ctx.t), ctx, fx[i]!); i++; }
  }
  return cur;
}
