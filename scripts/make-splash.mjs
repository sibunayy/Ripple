// Generates iPad launch images (apple-touch-startup-image) into public/splash and prints the <link> tags.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
// [css width, css height, name] — dpr 2
const ipads = [[1024, 1366, '12.9'], [834, 1194, '11'], [820, 1180, '10.9'], [810, 1080, '10.2'], [744, 1133, 'mini']];
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const browser = await pw.chromium.launch();
const out = new URL('../public/splash/', import.meta.url);
mkdirSync(out, { recursive: true });
const tags = [];
for (const [w, h, name] of ipads) for (const orient of ['portrait', 'landscape']) {
  const cw = orient === 'portrait' ? w : h, ch = orient === 'portrait' ? h : w, px = Math.round(Math.min(cw, ch) * 0.22);
  const page = await browser.newPage({ viewport: { width: cw, height: ch }, deviceScaleFactor: 2 });
  await page.setContent(`<body style="margin:0;background:#0e0f12;display:grid;place-items:center;height:100vh;font:600 ${Math.round(px * 0.2)}px -apple-system,system-ui,sans-serif;color:#e8eaee"><div style="display:grid;gap:${Math.round(px * 0.15)}px;justify-items:center"><div style="width:${px}px;height:${px}px">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</div>RippleFlow</div></body>`);
  const file = `${name}-${orient}.png`;
  await page.screenshot({ path: new URL(file, out).pathname });
  await page.close();
  tags.push(`  <link rel="apple-touch-startup-image" href="splash/${file}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: 2) and (orientation: ${orient})" />`);
}
await browser.close();
console.log(tags.join('\n'));
