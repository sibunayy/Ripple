import { test, expect, type Page } from '@playwright/test';
import { openApp, typeExact, ofield, insertLayer, selectedLayer, unfold, savedProject, layerG, ptr, isPortrait, settle, openRight } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });

const logo = async (page: Page) => (await savedProject(page)).layers.find((l: any) => l.id === 'logo');

// Checklist: "Text: content, font, weight, size, tracking, leading, word space, alignment, style, case,
// fill + gradient, outline width shows the outline colour chip."
test('text controls', async ({ page }) => {
  await unfold(page, 'app');
  const ta = page.locator('#ltext');
  await ta.fill('HELLO\nWORLD');
  await ta.blur();
  expect((await logo(page)).text).toBe('HELLO\nWORLD');
  await expect(page.locator('#stage g[data-id="logo"] text').first()).toContainText('HELLO');

  const font = page.locator('#rpanel select[data-sel="font"]');
  const opts = await font.locator('option').evaluateAll((o) => o.map((e) => (e as HTMLOptionElement).value));
  await font.selectOption(opts[opts.length - 1]);
  expect((await logo(page)).font).toBe(opts[opts.length - 1]);

  const w = page.locator('#rpanel select[data-sel="tweight"]');
  const wv = await w.locator('option').evaluateAll((o) => o.map((e) => (e as HTMLOptionElement).value));
  await w.selectOption(wv[0]);
  expect((await logo(page)).weight).toBe(Number(wv[0]));

  for (const [k, v] of [['size', '90'], ['track', '12'], ['lead', '130'], ['wsp', '20']] as const) {
    await typeExact(page, ofield(page, k), v);
    expect((await logo(page))[k]).toBe(Number(v));
  }

  await page.locator('#rpanel [data-act="tset"][data-k="align"][data-v="right"]').click();
  await expect(page.locator('#rpanel [data-act="tset"][data-k="align"][data-v="right"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#rpanel [data-act="tset"][data-k="italic"]').click();
  await page.locator('#rpanel [data-act="tset"][data-k="tcase"][data-v="lower"]').click();
  const l = await logo(page);
  expect([l.align, l.italic, l.tcase]).toEqual(['right', true, 'lower']);
  await expect(page.locator('#stage g[data-id="logo"] text').first()).toHaveAttribute('font-style', 'italic');
});

test('text fill, gradient and outline', async ({ page }) => {
  await unfold(page, 'fill');
  // Fill colour from the picker swatches.
  await page.locator('#rpanel [data-act="colour"][data-key="hue"]').click();
  const sw = page.locator('#layer-pop [data-act="cpsw"]').nth(2);
  const hex = (await sw.getAttribute('data-v'))!;
  await sw.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#layer-pop .pop')).toHaveCount(0);
  expect(((await logo(page)).hue as string).toLowerCase()).toBe(hex.toLowerCase());

  // Gradient adds a second colour chip.
  await page.locator('#rpanel [data-act="gradon"]').click();
  await expect(page.locator('#rpanel [data-act="gradon"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rpanel [data-act="colour"][data-key="hue2"]')).toHaveCount(1);
  expect((await logo(page)).grad).toBe(true);

  // Outline width > 0 shows the outline colour chip.
  await expect(page.locator('#rpanel [data-act="colour"][data-key="tsc"]')).toHaveCount(0);
  await typeExact(page, ofield(page, 'tsw'), '4');
  await expect(page.locator('#rpanel [data-act="colour"][data-key="tsc"]')).toHaveCount(1);
  expect((await logo(page)).tsw).toBe(4);
});

// Checklist: "Shapes (rect, ellipse, star, polygon, line, ring) and path: geometry, fill on / off, stroke,
// dash / gap / offset, cap / join, trim paths keyframes."
const GEOM: Record<string, string[]> = { rect: ['w', 'h', 'cr'], ellipse: ['r'], star: ['n', 'ir'], polygon: ['n'], line: ['w'], ring: ['r'] };
for (const [type, keys] of Object.entries(GEOM)) {
  test(`${type}: geometry fields edit the shape`, async ({ page }) => {
    await insertLayer(page, type);
    await unfold(page, 'app');
    const before = await layerG(page, (await selectedLayer(page)).id).innerHTML();
    const k = keys[0], fld = ofield(page, k);
    await expect(fld).toBeVisible();
    const cur = Number(await fld.getAttribute('aria-valuenow'));
    const next = k === 'n' ? String(cur + 2) : String(Math.round(cur * 1.5));
    await typeExact(page, fld, next);
    const l = await selectedLayer(page);
    expect(l[k]).toBe(Number(next));
    expect(await layerG(page, l.id).innerHTML()).not.toBe(before);
    for (const k2 of keys) await expect(ofield(page, k2)).toHaveCount(1);
  });
}

test('rectangle fill on/off, stroke, dash / gap / offset, cap / join, trim paths', async ({ page }) => {
  await insertLayer(page, 'rect');
  await unfold(page, 'fill');
  await page.locator('#rpanel [data-act="fillon"]').click();
  expect((await selectedLayer(page)).fill).toBe(false);
  await page.locator('#rpanel [data-act="fillon"]').click();
  expect((await selectedLayer(page)).fill).toBe(true);

  await typeExact(page, ofield(page, 'sw'), '6');
  expect((await selectedLayer(page)).sw).toBe(6);
  await typeExact(page, ofield(page, 'dash'), '20');
  await expect(ofield(page, 'dgap')).toHaveCount(1);
  await expect(ofield(page, 'doff')).toHaveCount(1);
  await typeExact(page, ofield(page, 'dgap'), '10');
  await typeExact(page, ofield(page, 'doff'), '5');
  let l = await selectedLayer(page);
  expect([l.dash, l.dgap, l.doff]).toEqual([20, 10, 5]);

  await page.locator('#rpanel select[data-sel="cap"]').selectOption('round');
  await page.locator('#rpanel select[data-sel="join"]').selectOption('bevel');
  l = await selectedLayer(page);
  expect([l.cap, l.join]).toEqual(['round', 'bevel']);

  // Trim paths is a property row inside the Stroke group.
  const trim = page.locator('#rpanel .prop[data-g="trim"]');
  await expect(trim).toHaveCount(1);
  await trim.locator('[data-act="kgroup"]').click();
  await expect(trim).toHaveClass(/is-anim/);
  l = await selectedLayer(page);
  expect(l.p.ts.keys).toHaveLength(1);
  expect(l.p.te.keys).toHaveLength(1);
});

test('ring and line show a Stroke group with trim paths', async ({ page }) => {
  for (const t of ['ring', 'line']) {
    await insertLayer(page, t);
    await expect(page.locator('#rpanel .sec-h[data-v="fill"]')).toHaveText(/Stroke/);
    await unfold(page, 'fill');
    await expect(page.locator('#rpanel .prop[data-g="trim"]')).toHaveCount(1);
  }
});

test('path: smooth, closed and fill', async ({ page }) => {
  if (await isPortrait(page)) { await page.locator('#rstrip [aria-label="Properties"]').click(); await settle(page); }
  await page.locator('#lstrip [data-v="pen"]').click();
  const vp = (await page.locator('#vp').boundingBox())!;
  for (const [dx, dy] of [[100, 100], [220, 90], [180, 190]]) { await ptr(page, 'pointerdown', vp.x + dx, vp.y + dy); await ptr(page, 'pointerup', vp.x + dx, vp.y + dy); }
  await page.locator('#qbar [data-act="pendone"]').dispatchEvent('click');
  await openRight(page, 'Properties');
  await expect(page.locator('#lname')).toHaveValue('Path 1');
  await unfold(page, 'app');
  await expect(page.locator('#rpanel .sec-h[data-v="app"]')).toHaveText(/Path/);
  for (const act of ['pathsm', 'pathcl', 'pathfill']) await page.locator(`#rpanel [data-act="${act}"]`).click();
  const l = await selectedLayer(page);
  expect([l.smooth, l.closed, l.fill]).toEqual([true, true, true]);
  expect(l.pts).toHaveLength(3);
});

test('other layer types add and show their content section', async ({ page }) => {
  for (const [t, title] of [['solid', /Fill/], ['null', null], ['adjust', null], ['comp', /Fill/], ['draw', /Drawing/]] as const) {
    await insertLayer(page, t);
    await openRight(page, 'Properties'); // in portrait, picking the brush folds the sheet
    await expect(page.locator('#rpanel .ity')).toBeVisible();
    if (title) await expect(page.locator('#rpanel .sec-h[data-v="app"]')).toHaveText(title);
    if (t === 'draw') { await page.keyboard.press('v'); }
  }
  await expect(page.locator('#stage g[data-id]')).toHaveCount(9);
});
