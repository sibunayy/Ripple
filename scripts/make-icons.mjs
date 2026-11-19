// Renders public/icon.svg to the PNG sizes the manifest and iPadOS need. Run after editing the SVG:
//   node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const svg = fs.readFileSync('public/icon.svg', 'utf8');
const out = [['public/icons/icon-192.png', 192], ['public/icons/icon-512.png', 512], ['public/icons/apple-touch-icon.png', 180]];
fs.mkdirSync('public/icons', { recursive: true });
const browser = await chromium.launch();
for (const [file, size] of out) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: file });
  await page.close();
  console.log(file);
}
await browser.close();
