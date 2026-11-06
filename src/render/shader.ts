// User shaders (spec §7.12): Shadertoy-style GLSL ES 3.0 fragments as layers or effects.
//   void mainImage(out vec4 fragColor, in vec2 fragCoord)  — fragCoord in comp pixels, origin bottom-left
// Built-ins: iResolution (vec3), iTime (s), iFrame, iChannel0 (layer below for layers / layer input for effects, premultiplied).
// Custom controls: `// @uniform name float|vec2|color|bool min max default…` become animatable props.
import { signal } from '@preact/signals';
import type { Layer, Prop } from '../model/layer';

export interface UniformDecl { name: string; type: 'float' | 'vec2' | 'color' | 'bool'; min: number; max: number; def: number | number[] }

const HEADER_LINES = 11;
export const MAX_UNIFORMS = 16;

export function parseUniforms(code: string): UniformDecl[] {
  const out: UniformDecl[] = [];
  for (const m of code.matchAll(/^\s*\/\/\s*@uniform\s+(\w+)\s+(float|vec2|color|bool)\b([^\n]*)/gm)) {
    const name = m[1]!, type = m[2] as UniformDecl['type'], nums = m[3]!.trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isFinite);
    if (!/^[A-Za-z_]\w*$/.test(name) || name.startsWith('i') && /^i[A-Z]/.test(name) || out.some((u) => u.name === name) || out.length >= MAX_UNIFORMS) continue;
    if (type === 'float') out.push({ name, type, min: nums[0] ?? 0, max: nums[1] ?? 1, def: nums[2] ?? nums[0] ?? 0 });
    else if (type === 'bool') out.push({ name, type, min: 0, max: 1, def: nums[0] ? 1 : 0 });
    else if (type === 'vec2') out.push({ name, type, min: -1e5, max: 1e5, def: [nums[0] ?? 0, nums[1] ?? 0] });
    else out.push({ name, type, min: 0, max: 1, def: [nums[0] ?? 1, nums[1] ?? 1, nums[2] ?? 1, nums[3] ?? 1] });
  }
  return out;
}

const glslType = (t: UniformDecl['type']) => (t === 'color' ? 'vec4' : t === 'bool' ? 'float' : t);

/** Wrap user code into a full fragment shader. */
export function wrapShader(code: string, decls: UniformDecl[]): string {
  return `#version 300 es
precision highp float;
precision highp sampler2D;
uniform vec3 iResolution; uniform float iTime; uniform int iFrame; uniform sampler2D iChannel0;
in vec2 v_uv; out vec4 o;
${decls.map((d) => `uniform ${glslType(d.type)} ${d.name};`).join(' ')}
// ---- user code ----
${code}
// ---- end user code ----
void main(){ vec4 c = vec4(0.0); mainImage(c, v_uv * iResolution.xy); c = clamp(c, 0.0, 1.0); o = vec4(c.rgb * c.a, c.a); }`;
}
/** Number of lines before the user's first line (for error line mapping). */
export const wrapHeaderLines = (decls: UniformDecl[]) => HEADER_LINES + 0 * decls.length - 3;

/** Compiler log → readable list with user-relative line numbers. */
export function formatShaderLog(log: string, wrapped: string): string[] {
  const start = wrapped.split('\n').findIndex((l) => l.startsWith('// ---- user code')) + 1;
  return log.split('\n').filter((l) => /ERROR|WARNING/.test(l)).map((l) => l.replace(/^(ERROR|WARNING): \d+:(\d+):/, (_, k, n) => `${k === 'ERROR' ? 'Error' : 'Warning'} line ${Math.max(1, +n - start)}:`));
}

/** Compile errors by shader source, filled in by the renderer; the editor reads these. */
export const shaderErrors = signal<Record<string, string[]>>({});

export const GALLERY: { name: string; code: string }[] = [
  { name: 'Gradient', code: `// @uniform speed float 0 4 1
// @uniform colorA color 0.1 0.2 0.7 1
// @uniform colorB color 0.95 0.35 0.6 1
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = 0.5 + 0.5 * sin(iTime * speed + uv.x * 3.0 + uv.y * 2.0);
  fragColor = vec4(mix(colorA.rgb, colorB.rgb, t), 1.0);
}` },
  { name: 'Plasma', code: `// @uniform speed float 0 4 1
// @uniform scale float 1 20 6
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y * scale;
  float t = iTime * speed;
  float v = sin(p.x + t) + sin(p.y * 1.3 + t * 0.8) + sin((p.x + p.y) * 0.7 + t * 1.2) + sin(length(p) * 1.5 - t);
  fragColor = vec4(0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + v), 1.0);
}` },
  { name: 'Voronoi cells', code: `// @uniform cells float 2 30 8
// @uniform speed float 0 3 0.5
vec2 h2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.y * cells, i = floor(uv), f = fract(uv);
  float d = 8.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)), r = g + 0.5 + 0.5 * sin(iTime * speed + 6.2831 * h2(i + g)) - f;
    float dd = dot(r, r); if (dd < d) { d = dd; id = i + g; }
  }
  fragColor = vec4(0.5 + 0.5 * cos(6.2831 * h2(id).x + vec3(0.0, 2.0, 4.0)) * (1.0 - 0.5 * sqrt(d)), 1.0);
}` },
  { name: 'Noise clouds', code: `// @uniform speed float 0 2 0.3
// @uniform tint color 0.6 0.75 1 1
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord / iResolution.y * 3.0; float a = 0.5, v = 0.0;
  for (int k = 0; k < 5; k++) { v += a * noise(p + iTime * speed); p *= 2.0; a *= 0.5; }
  fragColor = vec4(tint.rgb * v, v);
}` },
  { name: 'CRT scanlines (effect)', code: `// @uniform strength float 0 1 0.4
// @uniform curve float 0 0.3 0.08
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy, c = uv * 2.0 - 1.0;
  c *= 1.0 + curve * dot(c, c); uv = c * 0.5 + 0.5;
  vec4 s = texture(iChannel0, uv);
  float line = 0.5 + 0.5 * sin(fragCoord.y * 3.14159);
  float vig = smoothstep(1.2, 0.4, length(c));
  fragColor = vec4(s.rgb * (1.0 - strength * (1.0 - line)) * vig, s.a * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0));
}` },
  { name: 'Kaleidoscope (effect)', code: `// @uniform segments float 2 16 6
// @uniform spin float -2 2 0.2
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float a = atan(p.y, p.x) + iTime * spin, r = length(p), k = 6.2831853 / segments;
  a = abs(mod(a, k) - 0.5 * k);
  vec2 q = vec2(cos(a), sin(a)) * r;
  fragColor = texture(iChannel0, q * iResolution.y / iResolution.xy + 0.5);
}` },
  { name: 'RGB glitch (effect)', code: `// @uniform amount float 0 60 12
// @uniform rate float 0 20 6
float hash(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float band = floor(uv.y * 24.0), n = hash(band + floor(iTime * rate));
  float off = (n > 0.8 ? (n - 0.8) * 5.0 : 0.0) * amount / iResolution.x;
  vec4 r = texture(iChannel0, uv + vec2(off, 0.0)), g = texture(iChannel0, uv), b = texture(iChannel0, uv - vec2(off, 0.0));
  fragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}` },
];

/** Props for a shader's declared uniforms (keys prefixed). Existing values are kept; stale ones are dropped. */
export function syncUniformProps(props: Record<string, Prop<any>> | undefined, prefix: string, decls: UniformDecl[]): Record<string, Prop<any>> {
  const next: Record<string, Prop<any>> = {};
  for (const [k, v] of Object.entries(props ?? {})) if (!k.startsWith(prefix)) next[k] = v;
  for (const d of decls) next[prefix + d.name] = props?.[prefix + d.name] ?? { value: d.def };
  return next;
}

export const shaderLayerCode = (l: Layer) => l.shader?.code ?? '';
