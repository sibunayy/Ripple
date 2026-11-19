import { describe, it, expect, beforeEach } from 'vitest';
import { bez, EASES } from '../../src/anim/easing';
import { val } from '../../src/anim/interpolate';
import { pose, mat, world } from '../../src/anim/pose';
import { layers, setLayers } from '../../src/model/project';
import { st, an } from '../../src/model/schema';

const layer = (o: any = {}) => ({ id: 'a', name: 'A', type: 'rect', hue: '#fff', vis: true, lock: false, fx: [],
  p: { x: st(0), y: st(0), scale: st(100), rot: st(0), op: st(100), ax: st(0), ay: st(0), ts: st(0), te: st(100) }, ...o });

describe('bez (cubic-bezier easing)', () => {
  it('starts at 0 and ends at 1', () => {
    for (const a of Object.values(EASES)) { const e = bez(a as number[]); expect(e(0)).toBeCloseTo(0, 3); expect(e(1)).toBeCloseTo(1, 3); }
  });
  it('linear is the identity', () => { const e = bez([0, 0, 1, 1]); for (const t of [0.1, 0.25, 0.5, 0.9]) expect(e(t)).toBeCloseTo(t, 4); });
  it('matches the CSS ease curve at the midpoint', () => expect(bez([0.25, 0.1, 0.25, 1])(0.5)).toBeCloseTo(0.8024, 3));
  it('ease-out runs ahead of linear, ease-in behind', () => {
    expect(bez(EASES.out)(0.3)).toBeGreaterThan(0.3); expect(bez(EASES.in)(0.3)).toBeLessThan(0.3);
  });
  it('back overshoots past 1', () => { const e = bez(EASES.back); expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map(e))).toBeGreaterThan(1); });
});

describe('val (property value at a frame)', () => {
  it('returns the static value', () => expect(val(st(42), 10)).toBe(42));
  it('holds the first and last key outside the range', () => {
    const p = an([10, 0, 'linear'], [20, 100, 'linear']);
    expect(val(p, 0)).toBe(0); expect(val(p, 30)).toBe(100);
  });
  it('interpolates linearly between keys', () => expect(val(an([0, 0, 'linear'], [10, 100, 'linear']), 5)).toBeCloseTo(50, 2));
  it('hold keeps the value until the next key', () => {
    const p = an([0, 0, 'hold'], [10, 100, 'linear']);
    expect(val(p, 9.9)).toBe(0); expect(val(p, 10)).toBe(100);
  });
  it('uses the easing of the key it leaves', () => {
    const p = an([0, 0, 'out'], [10, 100, 'linear']);
    expect(val(p, 3)).toBeCloseTo(100 * bez(EASES.out)(0.3), 6);
  });
});

describe('pose, mat and world', () => {
  let saved: any;
  beforeEach(() => { saved = layers; return () => setLayers(saved); });

  it('reads the transform at a frame, with flips', () => {
    const q = pose(layer({ flipX: true, p: { ...layer().p, x: an([0, 0, 'linear'], [10, 200, 'linear']) } }), 5, 0);
    expect(q.x).toBeCloseTo(100, 3); expect(q.s).toBe(100); expect(q.fx).toBe(-1); expect(q.fy).toBe(1);
  });
  it('adds a spin behaviour as degrees per second', () => {
    const q = pose(layer({ mods: [{ kind: 'spin', tgt: 'rot', amp: 90, freq: 1, on: true }] }), 60, 0);
    expect(q.r).toBeCloseTo(180, 6); // 60 frames = 2 s at 30 fps
  });
  it('ignores a behaviour that is off', () => {
    expect(pose(layer({ mods: [{ kind: 'spin', tgt: 'rot', amp: 90, freq: 1, on: false }] }), 60, 0).r).toBe(0);
  });
  it('mat translates, rotates, scales, then offsets the anchor', () => {
    const m = mat({ x: 100, y: 50, r: 90, s: 200, ax: 10, ay: 0 });
    const p = m.transformPoint({ x: 10, y: 0 }); // the anchor lands on the position
    expect(p.x).toBeCloseTo(100, 6); expect(p.y).toBeCloseTo(50, 6);
    const q = m.transformPoint({ x: 11, y: 0 }); // one unit right becomes two units down
    expect(q.x).toBeCloseTo(100, 6); expect(q.y).toBeCloseTo(52, 6);
  });
  it('world follows the parent since the frame it was parented', () => {
    const parent = layer({ id: 'p', p: { ...layer().p, x: an([0, 0, 'linear'], [10, 100, 'linear']) } });
    const kid = layer({ id: 'k', parent: 'p', pt: 0, p: { ...layer().p, x: st(5) } });
    setLayers([parent, kid]);
    expect(world(kid, 0).e).toBeCloseTo(5, 6);
    expect(world(kid, 10).e).toBeCloseTo(105, 6);
  });
});
