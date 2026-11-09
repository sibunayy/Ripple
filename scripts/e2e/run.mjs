// Headless-Chromium golden/e2e suite. Usage: `npm run build && npm run e2e` (starts `vite preview` itself).
// Checks live in scripts/e2e/checks/*.mjs and export `checks: [{ name, run(ctx) }]`.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { PRELUDE } from './prelude.mjs';
import { UI } from './ui.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.E2E_PORT ?? 4179), URL_ = `http://localhost:${PORT}/Ripple/`;
const only = process.argv[2];

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(URL_)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 250)); }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0, passed = 0;
try {
  const files = readdirSync(join(here, 'checks')).filter((f) => f.endsWith('.mjs')).sort();
  for (const f of files) {
    if (only && !f.includes(only)) continue;
    const { checks } = await import(pathToFileURL(join(here, 'checks', f)).href);
    for (const c of checks) {
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, acceptDownloads: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.addInitScript(PRELUDE);
      await page.addInitScript(() => { try { if (!sessionStorage.getItem('rf-e2e-first')) { localStorage.setItem('rf-onboarded-v1', '1'); } } catch { /* ignore */ } });
      await page.goto(URL_);
      await page.click('text=New project'); await page.waitForSelector(UI.editor); await page.waitForFunction(() => window.__ripple?.renderer);
      try {
        await c.run({ page, ctx, URL_ });
        if (errors.length) throw new Error('console errors: ' + errors.join(' | '));
        console.log(`  ok   ${f.replace('.mjs', '')} · ${c.name}`); passed++;
      } catch (e) {
        console.log(`  FAIL ${f.replace('.mjs', '')} · ${c.name}\n       ${String(e.message).split('\n').join('\n       ')}`); failed++;
      }
      await ctx.close();
    }
  }
} finally { await browser.close(); stop(); }
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
