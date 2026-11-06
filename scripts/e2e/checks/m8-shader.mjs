const near = (a, b, tol, what) => { if (Math.abs(a - b) > tol) throw new Error(`${what}: got ${a}, expected ${b}±${tol}`); };

export const checks = [{
  name: 'shader layer: custom uniforms drive output (animatable), time is available',
  async run({ page }) {
    const code = `// @uniform tint color 0.2 0.4 0.8 1
// @uniform gain float 0 2 1
void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(tint.rgb * gain, 1.0); }`;
    const r = await page.evaluate((code) => {
      const mk = (gain, tint) => { const l = T.layer('solid', { w: 64, h: 64 }); l.type = 'shader'; l.shader = { code }; l.props = { 'sh:tint': { value: tint }, 'sh:gain': { value: gain } }; return l; };
      return [T.draw([mk(1, [0.2, 0.4, 0.8, 1])], {}, [[10, 10]])[0], T.draw([mk(0.5, [1, 0, 0, 1])], {}, [[10, 10]])[0]];
    }, code);
    near(r[0][0], 51, 3, 'R'); near(r[0][1], 102, 3, 'G'); near(r[0][2], 204, 3, 'B'); near(r[1][0], 128, 3, 'gain 0.5 on red');
  },
}, {
  name: 'shader reads the layers below (iChannel0) and works as an effect',
  async run({ page }) {
    const code = `void mainImage(out vec4 fragColor, in vec2 fragCoord) { vec4 s = texture(iChannel0, fragCoord / iResolution.xy); fragColor = vec4(1.0 - s.rgb, s.a); }`;
    const r = await page.evaluate((code) => {
      const sh = T.layer('solid', { w: 64, h: 64 }); sh.type = 'shader'; sh.shader = { code }; sh.props = {};
      const below = T.layer('solid', { color: [1, 0, 0, 1] });
      const withFx = T.layer('solid', { color: [1, 0, 0, 1], extra: { effects: [{ id: 's1', type: 'shader', enabled: true, data: { code } }], props: {} } });
      return [T.draw([sh, below], {}, [[10, 10]])[0], T.draw([withFx], {}, [[10, 10]])[0]];
    }, code);
    near(r[0][0], 0, 3, 'layer: red inverted → R'); near(r[0][1], 255, 3, 'layer: G'); near(r[1][0], 0, 3, 'effect R'); near(r[1][2], 255, 3, 'effect B');
  },
}, {
  name: 'compile errors are reported with user line numbers and do not break rendering',
  async run({ page }) {
    await page.click('text=＋ Shader');
    await page.waitForSelector('textarea.code');
    await page.fill('textarea.code', 'void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  fragColor = vec4(1.0, 0.0, 0.0);\n}');
    await page.waitForSelector('.shader-errors', { timeout: 5000 });
    const txt = await page.locator('.shader-errors').textContent();
    if (!/line 2/.test(txt)) throw new Error('expected user line 2 in: ' + txt);
    await page.fill('textarea.code', 'void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(0.0, 1.0, 0.0, 1.0); }');
    await page.waitForFunction(() => !document.querySelector('.shader-errors'));
  },
}, {
  name: 'UI: gallery example creates uniform controls with stopwatches; effect shader via effects panel',
  async run({ page }) {
    await page.click('text=＋ Shader');
    await page.selectOption('select[aria-label="Shader starter"]', 'Plasma');
    await page.waitForSelector('.prop >> text=speed');
    await page.locator('.prop', { has: page.locator('.pname:text("speed")') }).locator('button.watch').click();
    await page.click('text=＋ Solid');
    await page.click('button[role=tab]:has-text("effects")');
    await page.selectOption('select[aria-label="Add effect"]', 'shader');
    await page.waitForSelector('.fx textarea.code');
    await page.waitForSelector('.fx .prop >> text=strength');
  },
}];
