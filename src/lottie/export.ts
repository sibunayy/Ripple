// Lottie export (spec §7.15), "lottie-web" profile. Pure (no DOM): image bytes come from a callback.
// Supported: solids, nulls, shape layers (paths, rect, ellipse, star/polygon, fill, stroke, gradients, trim, repeater),
// parenting, precomps, transform/opacity/parameter keyframes with bézier easing (hold keys; elastic/bounce are baked),
// masks (all modes), alpha/luma mattes, blend modes, basic text, embedded images, markers. Everything else is reported.
import { applyEaseFn } from '../anim/easings';
import { evalProp } from '../anim/interp';
import { evalPath } from '../shape/path';
import { shapePath } from '../shape/geometry';
import { BM_TO_LOTTIE, LOTTIE_VERSION, MASK_TO_LOTTIE, MATTE_TO_TT, type LottieReport } from './common';
import { maskProp } from '../render/masks';
import { paramKey } from '../render/effects';
import type { BezPath, Ease, Keyframe, Layer, Paint, Prop, Vec2 } from '../model/layer';
import type { Comp, Project } from '../model/project';

type J = Record<string, any>;
export interface LottieOut { json: J; report: LottieReport[] }
export interface ExportOpts { assetData?: (hash: string) => Promise<{ mime: string; bytes: Uint8Array } | null> }

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const num = (v: number | number[]): number | number[] => (Array.isArray(v) ? v.map(r4) : r4(v));
const LIN_O = 1 / 3, LIN_I = 2 / 3;

class Ctx {
  report: LottieReport[] = [];
  seen = new Set<string>();
  warn(key: string, msg: string) { if (!this.seen.has(key)) { this.seen.add(key); this.report.push({ level: 'warn', msg }); } }
  images = new Map<string, J>();
}

/** Keyframes → Lottie keyframe list. Function eases are baked into linear samples. */
function keyframes(keys: Keyframe<any>[], conv: (v: any) => number[], multi: boolean): J[] {
  const out: J[] = [];
  const hand = (x1: number, y1: number, x2: number, y2: number) => (multi ? { o: { x: r4(x1), y: r4(y1) }, i: { x: r4(x2), y: r4(y2) } } : { o: { x: [r4(x1)], y: [r4(y1)] }, i: { x: [r4(x2)], y: [r4(y2)] } });
  for (let j = 0; j < keys.length; j++) {
    const k = keys[j]!, next = keys[j + 1];
    if (!next) { out.push({ t: k.t, s: conv(k.v) }); break; }
    const e = k.ease as Ease;
    if (typeof e === 'object' && !Array.isArray(e)) { // elastic / bounce: sample every ~frame between the keys
      const n = Math.max(2, Math.min(60, Math.round(next.t - k.t)));
      for (let s = 0; s < n; s++) {
        const u = s / n, f = applyEaseFn(e, u);
        const v = Array.isArray(k.v) ? k.v.map((a: number, d: number) => a + (next.v[d] - a) * f) : k.v + (next.v - k.v) * f;
        out.push({ t: r4(k.t + u * (next.t - k.t)), s: conv(v), ...hand(LIN_O, LIN_O, LIN_I, LIN_I) });
      }
    } else if (e === 'hold') out.push({ t: k.t, s: conv(k.v), h: 1 });
    else if (e === 'linear') out.push({ t: k.t, s: conv(k.v), ...hand(LIN_O, LIN_O, LIN_I, LIN_I) });
    else out.push({ t: k.t, s: conv(k.v), ...hand(e[0], e[1], e[2], e[3]) });
  }
  return out;
}

/** Prop → Lottie property object. `conv` maps our value to the Lottie array/number (e.g. add a 3rd dimension). */
function lprop(p: Prop<any> | undefined, def: number | number[], conv: (v: any) => number | number[] = (v) => v): J {
  if (!p) return { a: 0, k: num(def) };
  if ('keys' in p && p.keys.length > 1) {
    const multi = Array.isArray(conv(p.keys[0]!.v));
    return { a: 1, k: keyframes(p.keys, (v) => [].concat(conv(v) as never).map(r4) as number[], multi) };
  }
  const v = 'keys' in p ? p.keys[0]!.v : p.value;
  return { a: 0, k: num(conv(v)) };
}
const v3 = (z: number) => (v: Vec2) => [v[0], v[1], z];

function pathJson(p: BezPath) {
  const f = (n: Vec2) => [r4(n[0]), r4(n[1])];
  return { i: p.nodes.map((n) => f(n.i)), o: p.nodes.map((n) => f(n.o)), v: p.nodes.map((n) => f(n.p)), c: p.closed };
}
function pathProp(p: BezPath): J {
  if (p.keys && p.keys.length > 1) {
    return { a: 1, k: p.keys.map((k, j) => (j === p.keys!.length - 1
      ? { t: k.t, s: [pathJson({ nodes: k.nodes, closed: p.closed })] }
      : { t: k.t, s: [pathJson({ nodes: k.nodes, closed: p.closed })], o: { x: [LIN_O], y: [LIN_O] }, i: { x: [LIN_I], y: [LIN_I] } })) };
  }
  return { a: 0, k: pathJson(p.keys?.length ? evalPath(p, p.keys[0]!.t) : p) };
}

const col = (c: number[]) => [r4(c[0]!), r4(c[1]!), r4(c[2]!)];
function gradient(paint: Paint, kind: 'gf' | 'gs', base: J): J {
  const flat = paint.stops.flatMap((s) => [r4(s.at), r4(s.c[0]), r4(s.c[1]), r4(s.c[2])]);
  return { ...base, ty: kind, s: { a: 0, k: paint.from.map(r4) }, e: { a: 0, k: paint.to.map(r4) }, t: paint.kind === 'radial' ? 2 : 1, g: { p: paint.stops.length, k: { a: 0, k: flat } } };
}

function transform(l: Layer, ctx: Ctx): J {
  const t = l.transform;
  return {
    o: lprop(t.opacity as Prop<any>, 100), r: lprop(t.rotation as Prop<any>, 0),
    p: lprop(t.position as Prop<any>, [0, 0, 0], v3(0)), a: lprop(t.anchor as Prop<any>, [0, 0, 0], v3(0)), s: lprop(t.scale as Prop<any>, [100, 100, 100], v3(100)),
  };
}

function shapeItems(l: Layer, ctx: Ctx): J[] {
  const s = l.shape!, items: J[] = [];
  const P = (k: string) => l.props?.[k] as Prop<any> | undefined;
  switch (s.kind) {
    case 'rect': items.push({ ty: 'rc', nm: 'Rect', d: 1, p: { a: 0, k: [0, 0] }, s: lprop(P('shape.size'), [240, 160]), r: lprop(P('shape.round'), 0) }); break;
    case 'ellipse': items.push({ ty: 'el', nm: 'Ellipse', d: 1, p: { a: 0, k: [0, 0] }, s: lprop(P('shape.size'), [200, 200]) }); break;
    case 'polygon': items.push({ ty: 'sr', nm: 'Polygon', sy: 2, d: 1, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 }, pt: lprop(P('shape.points'), 5), or: lprop(P('shape.outer'), 100), os: { a: 0, k: 0 } }); break;
    case 'star': items.push({ ty: 'sr', nm: 'Star', sy: 1, d: 1, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 }, pt: lprop(P('shape.points'), 5), or: lprop(P('shape.outer'), 120), os: { a: 0, k: 0 }, ir: lprop(P('shape.inner'), 50), is: { a: 0, k: 0 } }); break;
    default: { const p = s.path ?? shapePath(l, 0); if (p) items.push({ ty: 'sh', nm: 'Path', ks: pathProp(p), d: 1 }); }
  }
  if (s.stroke) {
    const st = s.stroke, base: J = { nm: 'Stroke', o: lprop(P('stroke.opacity'), 100), w: lprop(P('stroke.width'), 6), lc: { butt: 1, round: 2, square: 3 }[st.cap], lj: { miter: 1, round: 2, bevel: 3 }[st.join], ml: 4 };
    if (st.dash > 0) base.d = [{ n: 'd', nm: 'dash', v: { a: 0, k: st.dash } }, { n: 'g', nm: 'gap', v: { a: 0, k: st.gap || st.dash } }];
    items.push(st.paint.kind === 'solid' ? { ...base, ty: 'st', c: lprop(P('stroke.color'), [1, 1, 1], (v: number[]) => col(v)) } : gradient(st.paint, 'gs', base));
  }
  if (s.fill) {
    const base: J = { nm: 'Fill', o: lprop(P('fill.opacity'), 100), r: 1 };
    items.push(s.fill.kind === 'solid' ? { ...base, ty: 'fl', c: lprop(P('fill.color'), [1, 1, 1], (v: number[]) => col(v)) } : gradient(s.fill, 'gf', base));
  }
  if (s.trim) items.push({ ty: 'tm', nm: 'Trim', s: lprop(P('trim.start'), 0), e: lprop(P('trim.end'), 100), o: lprop(P('trim.offset'), 0), m: 1 });
  if (s.repeater) items.push({ ty: 'rp', nm: 'Repeater', c: lprop(P('rep.copies'), 3), o: { a: 0, k: 0 }, m: 1,
    tr: { ty: 'tr', p: lprop(P('rep.position'), [60, 0]), a: { a: 0, k: [0, 0] }, s: lprop(P('rep.scale'), [100, 100]), r: lprop(P('rep.rotation'), 0), so: lprop(P('rep.opacityStart'), 100), eo: lprop(P('rep.opacityEnd'), 100) } });
  return items;
}

function convertLayer(l: Layer, ind: number, comp: Comp | Project, ctx: Ctx, extra: { td?: boolean; tt?: number; parent?: number } = {}): J | null {
  const base: J = { ddd: 0, ind, nm: l.name, sr: 1, ks: transform(l, ctx), ao: 0, ip: l.in, op: l.out, st: 0, bm: 0 };
  if (extra.parent) base.parent = extra.parent;
  if (extra.td) base.td = 1;
  if (extra.tt) base.tt = extra.tt;
  if (l.blend && l.blend !== 'normal') { const b = BM_TO_LOTTIE[l.blend]; if (b === undefined) ctx.warn(`bm:${l.blend}`, `Blend mode “${l.blend}” has no Lottie equivalent; “${l.name}” exports as Normal.`); else base.bm = b; }
  if (l.masks?.length) {
    base.hasMask = true;
    base.masksProperties = l.masks.map((m) => {
      if ((l.props?.[maskProp(m.id, 'feather')] as Prop<number> | undefined) && evalProp(l.props![maskProp(m.id, 'feather')] as Prop<number>, 0) > 0) ctx.warn('feather', 'Mask feather is not supported by Lottie and was dropped.');
      return { inv: m.invert, mode: MASK_TO_LOTTIE[m.mode], nm: m.name, pt: pathProp(m.path), o: lprop(l.props?.[maskProp(m.id, 'opacity')] as Prop<any>, 100), x: lprop(l.props?.[maskProp(m.id, 'expansion')] as Prop<any>, 0) };
    });
  }
  if (l.effects?.length) ctx.warn('effects', 'Effects (blur, glow, colour…) are not exported — Lottie has no portable equivalent.');
  if (l.motionBlur) ctx.warn('mb', 'Layer motion blur is not exported.');
  switch (l.type) {
    case 'solid': return { ...base, ty: 1, sc: '#' + l.color.slice(0, 3).map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join(''), sw: l.size[0], sh: l.size[1] };
    case 'null': return { ...base, ty: 3 };
    case 'shape': return { ...base, ty: 4, shapes: [{ ty: 'gr', nm: l.name, it: [...shapeItems(l, ctx), { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }] }] };
    case 'text': {
      const x = l.text!, size = evalProp((l.props?.['text.size'] ?? { value: 96 }) as Prop<number>, 0), fill = evalProp((l.props?.['fill.color'] ?? { value: [1, 1, 1, 1] }) as Prop<number[]>, 0);
      if (x.animators?.length) ctx.warn('textanim', 'Text animators are not exported; the text exports static.');
      const fam = x.font.split(',')[0]!.replace(/["']/g, '').trim();
      return { ...base, ty: 5, t: { d: { k: [{ s: { s: r4(size), f: fam.replace(/\s+/g, ''), t: x.text.replace(/\n/g, '\r'), j: { left: 0, right: 1, center: 2 }[x.align], tr: 0, lh: r4((size * evalProp((l.props?.['text.leading'] ?? { value: 120 }) as Prop<number>, 0)) / 100), ls: 0, fc: col(fill) }, t: 0 }] }, p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } }, a: [] } };
    }
    case 'image': { const id = `img_${l.media!.asset.slice(0, 12)}`; return { ...base, ty: 2, refId: id }; }
    case 'precomp': { if (!l.precomp) return null; return { ...base, ty: 0, refId: l.precomp.comp, w: l.size[0], h: l.size[1], st: l.in - l.precomp.offset }; }
    case 'adjustment': ctx.warn('adj', `Adjustment layer “${l.name}” was skipped (effects are not exported).`); return null;
    case 'video': ctx.warn('video', `Video layer “${l.name}” was skipped — Lottie cannot embed video.`); return null;
    case 'shader': ctx.warn('shader', `Shader layer “${l.name}” was skipped — custom shaders have no Lottie equivalent.`); return null;
  }
}

/** Convert a layer list (top first). Matte sources are emitted directly above their consumer, as Lottie requires. */
function convertList(layers: readonly Layer[], comp: Comp | Project, ctx: Ctx): J[] {
  const sources = new Set(layers.map((l) => l.matte?.layer).filter(Boolean) as string[]);
  const byId = new Map(layers.map((l) => [l.id, l]));
  const out: J[] = [];
  const idxOf = new Map<string, number>();
  let ind = 1;
  const emit = (l: Layer, extra: { td?: boolean; tt?: number } = {}, primary = true) => {
    const j = convertLayer(l, ind, comp, ctx, extra);
    if (!j) return null;
    if (primary) idxOf.set(l.id, ind);
    ind++; out.push(j); return j;
  };
  layers.forEach((l, i) => {
    if (sources.has(l.id)) return; // emitted next to its consumer(s)
    if (l.matte && byId.has(l.matte.layer)) {
      const src = byId.get(l.matte.layer)!;
      emit(src, { td: true }, false);
      emit(l, { tt: MATTE_TO_TT[l.matte.mode] });
    } else if (l.clip && layers[i + 1]) {
      emit(layers[i + 1]!, { td: true }, false);
      emit(l, { tt: 1 });
    } else emit(l);
  });
  // parenting: resolve to the primary emission's index
  const byInd = new Map(out.map((j) => [j.ind, j]));
  layers.forEach((l) => {
    if (!l.parent) return;
    const me = out.find((j) => j.nm === l.name && idxOf.get(l.id) === j.ind), p = idxOf.get(l.parent);
    if (me && p) { me.parent = p; byInd.set(me.ind, me); }
    else if (me) ctx.warn('parent', `“${l.name}” has a parent that was not exported; parenting was dropped.`);
  });
  return out;
}

export async function exportLottie(p: Project, opts: ExportOpts = {}): Promise<LottieOut> {
  const ctx = new Ctx();
  const s = p.settings;
  if (s.linearLight) ctx.warn('linear', 'Linear-light compositing is not part of Lottie; colours will composite in sRGB.');
  const assets: J[] = [];
  const all = [p.layers, ...Object.values(p.comps).map((c) => c.layers)].flat();
  for (const l of all) {
    if (l.type !== 'image' || !l.media) continue;
    const id = `img_${l.media.asset.slice(0, 12)}`;
    if (assets.some((a) => a.id === id)) continue;
    const meta = p.assets[l.media.asset], data = await opts.assetData?.(l.media.asset);
    if (!meta || !data) { ctx.warn(`img:${id}`, `Image “${l.name}” is missing and was exported empty.`); assets.push({ id, w: meta?.width ?? 1, h: meta?.height ?? 1, u: '', p: '', e: 1 }); continue; }
    let bin = ''; for (let i = 0; i < data.bytes.length; i += 0x8000) bin += String.fromCharCode(...data.bytes.subarray(i, i + 0x8000));
    assets.push({ id, w: meta.width, h: meta.height, u: '', p: `data:${data.mime || meta.mime};base64,${btoa(bin)}`, e: 1 });
  }
  for (const c of Object.values(p.comps)) assets.push({ id: c.id, nm: c.name, fr: c.fps, layers: convertList(c.layers, c, ctx) });
  const fonts = [...new Set(all.filter((l) => l.text).map((l) => l.text!.font.split(',')[0]!.replace(/["']/g, '').trim()))];
  const json: J = {
    v: LOTTIE_VERSION, fr: s.fps, ip: 0, op: s.duration, w: s.width, h: s.height, nm: p.name, ddd: 0, assets,
    layers: convertList(p.layers, p, ctx),
    markers: p.markers.map((m) => ({ cm: m.name, tm: m.t, dr: 0 })),
  };
  if (fonts.length) json.fonts = { list: fonts.map((f) => ({ fName: f.replace(/\s+/g, ''), fFamily: f, fStyle: 'Regular', ascent: 75 })) };
  void paramKey;
  return { json, report: ctx.report };
}
