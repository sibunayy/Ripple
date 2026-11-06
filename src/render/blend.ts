// Blend modes (spec §7.2): ids, labels, GLSL and a CPU reference used by the golden tests.
export type BlendMode =
  | 'normal' | 'dissolve' | 'darken' | 'multiply' | 'colorBurn' | 'linearBurn' | 'darkerColor'
  | 'lighten' | 'screen' | 'colorDodge' | 'add' | 'lighterColor'
  | 'overlay' | 'softLight' | 'hardLight' | 'vividLight' | 'linearLight' | 'pinLight' | 'hardMix'
  | 'difference' | 'exclusion' | 'subtract' | 'divide' | 'hue' | 'saturation' | 'color' | 'luminosity';

export const BLEND_MODES: { id: BlendMode; label: string }[] = [
  { id: 'normal', label: 'Normal' }, { id: 'dissolve', label: 'Dissolve' },
  { id: 'darken', label: 'Darken' }, { id: 'multiply', label: 'Multiply' }, { id: 'colorBurn', label: 'Colour Burn' }, { id: 'linearBurn', label: 'Linear Burn' }, { id: 'darkerColor', label: 'Darker Colour' },
  { id: 'lighten', label: 'Lighten' }, { id: 'screen', label: 'Screen' }, { id: 'colorDodge', label: 'Colour Dodge' }, { id: 'add', label: 'Linear Dodge (Add)' }, { id: 'lighterColor', label: 'Lighter Colour' },
  { id: 'overlay', label: 'Overlay' }, { id: 'softLight', label: 'Soft Light' }, { id: 'hardLight', label: 'Hard Light' }, { id: 'vividLight', label: 'Vivid Light' }, { id: 'linearLight', label: 'Linear Light' }, { id: 'pinLight', label: 'Pin Light' }, { id: 'hardMix', label: 'Hard Mix' },
  { id: 'difference', label: 'Difference' }, { id: 'exclusion', label: 'Exclusion' }, { id: 'subtract', label: 'Subtract' }, { id: 'divide', label: 'Divide' },
  { id: 'hue', label: 'Hue' }, { id: 'saturation', label: 'Saturation' }, { id: 'color', label: 'Colour' }, { id: 'luminosity', label: 'Luminosity' },
];
export const blendIndex = (m: BlendMode) => BLEND_MODES.findIndex((b) => b.id === m);

type V3 = [number, number, number];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lum = (c: V3) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
function clipColor(c: V3): V3 {
  const l = lum(c), n = Math.min(...c), x = Math.max(...c);
  let o: V3 = [...c] as V3;
  if (n < 0) o = o.map((v) => l + ((v - l) * l) / (l - n)) as V3;
  if (x > 1) o = o.map((v) => l + ((v - l) * (1 - l)) / (x - l)) as V3;
  return o;
}
const setLum = (c: V3, l: number): V3 => { const d = l - lum(c); return clipColor([c[0] + d, c[1] + d, c[2] + d]); };
const sat = (c: V3) => Math.max(...c) - Math.min(...c);
function setSat(c: V3, s: number): V3 {
  const idx = [0, 1, 2].sort((a, b) => c[a]! - c[b]!);
  const [i0, i1, i2] = idx as [number, number, number];
  const o: V3 = [0, 0, 0];
  if (c[i2]! > c[i0]!) { o[i1] = ((c[i1]! - c[i0]!) * s) / (c[i2]! - c[i0]!); o[i2] = s; }
  return o;
}

const burn = (b: number, s: number) => (s === 0 ? (b === 1 ? 1 : 0) : 1 - Math.min(1, (1 - b) / s));
const dodge = (b: number, s: number) => (s === 1 ? 1 : Math.min(1, b / (1 - s)));
const hard = (b: number, s: number) => (s <= 0.5 ? b * 2 * s : 1 - (1 - b) * (1 - (2 * s - 1)));
const soft = (b: number, s: number) => {
  if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
  const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
  return b + (2 * s - 1) * (d - b);
};
const vivid = (b: number, s: number) => (s < 0.5 ? burn(b, 2 * s) : dodge(b, 2 * (s - 0.5)));

/** CPU reference: blend source colour cs over backdrop colour cb (straight, non-premultiplied, 0–1). */
export function blendRGB(mode: BlendMode, cb: V3, cs: V3): V3 {
  const f = (fn: (b: number, s: number) => number): V3 => [fn(cb[0], cs[0]), fn(cb[1], cs[1]), fn(cb[2], cs[2])].map(clamp01) as V3;
  switch (mode) {
    case 'normal': case 'dissolve': return cs;
    case 'darken': return f(Math.min);
    case 'multiply': return f((b, s) => b * s);
    case 'colorBurn': return f(burn);
    case 'linearBurn': return f((b, s) => b + s - 1);
    case 'darkerColor': return lum(cs) < lum(cb) ? cs : cb;
    case 'lighten': return f(Math.max);
    case 'screen': return f((b, s) => b + s - b * s);
    case 'colorDodge': return f(dodge);
    case 'add': return f((b, s) => b + s);
    case 'lighterColor': return lum(cs) > lum(cb) ? cs : cb;
    case 'overlay': return f((b, s) => hard(s, b));
    case 'softLight': return f(soft);
    case 'hardLight': return f(hard);
    case 'vividLight': return f(vivid);
    case 'linearLight': return f((b, s) => b + 2 * s - 1);
    case 'pinLight': return f((b, s) => (s < 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1)));
    case 'hardMix': return f((b, s) => (b + s >= 1 ? 1 : 0));
    case 'difference': return f((b, s) => Math.abs(b - s));
    case 'exclusion': return f((b, s) => b + s - 2 * b * s);
    case 'subtract': return f((b, s) => b - s);
    case 'divide': return f((b, s) => (s === 0 ? 1 : b / s));
    case 'hue': return setLum(setSat(cs, sat(cb)), lum(cb));
    case 'saturation': return setLum(setSat(cb, sat(cs)), lum(cb));
    case 'color': return setLum(cs, lum(cb));
    case 'luminosity': return setLum(cb, lum(cs));
  }
}

/** Full W3C compositing of a premultiplied source (with opacity already applied) over a premultiplied backdrop. */
export function compositePx(mode: BlendMode, src: [number, number, number, number], dst: [number, number, number, number]): [number, number, number, number] {
  const [sa, da] = [src[3], dst[3]];
  const cs: V3 = sa > 0 ? [src[0] / sa, src[1] / sa, src[2] / sa] : [0, 0, 0];
  const cb: V3 = da > 0 ? [dst[0] / da, dst[1] / da, dst[2] / da] : [0, 0, 0];
  const b = blendRGB(mode, cb, cs);
  const ao = sa + da - sa * da;
  return [0, 1, 2].map((i) => (1 - sa) * dst[i]! + (1 - da) * src[i]! + sa * da * b[i]!).concat(ao) as [number, number, number, number];
}

export const BLEND_GLSL = `
float lum(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipC(vec3 c){ float l = lum(c), n = min(c.r, min(c.g, c.b)), x = max(c.r, max(c.g, c.b));
  if (n < 0.0) c = l + (c - l) * l / (l - n);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / (x - l);
  return c; }
vec3 setLum(vec3 c, float l){ return clipC(c + (l - lum(c))); }
float satOf(vec3 c){ return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); }
vec3 setSat(vec3 c, float s){
  float mn = min(c.r, min(c.g, c.b)), mx = max(c.r, max(c.g, c.b));
  if (mx <= mn) return vec3(0.0);
  return (c - mn) * s / (mx - mn); }
float burn1(float b, float s){ return s == 0.0 ? (b == 1.0 ? 1.0 : 0.0) : 1.0 - min(1.0, (1.0 - b) / s); }
float dodge1(float b, float s){ return s == 1.0 ? 1.0 : min(1.0, b / (1.0 - s)); }
float hard1(float b, float s){ return s <= 0.5 ? b * 2.0 * s : 1.0 - (1.0 - b) * (1.0 - (2.0 * s - 1.0)); }
float soft1(float b, float s){
  if (s <= 0.5) return b - (1.0 - 2.0 * s) * b * (1.0 - b);
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return b + (2.0 * s - 1.0) * (d - b); }
float vivid1(float b, float s){ return s < 0.5 ? burn1(b, 2.0 * s) : dodge1(b, 2.0 * (s - 0.5)); }
float chan(int m, float b, float s){
  if (m == 2) return min(b, s);
  if (m == 3) return b * s;
  if (m == 4) return burn1(b, s);
  if (m == 5) return b + s - 1.0;
  if (m == 7) return max(b, s);
  if (m == 8) return b + s - b * s;
  if (m == 9) return dodge1(b, s);
  if (m == 10) return b + s;
  if (m == 12) return hard1(s, b);
  if (m == 13) return soft1(b, s);
  if (m == 14) return hard1(b, s);
  if (m == 15) return vivid1(b, s);
  if (m == 16) return b + 2.0 * s - 1.0;
  if (m == 17) return s < 0.5 ? min(b, 2.0 * s) : max(b, 2.0 * s - 1.0);
  if (m == 18) return b + s >= 1.0 ? 1.0 : 0.0;
  if (m == 19) return abs(b - s);
  if (m == 20) return b + s - 2.0 * b * s;
  if (m == 21) return b - s;
  if (m == 22) return s == 0.0 ? 1.0 : b / s;
  return s; }
vec3 blendRGB(int m, vec3 cb, vec3 cs){
  if (m <= 1) return cs;
  if (m == 6) return lum(cs) < lum(cb) ? cs : cb;
  if (m == 11) return lum(cs) > lum(cb) ? cs : cb;
  if (m == 23) return setLum(setSat(cs, satOf(cb)), lum(cb));
  if (m == 24) return setLum(setSat(cb, satOf(cs)), lum(cb));
  if (m == 25) return setLum(cs, lum(cb));
  if (m == 26) return setLum(cb, lum(cs));
  return clamp(vec3(chan(m, cb.r, cs.r), chan(m, cb.g, cs.g), chan(m, cb.b, cs.b)), 0.0, 1.0); }
`;
