// WebGL2 renderer (spec §6). Render graph: per comp, an accumulator render target (RT) that layers are composited
// onto. Plain normal-blend layers draw straight into the accumulator; layers with blend modes, masks, mattes or
// effects are rendered to their own RT first and then combined (blend shader / modulate passes).
// All RTs are premultiplied RGBA8, pooled by size. Precomps recurse into their own accumulator.
import type { ColorRGBA, Comp } from '../model/project';
import { evaluate, type Resolved } from '../eval/evaluate';
import { mul, type Mat } from '../eval/affine';
import { rasterLayer } from './raster';
import { BLEND_GLSL, blendIndex } from './blend';
import { maskCanvas } from './masks';
import { effectsInput } from './effects';
import type { Layer } from '../model/layer';
import { imageFor, videoFor } from './media';

const QVS = `#version 300 es
layout(location=0) in vec2 a;
uniform mat3 u_m; uniform vec2 u_size; uniform vec2 u_res;
out vec2 v_uv; out vec2 v_p;
void main(){
  vec2 p = (u_m * vec3(a * u_size, 1.0)).xy;
  v_uv = vec2(a.x, 1.0 - a.y); v_p = a * u_size;
  gl_Position = vec4(p / u_res * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);
}`;
const COV = `
uniform float u_aa;
float cover(vec2 p, vec2 s){
  if (u_aa <= 0.0) return 1.0;
  float d = min(min(p.x, s.x - p.x), min(p.y, s.y - p.y));
  return clamp(d / u_aa + 0.5, 0.0, 1.0);
}`;
const SOLID_FS = `#version 300 es
precision highp float;
in vec2 v_uv; in vec2 v_p; uniform vec4 u_color; uniform vec2 u_size; out vec4 o;
${COV}
void main(){ o = u_color * cover(v_p, u_size); }`;
const TEX_FS = `#version 300 es
precision highp float;
in vec2 v_uv; in vec2 v_p; uniform sampler2D u_tex; uniform float u_op; uniform vec2 u_size; uniform int u_decode; out vec4 o;
${COV}
vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main(){
  vec4 t = texture(u_tex, v_uv);
  if (u_decode == 1 && t.a > 0.0) t = vec4(toLin(t.rgb / t.a) * t.a, t.a);
  o = t * (u_op * cover(v_p, u_size));
}`;

const FVS = `#version 300 es
layout(location=0) in vec2 a; out vec2 v_uv;
void main(){ v_uv = a; gl_Position = vec4(a * 2.0 - 1.0, 0.0, 1.0); }`;
const COPY_FS = `#version 300 es
precision mediump float;
in vec2 v_uv; uniform sampler2D u_tex; uniform float u_op; uniform int u_encode; out vec4 o;
vec3 toSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec4 t = texture(u_tex, v_uv) * u_op;
  if (u_encode == 1 && t.a > 0.0) t = vec4(toSrgb(clamp(t.rgb / t.a, 0.0, 1.0)) * t.a, t.a);
  o = t;
}`;
const BLUR_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_src; uniform vec2 u_step; uniform float u_sigma; out vec4 o;
void main(){
  vec4 acc = vec4(0.0); float wsum = 0.0;
  for (int i = -12; i <= 12; i++) { float w = exp(-0.5 * float(i * i) / (u_sigma * u_sigma)); acc += texture(u_src, v_uv + u_step * float(i)) * w; wsum += w; }
  o = acc / wsum;
}`;
const GLOW_X_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_src; uniform float u_th; out vec4 o;
void main(){ vec4 s = texture(u_src, v_uv); float l = dot(s.rgb / max(s.a, 1e-4), vec3(0.299, 0.587, 0.114)); o = s * smoothstep(u_th, u_th + 0.25, l); }`;
const GLOW_ADD_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_src; uniform sampler2D u_glow; uniform float u_int; uniform vec4 u_color; out vec4 o;
void main(){ vec4 s = texture(u_src, v_uv), g = texture(u_glow, v_uv);
  float a = min(1.0, s.a + g.a * u_int * u_color.a); o = vec4(min(s.rgb + g.rgb * u_color.rgb * u_int, vec3(a)), a); }`;
const SH_TINT_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_src; uniform vec4 u_color; uniform float u_op; out vec4 o;
void main(){ float a = texture(u_src, v_uv).a * u_op * u_color.a; o = vec4(u_color.rgb * a, a); }`;
const SH_COMP_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_src; uniform sampler2D u_sh; uniform vec2 u_off; out vec4 o;
void main(){ vec4 s = texture(u_src, v_uv); o = s + texture(u_sh, v_uv - u_off) * (1.0 - s.a); }`;
const BLEND_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_src; uniform sampler2D u_dst; uniform int u_mode; uniform float u_op; out vec4 o;
${BLEND_GLSL}
void main(){
  vec4 s = texture(u_src, v_uv) * u_op, d = texture(u_dst, v_uv);
  if (u_mode == 1) { float h = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453); s = h < s.a ? vec4(s.rgb / max(s.a, 1e-5), 1.0) : vec4(0.0); }
  vec3 cs = s.a > 0.0 ? s.rgb / s.a : vec3(0.0), cb = d.a > 0.0 ? d.rgb / d.a : vec3(0.0);
  vec3 b = blendRGB(u_mode, cb, cs);
  float ao = s.a + d.a - s.a * d.a;
  o = vec4((1.0 - s.a) * d.rgb + (1.0 - d.a) * s.rgb + s.a * d.a * b, ao);
}`;
const MOD_FS = `#version 300 es
precision mediump float;
in vec2 v_uv; uniform sampler2D u_src; uniform sampler2D u_mask; uniform int u_kind; out vec4 o;
void main(){
  vec4 s = texture(u_src, v_uv), m = texture(u_mask, v_uv);
  float l = dot(m.rgb, vec3(0.2126, 0.7152, 0.0722));
  float f = u_kind == 0 ? m.a : u_kind == 1 ? 1.0 - m.a : u_kind == 2 ? l : 1.0 - l;
  o = s * f;
}`;
const MIX_FS = `#version 300 es
precision mediump float;
in vec2 v_uv; uniform sampler2D u_a; uniform sampler2D u_b; uniform sampler2D u_cov; uniform float u_op; out vec4 o;
void main(){ float k = texture(u_cov, v_uv).a * u_op; o = texture(u_a, v_uv) * (1.0 - k) + texture(u_b, v_uv) * k; }`;

export const FULLSCREEN_VS = FVS;
export interface FrameInfo { width: number; height: number; bg: ColorRGBA; t?: number; comps?: Record<string, Comp>; fps?: number; linear?: boolean }
export interface RT { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number; f16?: boolean }
export type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
const MAX_DEPTH = 6;

export class GLRenderer {
  gl!: WebGL2RenderingContext;
  private progs!: Record<'solid' | 'tex' | 'copy' | 'blend' | 'mod' | 'mix' | 'blur' | 'glowX' | 'glowAdd' | 'shTint' | 'shComp', Prog>;
  /** Compositing in linear light (RGBA16F targets, sRGB decode/encode at the edges). */
  linear = false;
  private floatOK = false;
  private vao!: WebGLVertexArrayObject;
  private pool = new Map<string, RT[]>();
  private maskTex: WebGLTexture | null = null;
  private rasterTex: WebGLTexture | null = null;
  /** Media textures (images uploaded once, video re-uploaded when its frame changes); LRU under a byte budget. */
  private mediaTex = new Map<string, { tex: WebGLTexture; ver: string; bytes: number }>();
  mediaBudget = 384 * 1024 * 1024;
  lost = false;
  stats = { passes: 0, rts: 0 };

  constructor(private canvas: HTMLCanvasElement, opts: { alpha?: boolean } = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: !!opts.alpha, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.init();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.init(); this.lost = false; this.onRestore?.(); });
  }
  onRestore?: () => void;

  private compile(type: number, src: string) {
    const { gl } = this;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
    return s;
  }
  /** Compile + link a program; `names` are the uniforms to look up. Reused by effects. */
  program(vs: string, fs: string, names: string[]): Prog {
    const { gl } = this;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
    return { p, u: Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)])) };
  }

  private init() {
    const { gl } = this;
    const q = ['u_m', 'u_size', 'u_res', 'u_aa'];
    this.progs = {
      solid: this.program(QVS, SOLID_FS, [...q, 'u_color']),
      tex: this.program(QVS, TEX_FS, [...q, 'u_tex', 'u_op', 'u_decode']),
      copy: this.program(FVS, COPY_FS, ['u_tex', 'u_op', 'u_encode']),
      blend: this.program(FVS, BLEND_FS, ['u_src', 'u_dst', 'u_mode', 'u_op']),
      mod: this.program(FVS, MOD_FS, ['u_src', 'u_mask', 'u_kind']),
      mix: this.program(FVS, MIX_FS, ['u_a', 'u_b', 'u_cov', 'u_op']),
      blur: this.program(FVS, BLUR_FS, ['u_src', 'u_step', 'u_sigma']),
      glowX: this.program(FVS, GLOW_X_FS, ['u_src', 'u_th']),
      glowAdd: this.program(FVS, GLOW_ADD_FS, ['u_src', 'u_glow', 'u_int', 'u_color']),
      shTint: this.program(FVS, SH_TINT_FS, ['u_src', 'u_color', 'u_op']),
      shComp: this.program(FVS, SH_COMP_FS, ['u_src', 'u_sh', 'u_off']),
    };
    this.floatOK = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    this.pool.clear(); this.maskTex = null; this.rasterTex = null; this.mediaTex.clear(); this.stats.rts = 0;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  /** Size the drawing buffer (px). The canvas is CSS-scaled by the viewer. */
  resize(w: number, h: number) {
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  // ---- render targets --------------------------------------------------------------------------------

  getRT(w: number, h: number): RT {
    const { gl } = this;
    const f16 = this.linear && this.floatOK, key = `${w}x${h}${f16 ? 'f' : ''}`, free = this.pool.get(key);
    const hit = free?.pop();
    if (hit) return hit;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (f16) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]] as const) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    this.stats.rts++;
    return { tex, fbo, w, h, f16 };
  }
  release(rt: RT) {
    const key = `${rt.w}x${rt.h}${rt.f16 ? 'f' : ''}`, list = this.pool.get(key) ?? [];
    if (list.length < 6) { list.push(rt); this.pool.set(key, list); }
    else { this.gl.deleteFramebuffer(rt.fbo); this.gl.deleteTexture(rt.tex); this.stats.rts--; }
  }
  bind(rt: RT | null, w = this.canvas.width, h = this.canvas.height) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt ? rt.fbo : null);
    gl.viewport(0, 0, rt ? rt.w : w, rt ? rt.h : h);
  }
  clear(rt: RT, c: ColorRGBA | null) {
    const { gl } = this;
    this.bind(rt);
    c ? gl.clearColor(c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]) : gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  private tex(unit: number, t: WebGLTexture) { const { gl } = this; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }
  private fs(prog: Prog) { const { gl } = this; gl.useProgram(prog.p); gl.bindVertexArray(this.vao); this.stats.passes++; }
  /** Draw the full-screen quad into the bound target (no blending). */
  fullscreen() { const { gl } = this; gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

  /** Upload a canvas as a (cached) texture, flipped so row 0 is the top (matches RT orientation). */
  private upload(slot: 'maskTex' | 'rasterTex', src: TexImageSource): WebGLTexture {
    const { gl } = this;
    let t = this[slot];
    if (!t) {
      t = this[slot] = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]] as const) gl.texParameteri(gl.TEXTURE_2D, k, v);
    }
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return t;
  }

  /** Run a full-screen pass: bind `out`, bind inputs to units 0.., let `set` fill uniforms, draw. */
  runPass(prog: Prog, out: RT, inputs: WebGLTexture[], set: (gl: WebGL2RenderingContext, u: Prog['u']) => void) {
    const { gl } = this;
    this.bind(out); this.fs(prog);
    inputs.forEach((t, i) => this.tex(i, t));
    set(gl, prog.u);
    this.fullscreen();
  }
  /** Copy/scale `src` into `out` (bilinear). */
  blit(src: RT, out: RT) {
    this.runPass(this.progs.copy, out, [src.tex], (gl, u) => { gl.uniform1i(u.u_tex!, 0); gl.uniform1f(u.u_op!, 1); gl.uniform1i(u.u_encode!, 0); });
  }

  /** Separable Gaussian blur (σ in buffer px). Consumes `rt`. Large radii run on a downsampled copy. */
  blur(rt: RT, sigma: number, dir: 'h' | 'v' | 'hv'): RT {
    if (sigma < 0.3) return rt;
    const f = sigma > 96 ? 4 : sigma > 24 ? 2 : 1, sw = Math.max(1, Math.ceil(rt.w / f)), sh = Math.max(1, Math.ceil(rt.h / f)), sg = sigma / f;
    let cur: RT = rt;
    if (f > 1) { cur = this.getRT(sw, sh); this.blit(rt, cur); this.release(rt); }
    const step = Math.max(1, sg / 4), taps = sg / step;
    const pass = (d: 'h' | 'v') => {
      const out = this.getRT(cur.w, cur.h);
      this.runPass(this.progs.blur, out, [cur.tex], (gl, u) => {
        gl.uniform1i(u.u_src!, 0); gl.uniform1f(u.u_sigma!, Math.max(taps, 0.3));
        gl.uniform2f(u.u_step!, d === 'h' ? step / cur.w : 0, d === 'v' ? step / cur.h : 0);
      });
      this.release(cur); cur = out;
    };
    if (dir !== 'v') pass('h');
    if (dir !== 'h') pass('v');
    if (f > 1) { const out = this.getRT(rt.w, rt.h); this.blit(cur, out); this.release(cur); cur = out; }
    return cur;
  }

  glow(rt: RT, threshold: number, sigma: number, intensity: number, color: number[]): RT {
    const ext = this.getRT(rt.w, rt.h);
    this.runPass(this.progs.glowX, ext, [rt.tex], (gl, u) => { gl.uniform1i(u.u_src!, 0); gl.uniform1f(u.u_th!, threshold); });
    const blurred = this.blur(ext, sigma, 'hv'), out = this.getRT(rt.w, rt.h);
    const c = this.linear ? srgb3(color) : color;
    this.runPass(this.progs.glowAdd, out, [rt.tex, blurred.tex], (gl, u) => {
      gl.uniform1i(u.u_src!, 0); gl.uniform1i(u.u_glow!, 1); gl.uniform1f(u.u_int!, intensity); gl.uniform4f(u.u_color!, c[0]!, c[1]!, c[2]!, color[3] ?? 1);
    });
    this.release(rt); this.release(blurred);
    return out;
  }

  dropShadow(rt: RT, color: number[], opacity: number, angle: number, distPx: number, sigma: number): RT {
    const sh = this.getRT(rt.w, rt.h), c = this.linear ? srgb3(color) : color;
    this.runPass(this.progs.shTint, sh, [rt.tex], (gl, u) => { gl.uniform1i(u.u_src!, 0); gl.uniform4f(u.u_color!, c[0]!, c[1]!, c[2]!, color[3] ?? 1); gl.uniform1f(u.u_op!, opacity); });
    const blurred = this.blur(sh, sigma, 'hv'), out = this.getRT(rt.w, rt.h), a = (angle * Math.PI) / 180;
    this.runPass(this.progs.shComp, out, [rt.tex, blurred.tex], (gl, u) => {
      gl.uniform1i(u.u_src!, 0); gl.uniform1i(u.u_sh!, 1); gl.uniform2f(u.u_off!, (Math.cos(a) * distPx) / rt.w, (-Math.sin(a) * distPx) / rt.h);
    });
    this.release(rt); this.release(blurred);
    return out;
  }

  // ---- passes ----------------------------------------------------------------------------------------

  /** Draw a textured quad (layer-space size) with a world matrix into the bound target, premultiplied-over. */
  private quad(prog: Prog, m: Mat, size: [number, number], res: [number, number], aa: number) {
    const { gl } = this;
    gl.useProgram(prog.p); gl.bindVertexArray(this.vao); this.stats.passes++;
    gl.uniformMatrix3fv(prog.u.u_m!, false, [m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1]);
    gl.uniform2f(prog.u.u_size!, size[0], size[1]);
    gl.uniform2f(prog.u.u_res!, res[0], res[1]);
    gl.uniform1f(prog.u.u_aa!, aa);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** dst := dst OVER (src * op) — used for normal-blend compositing of an RT. */
  private overRT(src: WebGLTexture, op: number) {
    const { gl } = this, p = this.progs.copy;
    this.fs(p); this.tex(0, src);
    gl.uniform1i(p.u.u_tex!, 0); gl.uniform1f(p.u.u_op!, op); gl.uniform1i(p.u.u_encode!, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** out = blend(acc, src). Consumes `src`, returns the new accumulator (old one released). */
  private blendOnto(acc: RT, src: RT, mode: string, op: number): RT {
    const { gl } = this;
    if (mode === 'normal') { this.bind(acc); this.overRT(src.tex, op); this.release(src); return acc; }
    const out = this.getRT(acc.w, acc.h), p = this.progs.blend;
    this.bind(out); this.fs(p);
    this.tex(0, src.tex); this.tex(1, acc.tex);
    gl.uniform1i(p.u.u_src!, 0); gl.uniform1i(p.u.u_dst!, 1); gl.uniform1i(p.u.u_mode!, blendIndex(mode as never)); gl.uniform1f(p.u.u_op!, op);
    this.fullscreen();
    this.release(src); this.release(acc);
    return out;
  }

  /** src := src * f(mask). `mask` is a texture; `kind` 0 alpha, 1 inverted alpha, 2 luma, 3 inverted luma. */
  private modulate(src: RT, mask: WebGLTexture, kind: number): RT {
    const { gl } = this, out = this.getRT(src.w, src.h), p = this.progs.mod;
    this.bind(out); this.fs(p);
    this.tex(0, src.tex); this.tex(1, mask);
    gl.uniform1i(p.u.u_src!, 0); gl.uniform1i(p.u.u_mask!, 1); gl.uniform1i(p.u.u_kind!, kind);
    this.fullscreen();
    this.release(src);
    return out;
  }

  private mediaTexture(key: string, src: TexImageSource, ver: string, bytes: number): WebGLTexture {
    const { gl } = this;
    let e = this.mediaTex.get(key);
    if (e) { this.mediaTex.delete(key); this.mediaTex.set(key, e); } // LRU touch
    if (!e) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]] as const) gl.texParameteri(gl.TEXTURE_2D, k, v);
      e = { tex, ver: '', bytes }; this.mediaTex.set(key, e);
    }
    if (e.ver !== ver) {
      gl.bindTexture(gl.TEXTURE_2D, e.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      e.ver = ver;
    }
    let total = 0; for (const v of this.mediaTex.values()) total += v.bytes;
    for (const [k, v] of this.mediaTex) { // evict oldest until under budget (never the one just used)
      if (total <= this.mediaBudget || k === key) break;
      gl.deleteTexture(v.tex); this.mediaTex.delete(k); total -= v.bytes;
    }
    return e.tex;
  }

  // ---- layer rendering ----------------------------------------------------------------------------------

  private worldScale(m: Mat, k: number) { return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) * k || 1; }

  /** Draw a layer's own content (no mask/blend) into the currently bound RT. */
  private drawContent(r: Resolved, op: number, ctx: Ctx, target: RT) {
    const { gl } = this, l = r.layer, res: [number, number] = [ctx.cw, ctx.ch];
    if (l.type === 'solid') {
      const p = this.progs.solid, c = this.linear ? [...srgb3(l.color), l.color[3]] as number[] : l.color, o = op * l.color[3];
      gl.useProgram(p.p);
      gl.uniform4f(p.u.u_color!, c[0]! * o, c[1]! * o, c[2]! * o, o);
      this.quad(p, r.world, l.size, res, 1 / this.worldScale(r.world, ctx.k));
    } else if (l.type === 'shape' || l.type === 'text') {
      const ras = rasterLayer(r, ctx.t, ctx.k, { w: ctx.cw, h: ctx.ch });
      if (!ras) return;
      const p = this.progs.tex;
      this.tex(0, this.upload('rasterTex', ras.canvas));
      gl.useProgram(p.p); gl.uniform1i(p.u.u_tex!, 0); gl.uniform1f(p.u.u_op!, op); gl.uniform1i(p.u.u_decode!, this.linear ? 1 : 0);
      this.quad(p, [ras.w, 0, 0, ras.h, ras.x, ras.y], [1, 1], res, 0);
    } else if ((l.type === 'image' || l.type === 'video') && l.media) {
      let src: TexImageSource | null = null, ver = 'i', w = 0, h = 0;
      if (l.type === 'image') { const bm = imageFor(l.media.asset); if (bm) { src = bm; w = bm.width; h = bm.height; } }
      else { const el = videoFor(l.media.asset); if (el) { src = el; ver = `${el.currentTime}`; w = el.videoWidth; h = el.videoHeight; } }
      if (!src || !w) return;
      const p = this.progs.tex, tex = this.mediaTexture(l.media.asset, src, ver, w * h * 4);
      this.tex(0, tex);
      gl.useProgram(p.p); gl.uniform1i(p.u.u_tex!, 0); gl.uniform1f(p.u.u_op!, op); gl.uniform1i(p.u.u_decode!, this.linear ? 1 : 0);
      this.quad(p, r.world, l.size, res, 1 / this.worldScale(r.world, ctx.k));
    } else if (l.type === 'precomp' && l.precomp) {
      const comp = ctx.comps[l.precomp.comp];
      if (!comp || ctx.depth >= MAX_DEPTH) return;
      const tc = (ctx.t - l.in) * (comp.fps / ctx.fps) + l.precomp.offset;
      const child = this.renderLayers(comp.layers, comp.width, comp.height, { ...ctx, t: tc, cw: comp.width, ch: comp.height, fps: comp.fps, depth: ctx.depth + 1 }, null);
      this.bind(target);
      const p = this.progs.tex;
      this.tex(0, child.tex);
      gl.useProgram(p.p); gl.uniform1i(p.u.u_tex!, 0); gl.uniform1f(p.u.u_op!, op); gl.uniform1i(p.u.u_decode!, 0);
      this.quad(p, r.world, [comp.width, comp.height], res, 1 / this.worldScale(r.world, ctx.k));
      this.release(child);
    }
  }

  /** Content → effects → masks, into a fresh RT (opacity applied). */
  private layerRT(r: Resolved, op: number, ctx: Ctx, w: number, h: number, acc: RT | null): RT {
    const l = r.layer;
    let rt = this.getRT(w, h);
    this.clear(rt, null);
    if (l.type === 'adjustment') {
      // full-frame coverage; the effect result is mixed over the accumulator by the caller
      const p = this.progs.solid;
      this.bind(rt); gl_use(this, p);
      this.gl.uniform4f(p.u.u_color!, 1, 1, 1, 1);
      this.quad(p, [ctx.cw, 0, 0, ctx.ch, 0, 0], [1, 1], [ctx.cw, ctx.ch], 0);
    } else {
      this.bind(rt);
      this.drawContent(r, op, ctx, rt);
    }
    if (l.effects?.length && l.type !== 'adjustment') rt = effectsInput(this, l, rt, ctx);
    if (l.masks?.length) {
      const mc = maskCanvas(r, ctx.t, ctx.k, w, h);
      if (mc) rt = this.modulate(rt, this.upload('maskTex', mc), 0);
    }
    void acc;
    return rt;
  }

  /** Composite a layer list into a new accumulator RT (caller releases). `bg` null = transparent (nested comps). */
  renderLayers(layers: readonly Layer[], cw: number, ch: number, ctx: Ctx, bg: ColorRGBA | null): RT {
    const { gl } = this;
    const w = Math.max(1, Math.round(cw * ctx.k)), h = Math.max(1, Math.round(ch * ctx.k));
    const resolved = evaluate(layers, ctx.t);
    const byId = new Map(resolved.map((r) => [r.layer.id, r]));
    const matteSrc = new Set(layers.map((l) => l.matte?.layer).filter(Boolean) as string[]);
    let acc = this.getRT(w, h);
    this.clear(acc, bg && this.linear ? [...srgb3(bg), bg[3]] as ColorRGBA : bg);
    const c2: Ctx = { ...ctx, cw, ch };
    for (let i = resolved.length - 1; i >= 0; i--) {
      const r = resolved[i]!, l = r.layer;
      if (!r.active || matteSrc.has(l.id)) continue;
      const mode = l.blend ?? 'normal';
      const hasMatte = !!l.matte || !!l.clip;
      if (l.type === 'adjustment') {
        if (r.opacity <= 0) continue;
        let cov = this.layerRT(r, 1, c2, w, h, acc);
        if (hasMatte) cov = this.applyMatte(cov, r, resolved, byId, i, c2, w, h);
        let fx = acc;
        if (l.effects?.length) { fx = effectsInput(this, l, this.copyRT(acc), c2); }
        const out = this.getRT(w, h), p = this.progs.mix;
        this.bind(out); this.fs(p);
        this.tex(0, acc.tex); this.tex(1, fx.tex); this.tex(2, cov.tex);
        gl.uniform1i(p.u.u_a!, 0); gl.uniform1i(p.u.u_b!, 1); gl.uniform1i(p.u.u_cov!, 2); gl.uniform1f(p.u.u_op!, r.opacity);
        this.fullscreen();
        if (fx !== acc) this.release(fx);
        this.release(cov); this.release(acc); acc = out;
        continue;
      }
      if (r.opacity <= 0 || l.type === 'null') continue;
      const direct = mode === 'normal' && !l.masks?.length && !hasMatte && !l.effects?.length;
      if (direct) { this.bind(acc); this.drawContent(r, r.opacity, c2, acc); continue; }
      let rt = this.layerRT(r, 1, c2, w, h, acc);
      if (hasMatte) rt = this.applyMatte(rt, r, resolved, byId, i, c2, w, h);
      acc = this.blendOnto(acc, rt, mode, r.opacity);
    }
    return acc;
  }

  private copyRT(src: RT): RT {
    const out = this.getRT(src.w, src.h);
    this.bind(out); this.overRT(src.tex, 1);
    return out;
  }

  /** Multiply `rt` by its matte (explicit matte layer, or the layer below for "clip"). */
  private applyMatte(rt: RT, r: Resolved, resolved: Resolved[], byId: Map<string, Resolved>, i: number, ctx: Ctx, w: number, h: number): RT {
    const l = r.layer;
    const src = l.matte ? byId.get(l.matte.layer) : resolved[i + 1];
    const mode = l.matte?.mode ?? 'alpha';
    let m: RT;
    if (src && src.active && src.layer.id !== l.id) m = this.layerRT(src, src.opacity, ctx, w, h, null);
    else { m = this.getRT(w, h); this.clear(m, null); }
    const out = this.modulate(rt, m.tex, mode === 'alpha' ? 0 : mode === 'alphaInv' ? 1 : mode === 'luma' ? 2 : 3);
    this.release(m);
    return out;
  }

  /** Render the root comp to the canvas. */
  render(layers: readonly Layer[], f: FrameInfo) {
    if (this.lost) return;
    const { gl } = this;
    this.stats.passes = 0;
    this.linear = !!f.linear;
    const k = this.canvas.width / f.width;
    const ctx: Ctx = { t: f.t ?? 0, k, comps: f.comps ?? {}, cw: f.width, ch: f.height, fps: f.fps ?? 30, depth: 0 };
    const acc = this.renderLayers(layers, f.width, f.height, ctx, f.bg);
    this.bind(null);
    const p = this.progs.copy;
    this.fs(p); this.tex(0, acc.tex);
    gl.uniform1i(p.u.u_tex!, 0); gl.uniform1f(p.u.u_op!, 1); gl.uniform1i(p.u.u_encode!, this.linear ? 1 : 0);
    this.fullscreen();
    this.release(acc);
  }

  /** Read one pixel (comp-buffer coordinates, origin top-left). For tests/debug only. */
  readPixel(x: number, y: number): number[] {
    const { gl } = this;
    const out = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(x, this.canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return Array.from(out);
  }
}

export interface Ctx { t: number; k: number; comps: Record<string, Comp>; cw: number; ch: number; fps: number; depth: number }
const gl_use = (r: GLRenderer, p: Prog) => r.gl.useProgram(p.p);

const srgb3 = (c: readonly number[]): [number, number, number] => [0, 1, 2].map((i) => (c[i]! <= 0.04045 ? c[i]! / 12.92 : ((c[i]! + 0.055) / 1.055) ** 2.4)) as [number, number, number];
