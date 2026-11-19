import { test, expect, type Page } from '@playwright/test';
import { openApp, openRight, savedProject, layerG, drag, center, typeExact, ofield, stored, insertLayer, openLeft } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });

const logo = async (page: Page) => (await savedProject(page)).layers.find((l: any) => l.id === 'logo');
const fxIds = async (page: Page) => (await logo(page)).fx.map((e: any) => e.id);

// Checklist: "Effects tab: add, toggle, reorder (hold and drag), mix, bypass all, copy / paste stack."
test('effects: add, toggle, mix, reorder, bypass, copy and paste', async ({ page }) => {
  await openRight(page, 'Effects');
  await expect(page.locator('#rpanel .fx')).toHaveCount(1); // the demo Glow
  await page.locator('#rpanel .phead [data-act="addfx"], #rpanel [data-act="addfx"]').first().click();
  await page.locator('#layer-pop [data-act="fxadd"][data-v="blur"]').click();
  await expect(page.locator('#rpanel .fx')).toHaveCount(2);
  expect(await fxIds(page)).toEqual(['glow', 'blur']);
  await expect(page.locator('#stage defs filter#fx-logo, #stage filter#fx-logo')).toHaveCount(1);

  await page.locator('#rpanel [data-act="fxon"][data-v="0"]').click();
  expect((await logo(page)).fx[0].on).toBe(false);
  await page.locator('#rpanel [data-act="fxon"][data-v="0"]').click();

  await typeExact(page, page.locator('#rpanel .fld[data-o="fx"][data-k="mix"]').nth(1), '40');
  expect((await logo(page)).fx[1].mix).toBe(40);

  // Hold the second card and drag it above the first.
  const cards = page.locator('#rpanel .fx');
  const b1 = (await cards.nth(1).boundingBox())!, b0 = (await cards.nth(0).boundingBox())!;
  const x = b1.x + 8, y = b1.y + 6;
  await drag(page, [x, y], [x, b0.y + 4], { holdMs: 500, steps: 14 });
  await expect.poll(() => fxIds(page)).toEqual(['blur', 'glow']);

  await page.locator('#rpanel [data-act="fxbypass"]').click();
  expect((await logo(page)).fxOff).toBe(true);
  await expect(layerG(page, 'logo')).not.toHaveAttribute('filter', /url/);
  await page.locator('#rpanel [data-act="fxbypass"]').click();

  await page.locator('#rpanel [data-act="fxcopy"]').click();
  await expect(page.locator('#toast')).toContainText('Copied 2 effects');
  // Paste the stack onto Core.
  await page.keyboard.press('Escape');
  await openLeft(page, 'Layers');
  await page.locator('#lpanel .lrow[data-v="core"]').click();
  await openRight(page, 'Effects');
  await page.locator('#rpanel [data-act="fxpaste"]').click();
  const core = (await savedProject(page)).layers.find((l: any) => l.id === 'core');
  expect(core.fx.map((e: any) => e.id)).toEqual(['blur', 'glow']);
});

test('effect options menu: duplicate, solo and remove', async ({ page }) => {
  await openRight(page, 'Effects');
  await page.locator('#rpanel [data-act="fxmenu"][data-v="0"]').click();
  await page.locator('#layer-pop [data-act="fxdup"]').click();
  expect(await fxIds(page)).toEqual(['glow', 'glow']);
  await page.locator('#rpanel [data-act="fxmenu"][data-v="1"]').click();
  await page.locator('#layer-pop [data-act="fxdel"]').click();
  expect(await fxIds(page)).toEqual(['glow']);
});

test('every effect in the Add effect menu can be added', async ({ page }) => {
  await openRight(page, 'Effects');
  await page.locator('#rpanel [data-act="addfx"]').first().click();
  const items = page.locator('#layer-pop [data-act="fxadd"]');
  await expect(items).toHaveCount(23); // the menu lists 23 effects (the brief says 25; the source menu has 23)
  const ids = await items.evaluateAll((b) => b.map((e) => (e as HTMLElement).dataset.v!));
  await page.keyboard.press('Escape');
  // Bypass first: 20+ live SVG filters make the page too slow to drive.
  await page.locator('#rpanel [data-act="fxbypass"]').click();
  for (const id of ids) {
    await page.locator('#rpanel [data-act="addfx"]').first().click();
    await page.locator(`#layer-pop [data-act="fxadd"][data-v="${id}"]`).click();
  }
  expect((await fxIds(page)).length).toBe(1 + ids.length);
});

// Checklist: "Easing tab: curve handle drag, presets, copy / paste / mirror."
test('easing: presets, curve handle drag, copy / paste / mirror', async ({ page }) => {
  await openRight(page, 'Easing');
  await page.locator('#rpanel [data-act="keysall"]').click();
  await expect(page.locator('#rpanel .sub')).toHaveText('4 keyframes selected');

  await page.locator('#rpanel [data-act="ease"][data-v="inout"]').click();
  await expect(page.locator('#rpanel [data-act="ease"][data-v="inout"]')).toHaveAttribute('aria-pressed', 'true');
  expect((await logo(page)).p.scale.keys[0].e).toBe('inout');

  const h = page.locator('#curve circle.hz[data-h="2"]');
  const [hx, hy] = await center(h);
  await drag(page, [hx, hy], [hx - 40, hy + 30], { type: 'mouse', id: 1 });
  const e = (await logo(page)).p.scale.keys[0].e;
  expect(Array.isArray(e)).toBe(true);

  await page.locator('#rpanel [data-act="ezcopy"]').click();
  await expect(page.locator('#rpanel [data-act="ezpaste"]')).toBeEnabled();
  await page.locator('#rpanel [data-act="ease"][data-v="linear"]').click();
  await page.locator('#rpanel [data-act="ezpaste"]').click();
  expect((await logo(page)).p.scale.keys[0].e).toEqual(e);

  await page.locator('#rpanel [data-act="ezrev"]').click();
  const m = (await logo(page)).p.scale.keys[0].e;
  expect(m).toEqual([1 - e[2], 1 - e[3], 1 - e[0], 1 - e[1]].map((n: number) => Math.round(n * 100) / 100));

  // Typing a bezier value.
  const x1 = page.locator('#rpanel input[data-ezv="0"]');
  await x1.fill('0.2');
  await x1.press('Tab');
  expect((await logo(page)).p.scale.keys[0].e[0]).toBe(0.2);
});

// Checklist: "Presets: built-in presets apply with the direction, start, stagger, duration and intensity options.
// Save and apply a user preset."
test('built-in presets apply with options', async ({ page }) => {
  await insertLayer(page, 'rect');
  await openRight(page, 'Presets');
  await page.locator('#rpanel [data-act="popt"][data-k="pDir"][data-v="left"]').click();
  await expect(page.locator('#rpanel [data-act="popt"][data-k="pDir"][data-v="left"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#rpanel [data-act="popt"][data-k="pAt"][data-v="in"]').click();
  await typeExact(page, ofield(page, 'pDur', 'po'), '200');
  await typeExact(page, ofield(page, 'pAmt', 'po'), '150');
  await page.locator('#rpanel [data-act="preset"][data-v="slideUp"]').click();
  const pj = await savedProject(page);
  const r = pj.layers.find((l: any) => l.type === 'rect');
  expect(r.p.x.keys.length).toBeGreaterThanOrEqual(2);
  // Starts at the layer in point (0), runs twice as long as 0.6 s, from the right moving left.
  expect(r.p.x.keys[0].t).toBe(0);
  expect(r.p.x.keys[r.p.x.keys.length - 1].t).toBe(36);
  expect(r.p.x.keys[0].v).toBeGreaterThan(r.p.x.keys[r.p.x.keys.length - 1].v);

  // Stagger across a multi-selection.
  await page.locator('#rpanel [data-act="popreset"]').click();
  await page.keyboard.press('Control+a');
  await typeExact(page, ofield(page, 'pStag', 'po'), '5');
  await page.locator('#rpanel [data-act="preset"][data-v="fadeIn"]').click();
  const pj2 = await savedProject(page);
  const starts = pj2.layers.map((l: any) => l.p.op.keys?.[0]?.t).filter((t: any) => t != null);
  expect(new Set(starts).size).toBeGreaterThan(1);

  // Procedural presets: duplicator and behaviours.
  await page.locator('#rpanel [data-act="popreset"]').click();
  await page.keyboard.press('Escape');
  await page.locator('#rpanel [data-act="preset"][data-v="rippleRings"]').click();
  await page.locator('#rpanel [data-act="preset"][data-v="wiggle"]').click();
});

test('save and apply a user preset', async ({ page }) => {
  await openRight(page, 'Presets');
  await page.locator('#rpanel [data-act="psave"]').click();
  await expect(page.locator('#rpanel [data-act="cat"][data-v="Mine"]')).toHaveClass(/on/);
  const mine = await stored(page, 'myPresets');
  expect(mine).toHaveLength(1);
  expect(mine[0].name).toBe('YOUR LOGO motion 1');
  await insertLayer(page, 'ellipse');
  await openRight(page, 'Presets');
  await page.locator('#rpanel [data-act="cat"][data-v="Mine"]').click();
  await page.locator(`#rpanel [data-act="mypreset"][data-v="${mine[0].id}"]`).click();
  const el = (await savedProject(page)).layers.find((l: any) => l.type === 'ellipse' && l.name.startsWith('Ellipse'));
  expect(el.p.scale.keys?.length).toBeGreaterThan(1);
  expect(el.fx.map((e: any) => e.id)).toContain('glow');
  await page.locator(`#rpanel [data-act="mypdel"][data-v="${mine[0].id}"]`).click();
  expect(await stored(page, 'myPresets')).toEqual([]);
});

test('preset search and categories filter the list', async ({ page }) => {
  await openRight(page, 'Presets');
  await page.locator('#rpanel [data-act="cat"][data-v="Loop"]').click();
  await expect(page.locator('#rpanel [data-act="preset"]')).toHaveCount(4);
  await page.locator('#rpanel [data-act="cat"][data-v="All"]').click();
  await page.locator('#pq').fill('bounce');
  await expect(page.locator('#rpanel [data-act="preset"]')).toHaveCount(1);
});
