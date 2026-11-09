// Visual baseline for UI work: `npm run build && npm run shots [outDir]` writes PNGs of the key screens
// (dark/light × desktop/iPad) so before/after screenshots of a redesign can be compared side by side.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots', PORT = Number(process.env.SHOTS_PORT ?? 4180), base = `http://localhost:${PORT}/Ripple/`;
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 250)); }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sizes = { desktop: { width: 1400, height: 900 }, ipad: { width: 1180, height: 820 }, 'ipad-portrait': { width: 820, height: 1180 } };
try {
  for (const [dev, viewport] of Object.entries(sizes)) for (const scheme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { try { localStorage.setItem('rf-onboarded-v1', '1'); } catch { /* ignore */ } });
    const page = await ctx.newPage();
    const shot = (name) => page.screenshot({ path: `${out}/${dev}-${scheme}-${name}.png` });
    await page.goto(base); await page.waitForSelector('[data-testid=library]'); await shot('library');
    await page.goto(`${base}?view=editor&template=logo`); await page.waitForSelector('[data-testid=editor]');
    await page.waitForFunction(() => window.__ripple?.renderer); await page.waitForTimeout(500); await shot('editor');
    for (const [name, button] of [['export', 'Export'], ['settings', 'Settings']]) {
      await page.click(`button:has-text("${button}")`); await page.waitForSelector('[role=dialog]'); await shot(name);
      await page.keyboard.press('Escape'); if (await page.locator('[role=dialog]').count()) await page.click('.dialog button.primary');
    }
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
console.log(`screenshots written to ${out}/`);
