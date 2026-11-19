import { test, expect } from '@playwright/test';
import { openApp, openLeft, savedProject, stored, isPortrait, settle, drag, center, ptr, insertLayer } from './helpers';

// Checklist: "Persistence: reload keeps the project and the panel state. Settings → reset restores the demo."
test('reload keeps the project and the panel state', async ({ page }) => {
  await openApp(page);
  await page.locator('#pname').fill('My sting');
  await insertLayer(page, 'star');
  await openLeft(page, 'Layers');
  await page.locator('#tlh').click(); // after Layers: the expanded timeline covers the lower strip
  const left = await stored(page, 'left'), right = await stored(page, 'right');
  await page.reload();
  await expect(page.locator('#pname')).toHaveValue('My sting');
  await expect(page.locator('#stage g[data-id]')).toHaveCount(5);
  await expect(page.locator('#tl .tl-tools')).toBeVisible();
  expect(await stored(page, 'tl')).toBe('mid');
  await expect(page.locator('#lstrip [aria-label="Layers"]')).toHaveAttribute('aria-pressed', String(left === 'layers'));
  expect(await stored(page, 'right')).toBe(right);
});

test('keeps the rfp- keys and migrates panel folds only once', async ({ page }) => {
  await openApp(page);
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  for (const k of ['rfp-collapsed', 'rfp-collapsedV', 'rfp-collapsedV2', 'rfp-collapsedV3', 'rfp-theme', 'rfp-glow', 'rfp-tint', 'rfp-left', 'rfp-right', 'rfp-tl']) expect(keys).toContain(k);
  expect(keys.every((k) => k.startsWith('rfp-'))).toBe(true);
  expect(await stored(page, 'collapsed')).toEqual(expect.arrayContaining(['blend', 'masks', 'trim', 'repeat', 'more', 'rep', 'beh', 'adv']));
});

test('a saved project from an existing user loads (blob media dropped)', async ({ page }) => {
  const layer = (id: string, extra = {}) => ({ id, name: id, type: 'rect', hue: '#ff0000', vis: true, lock: false, fx: [], w: 100, h: 100, p: { x: { v: 960 }, y: { v: 540 }, scale: { v: 100 }, rot: { v: 0 }, op: { v: 100 }, ax: { v: 0 }, ay: { v: 0 }, ts: { v: 0 }, te: { v: 100 } }, ...extra });
  await openApp(page, { storage: { project: { layers: [layer('a'), layer('b', { type: 'image', src: 'blob:x' })], markers: [], dur: 90, name: 'Old one' }, theme: 'light' } });
  await expect(page.locator('#stage g[data-id]')).toHaveCount(1);
  await expect(page.locator('#pname')).toHaveValue('Old one');
  await expect(page.locator('#tl .time')).toContainText('00:03:00');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('Settings → reset restores the demo', async ({ page }) => {
  await openApp(page);
  await insertLayer(page, 'star');
  expect((await savedProject(page)).layers).toHaveLength(5);
  await page.locator('#top [data-act="menu"]').click();
  await page.locator('#layer-pop [data-act="settings"]').click();
  await expect(page.locator('#dlg')).toBeVisible();
  await page.locator('#dlg [data-act="resetproj"]').click(); // first tap arms
  await Promise.all([page.waitForEvent('load'), page.locator('#dlg [data-act="resetproj"]').click()]);
  await expect(page.locator('#stage g[data-id]')).toHaveCount(4);
  await expect(page.locator('#pname')).toHaveValue('Logo sting');
});

test('Settings: duration', async ({ page }) => {
  await openApp(page);
  await page.locator('#top [data-act="menu"]').click();
  await page.locator('#layer-pop [data-act="settings"]').click();
  await page.locator('#dlg [data-act="setdur"][data-v="10"]').click();
  await expect(page.locator('#tl .time')).toContainText('00:10:00');
  expect((await savedProject(page)).dur).toBe(300);
});

// Checklist: "Theme: Auto / Dark / Light, Reduce glow, Ocean / Aqua tint."
test('theme, glow and tint', async ({ page }) => {
  await openApp(page);
  const html = page.locator('html');
  await page.locator('#top [data-act="menu"]').click();
  const pop = page.locator('#layer-pop');
  await pop.locator('[data-act="theme"][data-v="light"]').click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  const lightBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg'));
  await pop.locator('[data-act="theme"][data-v="dark"]').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg'))).not.toBe(lightBg);
  await pop.locator('[data-act="theme"][data-v="auto"]').click();
  await expect(html).not.toHaveAttribute('data-theme', /./);
  expect(await stored(page, 'theme')).toBe('auto');

  await pop.locator('[data-act="glow"]').click();
  await expect(html).toHaveAttribute('data-glow', 'soft');
  await pop.locator('[data-act="tint"][data-v="warm"]').click();
  await expect(html).toHaveAttribute('data-tint', 'warm');
  expect([await stored(page, 'glow'), await stored(page, 'tint')]).toEqual(['soft', 'warm']);
  await pop.locator('[data-act="tint"][data-v="classic"]').click();
  await expect(html).toHaveAttribute('data-tint', 'classic');

  await pop.locator('[data-act="autofold"]').click();
  expect(await stored(page, 'autofold')).toBe(false);
});

test('auto theme follows the system colour scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openApp(page);
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(dark);
});

test('help dialog opens with ? and closes with Escape', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('?');
  await expect(page.locator('#dlg')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#dlg')).toHaveCount(0);
});

test('landscape: panels auto-fold during playback', async ({ page }) => {
  await openApp(page);
  test.skip(await isPortrait(page), 'landscape only');
  await page.locator('#tl [data-act="play"]').click();
  await expect(page.locator('#app')).toHaveClass(/folding/);
  await page.locator('#tl [data-act="play"]').click();
  await expect(page.locator('#app')).not.toHaveClass(/folding/);
});

// Checklist: "Portrait: the left drawer and the right bottom sheet open, drag and close.
// Picking a draw tool folds the sheet." (The draw-tool part is in 06-drawing.)
test.describe('portrait', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    test.skip(!(await isPortrait(page)), 'portrait only');
  });

  test('left drawer opens, closes the sheet, and the scrim closes it', async ({ page }) => {
    await openLeft(page, 'Layers');
    await settle(page);
    await expect(page.locator('#app')).toHaveClass(/left-open/);
    await expect(page.locator('#app')).not.toHaveClass(/right-open/);
    await expect(page.locator('#scrim')).toBeVisible();
    const lp = (await page.locator('#lpanel').boundingBox())!;
    await page.mouse.click(lp.x + lp.width + 100, 300);
    await expect(page.locator('#app')).not.toHaveClass(/left-open/);
  });

  test('bottom sheet: tap the grab to expand, drag down to collapse and close', async ({ page }) => {
    const g = page.locator('#sheetgrab');
    const h0 = (await page.locator('#rpanel').boundingBox())!.height;
    await g.click();
    await expect(page.locator('#rpanel')).toHaveClass(/full/);
    await settle(page);
    expect((await page.locator('#rpanel').boundingBox())!.height).toBeGreaterThan(h0 + 50);
    let [x, y] = await center(g);
    await drag(page, [x, y], [x, y + 120]);
    await expect(page.locator('#rpanel')).not.toHaveClass(/full/);
    await settle(page);
    [x, y] = await center(g);
    await drag(page, [x, y], [x, y + 120]);
    await expect(page.locator('#app')).not.toHaveClass(/right-open/);
  });

  test('drag the sheet grab up expands it', async ({ page }) => {
    const [x, y] = await center(page.locator('#sheetgrab'));
    await drag(page, [x, y], [x, y - 120]);
    await expect(page.locator('#rpanel')).toHaveClass(/full/);
  });
});

test('landscape: Preview iPad portrait from the menu', async ({ page }) => {
  await openApp(page);
  test.skip(await isPortrait(page), 'landscape only');
  await page.locator('#top [data-act="menu"]').click();
  await page.locator('#layer-pop [data-act="pp"]').click();
  await expect(page.locator('#app')).toHaveClass(/preview-portrait/);
  await expect(page.locator('#app')).toHaveClass(/\bportrait\b/);
});

test('context hold on a layer row opens its menu', async ({ page }) => {
  await openApp(page);
  await openLeft(page, 'Layers');
  await settle(page);
  const row = page.locator('#lpanel .lrow[data-v="core"] .nm, #lpanel .lrow[data-v="core"]').first();
  const [x, y] = await center(row);
  await ptr(page, 'pointerdown', x, y);
  await page.waitForTimeout(650);
  await ptr(page, 'pointerup', x, y);
  await expect(page.locator('#layer-pop [role="menu"]')).toBeVisible();
  await page.locator('#layer-pop [data-act="move"][data-v="1"]').click();
  expect((await savedProject(page)).layers.map((l: any) => l.id)).toEqual(['tag', 'logo', 'ring', 'core']);
});
