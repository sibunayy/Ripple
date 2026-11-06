import { BLEND_MODES, compositePx } from '../../../src/render/blend.ts';

const pairs = [[[0.6, 0.3, 0.8], [0.2, 0.75, 0.4]], [[0.1, 0.9, 0.5], [0.8, 0.2, 0.3]], [[0.5, 0.5, 0.5], [0.7, 0.6, 0.1]]];
const OPACITY = 0.8;

export const checks = [{
  name: 'all blend modes match the CPU reference (±3/255)',
  async run({ page }) {
    const bad = [];
    for (const m of BLEND_MODES) {
      if (m.id === 'dissolve') continue;
      for (const [cb, cs] of pairs) {
        const [px] = await page.evaluate(([mode, cb, cs, op]) =>
          T.draw([T.layer('solid', { color: [...cs, 1], opacity: op * 100, extra: { blend: mode } })], { bg: [...cb, 1] }, [[32, 32]]), [m.id, cb, cs, OPACITY]);
        const exp = compositePx(m.id, [cs[0] * OPACITY, cs[1] * OPACITY, cs[2] * OPACITY, OPACITY], [...cb, 1]);
        const got = px.slice(0, 3).map((v) => v / 255);
        const err = Math.max(...got.map((g, i) => Math.abs(g - exp[i])));
        if (err > 3 / 255 + 1e-6) bad.push(`${m.id}: got ${got.map((v) => v.toFixed(3))} expected ${exp.slice(0, 3).map((v) => v.toFixed(3))}`);
      }
    }
    if (bad.length) throw new Error(bad.join('\n'));
  },
}, {
  name: 'dissolve is deterministic and binary',
  async run({ page }) {
    const run = () => page.evaluate(() => T.draw([T.layer('solid', { color: [1, 1, 1, 1], opacity: 50, extra: { blend: 'dissolve' } })], { bg: [0, 0, 0, 1] },
      Array.from({ length: 64 }, (_, i) => [i, 10])));
    const a = await run(), b = await run();
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('not deterministic');
    const vals = new Set(a.map((p) => p[0]));
    if (![...vals].every((v) => v === 0 || v === 255) || vals.size < 2) throw new Error('expected a mix of 0/255, got ' + [...vals]);
  },
}];
