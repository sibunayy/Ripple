// WebGL2 renderer (spec §6). M1: solid layers with 2D transform + opacity, normal blend, one pass per layer
// drawn straight into the default framebuffer (no intermediate render targets yet).
import type { ColorRGBA } from '../model/project';
import type { Resolved } from '../eval/evaluate';
import { rasterLayer, type Raster } from './raster';

const VS = `#version 300 es
layout(location=0) in vec2 a;
uniform mat3 u_m; uniform vec2 u_size; uniform vec2 u_res;
void main(){
  vec2 p = (u_m * vec3(a * u_size, 1.0)).xy;
  gl_Position = vec4(p / u_res * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);
}`;
const FS = `#version 300 es
precision mediump float;
uniform vec4 u_color; out vec4 o;
void main(){ o = u_color; }`;

const TVS = `#version 300 es
layout(location=0) in vec2 a; out vec2 uv;
uniform vec4 u_rect; uniform vec2 u_res;
void main(){
  uv = a;
  vec2 p = u_rect.xy + a * u_rect.zw;
  gl_Position = vec4(p / u_res * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);
}`;
const TFS = `#version 300 es
precision mediump float;
in vec2 uv; uniform sampler2D u_tex; uniform float u_op; out vec4 o;
void main(){ o = texture(u_tex, uv) * u_op; }`;

export interface FrameInfo { width: number; height: number; bg: ColorRGBA; t?: number }

export class GLRenderer {
  private gl!: WebGL2RenderingContext;
  private prog!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private tprog!: WebGLProgram;
  private tloc!: Record<'rect' | 'res' | 'tex' | 'op', WebGLUniformLocation | null>;
  private tex: WebGLTexture | null = null;
  private loc!: Record<'m' | 'size' | 'res' | 'color', WebGLUniformLocation | null>;
  lost = false;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
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

  private init() {
    const { gl } = this;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
    this.prog = p;
    this.loc = {
      m: gl.getUniformLocation(p, 'u_m'), size: gl.getUniformLocation(p, 'u_size'),
      res: gl.getUniformLocation(p, 'u_res'), color: gl.getUniformLocation(p, 'u_color'),
    };
    const tp = gl.createProgram()!;
    gl.attachShader(tp, this.compile(gl.VERTEX_SHADER, TVS));
    gl.attachShader(tp, this.compile(gl.FRAGMENT_SHADER, TFS));
    gl.linkProgram(tp);
    if (!gl.getProgramParameter(tp, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(tp) ?? 'link error');
    this.tprog = tp;
    this.tloc = { rect: gl.getUniformLocation(tp, 'u_rect'), res: gl.getUniformLocation(tp, 'u_res'), tex: gl.getUniformLocation(tp, 'u_tex'), op: gl.getUniformLocation(tp, 'u_op') };
    this.tex = null;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  /** Draw a rasterised layer (premultiplied canvas) as a textured quad at comp-space rect. */
  private drawRaster(r: Raster, opacity: number, f: FrameInfo) {
    const { gl, tloc } = this;
    gl.useProgram(this.tprog);
    gl.bindVertexArray(this.vao);
    if (!this.tex) {
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, r.canvas);
    gl.uniform1i(tloc.tex, 0);
    gl.uniform2f(tloc.res, f.width, f.height);
    gl.uniform4f(tloc.rect, r.x, r.y, r.w, r.h);
    gl.uniform1f(tloc.op, opacity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.useProgram(this.prog);
  }

  /** Size the drawing buffer (px). The canvas is CSS-scaled by the viewer. */
  resize(w: number, h: number) {
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  /** `resolved` is top-first (as evaluate() returns); draws bottom-to-top. */
  render(resolved: readonly Resolved[], f: FrameInfo) {
    if (this.lost) return;
    const { gl, loc } = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(f.bg[0] * f.bg[3], f.bg[1] * f.bg[3], f.bg[2] * f.bg[3], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied "normal"
    gl.uniform2f(loc.res, f.width, f.height);
    for (let i = resolved.length - 1; i >= 0; i--) {
      const r = resolved[i]!;
      if (!r.active || r.opacity <= 0) continue;
      if (r.layer.type === 'shape' || r.layer.type === 'text') {
        const ras = rasterLayer(r, f.t ?? 0, this.canvas.width / f.width, { w: f.width, h: f.height });
        if (ras) this.drawRaster(ras, r.opacity, f);
        continue;
      }
      if (r.layer.type !== 'solid') continue;
      const m = r.world, c = r.layer.color, o = r.opacity * c[3];
      gl.uniformMatrix3fv(loc.m, false, [m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1]);
      gl.uniform2f(loc.size, r.layer.size[0], r.layer.size[1]);
      gl.uniform4f(loc.color, c[0] * o, c[1] * o, c[2] * o, o);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  /** Read one pixel (comp-buffer coordinates, origin top-left). For tests/debug only. */
  readPixel(x: number, y: number): number[] {
    const { gl } = this;
    const out = new Uint8Array(4);
    gl.readPixels(x, this.canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return Array.from(out);
  }
}
