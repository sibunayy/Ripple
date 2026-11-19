import { test, expect, type Page } from '@playwright/test';
import { openApp, ptr, center, drag, field, fieldValue, layerG, savedProject, expandTimeline, openLeft, settle, isPortrait } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });

const logo = async (page: Page) => (await savedProject(page))?.layers.find((l: any) => l.id === 'logo');

/** Tap a field to type an exact value (the field turns into a text input). */
async function typeInto(page: Page, fld: ReturnType<typeof field>, value: string) {
  await fld.scrollIntoViewIfNeeded();
  const [x, y] = await center(fld);
  await ptr(page, 'pointerdown', x, y);
  await ptr(page, 'pointerup', x, y);
  const inp = fld.locator('input');
  await expect(inp).toBeFocused();
  await inp.fill(value);
  await inp.press('Enter');
}

// Checklist: Inspector
test('tap the Position diamond: Position becomes animated and its label turns accent', async ({ page }) => {
  const row = page.locator('#rpanel .prop[data-g="pos"]');
  await expect(row).not.toHaveClass(/is-anim/);
  const colourBefore = await row.locator('.plbl span').evaluate((e) => getComputedStyle(e).color);
  await row.locator('[data-act="kgroup"]').click();
  await expect(row).toHaveClass(/is-anim/);
  await expect(row.locator('[data-act="kgroup"]')).toHaveAttribute('aria-label', 'Remove Position keyframe');
  const accent = await page.locator('#rpanel .prop[data-g="scale"] .plbl span').evaluate((e) => getComputedStyle(e).color);
  await expect(row.locator('.plbl span')).toHaveCSS('color', accent);
  expect(accent).not.toBe(colourBefore);
  const l = await logo(page);
  expect(l.p.x.keys).toHaveLength(1);
  expect(l.p.y.keys).toHaveLength(1);
  // Tap again removes the keyframe; hold removes all animation.
  await row.locator('[data-act="kgroup"]').click();
  await expect(row).not.toHaveClass(/is-anim/);
});

test('hold the Scale diamond removes all its animation', async ({ page }) => {
  const kd = page.locator('#rpanel .prop[data-g="scale"] [data-act="kgroup"]');
  const [x, y] = await center(kd);
  await ptr(page, 'pointerdown', x, y);
  await page.waitForTimeout(600);
  await ptr(page, 'pointerup', x, y);
  await expect(page.locator('#rpanel .prop[data-g="scale"]')).not.toHaveClass(/is-anim/);
  expect((await logo(page)).p.scale.keys).toBeUndefined();
});

test('previous / next keyframe buttons move the playhead', async ({ page }) => {
  await page.locator('#rpanel [data-act="knext"][data-g="scale"]').click();
  await expect(page.locator('#scrub')).toHaveAttribute('aria-valuenow', '54');
  await page.locator('#rpanel [data-act="kprev"][data-g="scale"]').click();
  await expect(page.locator('#scrub')).toHaveAttribute('aria-valuenow', '30');
});

test('horizontal drag on Rotation changes the value', async ({ page }) => {
  const f = field(page, 'Rotation');
  const [x, y] = await center(f);
  await drag(page, [x, y], [x + 60, y], { steps: 10 });
  expect(await fieldValue(page, 'Rotation')).toBeGreaterThan(15);
  expect((await logo(page)).p.rot.v).toBeGreaterThan(15);
});

test('horizontal drag on Scale writes a keyframe (Scale is animated)', async ({ page }) => {
  const s0 = await fieldValue(page, 'Scale');
  const f = field(page, 'Scale');
  const [x, y] = await center(f);
  await drag(page, [x, y], [x - 60, y], { steps: 10 });
  expect(await fieldValue(page, 'Scale')).toBeLessThan(s0 - 15);
  expect((await logo(page)).p.scale.keys.some((k: any) => k.t === 42)).toBe(true);
});

test('tap a field to type an exact value', async ({ page }) => {
  await typeInto(page, field(page, 'Position X'), '700');
  await expect(field(page, 'Position X')).toHaveAttribute('aria-valuenow', '700');
  expect((await logo(page)).p.x.v).toBe(700);
});

test('anchor Presets moves the anchor and the layer stays in place', async ({ page }) => {
  const before = (await layerG(page, 'logo').boundingBox())!;
  await page.locator('#rpanel [data-act="anchorpick"]').click();
  const cells = page.locator('#layer-pop [data-act="anchor"]');
  await expect(cells).toHaveCount(9);
  await cells.first().click(); // top-left
  await expect(page.locator('#layer-pop .pop')).toHaveCount(0);
  expect(await fieldValue(page, 'Anchor X')).toBeLessThan(-100);
  expect(await fieldValue(page, 'Anchor Y')).toBeLessThan(-20);
  const after = (await layerG(page, 'logo').boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
});

test('header Hide / Lock / Solo toggle', async ({ page }) => {
  const hd = page.locator('#rpanel .phead');
  await hd.locator('[data-act="vis"]').click();
  await expect(hd.locator('[data-act="vis"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(layerG(page, 'logo')).toHaveAttribute('opacity', '0');
  await hd.locator('[data-act="vis"]').click();
  await expect(layerG(page, 'logo')).toHaveAttribute('opacity', '1');

  await hd.locator('[data-act="lock"]').click();
  await expect(hd.locator('[data-act="lock"]')).toHaveAttribute('aria-pressed', 'true');
  expect((await logo(page)).lock).toBe(true);

  await hd.locator('[data-act="solo"]').click();
  await expect(hd.locator('[data-act="solo"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(layerG(page, 'core')).toHaveAttribute('opacity', '0');
  await expect(layerG(page, 'logo')).toHaveAttribute('opacity', '1');
});

test('multi-select header reads "N layers · editing all"', async ({ page }) => {
  await page.keyboard.press('Control+a');
  await expect(page.locator('#rpanel .ity')).toHaveText(/4 layers · editing all/);
});

test('renaming updates the Layers list and the timeline', async ({ page }) => {
  await page.locator('#lname').fill('Brand mark');
  await page.locator('#lname').blur();
  expect((await logo(page)).name).toBe('Brand mark');
  await openLeft(page, 'Layers');
  await expect(page.locator('#lpanel .lrow[data-v="logo"]')).toContainText('Brand mark');
  await expandTimeline(page); // the expanded timeline covers the lower strip, so check it last
  await expect(page.locator('#tl')).toContainText('Brand mark');
});

test('align to composition, flip and reset', async ({ page }) => {
  await page.locator('#rpanel [data-act="alignto"][data-v="left"]').click();
  expect(await fieldValue(page, 'Position X')).toBeLessThan(600);
  await page.locator('#rpanel [data-act="flipx"]').click();
  await expect(page.locator('#rpanel [data-act="flipx"]')).toHaveAttribute('aria-pressed', 'true');
  expect((await logo(page)).flipX).toBe(true);
  await page.locator('#rpanel [data-act="tfreset"]').click();
  expect(await fieldValue(page, 'Position X')).toBe(960);
  expect(await fieldValue(page, 'Position Y')).toBe(540);
  await expect(page.locator('#rpanel [data-act="flipx"]')).toHaveAttribute('aria-pressed', 'false');
});

test('sections fold and the folded state is saved', async ({ page }) => {
  const h = page.locator('#rpanel .sec-h[data-v="tf"]');
  await h.click();
  await expect(h).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('rfp-collapsed')!))).toContain('tf');
});

// Checklist: "Layer section: Blend mode applies mix-blend-mode on the stage group."
test('blend mode applies mix-blend-mode on the stage group', async ({ page }) => {
  await page.locator('#rpanel select[data-sel="blend"]').selectOption('screen');
  await expect(layerG(page, 'logo')).toHaveCSS('mix-blend-mode', 'screen');
  expect((await logo(page)).blend).toBe('screen');
});

test('layer opacity field lives in the Layer section', async ({ page }) => {
  const sec = page.locator('#rpanel .sec').filter({ has: page.locator('.sec-h[data-v="cmp"]') });
  await expect(sec.locator('.fld[aria-label="Opacity"]')).toHaveCount(1);
  await expect(sec.locator('select[data-sel="blend"]')).toHaveCount(1);
});

test('timing: set in / out at the playhead, parent and matte', async ({ page }) => {
  const adv = page.locator('#rpanel .sec-h[data-v="adv"]');
  if ((await adv.getAttribute('aria-expanded')) === 'false') await adv.click();
  await page.locator('#rpanel [data-act="trimin"]').click();
  expect((await logo(page)).inP).toBe(42);
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowRight');
  await page.locator('#rpanel [data-act="trimout"]').click();
  expect((await logo(page)).outP).toBe(53);
  await page.locator('#rpanel select[data-sel="parent"]').selectOption('core');
  expect((await logo(page)).parent).toBe('core');
  await page.locator('#rpanel select[data-sel="matte"]').selectOption({ index: 1 });
  expect((await logo(page)).matte).toBeTruthy();
  await expect(layerG(page, 'logo')).toHaveAttribute('mask', /url\(#mt-logo\)/);
});

test('behaviours and duplicator', async ({ page }) => {
  for (const v of ['beh', 'rep']) {
    const h = page.locator(`#rpanel .sec-h[data-v="${v}"]`);
    if ((await h.getAttribute('aria-expanded')) === 'false') await h.click();
  }
  await page.locator('#rpanel [data-act="modadd"][data-v="wiggle"]').click();
  expect((await logo(page)).mods).toHaveLength(1);
  await page.locator('#rpanel [data-act="repon"]').click();
  expect((await logo(page)).rep.on).toBe(true);
  await expect.poll(() => layerG(page, 'logo').locator('.xf').count()).toBeGreaterThan(1);
});

test('portrait: the inspector is a bottom sheet', async ({ page }) => {
  test.skip(!(await isPortrait(page)), 'portrait only');
  await settle(page);
  const r = (await page.locator('#rpanel').boundingBox())!;
  expect(r.y).toBeGreaterThan(300);
  await expect(page.locator('#sheetgrab')).toBeVisible();
});
