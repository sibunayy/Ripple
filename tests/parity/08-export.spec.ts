import { test, expect, type Page } from '@playwright/test';
import { openApp } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });
test.describe.configure({ timeout: 180_000 });

/** Opens Export, picks a format and the lowest resolution / frame rate to keep the run short. */
async function startExport(page: Page, fmt: 'MP4' | 'GIF' | 'PNG' | 'Lottie', heavy = false) {
  await page.locator('#top [data-act="export"]').click();
  const dlg = page.locator('#dlg');
  await dlg.locator(`[data-act="expfmt"][data-v="${fmt}"]`).click();
  await expect(dlg.locator(`[data-act="expfmt"][data-v="${fmt}"]`)).toHaveAttribute('aria-pressed', 'true');
  if (fmt !== 'Lottie') {
    await dlg.locator('[data-act="expres"]')[heavy ? 'last' : 'first']().click();
    await dlg.locator('[data-act="expfps"]')[heavy ? 'last' : 'first']().click();
  }
  await dlg.locator('[data-act="queue"]').click();
  return dlg;
}

async function finishAndSave(page: Page, dlg: ReturnType<Page['locator']>, ext: string) {
  await expect(dlg.locator('[data-act="exsave"]')).toBeVisible({ timeout: 150_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), dlg.locator('[data-act="exsave"]').click()]);
  expect(dl.suggestedFilename()).toMatch(new RegExp(`\\.${ext}$`));
  const path = await dl.path();
  const fs = await import('node:fs');
  return fs.readFileSync(path!);
}

// Checklist: "Export: all four formats finish and download."
test('GIF', async ({ page }) => {
  const buf = await finishAndSave(page, await startExport(page, 'GIF'), 'gif');
  expect(buf.subarray(0, 6).toString('latin1')).toBe('GIF89a');
});

test('PNG sequence (ZIP)', async ({ page }) => {
  const buf = await finishAndSave(page, await startExport(page, 'PNG'), 'zip');
  expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
});

test('Lottie JSON', async ({ page }) => {
  const buf = await finishAndSave(page, await startExport(page, 'Lottie'), 'json');
  const j = JSON.parse(buf.toString('utf8'));
  expect([j.w, j.h, j.fr, j.op]).toEqual([1920, 1080, 30, 150]);
  expect(j.layers.length).toBeGreaterThanOrEqual(4);
});

test('MP4 (H.264 via WebCodecs)', async ({ page }) => {
  const hasCodecs = await page.evaluate(() => typeof (window as any).VideoEncoder !== 'undefined');
  const dlg = await startExport(page, 'MP4');
  if (!hasCodecs) {
    // This browser build has no WebCodecs: the app must say so (Chromium covers the encode path).
    await expect(dlg).toContainText('MP4 export needs a browser with WebCodecs', { timeout: 30_000 });
    return;
  }
  const buf = await finishAndSave(page, dlg, 'mp4');
  expect(buf.subarray(4, 8).toString('latin1')).toBe('ftyp');
  expect(buf.includes(Buffer.from('moov'))).toBe(true);
});

test('cancel stops a running export', async ({ page }) => {
  const dlg = await startExport(page, 'PNG', true); // 4K at 30 fps, so it is still running when Cancel is tapped
  await dlg.locator('[data-act="excancel"]').click();
  await expect(dlg.locator('[data-act="queue"]')).toBeVisible();
  await expect(dlg.locator('[data-act="exsave"]')).toHaveCount(0);
});
