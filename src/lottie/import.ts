// Lottie import (spec §7.15): Bodymovin JSON → native layers/props. Pure except for the optional image loader.
// Shape layers become one ripple layer per geometry (styles of the enclosing group applied); group transforms that are
// not identity become null parents so animation is preserved. Unsupported features are reported, never silently dropped.
import { createLayer, createShapeLayer, type BezPath, type Keyframe, type Layer, type Mask, type PathNode, type Prop, type Vec2 } from '../model/layer';
import { createProject, newId, type AssetMeta, type Comp, type Project, type ProjectSettings } from '../model/project';
import { maskProp } from '../render/masks';
import { rectPath } from '../shape/path';
import { LOTTIE_TO_BM, LOTTIE_TO_MASK, TT_TO_MATTE, type LottieReport } from './common';
import type { Ease } from '../model/layer';

type J = Record<string, any>;
export interface ImportOpts { loadImage?: (dataUri: string, name: string) => Promise<AssetMeta | null> }
export interface LottieImport { project: Project; report: LottieReport[] }

const first = (v: any, d = 0): number => (Array.isArray(v) ? (v[0] ?? d) : typeof v === 'number' ? v : d);

class Cx {
  report: LottieReport[] = [];
  seen = new Set<string>();
  shift = 0; // comp.ip → our 0-based time
  settings!: ProjectSettings;
  warn(key: string, msg: string) { if (!this.seen.has(key)) { this.seen.add(key); this.report.push({ level: 'warn', msg }); } }
}

const isAnimated = (p: J | undefined) => !!p && (p.a === 1 || (Array.isArray(p.k) && p.k.length > 0 && typeof p.k[0] === 'object' && p.k[0] !== null && 't' in p.k[0]));

/** Lottie property → Prop. `conv` maps a Lottie value (number | number[]) to ours. */
function prop<T>(p: J | undefined, conv: (v: any) => T, cx: Cx, st = 0): Prop<T> | undefined {
  if (!p || p.k === undefined) return undefined;
  if (p.x !== undefined) cx.warn('expr', 'Expressions are not supported; the property keeps its keyframed/static value.');
  if (!isAnimated(p)) return { value: conv(p.k) };
  const ks = p.k as J[], keys: Keyframe<T>[] = [];
  for (let j = 0; j < ks.length; j++) {
    const k = ks[j]!, prev = ks[j - 1];
    const sv = k.s ?? prev?.e;
    if (sv === undefined) continue;
    let ease: Ease = 'linear';
    if (k.h === 1) ease = 'hold';
    else if (k.o && k.i && j < ks.length - 1) ease = [first(k.o.x), first(k.o.y), first(k.i.x, 1), first(k.i.y, 1)] as Ease;
    keys.push({ t: Math.round((k.t + st - cx.shift) * 1000) / 1000, v: conv(sv), ease });
  }
  return keys.length ? { keys } : undefined;
}

const num = (v: any) => first(v);
const vec = (v: any): Vec2 => [v[0] ?? 0, v[1] ?? 0];
const colour = (v: any): number[] => [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? 1];

function pathOf(j: J, closedFallback = true): BezPath {
  const nodes: PathNode[] = (j.v ?? []).map((v: number[], i: number) => ({ p: [v[0]!, v[1]!] as Vec2, i: (j.i?.[i] ?? [0, 0]) as Vec2, o: (j.o?.[i] ?? [0, 0]) as Vec2 }));
  return { nodes, closed: j.c ?? closedFallback };
}
function pathProp(p: J | undefined, cx: Cx, st: number): BezPath | undefined {
  if (!p) return undefined;
  if (!isAnimated(p)) return pathOf(p.k);
  const ks = p.k as J[], keys: { t: number; nodes: PathNode[] }[] = [];
  for (const k of ks) { const s = k.s?.[0] ?? k.e?.[0]; if (s) keys.push({ t: k.t + st - cx.shift, nodes: pathOf(s).nodes }); }
  if (!keys.length) return undefined;
  const base = pathOf(ks[0]!.s?.[0] ?? {});
  const same = keys.every((k) => k.nodes.length === base.nodes.length);
  if (!same) { cx.warn('pathcount', 'A morphing path changes its point count between keyframes; only the first shape was kept.'); return { ...base }; }
  return { nodes: keys[0]!.nodes, closed: base.closed, keys };
}

interface Built { layers: Layer[]; rootId: string; byInd?: number }

function baseTransform(l: Layer, ks: J | undefined, cx: Cx, st: number) {
  if (!ks) return;
  const set = <K extends keyof Layer['transform']>(k: K, p: Prop<any> | undefined) => { if (p) l.transform[k] = p as never; };
  set('opacity', prop(ks.o, num, cx, st));
  set('rotation', prop(ks.r ?? ks.rz, num, cx, st));
  if (ks.p?.s) { cx.warn('sepdim', 'Separated position dimensions are not supported; using the first-frame value.'); const x = ks.p.x?.k, y = ks.p.y?.k; l.transform.position = { value: [first(Array.isArray(x) && x[0]?.s ? x[0].s : x), first(Array.isArray(y) && y[0]?.s ? y[0].s : y)] }; }
  else set('position', prop(ks.p, vec, cx, st));
  set('anchor', prop(ks.a, vec, cx, st));
  set('scale', prop(ks.s, vec, cx, st));
}

const hex = (s: string): number[] => { const n = parseInt(s.replace('#', ''), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]; };

/** Common per-layer properties (timing, blend, masks, parent bookkeeping). */
function finish(l: Layer, ly: J, cx: Cx) {
  l.name = ly.nm ?? l.name;
  l.in = Math.round(ly.ip - cx.shift - 0); l.out = Math.max(l.in + 1, Math.round(ly.op - cx.shift));
  l.in = Math.max(0, l.in);
  l.visible = ly.hd !== true;
  const bm = LOTTIE_TO_BM[ly.bm ?? 0]; if (bm && bm !== 'normal') l.blend = bm;
  if (ly.sr !== undefined && ly.sr !== 1) cx.warn('sr', 'Layer time-stretch (sr) is not supported.');
  if (ly.tm) cx.warn('tm', 'Time remapping is not supported.');
  if (ly.ef?.length) cx.warn('ef', 'Layer effects were ignored.');
  if (ly.ddd) cx.warn('3d', '3D layers are imported as flat 2D.');
  const mp: J[] | undefined = ly.masksProperties;
  if (mp?.length) {
    l.masks = []; const props = { ...l.props };
    for (const m of mp) {
      const path = pathProp(m.pt, cx, ly.st ?? 0); if (!path) continue;
      const id = newId();
      l.masks.push({ id, name: m.nm ?? `Mask ${l.masks.length + 1}`, mode: LOTTIE_TO_MASK[m.mode ?? 'a'] ?? 'add', invert: !!m.inv, path } as Mask);
      props[maskProp(id, 'opacity')] = prop(m.o, num, cx, ly.st ?? 0) ?? { value: 100 };
      props[maskProp(id, 'feather')] = { value: 0 };
      props[maskProp(id, 'expansion')] = prop(m.x, num, cx, ly.st ?? 0) ?? { value: 0 };
    }
    l.props = props;
  }
}

function gradPaint(it: J): { kind: 'linear' | 'radial'; stops: { at: number; c: number[] }[]; from: Vec2; to: Vec2 } | null {
  const n: number = it.g?.p ?? 0, k = it.g?.k?.k; if (!Array.isArray(k) || !n || isAnimated(it.g.k)) return null;
  const stops = Array.from({ length: n }, (_, i) => ({ at: k[i * 4]!, c: [k[i * 4 + 1]!, k[i * 4 + 2]!, k[i * 4 + 3]!, 1] }));
  return { kind: it.t === 2 ? 'radial' : 'linear', stops, from: vec(it.s?.k ?? [0, 0]), to: vec(it.e?.k ?? [100, 0]) };
}

interface GroupCtx { parentId?: string; opacity?: Prop<number>; order: number }

function buildShapeLayer(ly: J, cx: Cx, idx: number, mkLayer: (kind: any, at: Vec2, path?: BezPath) => Layer): Built {
  const st = ly.st ?? 0;
  const out: Layer[] = [];
  const rootTransformIdentity = (tr: J | undefined) => !tr || (!isAnimated(tr.p) && !isAnimated(tr.a) && !isAnimated(tr.s) && !isAnimated(tr.r) && !isAnimated(tr.o)
    && JSON.stringify(first2(tr.p, [0, 0])) === '[0,0]' && JSON.stringify(first2(tr.a, [0, 0])) === '[0,0]' && JSON.stringify(first2(tr.s, [100, 100])) === '[100,100]' && num(tr.r?.k ?? 0) === 0 && num(tr.o?.k ?? 100) === 100);
  const first2 = (p: J | undefined, d: number[]) => (p && !isAnimated(p) ? (p.k as number[]).slice(0, 2) : d);

  const walk = (items: J[], parentId: string | undefined, opacityMul: Prop<number> | undefined, depth: number): void => {
    const geoms = items.filter((i) => ['sh', 'rc', 'el', 'sr'].includes(i.ty));
    const fl = items.find((i) => i.ty === 'fl' || i.ty === 'gf'), strk = items.find((i) => i.ty === 'st' || i.ty === 'gs');
    const tm = items.find((i) => i.ty === 'tm'), rp = items.find((i) => i.ty === 'rp'), rd = items.find((i) => i.ty === 'rd');
    if (items.filter((i) => i.ty === 'fl' || i.ty === 'gf').length > 1) cx.warn('multifill', 'A group with several fills keeps only the first.');
    if (items.some((i) => ['mm', 'tw', 'pb', 'zz', 'op', 'rd'].includes(i.ty) && i.ty !== 'rd')) cx.warn('mods', 'Shape modifiers other than trim paths, repeater and round corners are ignored.');
    for (const g of geoms) {
      const at: Vec2 = [0, 0];
      let layer: Layer;
      if (g.ty === 'sh') layer = mkLayer('path', at, pathProp(g.ks, cx, st) ?? { nodes: [], closed: false });
      else if (g.ty === 'rc' || g.ty === 'el') {
        const size = prop(g.s, vec, cx, st) ?? { value: [100, 100] as Vec2 }, pos = !isAnimated(g.p) ? vec(g.p?.k ?? [0, 0]) : (cx.warn('animpos', 'Animated rectangle/ellipse positions are not supported; the first value was used.'), vec(g.p.k[0]?.s ?? [0, 0]));
        const off = pos[0] !== 0 || pos[1] !== 0;
        if (off || isAnimated(g.p)) {
          const sv = 'value' in size ? size.value : size.keys[0]!.v;
          const base = g.ty === 'rc' ? rectPath(sv[0], sv[1], first(g.r?.k ?? 0)) : { closed: true, nodes: [] as PathNode[] };
          if (g.ty === 'el') { const K = 0.5522847498, a = sv[0] / 2, b = sv[1] / 2; base.nodes = [{ p: [0, -b], i: [-a * K, 0], o: [a * K, 0] }, { p: [a, 0], i: [0, -b * K], o: [0, b * K] }, { p: [0, b], i: [a * K, 0], o: [-a * K, 0] }, { p: [-a, 0], i: [0, b * K], o: [0, -b * K] }]; }
          layer = mkLayer('path', at, { closed: true, nodes: base.nodes.map((n) => ({ ...n, p: [n.p[0] + pos[0], n.p[1] + pos[1]] as Vec2 })) });
        } else {
          layer = mkLayer(g.ty === 'rc' ? 'rect' : 'ellipse', at);
          layer.props!['shape.size'] = size as Prop<any>;
          if (g.ty === 'rc') layer.props!['shape.round'] = prop(rd?.r ?? g.r, num, cx, st) ?? { value: 0 };
        }
      } else { // star / polygon
        layer = mkLayer(g.sy === 2 ? 'polygon' : 'star', at);
        layer.props!['shape.points'] = prop(g.pt, num, cx, st) ?? { value: 5 };
        layer.props!['shape.outer'] = prop(g.or, num, cx, st) ?? { value: 100 };
        if (g.sy !== 2) layer.props!['shape.inner'] = prop(g.ir, num, cx, st) ?? { value: 50 };
        if (g.r && (isAnimated(g.r) || num(g.r.k) !== 0)) cx.warn('starrot', 'Star/polygon rotation inside the shape is ignored.');
        if (g.p && !isAnimated(g.p) && JSON.stringify(vec(g.p.k)) !== '[0,0]') { const pp = vec(g.p.k); layer.transform.position = { value: pp }; }
      }
      layer.name = g.nm && g.nm !== 'Path' ? g.nm : layer.name;
      const P = layer.props!;
      // fill
      if (fl?.ty === 'fl') { P['fill.color'] = prop(fl.c, colour, cx, st) ?? { value: [1, 1, 1, 1] }; P['fill.opacity'] = prop(fl.o, num, cx, st) ?? { value: 100 }; }
      else if (fl?.ty === 'gf') { const gp = gradPaint(fl); layer.shape!.fill = gp ? { ...gp, stops: gp.stops.map((s) => ({ at: s.at, c: s.c as never })) } : null; if (!gp) cx.warn('animgrad', 'Animated gradients are not supported; the fill was dropped.'); P['fill.opacity'] = prop(fl.o, num, cx, st) ?? { value: 100 }; }
      else layer.shape!.fill = null;
      // stroke
      if (strk) {
        const cap = (['butt', 'butt', 'round', 'square'] as const)[strk.lc ?? 2] ?? 'round', join = (['miter', 'miter', 'round', 'bevel'] as const)[strk.lj ?? 2] ?? 'round';
        const dash = Array.isArray(strk.d) ? strk.d.filter((d: J) => d.n === 'd' || d.n === 'g') : [];
        const dv = dash.find((d: J) => d.n === 'd')?.v?.k ?? 0, gv = dash.find((d: J) => d.n === 'g')?.v?.k ?? 0;
        const gp = strk.ty === 'gs' ? gradPaint(strk) : null;
        layer.shape!.stroke = { cap, join, dash: first(dv), gap: first(gv), paint: gp ? { ...gp, stops: gp.stops.map((s) => ({ at: s.at, c: s.c as never })) } : { kind: 'solid', stops: [], from: [0, 0], to: [1, 0] } };
        if (strk.ty === 'st') P['stroke.color'] = prop(strk.c, colour, cx, st) ?? { value: [1, 1, 1, 1] };
        P['stroke.width'] = prop(strk.w, num, cx, st) ?? { value: 2 }; P['stroke.opacity'] = prop(strk.o, num, cx, st) ?? { value: 100 };
      } else layer.shape!.stroke = null;
      if (!layer.shape!.fill && !layer.shape!.stroke) continue;
      if (tm) { layer.shape!.trim = true; P['trim.start'] = prop(tm.s, num, cx, st) ?? { value: 0 }; P['trim.end'] = prop(tm.e, num, cx, st) ?? { value: 100 }; P['trim.offset'] = prop(tm.o, num, cx, st) ?? { value: 0 }; }
      if (rp) {
        layer.shape!.repeater = true; const t = rp.tr ?? {};
        P['rep.copies'] = prop(rp.c, num, cx, st) ?? { value: 3 }; P['rep.position'] = prop(t.p, vec, cx, st) ?? { value: [0, 0] };
        P['rep.rotation'] = prop(t.r, num, cx, st) ?? { value: 0 }; P['rep.scale'] = prop(t.s, vec, cx, st) ?? { value: [100, 100] };
        P['rep.opacityStart'] = prop(t.so, num, cx, st) ?? { value: 100 }; P['rep.opacityEnd'] = prop(t.eo, num, cx, st) ?? { value: 100 };
      }
      if (parentId) layer.parent = parentId;
      if (opacityMul) layer.transform.opacity = opacityMul as Prop<number>;
      out.push(layer);
    }
    for (const sub of items.filter((i) => i.ty === 'gr')) {
      const tr = (sub.it as J[] | undefined)?.find((i) => i.ty === 'tr') as J;
      let pid = parentId, om = opacityMul;
      if (!rootTransformIdentity(tr)) {
        const nul = createLayer('null', cx.settings, idx + out.length, sub.nm ?? 'Group');
        nul.in = 0; nul.out = cx.settings.duration;
        const t = nul.transform;
        t.position = prop(tr.p, vec, cx, st) ?? t.position; t.anchor = prop(tr.a, vec, cx, st) ?? t.anchor; t.scale = prop(tr.s, vec, cx, st) ?? t.scale; t.rotation = prop(tr.r, num, cx, st) ?? t.rotation;
        if (parentId) nul.parent = parentId;
        out.push(nul); pid = nul.id;
        const gop = prop(tr.o, num, cx, st);
        if (gop && !(('value' in gop) && gop.value === 100)) cx.warn('groupop', 'Group opacity is applied only as a static multiplier of the layer opacity.');
      }
      walk((sub.it as J[]).filter((i) => i.ty !== 'tr'), pid, om, depth + 1);
    }
  };
  const top = ly.shapes as J[];
  walk(top, undefined, undefined, 0);
  // Layer-level transform: single-output layers use ks directly; otherwise a null parent carries it.
  const drawables = out.filter((l) => l.type === 'shape');
  if (!drawables.length) return { layers: [], rootId: '' };
  const withNoParent = out.filter((l) => !l.parent);
  if (out.length === 1) {
    baseTransform(out[0]!, ly.ks, cx, st); finish(out[0]!, ly, cx); return { layers: out, rootId: out[0]!.id };
  }
  const root = createLayer('null', cx.settings, idx, ly.nm ?? 'Shape layer');
  baseTransform(root, ly.ks, cx, st); finish(root, ly, cx); root.masks = undefined;
  for (const l of withNoParent) l.parent = root.id;
  const lop = prop<number>(ly.ks?.o, num, cx, st);
  for (const l of out) { l.in = root.in; l.out = root.out; l.visible = root.visible; if (l.type === 'shape' && lop) l.transform.opacity = lop; if (root.blend) l.blend = root.blend; }
  return { layers: [...out, root], rootId: root.id };
}

function convertLayers(list: J[], cx: Cx, comps: Record<string, Comp>, assets: Map<string, AssetMeta | null>, fonts: J[]): Layer[] {
  const built: Built[] = [];
  const idxToId = new Map<number, string>();
  let n = 0;
  for (const ly of list) {
    const st = ly.st ?? 0;
    const idx = n++;
    const mk = (kind: any, at: Vec2, path?: BezPath) => createShapeLayer(kind, cx.settings, idx, at, path);
    let layers: Layer[] = [], rootId = '';
    switch (ly.ty) {
      case 4: { const b = buildShapeLayer(ly, cx, idx, mk); layers = b.layers; rootId = b.rootId; break; }
      case 1: { const l = createLayer('solid', cx.settings, idx); l.size = [ly.sw ?? cx.settings.width, ly.sh ?? cx.settings.height]; l.color = hex(ly.sc ?? '#ffffff') as never; baseTransform(l, ly.ks, cx, st); finish(l, ly, cx); layers = [l]; rootId = l.id; break; }
      case 3: { const l = createLayer('null', cx.settings, idx); baseTransform(l, ly.ks, cx, st); finish(l, ly, cx); layers = [l]; rootId = l.id; break; }
      case 0: {
        const comp = comps[ly.refId]; if (!comp) { cx.warn(`ref:${ly.refId}`, `Precomp “${ly.nm}” references a missing composition.`); break; }
        const l = createLayer('precomp', cx.settings, idx); l.size = [ly.w ?? comp.width, ly.h ?? comp.height]; l.precomp = { comp: comp.id, offset: 0 };
        baseTransform(l, ly.ks, cx, st); finish(l, ly, cx); l.precomp = { comp: comp.id, offset: l.in - st }; layers = [l]; rootId = l.id; break;
      }
      case 2: {
        const meta = assets.get(ly.refId); if (!meta) { cx.warn(`img:${ly.refId}`, `Image “${ly.nm}” could not be loaded (external files are not fetched).`); break; }
        const l = createLayer('image', cx.settings, idx); l.size = [meta.width, meta.height]; l.media = { asset: meta.hash, start: 0, speed: 1 };
        baseTransform(l, ly.ks, cx, st); finish(l, ly, cx); layers = [l]; rootId = l.id; break;
      }
      case 5: {
        const d = ly.t?.d?.k?.[0]?.s; if (!d) break;
        const l = createLayer('text', cx.settings, idx);
        const f = fonts.find((x) => x.fName === d.f)?.fFamily ?? 'Inter';
        l.name = ly.nm ?? 'Text';
        l.text = { text: String(d.t ?? '').replace(/\r\n?/g, '\n'), font: `${/^(Inter|Source Serif 4|JetBrains Mono|Space Grotesk)$/.test(f) ? f : 'Inter'}, system-ui, sans-serif`, align: (['left', 'right', 'center'] as const)[d.j ?? 0] ?? 'left', bold: false, italic: false };
        l.props = { ...l.props, 'text.size': { value: d.s ?? 48 }, 'text.leading': { value: d.lh && d.s ? (d.lh / d.s) * 100 : 120 }, 'fill.color': { value: colour(d.fc ?? [1, 1, 1]) } };
        if (!/^(Inter|Source Serif 4|JetBrains Mono|Space Grotesk)$/.test(f)) cx.warn(`font:${f}`, `Font “${f}” is not installed; text uses Inter. Import the font file to match.`);
        if (ly.t?.a?.length) cx.warn('textanim', 'Text animators in the file were ignored.');
        baseTransform(l, ly.ks, cx, st); finish(l, ly, cx); layers = [l]; rootId = l.id; break;
      }
      default: cx.warn(`ty:${ly.ty}`, `Layer type ${ly.ty} (“${ly.nm ?? ''}”) is not supported and was skipped.`);
    }
    built.push({ layers, rootId, byInd: ly.ind });
    if (ly.ind !== undefined && rootId) idxToId.set(ly.ind, rootId);
  }
  // parenting
  list.forEach((ly, i) => {
    if (ly.parent === undefined) return;
    const pid = idxToId.get(ly.parent), b = built[i]!;
    if (!pid) { cx.warn('parent', 'A layer references a parent that was not imported.'); return; }
    const root = b.layers.find((l) => l.id === b.rootId);
    if (root) root.parent = pid;
  });
  // mattes: a layer with td=1 is the matte source of the layer below it in the list
  list.forEach((ly, i) => {
    const next = list[i + 1], consumer = built[i + 1];
    if (ly.td === 1 && next && consumer && built[i]?.rootId) {
      for (const l of consumer.layers) if (l.type !== 'null') l.matte = { layer: built[i]!.rootId, mode: TT_TO_MATTE[next.tt ?? 1] ?? 'alpha' };
      if (consumer.layers.length > 2) cx.warn('mattegroup', 'A track matte on a multi-part shape layer may differ from the original.');
    }
  });
  return built.flatMap((b) => b.layers);
}

/** Convert Lottie JSON to a new RippleFlow project. */
export async function importLottie(json: J, opts: ImportOpts = {}): Promise<LottieImport> {
  if (!json || typeof json !== 'object' || !Array.isArray(json.layers) || typeof json.fr !== 'number') throw new Error('This file is not a Lottie animation.');
  const cx = new Cx();
  const ip = json.ip ?? 0, op = json.op ?? ip + 60;
  cx.shift = ip;
  const proj = createProject(json.nm || 'Lottie import');
  proj.settings = { ...proj.settings, width: Math.round(json.w ?? 512), height: Math.round(json.h ?? 512), fps: json.fr, duration: Math.max(1, Math.round(op - ip)) };
  cx.settings = proj.settings;
  const assetMeta = new Map<string, AssetMeta | null>();
  const comps: Record<string, Comp> = {};
  const fonts: J[] = json.fonts?.list ?? [];
  const asList: J[] = json.assets ?? [];
  for (const a of asList) {
    if (a.p && a.u !== undefined && typeof a.p === 'string' && a.p.startsWith('data:')) {
      const meta = opts.loadImage ? await opts.loadImage(a.p, a.id) : null;
      assetMeta.set(a.id, meta); if (meta) proj.assets[meta.hash] = meta;
    } else if (a.p) assetMeta.set(a.id, null);
  }
  // precomps first (they may reference each other)
  for (const a of asList.filter((x) => Array.isArray(x.layers))) {
    const sub = new Cx(); sub.shift = 0; sub.settings = { ...proj.settings, width: a.w ?? proj.settings.width, height: a.h ?? proj.settings.height }; sub.report = cx.report; sub.seen = cx.seen;
    comps[a.id] = { id: a.id, name: a.nm ?? 'Comp', width: sub.settings.width, height: sub.settings.height, fps: a.fr ?? json.fr, duration: proj.settings.duration, layers: [] };
    void sub;
  }
  for (const a of asList.filter((x) => Array.isArray(x.layers))) {
    const sub = new Cx(); sub.shift = 0; sub.settings = proj.settings; sub.report = cx.report; sub.seen = cx.seen;
    comps[a.id]!.layers = convertLayers(a.layers, sub, comps, assetMeta, fonts);
    const w = a.layers.reduce((m: number, l: J) => Math.max(m, l.op ?? 0), 0);
    comps[a.id]!.duration = Math.max(1, Math.round(w));
  }
  proj.layers = convertLayers(json.layers, cx, comps, assetMeta, fonts);
  proj.comps = comps;
  proj.markers = (json.markers ?? []).map((m: J) => ({ id: newId(), t: Math.max(0, Math.round((m.tm ?? 0) - ip)), name: String(m.cm ?? 'Marker') }));
  return { project: proj, report: cx.report };
}
