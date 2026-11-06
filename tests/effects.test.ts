import { describe, expect, it } from 'vitest';
import { BUILTIN_PRESETS, applyPreset, presetFromLayer } from '../src/anim/presets';
import { EFFECTS, EFFECT_BY_TYPE, createEffect, curveLUT, curvesTable, defaultCurves, paramKey } from '../src/render/effects';
import { createProject } from '../src/model/project';
import { createLayer, createShapeLayer, propOf } from '../src/model/layer';
import { evalProp } from '../src/anim/interp';

const s = createProject().settings;
let n = 0; const mk = () => `id${n++}`;

describe('curves', () => {
  it('identity is the diagonal and monotone', () => {
    const l = curveLUT([[0, 0], [1, 1]], 5);
    expect(Array.from(l).map((v) => +v.toFixed(3))).toEqual([0, 0.25, 0.5, 0.75, 1]);
    const c = curveLUT([[0, 0], [0.3, 0.6], [1, 1]]);
    for (let i = 1; i < c.length; i++) expect(c[i]!).toBeGreaterThanOrEqual(c[i - 1]! - 1e-6);
  });
  it('passes through control points and clamps', () => {
    const l = curveLUT([[0, 0.1], [0.5, 0.9], [1, 0.2]]);
    expect(l[0]).toBeCloseTo(0.1, 2); expect(l[127]).toBeCloseTo(0.9, 1); expect(l[255]).toBeCloseTo(0.2, 2);
    expect(Math.max(...l)).toBeLessThanOrEqual(1);
  });
  it('table combines master then per-channel', () => {
    const t = curvesTable({ ...defaultCurves(), master: [[0, 1], [1, 0]] });
    expect(t[0]).toBe(255); expect(t[255 * 4]).toBe(0); expect(t[3]).toBe(255);
  });
});

describe('effect registry', () => {
  it('has unique types and every pixel/spatial effect has GLSL', () => {
    expect(new Set(EFFECTS.map((e) => e.type)).size).toBe(EFFECTS.length);
    expect(EFFECTS.length).toBeGreaterThanOrEqual(28);
    for (const e of EFFECTS) { if (e.mode !== 'custom') expect(e.glsl).toBeTruthy(); else expect(e.run).toBeTruthy(); }
  });
  it('createEffect builds animatable props with defaults; vec2 centres on the comp', () => {
    const c = createEffect('ripple', { width: 1000, height: 400 }, 'x')!;
    expect(propOf({ props: c.props, transform: {} } as never, paramKey('x', 'center'))).toEqual({ value: [500, 200] });
    expect(Object.keys(c.props).length).toBe(EFFECT_BY_TYPE.get('ripple')!.params.length);
    expect(createEffect('nope', s, 'y')).toBeNull();
  });
});

describe('presets', () => {
  it('fade in keys opacity 0→base starting at the playhead', () => {
    const l = createLayer('solid', s, 0);
    const out = applyPreset(l, BUILTIN_PRESETS.find((p) => p.id === 'fade-in')!, 10, 30, mk, s);
    const keys = (out.transform.opacity as { keys: { t: number; v: number }[] }).keys;
    expect(keys.map((k) => k.t)).toEqual([10, 28]); expect(keys.map((k) => k.v)).toEqual([0, 100]);
  });
  it('relative values scale from the layer (slide / scale)', () => {
    const l = createLayer('solid', s, 0);
    const out = applyPreset(l, BUILTIN_PRESETS.find((p) => p.id === 'slide-up-in')!, 0, 30, mk, s);
    expect(evalProp(out.transform.position as never, 0)).toEqual([960, 660]);
    expect(evalProp(out.transform.position as never, 100)).toEqual([960, 540]);
    const pop = applyPreset({ ...l, transform: { ...l.transform, scale: { value: [50, 50] } } }, BUILTIN_PRESETS.find((p) => p.id === 'scale-pop')!, 0, 30, mk, s);
    expect(evalProp(pop.transform.scale as never, 0)).toEqual([0, 0]); expect(evalProp(pop.transform.scale as never, 99)).toEqual([50, 50]);
  });
  it('out presets end at the layer out point; effect presets add the effect', () => {
    const l = { ...createLayer('solid', s, 0), out: 100 };
    const out = applyPreset(l, BUILTIN_PRESETS.find((p) => p.id === 'fade-out')!, 0, 30, mk, s);
    expect((out.transform.opacity as { keys: { t: number }[] }).keys.at(-1)!.t).toBe(100);
    const blur = applyPreset(l, BUILTIN_PRESETS.find((p) => p.id === 'blur-in')!, 0, 30, mk, s);
    expect(blur.effects?.[0]?.type).toBe('gaussianBlur');
    const k = Object.keys(blur.props!).find((x) => x.endsWith(':radius'))!;
    expect(evalProp(blur.props![k] as never, 0)).toBe(40);
  });
  it('draw-on enables trim on shapes; every built-in applies cleanly to a shape layer', () => {
    const sh = createShapeLayer('rect', s, 0, [0, 0]);
    expect(applyPreset(sh, BUILTIN_PRESETS.find((p) => p.id === 'draw-on')!, 0, 30, mk, s).shape!.trim).toBe(true);
    for (const p of BUILTIN_PRESETS) expect(() => applyPreset(sh, p, 5, 30, mk, s)).not.toThrow();
  });
  it('presetFromLayer round-trips: save then apply reproduces the animation', () => {
    const l = createLayer('solid', s, 0);
    const animated = applyPreset(l, BUILTIN_PRESETS.find((p) => p.id === 'blur-in')!, 20, 30, mk, s);
    const pr = presetFromLayer(animated, 'mine', 30, 'u1')!;
    expect(pr.targets.some((t) => t.prop === 'fx:@gaussianBlur:radius')).toBe(true);
    const again = applyPreset(createLayer('solid', s, 1), pr, 0, 30, mk, s);
    const k = Object.keys(again.props!).find((x) => x.endsWith(':radius'))!;
    expect(evalProp(again.props![k] as never, 0)).toBe(40); expect(evalProp(again.props![k] as never, 100)).toBe(0);
    expect(presetFromLayer(l, 'none', 30, 'u2')).toBeNull();
  });
});
