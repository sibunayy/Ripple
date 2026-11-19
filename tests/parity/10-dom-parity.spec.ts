import { test, expect, type Browser } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Cross-check for the port: the build under test must write exactly the same HTML as the legacy
// prototype into the inspector, the timeline and the stage, for every layer type you can insert.
// The legacy file is served from disk on a separate origin, so this works for any RF_TARGET.
const LEGACY = 'http://legacy.rf.test/ripple-flow-console.html';
const legacyHtml = fs.readFileSync(path.resolve('legacy/ripple-flow-console.html'));

// Every inspector section unfolded, so the whole inspector is compared.
const seed = { collapsed: [], collapsedV: 1, collapsedV2: 1, collapsedV3: 1 };

async function snapshot(browser: Browser, url: string, type: string | null) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await ctx.route('http://legacy.rf.test/**', (r) => r.fulfill({ body: legacyHtml, contentType: 'text/html' }));
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem('rfp-' + k, JSON.stringify(v)); }, seed);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.locator('#stage g[data-id]').first().waitFor();
  if (type) {
    await page.locator('#lstrip [data-act="insert"]').click();
    await page.locator(`#layer-pop [data-act="add"][data-v="${type}"]`).click();
  }
  await page.waitForTimeout(150);
  const out = await page.evaluate(() => {
    const pj = JSON.parse(localStorage.getItem('rfp-project') || 'null');
    const ids = pj ? pj.layers.map((l: any) => l.id).filter((id: string) => !['tag', 'logo', 'core', 'ring'].includes(id)) : [];
    const norm = (h: string) => ids.reduce((s: string, id: string, i: number) => s.split(id).join('NEW' + i), h)
      // Shader previews and drawings render to bitmaps whose data URLs can differ by GPU timing.
      .replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, 'data:IMG');
    return { right: norm(document.querySelector('#rpanel')!.innerHTML), tl: norm(document.querySelector('#tl')!.innerHTML), stage: norm(document.querySelector('#stage')!.innerHTML), top: norm(document.querySelector('#top')!.innerHTML), strips: norm(document.querySelector('#lstrip')!.innerHTML + document.querySelector('#rstrip')!.innerHTML) };
  });
  await ctx.close();
  return { ...out, errors };
}

test.describe('DOM matches the legacy prototype', () => {
  const types = ['text', 'rect', 'ellipse', 'polygon', 'star', 'line', 'ring', 'solid', 'null', 'adjust', 'shader', 'comp', 'draw'];
  for (const type of [null, ...types]) {
    test(type ? `after inserting ${type}` : 'demo project', async ({ browser }) => {
      test.skip(test.info().project.name !== 'webkit-landscape', 'one project is enough');
      const a = await snapshot(browser, LEGACY, type);
      const b = await snapshot(browser, process.env.RF_URL!, type);
      expect(b.errors).toEqual([]);
      for (const k of ['right', 'tl', 'stage', 'top', 'strips'] as const) expect(b[k], k).toBe(a[k]);
    });
  }
});
