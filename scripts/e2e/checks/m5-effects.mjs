const near = (a, b, tol, what) => { if (Math.abs(a - b) > tol) throw new Error(`${what}: got ${a}, expected ${b}±${tol}`); };

export const checks = [{
  name: 'colour effects: invert, brightness, curves (identity / inverted)',
  async run({ page }) {
    const px = (layerOpts, fx, data, pts = [[32, 32]], opts = {}) => page.evaluate(([lo, fx, data, pts, opts]) => T.draw([T.layer('solid', { ...lo, extra: T.fx(fx, data) })], opts, pts), [layerOpts, fx, data, pts, opts]);
    near((await px({ color: [1, 1, 1, 1] }, [['invert']]))[0][0], 0, 2, 'invert white');
    near((await px({ color: [0.2, 0.2, 0.2, 1] }, [['brightnessContrast', { brightness: 50 }]]))[0][0], 178, 3, 'brightness');
    near((await px({ color: [0.3, 0.6, 0.9, 1] }, [['curves']], [{ master: [[0, 0], [1, 1]], r: [[0, 0], [1, 1]], g: [[0, 0], [1, 1]], b: [[0, 0], [1, 1]] }]))[0][0], 77, 3, 'identity curve');
    const inv = [[0, 1], [1, 0]], id = [[0, 0], [1, 1]];
    near((await px({ color: [0.3, 0.6, 0.9, 1] }, [['curves']], [{ master: inv, r: id, g: id, b: id }]))[0][0], 255 - 77, 4, 'inverted curve');
    near((await px({ color: [0.5, 0.5, 0.5, 1] }, [['exposure', { exposure: 1 }]]))[0][0], 255, 3, 'exposure +1 stop');
  },
}, {
  name: 'uber-shader fusion matches separate passes (±4/255)',
  async run({ page }) {
    const [fused, split] = await page.evaluate(() => {
      const list = [['hueSaturation', { hue: 90, saturation: 30 }], ['levels', { gamma: 1.4, inBlack: 5 }], ['tint', { amount: 40 }], ['invert']];
      const base = { color: [0.8, 0.4, 0.2, 1] };
      const a = T.draw([T.layer('solid', { ...base, extra: T.fx(list) })], {}, [[10, 10], [50, 50]]);
      // split: one effect per adjustment layer, each its own pass
      const adjs = list.map((e) => T.layer('adjustment', { extra: T.fx([e]) })).reverse();
      const b = T.draw([...adjs, T.layer('solid', base)], {}, [[10, 10], [50, 50]]);
      return [a, b];
    });
    for (let i = 0; i < 2; i++) for (let c = 0; c < 3; c++) near(fused[i][c], split[i][c], 4, `pixel ${i} channel ${c}`);
  },
}, {
  name: 'blur, glow and drop shadow spread beyond the layer',
  async run({ page }) {
    const r = await page.evaluate(() => {
      const sq = (x, y, w, color, fx) => T.layer('solid', { w, h: w, pos: [x, y], color, extra: T.fx(fx) });
      return {
        blur: T.draw([sq(0, 0, 32, [1, 1, 1, 1], [['gaussianBlur', { radius: 10 }]])], {}, [[5, 16], [31, 16], [36, 16], [60, 16]]),
        glow: T.draw([sq(24, 24, 16, [1, 1, 1, 1], [['glow', { threshold: 0, radius: 12, intensity: 250 }]])], {}, [[32, 32], [18, 32], [2, 2]]),
        shadow: T.draw([sq(16, 16, 16, [1, 0, 0, 1], [['dropShadow', { distance: 14, softness: 4, opacity: 100, angle: 90 }]])], { bg: [0.6, 0.6, 0.6, 1] }, [[24, 24], [24, 36], [24, 3]]),
      };
    });
    near(r.blur[0][0], 255, 6, 'blur interior'); if (!(r.blur[2][0] > 5 && r.blur[2][0] < 120)) throw new Error('blur outside edge ' + r.blur[2][0]); near(r.blur[3][0], 0, 2, 'blur far');
    if (!(r.glow[1][0] > 25)) throw new Error('glow did not spread: ' + r.glow[1][0]); near(r.glow[2][0], 0, 3, 'glow far corner');
    near(r.shadow[0][0], 255, 3, 'shadow keeps the layer'); if (!(r.shadow[1][1] < 100)) throw new Error('no shadow below: ' + r.shadow[1][1]); near(r.shadow[2][1], 153, 3, 'no shadow above');
  },
}, {
  name: 'adjustment layer with effects only changes layers below it',
  async run({ page }) {
    const r = await page.evaluate(() => {
      const red = T.layer('solid', { w: 32, h: 64, color: [1, 0, 0, 1] });
      const above = T.layer('solid', { w: 16, h: 16, pos: [48, 0], color: [0, 1, 0, 1] });
      const adj = T.layer('adjustment', { extra: T.fx([['invert']]) });
      return T.draw([above, adj, red], { bg: [0, 0, 0, 1] }, [[10, 10], [60, 5], [45, 40]]);
    });
    near(r[0][0], 0, 2, 'red → cyan (R)'); near(r[0][1], 255, 2, 'red → cyan (G)');
    near(r[1][1], 255, 2, 'layer above untouched'); near(r[1][0], 0, 2, 'layer above untouched R');
    near(r[2][0], 255, 2, 'black bg inverted to white');
  },
}, {
  name: 'linear-light compositing changes mixes as expected',
  async run({ page }) {
    const mix = (linear) => page.evaluate((linear) => T.draw([T.layer('solid', { color: [1, 1, 1, 1], opacity: 50 })], { linear }, [[32, 32]])[0][0], linear);
    near(await mix(false), 128, 3, 'sRGB mix'); near(await mix(true), 188, 3, 'linear mix');
    const fxLin = await page.evaluate(() => T.draw([T.layer('solid', { color: [0.5, 0.5, 0.5, 1], extra: T.fx([['gaussianBlur', { radius: 6 }], ['hueSaturation']]) })], { linear: true }, [[32, 32]])[0][0]);
    near(fxLin, 128, 4, 'effects keep colour in linear mode');
  },
}, {
  name: 'UI: effects panel and presets',
  async run({ page }) {
    await page.click('text=＋ Solid');
    await page.click('button[role=tab]:has-text("effects")');
    await page.selectOption('select[aria-label="Add effect"]', 'gaussianBlur');
    await page.waitForSelector('.fx');
    await page.locator('.fx button[aria-label^="Animate"]').first().click();
    await page.click('button[role=tab]:has-text("presets")');
    await page.click('button:has-text("Fade In")');
    await page.keyboard.press('Home');
    const rows = await page.locator('.tl-row.sub').count();
    if (rows < 2) throw new Error('expected animated rows for blur + opacity, got ' + rows);
    const labels = await page.locator('.tl-row.sub .propname').allTextContents();
    if (!labels.some((t) => t.includes('Gaussian Blur'))) throw new Error('missing effect row label: ' + labels);
    await page.click('button:has-text("Blur In")');
  },
}];
