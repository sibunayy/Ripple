import { test, expect } from '@playwright/test';
import { openApp, openLeft, openRight, expandTimeline, settle } from './helpers';

// Checklist: "Loads with no console errors. The demo project shows 4 layers; YOUR LOGO is selected."
test('loads the demo project with no errors', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('#stage g[data-id]')).toHaveCount(4);
  await expect(page.locator('#lname')).toHaveValue('YOUR LOGO');
  await expect(page.locator('#pname')).toHaveValue('Logo sting');
  await expect(page.locator('#tcode')).toHaveText('00:01:12');
  await expect(page.locator('#selbox')).toBeVisible();
  // The four demo layers are listed in the Layers panel.
  await openLeft(page, 'Layers');
  await expect(page.locator('#lpanel .lrow[data-v]')).toHaveCount(4);
  await expect(page.locator('#lpanel .lrow[data-v="logo"]')).toHaveClass(/\bsel\b/);
  expect(errors).toEqual([]);
});

// Reference screenshots. Phase 1 compares the port against these, pixel for pixel.
// Light and dark come from prefers-color-scheme; each project gives landscape or portrait.
test.describe('reference screenshots', () => {
  for (const scheme of ['dark', 'light'] as const) {
    test(`default view (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openApp(page);
      await expect(page).toHaveScreenshot(`default-${scheme}.png`);
    });
  }

  test('layers panel', async ({ page }) => {
    await openApp(page);
    await openLeft(page, 'Layers');
    await settle(page);
    await expect(page).toHaveScreenshot('layers.png');
  });

  for (const tab of ['Effects', 'Easing', 'Presets'] as const) {
    test(`${tab.toLowerCase()} tab`, async ({ page }) => {
      await openApp(page);
      await openRight(page, tab);
      await settle(page);
      await expect(page).toHaveScreenshot(`tab-${tab.toLowerCase()}.png`);
    });
  }

  test('inspector scrolled to the bottom', async ({ page }) => {
    await openApp(page);
    await page.locator('#rpanel .pbody').evaluate((e) => { e.scrollTop = e.scrollHeight; });
    await settle(page);
    await expect(page).toHaveScreenshot('inspector-bottom.png');
  });

  for (const mode of ['dope', 'graph'] as const) {
    test(`timeline ${mode}`, async ({ page }) => {
      await openApp(page);
      await expandTimeline(page);
      await page.locator(`#tl [data-act="tlmode"][data-v="${mode}"]`).click();
      await settle(page);
      await expect(page).toHaveScreenshot(`timeline-${mode}.png`);
    });
  }

  test('more menu', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-act="menu"]').click();
    await settle(page);
    await expect(page).toHaveScreenshot('menu.png');
  });

  test('export dialog', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-act="export"]').first().click();
    await expect(page.locator('#dlg')).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot('export.png');
  });
});
