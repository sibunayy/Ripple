import { test, expect, type Page } from '@playwright/test';
import { openApp } from './helpers';

// Phase 5 (host adapter): on a touch device that can share files, Save opens the share sheet
// instead of downloading. Playwright's browsers have no share sheet, so it is stubbed here.
// The legacy prototype has no share path, so this runs against the port only.
test.skip(process.env.RF_TARGET === 'legacy' || !process.env.RF_TARGET, 'port only');

async function stubShare(page: Page, outcome: 'ok' | 'abort') {
  await page.addInitScript((outcome) => {
    const w = window as any;
    w.__shared = null;
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (q === '(pointer: coarse)' ? { ...mm(q), matches: true } as MediaQueryList : mm(q));
    (navigator as any).canShare = (d: any) => !!(d && d.files && d.files.length);
    (navigator as any).share = async (d: any) => {
      const f: File = d.files[0];
      w.__shared = { name: f.name, type: f.type, size: f.size };
      if (outcome === 'abort') throw new DOMException('closed', 'AbortError');
    };
  }, outcome);
}

async function exportLottieAndSave(page: Page) {
  await page.locator('#top [data-act="export"]').click();
  const dlg = page.locator('#dlg');
  await dlg.locator('[data-act="expfmt"][data-v="Lottie"]').click();
  await dlg.locator('[data-act="queue"]').click();
  await expect(dlg.locator('[data-act="exsave"]')).toBeVisible({ timeout: 60_000 });
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await dlg.locator('[data-act="exsave"]').click();
  await page.waitForTimeout(500);
  return downloaded;
}

test('Save opens the share sheet on a touch device', async ({ page }) => {
  await stubShare(page, 'ok');
  await openApp(page);
  expect(await exportLottieAndSave(page)).toBe(false);
  const shared = await page.evaluate(() => (window as any).__shared);
  expect(shared.name).toMatch(/\.json$/);
  expect(shared.type).toBe('application/json');
  expect(shared.size).toBeGreaterThan(100);
});

test('closing the share sheet does not download or show an error', async ({ page }) => {
  await stubShare(page, 'abort');
  await openApp(page);
  expect(await exportLottieAndSave(page)).toBe(false);
  expect(await page.evaluate(() => (window as any).__shared)).not.toBeNull();
  await expect(page.locator('#toast', { hasText: 'Could not' })).toHaveCount(0);
});
