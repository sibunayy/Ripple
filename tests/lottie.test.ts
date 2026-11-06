import { describe, expect, it } from 'vitest';
import { exportLottie } from '../src/lottie/export';
import { importLottie } from '../src/lottie/import';
import { createProject } from '../src/model/project';
import { createLayer, createShapeLayer, type Layer, type Prop } from '../src/model/layer';
import { evalProp } from '../src/anim/interp';
import { maskProp } from '../src/render/masks';
import { node } from '../src/shape/path';

const base = () => { const p = createProject('T'); p.settings = { ...p.settings, width: 400, height: 300, fps: 24, duration: 48 }; return p; };
const S = base().settings;
const keys = (l: Layer, k: string) => ((l.transform as any)[k] ?? l.props?.[k]).keys;

describe('Lottie export', () => {
  it('writes the comp header, layer timing, solid/null/shape types and markers', async () => {
    const p = base();
    const solid = { ...createLayer('solid', S, 0), id: 's' }, nul = { ...createLayer('null', S, 1), id: 'n' }, sh = { ...createShapeLayer('rect', S, 2, [100, 100]), id: 'r' };
    p.layers = [sh, nul, solid]; p.markers = [{ id: 'm', t: 12, name: 'beat' }];
    const { json } = await exportLottie(p);
    expect([json.fr, json.w, json.h, json.op, json.ip]).toEqual([24, 400, 300, 48, 0]);
    expect(json.layers.map((l: any) => l.ty)).toEqual([4, 3, 1]);
    expect(json.layers[2].sc).toMatch(/^#[0-9a-f]{6}$/); expect(json.layers[0].ip).toBe(0); expect(json.layers[0].op).toBe(48);
    expect(json.markers).toEqual([{ cm: 'beat', tm: 12, dr: 0 }]);
    const items = json.layers[0].shapes[0].it.map((i: any) => i.ty);
    expect(items).toEqual(['rc', 'fl', 'tr']);
  });
  it('keyframes: bézier handles, hold, and elastic eases are baked to samples', async () => {
    const p = base(); const l = createLayer('null', S, 0);
    l.transform.opacity = { keys: [{ t: 0, v: 0, ease: [0.42, 0, 0.58, 1] }, { t: 10, v: 100, ease: 'hold' }, { t: 20, v: 50, ease: 'linear' }, { t: 30, v: 0, ease: { fn: 'elastic', mode: 'out' } }, { t: 40, v: 100, ease: 'linear' }] };
    p.layers = [l];
    const o = (await exportLottie(p)).json.layers[0].ks.o;
    expect(o.a).toBe(1);
    expect(o.k[0]).toMatchObject({ t: 0, s: [0], o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } });
    expect(o.k[1].h).toBe(1); expect(o.k[1].s).toEqual([100]);
    expect(o.k.filter((k: any) => k.t > 30 && k.t < 40).length).toBeGreaterThan(3); // baked elastic
    expect(o.k[o.k.length - 1]).toEqual({ t: 40, s: [100] });
  });
  it('masks, mattes (source emitted directly above consumer), blend modes and parenting', async () => {
    const p = base();
    const src = { ...createLayer('solid', S, 0), id: 'src' }, c = { ...createLayer('solid', S, 1), id: 'c', blend: 'multiply' as const, matte: { layer: 'src', mode: 'luma' as const }, parent: 'par' };
    const par = { ...createLayer('null', S, 2), id: 'par' };
    c.masks = [{ id: 'k', name: 'M', mode: 'subtract', invert: true, path: { closed: true, nodes: [node(0, 0), node(10, 0), node(10, 10)] } }];
    c.props = { [maskProp('k', 'opacity')]: { value: 60 }, [maskProp('k', 'expansion')]: { value: 2 }, [maskProp('k', 'feather')]: { value: 5 } };
    p.layers = [src, c, par];
    const { json, report } = await exportLottie(p);
    const names = json.layers.map((l: any) => [l.ty, l.td, l.tt, l.bm]);
    expect(names[0]).toEqual([1, 1, undefined, 0]); expect(names[1]).toEqual([1, undefined, 3, 1]);
    expect(json.layers[1].parent).toBe(json.layers[2].ind);
    expect(json.layers[1].masksProperties[0]).toMatchObject({ mode: 's', inv: true });
    expect(report.some((r) => /feather/.test(r.msg))).toBe(true);
  });
  it('reports what cannot be exported', async () => {
    const p = base();
    const adj = createLayer('adjustment', S, 0), vid = createLayer('video', S, 1), fx = { ...createLayer('solid', S, 2), effects: [{ id: 'e', type: 'invert', enabled: true }] };
    p.layers = [adj, vid, fx];
    const { json, report } = await exportLottie(p);
    expect(json.layers.length).toBe(1);
    const msgs = report.map((r) => r.msg).join(' ');
    expect(msgs).toMatch(/Adjustment/); expect(msgs).toMatch(/Video/); expect(msgs).toMatch(/Effects/);
  });
});

describe('Lottie round trip', () => {
  it('shape layer: fill/stroke/trim/repeater/props and keyframes survive export → import', async () => {
    const p = base();
    const l = { ...createShapeLayer('ellipse', S, 0, [200, 150]), id: 'e' };
    l.props = { ...l.props, 'shape.size': { value: [120, 80] }, 'fill.color': { keys: [{ t: 0, v: [1, 0, 0, 1], ease: 'linear' as const }, { t: 24, v: [0, 0, 1, 1], ease: 'linear' as const }] } as Prop<any> };
    l.shape = { ...l.shape!, trim: true, repeater: true, stroke: { cap: 'round', join: 'bevel', dash: 0, gap: 0, paint: l.shape!.fill! } };
    l.props['trim.end'] = { keys: [{ t: 0, v: 0, ease: [0.25, 0.1, 0.25, 1] as any }, { t: 20, v: 100, ease: 'linear' as const }] };
    l.transform.position = { keys: [{ t: 0, v: [50, 50], ease: 'hold' as const }, { t: 12, v: [300, 200], ease: 'linear' as const }] };
    p.layers = [l];
    const { json } = await exportLottie(p);
    const back = (await importLottie(JSON.parse(JSON.stringify(json)))).project;
    expect(back.settings).toMatchObject({ width: 400, height: 300, fps: 24, duration: 48 });
    expect(back.layers.length).toBe(1);
    const r = back.layers[0]!;
    expect(r.type).toBe('shape'); expect(r.shape!.kind).toBe('ellipse'); expect(r.shape!.trim).toBe(true); expect(r.shape!.repeater).toBe(true);
    expect(r.shape!.stroke).toMatchObject({ cap: 'round', join: 'bevel' });
    expect(evalProp(r.props!['shape.size'] as any, 0)).toEqual([120, 80]);
    expect(keys(r, 'fill.color').map((k: any) => k.v)).toEqual([[1, 0, 0, 1], [0, 0, 1, 1]]);
    expect(keys(r, 'trim.end')[0].ease).toEqual([0.25, 0.1, 0.25, 1]);
    const pos = keys(r, 'position'); expect(pos[0].ease).toBe('hold'); expect(pos[1].v).toEqual([300, 200]);
  });
  it('parenting, mattes, blend modes, masks and markers round trip', async () => {
    const p = base();
    const par = { ...createLayer('null', S, 0), id: 'par' };
    const src = { ...createLayer('solid', S, 1), id: 'src' };
    const c = { ...createLayer('solid', S, 2), id: 'c', parent: 'par', blend: 'screen' as const, matte: { layer: 'src', mode: 'alphaInv' as const },
      masks: [{ id: 'k', name: 'M', mode: 'intersect' as const, invert: false, path: { closed: true, nodes: [node(0, 0), node(10, 0), node(10, 10)] } }], props: { [maskProp('k', 'opacity')]: { value: 70 } } as Record<string, Prop<any>> };
    p.layers = [par, c, src]; p.markers = [{ id: 'm', t: 6, name: 'hit' }];
    const back = (await importLottie(JSON.parse(JSON.stringify((await exportLottie(p)).json)))).project;
    const bc = back.layers.find((l) => l.blend === 'screen')!;
    expect(bc).toBeTruthy(); expect(bc.parent).toBe(back.layers.find((l) => l.type === 'null')!.id);
    expect(bc.matte).toMatchObject({ mode: 'alphaInv' }); expect(back.layers.some((l) => l.id === bc.matte!.layer)).toBe(true);
    expect(bc.masks![0]).toMatchObject({ mode: 'intersect', invert: false });
    expect(evalProp(bc.props![maskProp(bc.masks![0]!.id, 'opacity')] as any, 0)).toBe(70);
    expect(back.markers).toMatchObject([{ t: 6, name: 'hit' }]);
  });
  it('precomps become comps with the same layers and time offset', async () => {
    const p = base();
    const inner = { ...createLayer('solid', S, 0), name: 'inner' };
    p.comps = { c1: { id: 'c1', name: 'Inner', width: 100, height: 100, fps: 24, duration: 48, layers: [inner] } };
    const pc = { ...createLayer('precomp', S, 0), in: 10, out: 40, precomp: { comp: 'c1', offset: 4 } }; p.layers = [pc];
    const back = (await importLottie(JSON.parse(JSON.stringify((await exportLottie(p)).json)))).project;
    const comp = Object.values(back.comps)[0]!;
    expect(comp.layers.map((l) => l.name)).toEqual(['inner']);
    const l = back.layers[0]!; expect(l.type).toBe('precomp'); expect([l.in, l.out, l.precomp!.offset]).toEqual([10, 40, 4]);
  });
});

describe('Lottie import of external files', () => {
  const file = (layers: any[], extra: any = {}) => ({ v: '5.7.0', fr: 30, ip: 0, op: 60, w: 200, h: 200, nm: 'X', ddd: 0, assets: [], layers, ...extra });
  const ks = (extra: any = {}) => ({ o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }, ...extra });
  it('multi-group shape layers split into children under a null carrying the layer transform; group transforms are kept', async () => {
    const grp = (nm: string, geo: any, tr: any) => ({ ty: 'gr', nm, it: [geo, { ty: 'fl', c: { a: 0, k: [1, 0, 0] }, o: { a: 0, k: 100 } }, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, ...tr }] });
    const res = await importLottie(file([{ ty: 4, nm: 'L', ind: 1, ip: 0, op: 60, st: 0, ks: ks(), shapes: [
      grp('A', { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [40, 40] }, r: { a: 0, k: 0 } }, { p: { a: 0, k: [30, 0] } }),
      grp('B', { ty: 'sr', sy: 1, pt: { a: 0, k: 5 }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 }, or: { a: 0, k: 30 }, ir: { a: 0, k: 12 } }, {}),
    ] }]));
    const L = res.project.layers;
    expect(L.filter((l) => l.type === 'shape').map((l) => l.shape!.kind).sort()).toEqual(['rect', 'star']);
    const root = L.find((l) => l.name === 'L')!; expect(root.type).toBe('null'); expect(evalProp(root.transform.position as any, 0)).toEqual([100, 100]);
    const groupNull = L.find((l) => l.name === 'A' && l.type === 'null')!; expect(evalProp(groupNull.transform.position as any, 0)).toEqual([30, 0]);
  });
  it('old-format keyframes (e), time offset ip and unsupported features are handled and reported', async () => {
    const res = await importLottie(file([{ ty: 3, nm: 'N', ind: 1, ip: 10, op: 70, st: 10, ks: ks({ p: { a: 1, k: [{ t: 10, s: [0, 0, 0], e: [100, 0, 0], i: { x: [0.5], y: [1] }, o: { x: [0.2], y: [0] } }, { t: 40 }] }, o: { a: 0, k: 100, x: 'wiggle(1,1)' } }), ef: [{}] },
      { ty: 99, nm: 'weird', ind: 2, ip: 0, op: 60 }], { ip: 10, op: 70 }));
    const n = res.project.layers[0]!;
    expect(res.project.settings.duration).toBe(60);
    expect([n.in, n.out]).toEqual([0, 60]);
    const ks2 = (n.transform.position as any).keys; expect(ks2.map((k: any) => k.t)).toEqual([10 + 10 - 10, 40 + 10 - 10]);
    expect(ks2[0].ease).toEqual([0.2, 0, 0.5, 1]); expect(ks2[1].v).toEqual([100, 0]);
    const msgs = res.report.map((r) => r.msg).join(' ');
    expect(msgs).toMatch(/Expressions/); expect(msgs).toMatch(/effects/i); expect(msgs).toMatch(/not supported and was skipped/);
  });
  it('rejects non-Lottie input', async () => {
    await expect(importLottie({ hello: 1 } as any)).rejects.toThrow(/Lottie/);
  });
});
