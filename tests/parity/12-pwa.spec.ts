import { test, expect } from '@playwright/test';

// Phase 6: home-screen install and offline use. The service worker only exists in the production
// build, so this runs against RF_TARGET=app.
test.skip(process.env.RF_TARGET !== 'app', 'production build only');

test('manifest names the app and lists its icons', async ({ page, request }) => {
  await page.goto(process.env.RF_URL!);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const res = await request.get(new URL(href!, page.url()).href);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.name).toBe('RippleFlow');
  expect(m.display).toBe('standalone');
  for (const icon of m.icons) expect((await request.get(new URL(icon.src, res.url()).href)).ok(), icon.src).toBe(true);
  expect(await page.locator('link[rel="apple-touch-icon"]').count()).toBe(1);
});

test('opens with no network once it has loaded', async ({ page, context }) => {
  await page.goto(process.env.RF_URL!);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // The first load is not yet controlled; reload once so the worker serves the page.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#stage g[data-id]').first()).toBeVisible();
  await expect(page).toHaveTitle('RippleFlow');
  await context.setOffline(false);
});
