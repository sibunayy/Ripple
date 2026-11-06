// Renders public/icon.svg to the PNG sizes the PWA needs (uses the preinstalled Playwright Chromium).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const sizes = [['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['apple-touch-icon.png', 180, 1], ['icon-maskable-512.png', 512, 0.8]];
// Playwright is a global/pre-installed tool, not a project dependency.
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const { chromium } = pw;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, scale] of sizes) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * scale);
  const off = Math.round((size - inner) / 2);
  await page.setContent(`<body style="margin:0;background:#0e0f12"><div style="position:absolute;left:${off}px;top:${off}px;width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`);
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname });
}
await browser.close();
