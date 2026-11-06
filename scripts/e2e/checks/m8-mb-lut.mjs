import { parseCube } from '../../../src/render/lut.ts';
const near = (a, b, tol, what) => { if (Math.abs(a - b) > tol) throw new Error(`${what}: got ${a}, expected ${b}±${tol}`); };

// inverting 2×2×2 cube: out = 1 - in
const cube = ['TITLE "Invert"', 'LUT_3D_SIZE 2', ...[0, 1].flatMap((b) => [0, 1].flatMap((g) => [0, 1].map((r) => `${1 - r} ${1 - g} ${1 - b}`)))].join('\n');

export const checks = [{
  name: 'motion blur: flagged layers smear across the shutter interval, unflagged layers stay sharp',
  async run({ page }) {
    const r = await page.evaluate(() => {
      const mk = (flag) => {
        const l = T.layer('solid', { w: 8, h: 64, color: [1, 1, 1, 1] });
        l.transform.position = { keys: [{ t: 0, v: [0, 0], ease: 'linear' }, { t: 8, v: [64, 0], ease: 'linear' }] };
        if (flag) l.motionBlur = true;
        return l;
      };
      const R = window.__ripple.renderer;
      const run = (flag, mb) => {
        R.resize(64, 64);
        R.render([mk(flag)], { width: 64, height: 64, bg: [0, 0, 0, 1], t: 4, comps: {}, fps: 30, motionBlur: mb });
        return [31, 34, 38, 50].map((x) => R.readPixel(x, 32)[0]);
      };
      return { plain: run(false, undefined), flaggedNoMb: run(true, undefined), blurred: run(true, { shutter: 360, samples: 16 }), unflagged: run(false, { shutter: 360, samples: 16 }) };
    });
    near(r.plain[0], 0, 2, 'x=31 sharp edge outside'); near(r.plain[1], 255, 2, 'x=34 inside');
    near(r.unflagged[0], 0, 2, 'unflagged layer ignores motion blur');
    if (!(r.blurred[0] > 30 && r.blurred[0] < 225)) throw new Error('left edge should be smeared, got ' + r.blurred[0]);
    if (!(r.blurred[2] > 30 && r.blurred[2] < 225)) throw new Error('right edge should be smeared, got ' + r.blurred[2]);
    near(r.blurred[3], 0, 2, 'far away stays black');
  },
}, {
  name: '3D LUT effect applies a .cube table (invert LUT)',
  async run({ page }) {
    const lut = parseCube(cube);
    const px = await page.evaluate(([lut]) => {
      const mk = (c) => T.draw([T.layer('solid', { color: [...c, 1], extra: T.fx([['lut3d']], [lut]) })], {}, [[32, 32]])[0];
      return [mk([1, 1, 1]), mk([0.8, 0.2, 0.4]), mk([0.5, 0.5, 0.5])];
    }, [lut]);
    near(px[0][0], 0, 3, 'white → black'); near(px[1][0], 51, 4, 'R 0.8 → 0.2'); near(px[1][1], 204, 4, 'G 0.2 → 0.8'); near(px[1][2], 153, 4, 'B 0.4 → 0.6'); near(px[2][0], 128, 4, 'mid grey stays');
  },
}];
