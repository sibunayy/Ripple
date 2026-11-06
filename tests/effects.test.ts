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

import { parseCube, identityLut, lutRGBA, fromB64 } from '../src/render/lut';
describe('.cube LUTs', () => {
  const cube = (n: number, extra = '') => `TITLE "T"\nLUT_3D_SIZE ${n}\n${extra}${Array.from({ length: n ** 3 }, (_, i) => `${(i % n) / (n - 1)} ${(Math.floor(i / n) % n) / (n - 1)} ${Math.floor(i / n / n) / (n - 1)}`).join('\n')}`;
  it('parses size, title and data (R fastest)', () => {
    const l = parseCube(cube(3)); expect(l.size).toBe(3); expect(l.name).toBe('T');
    const b = fromB64(l.b64); expect(b.length).toBe(27 * 3); expect(Array.from(b.slice(3, 6))).toEqual([128, 0, 0]);
  });
  it('honours DOMAIN_MIN/MAX and rejects 1D / truncated files', () => {
    const l = parseCube(`LUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 2 2 2\n${Array(8).fill('2 1 0').join('\n')}`);
    expect(Array.from(fromB64(l.b64).slice(0, 3))).toEqual([255, 128, 0]);
    expect(() => parseCube('LUT_1D_SIZE 4\n0 0 0')).toThrow(/1D/);
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 0')).toThrow(/entries/);
    expect(() => parseCube('hello')).toThrow();
  });
  it('identity LUT expands to RGBA with opaque alpha', () => {
    const i = identityLut(), rgba = lutRGBA(i);
    expect(rgba.length).toBe(i.size ** 3 * 4); expect(rgba[3]).toBe(255); expect(rgba[rgba.length - 2]).toBe(255);
  });
});

import { influence, unitMap, TEMPLATES } from '../src/text/animate';
import { parseUniforms, syncUniformProps, wrapShader, formatShaderLog } from '../src/render/shader';
describe('text animators', () => {
  it('unitMap: chars skip newlines, words group letters, lines group by line', () => {
    expect(unitMap('ab cd', 'chars')).toEqual({ idx: [0, 1, 2, 3, 4], count: 5 });
    const w = unitMap('ab cd', 'words'); expect(w.count).toBe(2); expect(w.idx[0]).toBe(0); expect(w.idx[3]).toBe(1);
    const l = unitMap('ab\ncd', 'lines'); expect(l.idx).toEqual([0, 0, -1, 1, 1]); expect(l.count).toBe(2);
  });
  it('ramp reveals left→right as the window sweeps; square marks the window; triangle peaks in the middle', () => {
    const at = (off: number) => [0, 1, 2, 3].map((i) => influence(i, 4, 0, 25, off, 'ramp'));
    expect(at(-100)).toEqual([1, 1, 1, 1]); expect(at(100)).toEqual([0, 0, 0, 0]);
    expect(at(25)[0]).toBe(0); expect(at(25)[3]).toBe(1);
    expect([0, 1, 2, 3].map((i) => influence(i, 4, 25, 50, 0, 'square'))).toEqual([0, 1, 1, 0].map((v, i) => (i === 1 ? 1 : i === 2 ? 0 : 0)));
    expect(influence(2, 5, 0, 100, 0, 'triangle')).toBeCloseTo(1, 1); expect(influence(0, 5, 0, 100, 0, 'triangle')).toBeLessThan(0.3);
  });
  it('templates are well formed', () => { for (const t of TEMPLATES) { expect(t.end).toBeGreaterThan(t.start); expect(t.secondsPer).toBeGreaterThan(0); } });
});

describe('shader helpers', () => {
  it('parseUniforms reads types, ranges and defaults; ignores bad/duplicate/reserved names', () => {
    const u = parseUniforms(`// @uniform speed float 0 4 1.5\n// @uniform c color 1 0 0 0.5\n// @uniform p vec2 3 4\n// @uniform on bool 1\n// @uniform speed float 0 1 0\n// @uniform iTime float 0 1 0\n// @uniform 9bad float`);
    expect(u.map((x) => x.name)).toEqual(['speed', 'c', 'p', 'on']);
    expect(u[0]).toMatchObject({ type: 'float', min: 0, max: 4, def: 1.5 }); expect(u[1]!.def).toEqual([1, 0, 0, 0.5]); expect(u[2]!.def).toEqual([3, 4]); expect(u[3]!.def).toBe(1);
  });
  it('syncUniformProps keeps existing values, adds new, drops stale, leaves other props', () => {
    const next = syncUniformProps({ 'sh:a': { value: 5 }, 'sh:gone': { value: 1 }, 'fill.color': { value: [1, 1, 1, 1] } }, 'sh:', parseUniforms('// @uniform a float 0 1 0.5\n// @uniform b float 0 1 0.25'));
    expect(next['sh:a']).toEqual({ value: 5 }); expect(next['sh:b']).toEqual({ value: 0.25 }); expect(next['sh:gone']).toBeUndefined(); expect(next['fill.color']).toBeDefined();
  });
  it('error lines are mapped to the user\'s code', () => {
    const w = wrapShader('line1\nline2', []);
    const idx = w.split('\n').findIndex((l) => l === 'line2') + 1;
    expect(formatShaderLog(`ERROR: 0:${idx}: 'x' : bad`, w)[0]).toContain('line 2');
  });
});
