import { describe, expect, it } from 'vitest';
import { bezierEase, evalProp, removeKey, setKey, toggleAnimated, writeProp } from '../src/anim/interp';
import { evaluate, hitTest, reparent, wouldCycle } from '../src/eval/evaluate';
import { apply, compose, decompose, invert, mul } from '../src/eval/affine';
import { History } from '../src/model/history';
import { createLayer, type Layer, type Prop } from '../src/model/layer';
import { createProject } from '../src/model/project';

const s = createProject().settings; // 1920×1080
const mk = (type: Layer['type'] = 'solid', i = 0) => createLayer(type, s, i);
const close = (a: number, b: number, e = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(e);

describe('interpolation', () => {
  it('bezier endpoints and symmetry', () => {
    close(bezierEase(0.42, 0, 0.58, 1, 0), 0); close(bezierEase(0.42, 0, 0.58, 1, 1), 1);
    close(bezierEase(0.42, 0, 0.58, 1, 0.5), 0.5, 1e-4);
    close(bezierEase(0, 0, 1, 1, 0.3), 0.3, 1e-4); // linear control points
  });
  it('linear, hold and vector keyframes', () => {
    const lin = { keys: [{ t: 0, v: 0, ease: 'linear' as const }, { t: 10, v: 100, ease: 'linear' as const }] };
    expect(evalProp(lin, -5)).toBe(0); expect(evalProp(lin, 5)).toBe(50); expect(evalProp(lin, 99)).toBe(100);
    const hold = { keys: [{ t: 0, v: 1, ease: 'hold' as const }, { t: 10, v: 9, ease: 'linear' as const }] };
    expect(evalProp(hold, 9.9)).toBe(1); expect(evalProp(hold, 10)).toBe(9);
    const vec = { keys: [{ t: 0, v: [0, 10], ease: 'linear' as const }, { t: 10, v: [10, 20], ease: 'linear' as const }] };
    expect(evalProp(vec, 5)).toEqual([5, 15]);
  });
  it('set/remove/toggle keys and auto-key writes', () => {
    let p: Prop<number> = toggleAnimated<number>({ value: 5 }, 10);
    expect(p).toMatchObject({ keys: [{ t: 10, v: 5 }] });
    p = writeProp(p, 20, 15);
    expect(evalProp(p, 20)).toBe(15);
    p = setKey(p, 10, 6); expect(evalProp(p, 10)).toBe(6);
    expect(removeKey(p, 10)).toMatchObject({ keys: [{ t: 20 }] });
    expect(removeKey(removeKey(p, 10), 20)).toEqual({ value: 15 });
    expect(toggleAnimated(p, 10)).toEqual({ value: 6 });
    expect(writeProp({ value: 1 }, 5, 2)).toEqual({ value: 2 });
  });
});

describe('affine', () => {
  it('compose maps anchor to position', () => {
    const m = compose([300, 200], 30, [150, 50], [40, 20]);
    const [x, y] = apply(m, 40, 20); close(x, 300); close(y, 200);
  });
  it('invert and decompose round-trip', () => {
    const m = compose([10, 20], 40, [120, 80], [5, 5]);
    const id = mul(m, invert(m)!); [1, 0, 0, 1, 0, 0].forEach((v, i) => close(id[i]!, v));
    const d = decompose(m, [5, 5]);
    close(d.position[0], 10); close(d.position[1], 20); close(d.rotation, 40, 1e-4); close(d.scale[0], 120, 1e-4); close(d.scale[1], 80, 1e-4);
  });
});

describe('evaluate', () => {
  it('centres a solid and respects in/out + visibility', () => {
    const l = { ...mk(), in: 10, out: 20 };
    const [r] = evaluate([l], 5)!; expect(r!.active).toBe(false);
    expect(evaluate([l], 10)[0]!.active).toBe(true);
    expect(evaluate([l], 20)[0]!.active).toBe(false);
    expect(evaluate([{ ...l, visible: false }], 10)[0]!.active).toBe(false);
    const c = apply(evaluate([l], 10)[0]!.world, 960, 540); close(c[0], 960); close(c[1], 540);
  });
  it('children inherit parent transform but not opacity', () => {
    const parent: Layer = { ...mk('null', 0), id: 'p', transform: { ...mk('null').transform, position: { value: [100, 100] }, anchor: { value: [0, 0] }, scale: { value: [200, 200] }, opacity: { value: 50 } } };
    const child: Layer = { ...mk('null', 1), id: 'c', parent: 'p', transform: { ...mk('null').transform, position: { value: [10, 0] }, anchor: { value: [0, 0] } } };
    const r = evaluate([child, parent], 0);
    const [x, y] = apply(r[0]!.world, 0, 0); close(x, 120); close(y, 100); // 100 + 10*2
    expect(r[0]!.opacity).toBe(1);
  });
  it('terminates on a parent cycle', () => {
    const a = { ...mk('null', 0), id: 'a', parent: 'b' }, b = { ...mk('null', 1), id: 'b', parent: 'a' };
    expect(() => evaluate([a, b], 0)).not.toThrow();
  });
  it('detects cycles', () => {
    const a = { ...mk('null', 0), id: 'a' }, b = { ...mk('null', 1), id: 'b', parent: 'a' }, c = { ...mk('null', 2), id: 'c', parent: 'b' };
    expect(wouldCycle([a, b, c], 'a', 'c')).toBe(true);
    expect(wouldCycle([a, b, c], 'a', 'a')).toBe(true);
    expect(wouldCycle([a, b, c], 'c', 'a')).toBe(false);
  });
  it('hit-tests topmost active layer', () => {
    const top = { ...mk('solid', 0), id: 't', size: [100, 100] as [number, number], transform: { ...mk().transform, position: { value: [50, 50] as [number, number] }, anchor: { value: [50, 50] as [number, number] } } };
    const bottom = { ...mk('solid', 1), id: 'b' };
    const r = evaluate([top, bottom], 0);
    expect(hitTest(r, 50, 50)).toBe('t'); expect(hitTest(r, 500, 500)).toBe('b'); expect(hitTest(r, 5000, 5000)).toBeNull();
  });
  it('reparent keeps visual position', () => {
    const parent: Layer = { ...mk('null', 0), id: 'p', transform: { ...mk('null').transform, position: { value: [300, 300] }, rotation: { value: 90 }, scale: { value: [200, 200] } } };
    const child: Layer = { ...mk('null', 1), id: 'c' };
    const before = apply(evaluate([child, parent], 0)[0]!.world, 20, 30);
    const out = reparent([child, parent], 'c', 'p', 0);
    const after = apply(evaluate(out, 0).find((r) => r.layer.id === 'c')!.world, 20, 30);
    close(before[0], after[0], 1e-6); close(before[1], after[1], 1e-6);
    expect(out.find((l) => l.id === 'c')!.parent).toBe('p');
    const unparented = reparent(out, 'c', undefined, 0);
    expect(unparented.find((l) => l.id === 'c')!.parent).toBeUndefined();
    const back = apply(evaluate(unparented, 0).find((r) => r.layer.id === 'c')!.world, 20, 30);
    close(before[0], back[0], 1e-6);
  });
});

describe('history', () => {
  it('undo/redo and coalescing', () => {
    const h = new History<number>(); 
    h.record(0, 'a', 'drag', 0); h.record(1, 'a', 'drag', 100); h.record(2, 'a', 'drag', 200);
    expect(h.undo(3)).toBe(0); expect(h.canUndo).toBe(false);
    expect(h.redo(0)).toBe(3); expect(h.canRedo).toBe(false);
    h.record(3, 'b', 'drag', 5000); h.record(4, 'c', undefined, 5001);
    expect(h.undo(5)).toBe(4); expect(h.undo(4)).toBe(3);
  });
  it('new edit clears redo, limit caps stack', () => {
    const h = new History<number>(2);
    h.record(0, 'a'); h.record(1, 'b'); h.record(2, 'c');
    expect(h.undo(3)).toBe(2); expect(h.undo(2)).toBe(1); expect(h.undo(1)).toBeUndefined();
    h.record(9, 'd'); expect(h.canRedo).toBe(false);
  });
});

import { EASINGS } from '../src/anim/easings';
import { applyEase } from '../src/anim/interp';
import { copyKeys, deleteKeys, moveKeys, nextKeyTime, pasteKeys, pruneRefs, setEaseOnKeys, setKeyValue } from '../src/anim/keys';
import { workRange } from '../src/model/project';

const animated = (): Layer => {
  const l = mk();
  return { ...l, id: 'L', transform: { ...l.transform, position: { keys: [
    { t: 0, v: [0, 0], ease: 'linear' }, { t: 10, v: [100, 50], ease: 'linear' }, { t: 20, v: [200, 0], ease: 'linear' } ] } } };
};
const keysOf = (l: Layer) => (l.transform.position as { keys: { t: number; v: number[] }[] }).keys;

describe('easing library', () => {
  it('has 30 curves + basics, all hit 0 and 1', () => {
    expect(EASINGS.filter((e) => e.group !== 'Basic')).toHaveLength(30);
    for (const e of EASINGS) {
      if (e.ease === 'hold') continue;
      close(applyEase(e.ease, 0), 0); close(applyEase(e.ease, 1), 1, 1e-4);
    }
  });
  it('shapes: in is slow at start, out is fast at start, back overshoots, bounce stays in [0,1]', () => {
    const get = (n: string) => EASINGS.find((e) => e.name === n)!.ease;
    expect(applyEase(get('Cubic In'), 0.3)).toBeLessThan(0.3);
    expect(applyEase(get('Cubic Out'), 0.3)).toBeGreaterThan(0.3);
    expect(applyEase(get('Back Out'), 0.7)).toBeGreaterThan(1);
    for (let u = 0; u <= 1; u += 0.05) { const v = applyEase(get('Bounce Out'), u); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1.0001); }
    expect(applyEase(get('Elastic Out'), 0.2)).toBeGreaterThan(1);
  });
});

describe('key operations', () => {
  const r = (t: number) => ({ layer: 'L', prop: 'position' as const, t });
  it('moves keys, replacing what they land on, and clamps', () => {
    const { layers, refs } = moveKeys([animated()], [r(10)], 10);
    expect(keysOf(layers[0]!).map((k) => k.t)).toEqual([0, 20]);
    expect(keysOf(layers[0]!)[1]!.v).toEqual([100, 50]);
    expect(refs).toEqual([r(20)]);
    expect(moveKeys([animated()], [r(0)], -5).refs).toEqual([r(0)]);
    expect(keysOf(moveKeys([animated()], [r(0), r(10)], 5, 20).layers[0]!).map((k) => k.t)).toEqual([5, 15, 20]);
  });
  it('deletes keys; deleting the last bakes a static value', () => {
    const one = deleteKeys([animated()], [r(10)]);
    expect(keysOf(one[0]!).map((k) => k.t)).toEqual([0, 20]);
    const none = deleteKeys([animated()], [r(0), r(10), r(20)]);
    expect(none[0]!.transform.position).toEqual({ value: [200, 0] });
  });
  it('sets ease and component values', () => {
    const e = setEaseOnKeys([animated()], [r(0)], 'hold');
    expect((e[0]!.transform.position as any).keys[0].ease).toBe('hold');
    const v = setKeyValue([animated()], r(10), 1, 999);
    expect(keysOf(v[0]!)[1]!.v).toEqual([100, 999]);
  });
  it('copy/paste preserves relative timing and ease', () => {
    const clip = copyKeys([animated()], [r(10), r(20)]);
    expect(clip.map((c) => c.dt)).toEqual([0, 10]);
    const target = { ...mk(), id: 'M' };
    const { layers, refs } = pasteKeys([target], 'M', clip, 100);
    expect(keysOf(layers[0]!).map((k) => k.t)).toEqual([100, 110]);
    expect(refs).toHaveLength(2);
    expect(pruneRefs(layers, [...refs, { layer: 'M', prop: 'position', t: 5 }])).toHaveLength(2);
  });
  it('finds next/prev key', () => {
    const L = [animated()];
    expect(nextKeyTime(L, ['L'], 0, 1)).toBe(10); expect(nextKeyTime(L, ['L'], 10, -1)).toBe(0);
    expect(nextKeyTime(L, ['L'], 20, 1)).toBeNull(); expect(nextKeyTime(L, ['x'], 0, 1)).toBeNull();
  });
});

describe('work area', () => {
  it('defaults to the full duration and clamps', () => {
    const p = createProject();
    expect(workRange(p)).toEqual([0, 300]);
    expect(workRange({ ...p, workArea: [50, 100] })).toEqual([50, 100]);
    expect(workRange({ ...p, workArea: [500, 900] })).toEqual([299, 300]);
  });
});

describe('lock / solo', () => {
  const a = { ...mk('solid', 0), id: 'a' }, b = { ...mk('solid', 1), id: 'b' };
  it('solo limits rendering to soloed layers', () => {
    expect(evaluate([a, b], 0).every((r) => r.active)).toBe(true);
    const r = evaluate([a, { ...b, solo: true }], 0);
    expect(r.map((x) => x.active)).toEqual([false, true]);
  });
  it('locked layers are not hit-testable', () => {
    const at = (l: Layer[]) => hitTest(evaluate(l, 0), s.width / 2, s.height / 2, 0);
    expect(at([a, b])).toBe('a');
    expect(at([{ ...a, locked: true }, b])).toBe('b');
  });
});
