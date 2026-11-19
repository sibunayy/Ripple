
/* ---- Shader layers: WGSL on WebGPU, Shadertoy-style GLSL on WebGL2 ---- */
const SH_H_GLSL = `float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; } return v; }
`;
const SH_H_WGSL = `fn hash(q: vec2f) -> f32 { var p = fract(q * vec2f(123.34, 456.21)); p = p + dot(p, p + 45.32); return fract(p.x * p.y); }
fn vnoise(p: vec2f) -> f32 { let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2f(1.0, 0.0)), u.x), mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), u.x), u.y); }
fn fbm(q: vec2f) -> f32 { var p = q; var v = 0.0; var a = 0.5; for (var i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.02 + vec2f(1.7, 9.2); a *= 0.5; } return v; }
`;
export const SHP = {
  liquid: { name: 'Liquid gradient', ps: ['Scale', 'Warp', 'Shadows', 'Brightness'], def: [.35, .5, .5, .5], c: ['#4f7cff', '#ff5ea8'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.y;
  float t = iTime * 0.15;
  vec2 p = uv * mix(0.5, 4.0, iParams.x);
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 1.3), fbm(p + 4.0 * q + vec2(8.3, 2.8) - t));
  float n = fbm(p + mix(0.0, 6.0, iParams.y) * r);
  vec3 col = mix(iColor1, iColor2, smoothstep(0.2, 0.8, n));
  col = mix(col, vec3(0.02, 0.02, 0.05), clamp(length(q) * iParams.z * 0.8, 0.0, 1.0) * 0.6);
  fragColor = vec4(col * mix(0.6, 1.4, iParams.w), 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = fragCoord / u.res.y;
  let t = u.time * 0.15;
  let p = uv * mix(0.5, 4.0, u.params.x);
  let q = vec2f(fbm(p + t), fbm(p + vec2f(5.2, 1.3) - t));
  let r = vec2f(fbm(p + 4.0 * q + vec2f(1.7, 9.2) + t * 1.3), fbm(p + 4.0 * q + vec2f(8.3, 2.8) - t));
  let n = fbm(p + mix(0.0, 6.0, u.params.y) * r);
  var col = mix(u.color1.rgb, u.color2.rgb, smoothstep(0.2, 0.8, n));
  col = mix(col, vec3f(0.02, 0.02, 0.05), clamp(length(q) * u.params.z * 0.8, 0.0, 1.0) * 0.6);
  return vec4f(col * mix(0.6, 1.4, u.params.w), 1.0);
}` },
  plasma: { name: 'Plasma', ps: ['Scale', 'Complexity', 'Rainbow', 'Brightness'], def: [.4, .4, .25, .5], c: ['#1b1f6b', '#36e0c8'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float sc = mix(2.0, 12.0, iParams.x), t = iTime;
  float v = sin(uv.x * sc + t) + sin((uv.y * sc + t) * 0.5) + sin((uv.x * sc + uv.y * sc + t) * 0.5);
  vec2 c = uv * sc * 0.5 + vec2(sin(t * 0.33), cos(t * 0.5)) * 2.0;
  v += sin(sqrt(dot(c, c) + 1.0) + t);
  v *= mix(0.5, 2.5, iParams.y);
  vec3 col = mix(iColor1, iColor2, 0.5 + 0.5 * sin(v * 3.14159));
  col += iParams.z * 0.5 * (0.5 + 0.5 * cos(v * 6.2831 + vec3(0.0, 2.0, 4.0)));
  fragColor = vec4(col * mix(0.6, 1.4, iParams.w), 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = (fragCoord - 0.5 * u.res) / u.res.y;
  let sc = mix(2.0, 12.0, u.params.x);
  let t = u.time;
  var v = sin(uv.x * sc + t) + sin((uv.y * sc + t) * 0.5) + sin((uv.x * sc + uv.y * sc + t) * 0.5);
  let c = uv * sc * 0.5 + vec2f(sin(t * 0.33), cos(t * 0.5)) * 2.0;
  v = v + sin(sqrt(dot(c, c) + 1.0) + t);
  v = v * mix(0.5, 2.5, u.params.y);
  var col = mix(u.color1.rgb, u.color2.rgb, 0.5 + 0.5 * sin(v * 3.14159));
  col = col + u.params.z * 0.5 * (0.5 + 0.5 * cos(v * 6.2831 + vec3f(0.0, 2.0, 4.0)));
  return vec4f(col * mix(0.6, 1.4, u.params.w), 1.0);
}` },
  aurora: { name: 'Aurora', ps: ['Spread', 'Softness', 'Intensity', 'Stars'], def: [.5, .5, .5, .6], c: ['#35f2a0', '#7a5cff'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime * 0.2;
  vec3 col = vec3(0.01, 0.02, 0.05) * (1.4 - uv.y);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y = 0.5 + 0.12 * fi * iParams.x + 0.3 * (fbm(vec2(uv.x * 2.5 + t + fi * 3.1, t * 0.5 + fi)) - 0.5);
    float d = uv.y - y;
    float band = exp(-d * d * mix(400.0, 40.0, iParams.y)) * (0.6 + 0.4 * fbm(vec2(uv.x * 14.0 + fi, t * 3.0)));
    col += mix(iColor1, iColor2, fi / 2.0) * band * mix(0.4, 1.6, iParams.z);
  }
  col += step(0.997, hash(floor(fragCoord / 2.0))) * iParams.w * (1.0 - uv.y);
  fragColor = vec4(col, 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = fragCoord / u.res;
  let t = u.time * 0.2;
  var col = vec3f(0.01, 0.02, 0.05) * (1.4 - uv.y);
  for (var i = 0; i < 3; i++) {
    let fi = f32(i);
    let y = 0.5 + 0.12 * fi * u.params.x + 0.3 * (fbm(vec2f(uv.x * 2.5 + t + fi * 3.1, t * 0.5 + fi)) - 0.5);
    let d = uv.y - y;
    let band = exp(-d * d * mix(400.0, 40.0, u.params.y)) * (0.6 + 0.4 * fbm(vec2f(uv.x * 14.0 + fi, t * 3.0)));
    col = col + mix(u.color1.rgb, u.color2.rgb, fi / 2.0) * band * mix(0.4, 1.6, u.params.z);
  }
  col = col + step(0.997, hash(floor(fragCoord / 2.0))) * u.params.w * (1.0 - uv.y);
  return vec4f(col, 1.0);
}` },
  tunnel: { name: 'Ring tunnel', ps: ['Ring density', 'Twist', 'Segments', 'Brightness'], def: [.4, .3, .4, .5], c: ['#ff7a3d', '#2a1a6b'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float r = max(length(uv), 0.001), a = atan(uv.y, uv.x);
  float z = 1.0 / r;
  float rings = 0.5 + 0.5 * sin(z * mix(2.0, 10.0, iParams.x) - iTime * 4.0);
  float seg = 0.5 + 0.5 * sin(a * floor(mix(2.0, 12.0, iParams.z)) + z * mix(0.0, 2.0, iParams.y) + iTime);
  vec3 col = mix(iColor2, iColor1, rings * (0.4 + 0.6 * seg));
  col *= clamp(r * 1.8, 0.0, 1.0) * mix(0.6, 1.4, iParams.w);
  fragColor = vec4(col, 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = (fragCoord - 0.5 * u.res) / u.res.y;
  let r = max(length(uv), 0.001);
  let a = atan2(uv.y, uv.x);
  let z = 1.0 / r;
  let rings = 0.5 + 0.5 * sin(z * mix(2.0, 10.0, u.params.x) - u.time * 4.0);
  let seg = 0.5 + 0.5 * sin(a * floor(mix(2.0, 12.0, u.params.z)) + z * mix(0.0, 2.0, u.params.y) + u.time);
  var col = mix(u.color2.rgb, u.color1.rgb, rings * (0.4 + 0.6 * seg));
  col = col * clamp(r * 1.8, 0.0, 1.0) * mix(0.6, 1.4, u.params.w);
  return vec4f(col, 1.0);
}` },
  cells: { name: 'Cells', ps: ['Cell count', 'Motion', 'Borders', 'Brightness'], def: [.3, .4, .6, .5], c: ['#ffd23f', '#3a86ff'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.y * mix(3.0, 14.0, iParams.x);
  vec2 i = floor(uv), f = fract(uv), mid = vec2(0.0);
  float md = 8.0, md2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(hash(i + g), hash(i + g + 17.3));
    o = 0.5 + 0.5 * sin(iTime * mix(0.2, 2.0, iParams.y) + 6.2831 * o);
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < md) { md2 = md; md = d; mid = i + g; } else if (d < md2) { md2 = d; }
  }
  float edge = sqrt(md2) - sqrt(md);
  vec3 col = mix(iColor1, iColor2, hash(mid));
  col *= 1.0 - iParams.z * (1.0 - smoothstep(0.0, 0.08, edge));
  fragColor = vec4(col * mix(0.6, 1.4, iParams.w), 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = fragCoord / u.res.y * mix(3.0, 14.0, u.params.x);
  let i = floor(uv);
  let f = fract(uv);
  var mid = vec2f(0.0);
  var md = 8.0;
  var md2 = 8.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let g = vec2f(f32(x), f32(y));
      var o = vec2f(hash(i + g), hash(i + g + 17.3));
      o = 0.5 + 0.5 * sin(u.time * mix(0.2, 2.0, u.params.y) + 6.2831 * o);
      let r = g + o - f;
      let d = dot(r, r);
      if (d < md) { md2 = md; md = d; mid = i + g; } else if (d < md2) { md2 = d; }
    }
  }
  let edge = sqrt(md2) - sqrt(md);
  var col = mix(u.color1.rgb, u.color2.rgb, hash(mid));
  col = col * (1.0 - u.params.z * (1.0 - smoothstep(0.0, 0.08, edge)));
  return vec4f(col * mix(0.6, 1.4, u.params.w), 1.0);
}` },
  synth: { name: 'Synth grid', ps: ['Horizon', 'Speed', 'Grid glow', 'Sun'], def: [.4, .4, .6, .8], c: ['#ff3fb4', '#5b2bff'],
    glsl: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float hz = mix(-0.2, 0.15, iParams.x);
  float d = max(hz - uv.y, 0.001);
  vec2 g = vec2(uv.x / d, 1.0 / d + iTime * mix(0.5, 4.0, iParams.y)) * 0.5;
  vec2 gl = abs(fract(g) - 0.5) / max(fwidth(g), vec2(0.0001));
  float line = 1.0 - min(min(gl.x, gl.y), 1.0);
  vec3 sky = mix(iColor2 * 0.6, iColor2 * 0.12, smoothstep(hz, 0.5, uv.y));
  vec2 sp = uv - vec2(0.0, hz + 0.2);
  float sun = smoothstep(0.21, 0.2, length(sp)) * iParams.w;
  sun *= max(step(0.0, sp.y), step(0.35, fract(sp.y * 18.0 - iTime * 0.4)));
  sky = mix(sky, mix(iColor1, vec3(1.0, 0.85, 0.3), smoothstep(-0.2, 0.2, sp.y)), sun);
  vec3 ground = vec3(0.01, 0.0, 0.03) + iColor1 * line * mix(0.3, 1.6, iParams.z) * clamp(d * 5.0, 0.0, 1.0);
  fragColor = vec4(uv.y < hz ? ground : sky, 1.0);
}`,
    wgsl: `fn mainImage(fragCoord: vec2f) -> vec4f {
  let uv = (fragCoord - 0.5 * u.res) / u.res.y;
  let hz = mix(-0.2, 0.15, u.params.x);
  let d = max(hz - uv.y, 0.001);
  let g = vec2f(uv.x / d, 1.0 / d + u.time * mix(0.5, 4.0, u.params.y)) * 0.5;
  let gl = abs(fract(g) - 0.5) / max(fwidth(g), vec2f(0.0001));
  let line = 1.0 - min(min(gl.x, gl.y), 1.0);
  var sky = mix(u.color2.rgb * 0.6, u.color2.rgb * 0.12, smoothstep(hz, 0.5, uv.y));
  let sp = uv - vec2f(0.0, hz + 0.2);
  var sun = smoothstep(0.21, 0.2, length(sp)) * u.params.w;
  sun = sun * max(step(0.0, sp.y), step(0.35, fract(sp.y * 18.0 - u.time * 0.4)));
  sky = mix(sky, mix(u.color1.rgb, vec3f(1.0, 0.85, 0.3), smoothstep(-0.2, 0.2, sp.y)), sun);
  let ground = vec3f(0.01, 0.0, 0.03) + u.color1.rgb * line * mix(0.3, 1.6, u.params.z) * clamp(d * 5.0, 0.0, 1.0);
  return vec4f(select(sky, ground, uv.y < hz), 1.0);
}` },
};
export const shLang = (code) => (/@fragment|\bfn\s+\w+\s*\(|vec[234]f\b|\bu\.res\b/.test(code) && !/void\s+mainImage/.test(code) ? 'wgsl' : 'glsl');
export const SH_GLSL_PRE = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution; uniform float iTime; uniform float iTimeDelta; uniform float iFrameRate; uniform int iFrame; uniform vec4 iMouse; uniform vec4 iDate; uniform float iSampleRate;
uniform vec4 iParams; uniform vec3 iColor1; uniform vec3 iColor2; uniform float iOpaque;
uniform sampler2D iChannel0; uniform sampler2D iChannel1; uniform sampler2D iChannel2; uniform sampler2D iChannel3; uniform vec3 iChannelResolution[4]; uniform float iChannelTime[4];
out vec4 shOut_;
`;
export const SH_GLSL_POST = `
void main() { vec4 c = vec4(0.0, 0.0, 0.0, 1.0); mainImage(c, gl_FragCoord.xy); shOut_ = vec4(clamp(c.rgb, 0.0, 1.0), iOpaque > 0.5 ? 1.0 : clamp(c.a, 0.0, 1.0)); }`;
export const SH_WGSL_PRE = `struct U { res: vec2f, time: f32, frame: f32, params: vec4f, color1: vec4f, color2: vec4f, mouse: vec4f, opaque: f32, delta: f32, pad0: f32, pad1: f32 };
@group(0) @binding(0) var<uniform> u: U;
`;
export const SH_WGSL_POST = `
@vertex fn shVs_(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[vi], 0.0, 1.0);
}
@fragment fn shFs_(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let c = clamp(mainImage(vec2f(pos.x, u.res.y - pos.y)), vec4f(0.0), vec4f(1.0));
  let a = select(c.a, 1.0, u.opaque > 0.5);
  return vec4f(c.rgb * a, a);
}`;
export const shPresetCode = (key, lang) => { const P = SHP[key] || SHP.liquid; return (lang === 'wgsl' ? SH_H_WGSL : SH_H_GLSL) + '\n' + P[lang]; };
export const SH = {};
