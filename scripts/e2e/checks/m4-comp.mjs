const near = (a, b, tol, what) => { if (Math.abs(a - b) > tol) throw new Error(`${what}: got ${a}, expected ${b}±${tol}`); };
const RECT = { closed: true, nodes: [[16, 16], [48, 16], [48, 48], [16, 48]].map(([x, y]) => ({ p: [x, y], i: [0, 0], o: [0, 0] })) };
const mask = (o = {}) => ({ id: 'm1', name: 'Mask 1', mode: 'add', invert: false, path: RECT, ...o });
const IN = [32, 32], OUT = [5, 5];
const draw = (page, build, pts = [IN, OUT], opts = {}) => page.evaluate(([b, pts, opts]) => T.draw(eval(b)(T), opts, pts), [build.toString(), pts, opts]);

export const checks = [{
  name: 'masks: add / subtract / invert / opacity / feather',
  async run({ page }) {
    const run = (m, props = {}) => draw(page, `(T) => [T.layer('solid', { color: [1,1,1,1], extra: { masks: [${JSON.stringify(m)}], props: ${JSON.stringify(props)} } })]`.replace(/^/, '() =>').replace('() =>(T)', '(T)'), [IN, OUT]);
    // helper above is awkward; use explicit evaluate instead
    const ev = (m, props = {}) => page.evaluate(([m, props]) => T.draw([T.layer('solid', { color: [1, 1, 1, 1], extra: { masks: [m], props } })], {}, [[32, 32], [5, 5], [16, 32]]), [m, props]);
    let [i, o] = await ev(mask()); near(i[0], 255, 2, 'add inside'); near(o[0], 0, 2, 'add outside');
    [i, o] = await ev(mask({ mode: 'subtract' })); near(i[0], 0, 2, 'subtract inside'); near(o[0], 255, 2, 'subtract outside');
    [i, o] = await ev(mask({ invert: true })); near(i[0], 0, 2, 'invert inside'); near(o[0], 255, 2, 'invert outside');
    [i, o] = await ev(mask(), { 'mask:m1:opacity': { value: 50 } }); near(i[0], 128, 3, 'opacity inside');
    const [, , e] = await ev(mask(), { 'mask:m1:feather': { value: 20 } }); if (e[0] < 40 || e[0] > 215) throw new Error('feather edge should be mid-grey, got ' + e[0]);
    [i] = await ev(mask({ mode: 'intersect' })); near(i[0], 0, 2, 'intersect with empty first mask');
  },
}, {
  name: 'masks: combine (add then subtract) and animated shape',
  async run({ page }) {
    const sub = { id: 'm2', name: 'Mask 2', mode: 'subtract', invert: false, path: { closed: true, nodes: [[28, 28], [38, 28], [38, 38], [28, 38]].map(([x, y]) => ({ p: [x, y], i: [0, 0], o: [0, 0] })) } };
    const [a, b] = await page.evaluate(([m1, m2]) => T.draw([T.layer('solid', { color: [1, 1, 1, 1], extra: { masks: [m1, m2] } })], {}, [[32, 32], [20, 20]]), [mask(), sub]);
    near(a[0], 0, 2, 'hole'); near(b[0], 255, 2, 'ring');
    // keyframed path: grows from RECT at t=0 to a bigger rect at t=10
    const big = { closed: true, nodes: [[0, 0], [64, 0], [64, 64], [0, 64]].map(([x, y]) => ({ p: [x, y], i: [0, 0], o: [0, 0] })) };
    const anim = { ...RECT, keys: [{ t: 0, nodes: RECT.nodes }, { t: 10, nodes: big.nodes }] };
    const px = (t) => page.evaluate(([m, t]) => T.draw([T.layer('solid', { color: [1, 1, 1, 1], extra: { masks: [m] } })], { t }, [[8, 8]]), [mask({ path: anim }), t]);
    near((await px(0))[0][0], 0, 2, 't=0 corner outside'); near((await px(10))[0][0], 255, 2, 't=10 corner inside');
    const mid = (await px(5))[0][0]; if (mid !== 255 && mid !== 0) throw new Error('unexpected'); // 8,8 inside at t=5 (rect from 8..56)
  },
}, {
  name: 'track mattes: alpha, inverted, luma, clip-to-below',
  async run({ page }) {
    const scene = ([mode, clip]) => page.evaluate(([mode, clip]) => {
      const matteSrc = T.layer('solid', { id: 'mt', w: 32, h: 32, pos: [16, 16], color: [0.5, 0.5, 0.5, 1] });
      const consumer = T.layer('solid', { color: [1, 1, 1, 1], extra: clip ? { clip: true } : { matte: { layer: 'mt', mode } } });
      return T.draw(clip ? [consumer, matteSrc] : [consumer, matteSrc], {}, [[32, 32], [5, 5]]);
    }, [mode, clip]);
    let [i, o] = await scene(['alpha']); near(i[0], 255, 2, 'alpha in'); near(o[0], 0, 2, 'alpha out');
    [i, o] = await scene(['alphaInv']); near(i[0], 0, 2, 'inv in'); near(o[0], 255, 2, 'inv out');
    [i, o] = await scene(['luma']); near(i[0], 128 * 1, 6, 'luma in (matte luma 0.5)'); near(o[0], 0, 2, 'luma out');
    [i, o] = await scene(['alpha', true]); near(i[0], 255, 2, 'clip in'); near(o[0], 0, 2, 'clip out');
  },
}, {
  name: 'precomps render nested comps with transforms; adjustment layers pass through',
  async run({ page }) {
    const r = await page.evaluate(() => {
      const inner = T.layer('solid', { w: 32, h: 32, color: [1, 0, 0, 1] });
      const comps = { c1: { id: 'c1', name: 'C1', width: 32, height: 32, fps: 30, duration: 100, layers: [inner] } };
      const pre = (scale, pos = [16, 16]) => T.layer('precomp', { w: 32, h: 32, pos, scale: [scale, scale], extra: { precomp: { comp: 'c1', offset: 0 } } });
      const adj = T.layer('adjustment', { opacity: 100 });
      return [
        T.draw([pre(100)], { comps }, [[32, 32], [5, 5]]),
        T.draw([pre(200, [0, 0])], { comps }, [[5, 5], [60, 60]]),
        T.draw([adj, pre(100)], { comps }, [[32, 32], [5, 5]]),
      ];
    });
    near(r[0][0][0], 255, 2, 'precomp inside'); near(r[0][1][0], 0, 2, 'precomp outside');
    near(r[1][0][0], 255, 2, 'scaled precomp covers corner'); near(r[1][1][0], 255, 2, 'scaled precomp far corner');
    near(r[2][0][0], 255, 2, 'adjustment keeps content'); near(r[2][1][0], 0, 2, 'adjustment keeps background');
  },
}, {
  name: 'UI: blend select, add mask, adjustment, pre-compose and comp navigation',
  async run({ page }) {
    await page.click('text=＋ Solid'); await page.click('text=＋ Solid');
    await page.selectOption('select[aria-label="Blend mode"]', 'multiply');
    await page.click('text=＋ Rectangle');
    if (!(await page.locator('.mask').count())) throw new Error('mask not added');
    await page.click('text=＋ Adjust');
    if ((await page.locator('.layers li').count()) !== 3) throw new Error('expected 3 layers');
    await page.locator('button[aria-label="Pre-compose selected layers"]').click();
    if ((await page.locator('.layers li').count()) !== 3) throw new Error('precompose should replace 1 of 3 with 1');
    await page.click('text=Open composition');
    await page.waitForSelector('.crumb');
    await page.click('button[aria-label="Back to parent composition"]');
    if (await page.locator('.crumb').count()) throw new Error('should be back at root');
    await page.keyboard.press('Control+z');
  },
}];
