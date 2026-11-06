import { describe, expect, it } from 'vitest';
import { parseColor, parsePathD, parseTransform } from '../src/io/svg';
import { apply } from '../src/eval/affine';
import { flatten, pathBounds, polyLength } from '../src/shape/path';

describe('SVG path data', () => {
  it('absolute/relative lines and implicit lineto', () => {
    const [p] = parsePathD('M10 10 L 20 10 20 20 l -10 0 z');
    expect(p!.closed).toBe(true);
    expect(p!.nodes.map((n) => n.p)).toEqual([[10, 10], [20, 10], [20, 20], [10, 20]]);
    const [q] = parsePathD('m1 1 5 0 0 5');
    expect(q!.nodes.map((n) => n.p)).toEqual([[1, 1], [6, 1], [6, 6]]);
  });
  it('H/V and compact numbers (1.5.5 → 1.5 and .5, minus separators)', () => {
    const [p] = parsePathD('M0,0H10V5h-3.5.5');
    expect(p!.nodes.map((n) => n.p)).toEqual([[0, 0], [10, 0], [10, 5], [6.5, 5], [7, 5]]); // h-3.5 then implicit h.5
  });
  it('cubic and smooth cubic produce matching handles', () => {
    const [p] = parsePathD('M0 0 C 0 10, 10 10, 10 0 S 20 -10, 20 0');
    expect(p!.nodes.length).toBe(3);
    expect(p!.nodes[0]!.o).toEqual([0, 10]); expect(p!.nodes[1]!.i).toEqual([0, 10]);
    expect(p!.nodes[1]!.o).toEqual([0, -10]); // reflected control point
  });
  it('quadratics become cubics with the same curve', () => {
    const [p] = parsePathD('M0 0 Q 50 100 100 0');
    const b = pathBounds(p!)!;
    expect(b[3]).toBeCloseTo(50, 0); // quadratic peak at y=50
  });
  it('arcs: half circle has the right length and endpoint', () => {
    const [p] = parsePathD('M0 0 A 50 50 0 0 1 100 0');
    const last = p!.nodes[p!.nodes.length - 1]!.p;
    expect(last[0]).toBeCloseTo(100, 6); expect(last[1]).toBeCloseTo(0, 6);
    expect(polyLength(flatten(p!, 32))).toBeCloseTo(Math.PI * 50, 0);
    const [full] = parsePathD('M0 0 A 50 50 0 1 1 0.001 0');
    expect(polyLength(flatten(full!, 32))).toBeGreaterThan(Math.PI * 100 * 0.9);
  });
  it('arc flags may be packed without separators', () => {
    const [p] = parsePathD('M0 0a5 5 0 0110 0');
    expect(p!.nodes[p!.nodes.length - 1]!.p[0]).toBeCloseTo(10, 6);
  });
  it('multiple subpaths; closing back to the start merges the duplicate node', () => {
    const ps = parsePathD('M0 0 L10 0 L10 10 L0 0 Z M20 20 L30 20 L30 30');
    expect(ps.length).toBe(2); expect(ps[0]!.nodes.length).toBe(3); expect(ps[0]!.closed).toBe(true); expect(ps[1]!.closed).toBe(false);
  });
  it('rejects garbage', () => { expect(() => parsePathD('M 1 x')).toThrow(); });
});

describe('colour & transform parsing', () => {
  it('hex, short hex, rgb(), rgba(), names, none', () => {
    expect(parseColor('#f00')).toEqual([1, 0, 0, 1]);
    expect(parseColor('#00ff0080')!.map((v) => +v.toFixed(2))).toEqual([0, 1, 0, 0.5]);
    expect(parseColor('rgb(255, 0, 0)')).toEqual([1, 0, 0, 1]);
    expect(parseColor('rgba(0,0,255,0.5)')).toEqual([0, 0, 1, 0.5]);
    expect(parseColor('white')).toEqual([1, 1, 1, 1]);
    expect(parseColor('none')).toBeNull(); expect(parseColor('url(#g)')).toBeNull(); expect(parseColor(null)).toBeNull();
  });
  it('transform lists compose left to right', () => {
    const m = parseTransform('translate(10 20) scale(2)');
    expect(apply(m, 1, 1)).toEqual([12, 22]);
    const r = parseTransform('rotate(90)');
    expect(apply(r, 1, 0)[0]).toBeCloseTo(0, 9); expect(apply(r, 1, 0)[1]).toBeCloseTo(1, 9);
    const rc = parseTransform('rotate(180 5 5)');
    expect(apply(rc, 0, 0)[0]).toBeCloseTo(10, 9);
    expect(parseTransform('matrix(1 0 0 1 3 4)')).toEqual([1, 0, 0, 1, 3, 4]);
    expect(parseTransform(undefined)).toEqual([1, 0, 0, 1, 0, 0]);
  });
});
