import { describe, expect, it } from 'vitest';
import { distToPoly, ellipsePath, flatten, insertNode, moveHandle, nearestOnPath, pathBounds, pointInPoly, polyLength, rectPath, recenter, removeNode, starPath, toggleSmooth, trimPoly, isCorner, node } from '../src/shape/path';
import { createProject } from '../src/model/project';
import { createShapeLayer, propOf, type BezPath, type Layer } from '../src/model/layer';
import { hitLayer, layerBox, shapePath } from '../src/shape/geometry';
import { evaluate, hitTest } from '../src/eval/evaluate';
import { evalProp, setKey } from '../src/anim/interp';
import { moveKeys, nextKeyTime } from '../src/anim/keys';

const s = createProject().settings;
const near = (a: number, b: number, e = 0.5) => expect(Math.abs(a - b)).toBeLessThan(e);

describe('path primitives', () => {
  it('rect bounds and rounded rect keep the same bounds', () => {
    expect(pathBounds(rectPath(200, 100, 0))).toEqual([-100, -50, 100, 50]);
    const b = pathBounds(rectPath(200, 100, 30))!;
    near(b[0], -100, 0.01); near(b[3], 50, 0.01);
    expect(rectPath(200, 100, 30).nodes.length).toBe(8);
    expect(rectPath(200, 100, 500).nodes.length).toBe(8); // radius clamps to half the short side
  });
  it('ellipse flattens to ~circumference', () => {
    const len = polyLength(flatten(ellipsePath(200, 200), 24));
    near(len, Math.PI * 200, 1);
  });
  it('star alternates outer/inner radii', () => {
    const st = starPath(5, 100, 40);
    expect(st.nodes.length).toBe(10);
    near(Math.hypot(...st.nodes[0]!.p), 100, 1e-6); near(Math.hypot(...st.nodes[1]!.p), 40, 1e-6);
  });
});

describe('trim paths', () => {
  const line: BezPath = { closed: false, nodes: [node(0, 0), node(100, 0)] };
  it('keeps the requested fraction of an open path', () => {
    const [seg] = trimPoly(flatten(line), 0.25, 0.75, 0);
    expect(seg!.pts[0]).toEqual([25, 0]); expect(seg!.pts[seg!.pts.length - 1]).toEqual([75, 0]);
  });
  it('clamps open paths and returns nothing when empty', () => {
    expect(trimPoly(flatten(line), 0.5, 0.5, 0)).toEqual([]);
    const [seg] = trimPoly(flatten(line), 0, 1, 0.5);
    expect(seg!.pts[0]).toEqual([50, 0]);
  });
  it('wraps closed paths around the start point', () => {
    const sq = rectPath(100, 100, 0);
    const segs = trimPoly(flatten(sq), 0, 0.5, 0.75);
    expect(segs.length).toBe(2);
    const total = segs.reduce((a, p) => a + polyLength(p), 0);
    near(total, 200, 0.01);
  });
  it('full range on a closed path is the whole loop', () => {
    const segs = trimPoly(flatten(rectPath(100, 100, 0)), 0, 1, 0);
    near(polyLength(segs[0]!), 400, 0.01);
  });
});

describe('node editing', () => {
  const p: BezPath = { closed: false, nodes: [node(0, 0), node(100, 0), node(100, 100)] };
  it('insertNode preserves the curve shape', () => {
    const curved: BezPath = { closed: false, nodes: [node(0, 0, [0, 0], [30, 60]), node(100, 0, [-30, 60], [0, 0])] };
    const before = polyLength(flatten(curved, 60));
    const after = polyLength(flatten(insertNode(curved, 0, 0.4), 60));
    near(before, after, 0.5);
    expect(insertNode(curved, 0, 0.4).nodes.length).toBe(3);
  });
  it('removeNode keeps at least two nodes', () => {
    expect(removeNode(p, 1).nodes.length).toBe(2);
    expect(removeNode(removeNode(p, 1), 0).nodes.length).toBe(2);
  });
  it('toggleSmooth round-trips corner <-> smooth', () => {
    const sm = toggleSmooth(p, 1);
    expect(isCorner(sm.nodes[1]!)).toBe(false);
    expect(isCorner(toggleSmooth(sm, 1).nodes[1]!)).toBe(true);
  });
  it('moveHandle mirrors the opposite handle on smooth nodes, not with alt', () => {
    const sm = toggleSmooth(p, 1);
    const len = Math.hypot(...sm.nodes[1]!.i);
    const moved = moveHandle(sm, 1, 'o', [0, 50]);
    near(Math.hypot(...moved.nodes[1]!.i), len, 1e-6);
    near(moved.nodes[1]!.i[0] * moved.nodes[1]!.o[1] - moved.nodes[1]!.i[1] * moved.nodes[1]!.o[0], 0, 1e-6); // collinear
    expect(moveHandle(sm, 1, 'o', [0, 50], true).nodes[1]!.i).toEqual(sm.nodes[1]!.i);
  });
  it('recenter moves the bbox centre to the origin', () => {
    const r = recenter({ closed: true, nodes: [node(100, 100), node(200, 100), node(200, 140)] });
    expect(r.offset).toEqual([150, 120]);
    expect(pathBounds(r.path)).toEqual([-50, -20, 50, 20]);
  });
  it('nearestOnPath finds the segment', () => {
    const n = nearestOnPath(p, 100, 60)!;
    expect(n.seg).toBe(1); near(n.dist, 0, 3);
  });
});

describe('hit testing', () => {
  it('point in polygon and distance to polyline', () => {
    const sq = flatten(rectPath(100, 100, 0));
    expect(pointInPoly(sq.pts, 0, 0)).toBe(true); expect(pointInPoly(sq.pts, 80, 0)).toBe(false);
    near(distToPoly(sq, 80, 0), 30, 1e-6);
  });
  const shape = (kind: Parameters<typeof createShapeLayer>[0]): Layer => createShapeLayer(kind, s, 0, [500, 400]);
  it('filled shape is hit inside, open stroke only near the line', () => {
    const r = shape('rect');
    expect(hitLayer(r, 0, 0, 0)).toBe(true); expect(hitLayer(r, 0, 300, 0)).toBe(false);
    const line = createShapeLayer('path', s, 0, [0, 0], { closed: false, nodes: [node(-100, 0), node(100, 0)] });
    expect(hitLayer(line, 0, 0, 0)).toBe(true); expect(hitLayer(line, 0, 0, 40)).toBe(false);
  });
  it('hitTest respects layer transform and stacking', () => {
    const bottom = shape('rect'), top = { ...shape('ellipse'), name: 'top' };
    const res = evaluate([top, bottom], 0);
    expect(hitTest(res, 500, 400)).toBe(top.id);
    expect(hitTest(res, 500 + 110, 400)).toBe(bottom.id); // outside the 200px ellipse, inside the 240px rect
    expect(hitTest(res, 5, 5)).toBeNull();
  });
});

describe('shape layers', () => {
  it('layerBox grows with stroke width', () => {
    const l = createShapeLayer('rect', s, 0, [0, 0]);
    expect(layerBox(l, 0)).toEqual([-120, -80, 120, 80]);
    const stroked = { ...l, shape: { ...l.shape!, stroke: { cap: 'round', join: 'round', dash: 0, gap: 0, paint: l.shape!.fill! } as never } };
    expect(layerBox(stroked, 0)).toEqual([-123, -83, 123, 83]);
  });
  it('primitive params animate', () => {
    let l = createShapeLayer('rect', s, 0, [0, 0]);
    l = { ...l, props: { ...l.props, 'shape.size': setKey(setKey({ value: [100, 100] }, 0, [100, 100]), 10, [200, 100]) as never } };
    const b0 = pathBounds(shapePath(l, 0)!)!, b10 = pathBounds(shapePath(l, 10)!)!;
    expect(b0[2]).toBe(50); expect(b10[2]).toBe(100);
  });
  it('colour props interpolate and keyframe tools address extra props', () => {
    let l = createShapeLayer('rect', s, 0, [0, 0]);
    const col = setKey(setKey(propOf(l, 'fill.color')!, 0, [0, 0, 0, 1]), 10, [1, 1, 1, 1]);
    l = { ...l, props: { ...l.props, 'fill.color': col } };
    expect(evalProp(propOf(l, 'fill.color')!, 5)).toEqual([0.5, 0.5, 0.5, 1]);
    expect(nextKeyTime([l], [l.id], 0, 1)).toBe(10);
    const moved = moveKeys([l], [{ layer: l.id, prop: 'fill.color', t: 10 }], 5);
    expect((propOf(moved.layers[0]!, 'fill.color') as { keys: { t: number }[] }).keys.map((k) => k.t)).toEqual([0, 15]);
  });
});

import { evalPath, togglePathAnimated, writePath } from '../src/shape/path';
import { BLEND_MODES, blendRGB, compositePx } from '../src/render/blend';
import { migrate } from '../src/model/project';

describe('animated paths', () => {
  const a: BezPath = { closed: true, nodes: [node(0, 0), node(10, 0), node(10, 10)] };
  it('interpolates between keys and holds outside', () => {
    const b = { ...a, nodes: a.nodes.map((n) => ({ ...n, p: [n.p[0] * 2, n.p[1] * 2] as [number, number] })) };
    const p = { ...a, keys: [{ t: 0, nodes: a.nodes }, { t: 10, nodes: b.nodes }] };
    expect(evalPath(p, 5).nodes[1]!.p).toEqual([15, 0]);
    expect(evalPath(p, -3).nodes[2]!.p).toEqual([10, 10]);
    expect(evalPath(p, 99).nodes[2]!.p).toEqual([20, 20]);
  });
  it('writePath keys animated paths and replaces static ones; node-count change collapses', () => {
    const anim = togglePathAnimated(a, 0);
    expect(anim.keys!.length).toBe(1);
    const edited = { ...a, nodes: a.nodes.map((n, i) => (i === 1 ? { ...n, p: [50, 0] as [number, number] } : n)) };
    const w = writePath(anim, edited, 10);
    expect(w.keys!.map((k) => k.t)).toEqual([0, 10]);
    expect(writePath(a, edited, 10).keys).toBeUndefined();
    const collapsed = writePath(w, { ...a, nodes: a.nodes.slice(0, 2) }, 5);
    expect(collapsed.keys!.length).toBe(1);
    expect(togglePathAnimated(w, 10).keys).toBeUndefined();
  });
});

describe('blend reference', () => {
  it('has 27 modes with textbook values', () => {
    expect(BLEND_MODES.length).toBe(27);
    expect(blendRGB('multiply', [0.5, 0.5, 0.5], [0.5, 1, 0])).toEqual([0.25, 0.5, 0]);
    expect(blendRGB('screen', [0.5, 0, 1], [0.5, 0, 0])).toEqual([0.75, 0, 1]);
    expect(blendRGB('difference', [1, 0.2, 0], [0.5, 0.5, 0])).toEqual([0.5, 0.3, 0].map((v) => expect.closeTo(v, 6)));
  });
  it('normal opaque source replaces the backdrop; transparent source leaves it', () => {
    expect(compositePx('normal', [1, 0, 0, 1], [0, 0, 1, 1])).toEqual([1, 0, 0, 1]);
    expect(compositePx('multiply', [0, 0, 0, 0], [0.2, 0.4, 0.6, 1])).toEqual([0.2, 0.4, 0.6, 1]);
  });
  it('migrate adds comps and bumps to v2', () => {
    const old = { ...createProject(), v: 1 } as never as Record<string, unknown>;
    delete old.comps;
    const m = migrate(old as never);
    expect(m.v).toBe(2); expect(m.comps).toEqual({});
  });
});
