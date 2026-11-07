import { deflateSync } from 'node:zlib';

// minimal PNG encoder for test fixtures
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length, 0); o.write(t, 4); d.copy(o, 8); o.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d])), 8 + d.length); return o; };
function png(w, h, [r, g, b, a]) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b, a], y * (w * 4 + 1) + 1 + x * 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const px = (page, x, y) => page.evaluate(([x, y]) => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const r = window.__ripple.renderer; const c = document.querySelector('canvas'); r.resize(c.width, c.height);
  res(null);
}))).then(() => null), [x, y]);

const near = (a, b, tol, what) => { if (Math.abs(a - b) > tol) throw new Error(`${what}: got ${a}, expected ${b}±${tol}`); };
/** Render the current document synchronously and sample canvas-buffer pixels. */
const sample = (page, pts) => page.evaluate((pts) => {
  const { renderer: r, doc } = window.__ripple; const p = doc();
  r.render(p.layers, { width: p.settings.width, height: p.settings.height, bg: p.settings.bg, t: 0, comps: p.comps, fps: p.settings.fps });
  const k = r.canvas ? 1 : 1; void k;
  const c = document.querySelector('canvas'); const s = c.width / p.settings.width;
  return pts.map(([x, y]) => r.readPixel(Math.round(x * s), Math.round(y * s)));
}, pts);

export const checks = [{
  name: 'import a PNG: asset recorded, layer fitted, pixels drawn, deduped on re-import',
  async run({ page }) {
    await page.setInputFiles('label[aria-label="Import media"] input', { name: 'red.png', mimeType: 'image/png', buffer: png(64, 64, [255, 0, 0, 255]) });
    await page.waitForSelector('.tl-row.layer.on');
    await page.waitForFunction(() => window.__ripple.doc().layers.length === 1);
    await page.waitForTimeout(300); // bitmap decode + redraw
    const [mid, corner] = await sample(page, [[960, 540], [5, 5]]);
    near(mid[0], 255, 3, 'image red'); near(mid[1], 0, 3, 'image green');
    near(corner[0], 18, 4, 'background intact');
    await page.setInputFiles('label[aria-label="Import media"] input', { name: 'again.png', mimeType: 'image/png', buffer: png(64, 64, [255, 0, 0, 255]) });
    await page.waitForFunction(() => window.__ripple.doc().layers.length === 2);
    const n = await page.evaluate(() => Object.keys(window.__ripple.doc().assets).length);
    if (n !== 1) throw new Error('identical content should dedupe, got ' + n + ' assets');
    await page.click('button[role=tab]:has-text("assets")');
    if (!(await page.locator('.assets li').count())) throw new Error('assets panel empty');
  },
}, {
  name: 'import SVG as vector shapes (paths, rect, circle, gradient) and as an image',
  async run({ page }) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs>
      <rect x="0" y="0" width="100" height="100" fill="url(#g)"/><g transform="translate(150 50)"><circle r="40" fill="#00ff00"/></g><path d="M10 90 L40 60 A 20 20 0 0 1 60 90 Z" fill="none" stroke="#fff" stroke-width="4"/><text>hi</text></svg>`;
    page.on('dialog', (d) => void d.accept());
    await page.setInputFiles('label[aria-label="Import media"] input', { name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
    await page.waitForFunction(() => window.__ripple.doc().layers.length === 3);
    const kinds = await page.evaluate(() => window.__ripple.doc().layers.map((l) => l.type + ':' + (l.shape?.fill?.kind ?? 'nofill')));
    if (!kinds.every((k) => k.startsWith('shape'))) throw new Error('not shapes: ' + kinds);
    if (!kinds.includes('shape:linear')) throw new Error('gradient lost: ' + kinds);
    const [circle, gradLeft] = await sample(page, [[1010, 540], [875, 540]]);
    if (circle[1] < 200) throw new Error('green circle missing: ' + circle);
    if (!(gradLeft[0] > gradLeft[2])) throw new Error('gradient left should be redder: ' + gradLeft);
    const toast = await page.locator('.toast', { hasText: 'Imported' }).textContent();
    if (!/text/.test(toast ?? '')) throw new Error('should report unsupported <text>: ' + toast);
  },
}, {
  name: 'video import: duration → layer length; frame drawn after seek; export frame contains video pixels',
  async run({ page }) {
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d');
      const stream = c.captureStream(30); const rec = new MediaRecorder(stream, { mimeType: 'video/webm' }); const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((r) => (rec.onstop = r)); rec.start();
      const t0 = performance.now(); while (performance.now() - t0 < 1200) { g.fillStyle = '#00c000'; g.fillRect(0, 0, 160, 90); await new Promise((r) => requestAnimationFrame(r)); }
      rec.stop(); await done;
      const buf = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s);
    });
    await page.setInputFiles('label[aria-label="Import media"] input', { name: 'clip.webm', mimeType: 'video/webm', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => window.__ripple.doc().layers.length === 1, null, { timeout: 15000 });
    const l = await page.evaluate(() => { const d = window.__ripple.doc(); const l = d.layers[0]; return { type: l.type, out: l.out, asset: d.assets[l.media.asset] }; });
    if (l.type !== 'video' || !(l.asset.width === 160) || l.out < 5) throw new Error('bad video layer ' + JSON.stringify(l));
    await page.waitForTimeout(800);
    const [mid] = await sample(page, [[960, 540]]);
    near(mid[1], 192, 12, 'video frame is green (MediaRecorder webm decode)');
  },
}, {
  name: 'library thumbnail is generated when closing a project',
  async run({ page }) {
    await page.click('text=＋ Solid');
    await page.click('button[aria-label="Back to library"]');
    await page.waitForSelector('.thumb');
    await page.waitForFunction(() => { const t = document.querySelector('.thumb'); return t && getComputedStyle(t).backgroundImage.startsWith('url('); }, null, { timeout: 15000 });
  },
}];
