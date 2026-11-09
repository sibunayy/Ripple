import { UI } from '../ui.mjs';
// Multi-layer selection (marquee, shift-toggle, select-all) and group move.
const setup = async (page) => {
  await page.click('text=＋ Solid'); await page.click('text=＋ Solid'); await page.click('text=＋ Solid');
  await page.evaluate(() => {
    const d = structuredClone(window.__ripple.doc());
    const spots = [[300, 300], [700, 300], [1500, 800]];
    d.layers.forEach((l, i) => { l.size = [200, 200]; l.transform.anchor = { value: [100, 100] }; l.transform.position = { value: spots[i] }; });
    window.__ripple.load(d);
  });
  await page.waitForTimeout(200);
};
const toScreen = (page, [x, y]) => page.evaluate(([x, y]) => {
  const r = document.querySelector('[data-testid=stage]').getBoundingClientRect(), s = window.__ripple.doc().settings;
  return [r.left + (x / s.width) * r.width, r.top + (y / s.height) * r.height];
}, [x, y]);
const selected = (page) => page.locator(UI.layerRowSelected).count();
const positions = (page) => page.evaluate(() => window.__ripple.doc().layers.map((l) => l.transform.position.value));

export const checks = [{
  name: 'marquee selects the layers it touches; shift toggles; Ctrl+A selects all',
  async run({ page }) {
    await setup(page);
    const [x0, y0] = await toScreen(page, [150, 150]), [x1, y1] = await toScreen(page, [900, 450]);
    await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 6 });
    if (!(await page.locator('svg.overlay rect[stroke-dasharray]').count())) throw new Error('marquee rectangle not drawn');
    await page.mouse.up();
    if ((await selected(page)) !== 2) throw new Error('marquee should select 2 layers, got ' + (await selected(page)));
    const [px, py] = await toScreen(page, [1500, 800]);
    await page.keyboard.down('Shift'); await page.mouse.click(px, py); await page.keyboard.up('Shift');
    if ((await selected(page)) !== 3) throw new Error('shift-click should add a layer');
    await page.keyboard.down('Shift'); await page.mouse.click(px, py); await page.keyboard.up('Shift');
    if ((await selected(page)) !== 2) throw new Error('shift-click should remove it again');
    const [ex, ey] = await toScreen(page, [1000, 150]); // top-centre is empty canvas; bottom-centre is the floating quickbar
    await page.mouse.click(ex, ey);
    if ((await selected(page)) !== 0) throw new Error('empty click should clear');
    await page.keyboard.press('Control+a');
    if ((await selected(page)) !== 3) throw new Error('Ctrl+A should select all');
  },
}, {
  name: 'dragging one of several selected layers moves them all together',
  async run({ page }) {
    await setup(page);
    const before = await positions(page);
    await page.keyboard.press('Control+a');
    const [sx, sy] = await toScreen(page, [300, 300]);
    await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 60, sy + 30, { steps: 5 }); await page.mouse.up();
    const after = await positions(page);
    const d = after.map((p, i) => [p[0] - before[i][0], p[1] - before[i][1]]);
    if (!(Math.abs(d[0][0]) > 20 && d.every((v) => Math.abs(v[0] - d[0][0]) < 1 && Math.abs(v[1] - d[0][1]) < 1))) throw new Error('layers moved differently: ' + JSON.stringify(d));
  },
}, {
  name: 'locked layers are skipped by marquee and Ctrl+A',
  async run({ page }) {
    await setup(page);
    await page.locator('button[aria-label="Lock layer"]').first().click();
    await page.keyboard.press('Control+a');
    if ((await selected(page)) !== 2) throw new Error('locked layer should not be selected by Ctrl+A');
  },
}];
