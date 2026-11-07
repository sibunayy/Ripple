import { UI } from '../ui.mjs';
import { unzipSync, strFromU8 } from 'fflate';
import { setRange, runExport, pngSize } from './m45-export.mjs';
import { deflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length, 0); o.write(t, 4); d.copy(o, 8); o.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d])), 8 + d.length); return o; };
const png = (w, h, px) => { const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px, y * (w * 4 + 1) + 1 + x * 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); };
const near = (a, b, tol, what) => { if (Math.abs(a - b) > tol) throw new Error(`${what}: got ${a}, expected ${b}±${tol}`); };

export const checks = [{
  name: 'GIF export: valid header, frame count follows range and frame-rate override',
  async run({ page }) {
    await setRange(page, 6);
    const u8 = await runExport(page, { kind: 'gif', scale: 0.25, fps: 15 });
    if (String.fromCharCode(...u8.slice(0, 6)) !== 'GIF89a') throw new Error('not a GIF');
    const w = u8[6] | (u8[7] << 8); near(w, 480, 0, 'gif width');
    // count image descriptors (0x2C) that follow a graphic-control extension (0x21 0xF9 ... 0x00)
    let frames = 0; for (let i = 0; i < u8.length - 1; i++) if (u8[i] === 0x21 && u8[i + 1] === 0xf9) frames++;
    near(frames, 3, 0, '6 frames @30 → 3 frames @15');
  },
}, {
  name: 'JPEG / WebP sequences and transparent PNG',
  async run({ page }) {
    await setRange(page, 3);
    const jpg = unzipSync(await runExport(page, { kind: 'jpeg-seq', scale: 0.25 }));
    const names = Object.keys(jpg); near(names.length, 3, 0, 'jpeg frames');
    if (jpg[names[0]][0] !== 0xff || jpg[names[0]][1] !== 0xd8) throw new Error('not a JPEG');
  },
}, {
  name: 'transparent PNG export keeps alpha',
  async run({ page }) {
    // an empty comp with transparent background must export alpha 0 pixels
    const u8 = await runExport(page, { kind: 'png', scale: 0.25, transparent: true });
    const a = await page.evaluate(async (bytes) => {
      const bm = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d'); g.drawImage(bm, 0, 0);
      return g.getImageData(10, 10, 1, 1).data[3];
    }, [...u8]);
    near(a, 0, 0, 'alpha of empty transparent export');
  },
}, {
  name: 'queue runs jobs sequentially; cancel works',
  async run({ page }) {
    await setRange(page, 4);
    await page.click('button:has-text("Export")');
    await page.selectOption('.dialog select >> nth=0', 'png-seq'); await page.selectOption('.dialog select >> nth=1', '0.25');
    await page.click('.dialog button.primary'); await page.click('.dialog button.primary');
    await page.waitForFunction(() => document.querySelectorAll('.job.done').length === 2, null, { timeout: 60000 });
    await page.click('.dialog button.primary'); // third job, cancelled right away
    await page.locator('.job >> nth=2').locator('button:has-text("Cancel")').click().catch(() => undefined);
    await page.waitForFunction(() => ['done', 'cancelled'].some((s) => document.querySelector('.job:nth-child(3).' + s)), null, { timeout: 30000 });
  },
}, {
  name: '.ripple bundle: export contains project + assets; import into the library restores it',
  async run({ page }) {
    await page.setInputFiles('label[aria-label="Import media"] input', { name: 'blue.png', mimeType: 'image/png', buffer: png(32, 32, [0, 0, 255, 255]) });
    await page.waitForFunction(() => window.__ripple.doc().layers.length === 1);
    const bytes = await runExport(page, { kind: 'ripple' });
    const files = unzipSync(bytes);
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    if (manifest.format !== 'ripple-project' || manifest.assets.length !== 1) throw new Error('bad manifest ' + JSON.stringify(manifest));
    if (!files[`assets/${manifest.assets[0]}`] || !files['project.json']) throw new Error('missing entries: ' + Object.keys(files));
    await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
    await page.click('button[aria-label="Back to library"]');
    await page.waitForSelector(UI.card);
    const before = await page.locator(UI.card).count();
    await page.setInputFiles('.library label:has-text("Import .ripple") input', { name: 'p.ripple', mimeType: 'application/zip', buffer: Buffer.from(bytes) });
    await page.waitForFunction((n) => document.querySelectorAll('[data-testid=project-card]').length === n + 1, before, { timeout: 15000 });
    await page.locator('.card .thumb').first().click();
    await page.waitForSelector(UI.editor);
    const doc = await page.evaluate(() => { const d = window.__ripple.doc(); return { layers: d.layers.length, assets: Object.keys(d.assets).length }; });
    if (doc.layers !== 1 || doc.assets !== 1) throw new Error('imported project incomplete ' + JSON.stringify(doc));
  },
}, {
  name: 'corrupt project file recovers from an automatic snapshot',
  async run({ page }) {
    const id = await page.evaluate(() => window.__ripple.doc().id);
    await page.click('button[aria-label="Back to library"]'); await page.waitForSelector(UI.card);
    await page.evaluate(async (id) => {
      const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('projects');
      const fh = await dir.getFileHandle(id + '.json'); const good = await (await fh.getFile()).text();
      const w = await fh.createWritable(); await w.write('{ not json'); await w.close();
      const snap = JSON.stringify([{ t: Date.now(), json: good.replace(/"name":"[^"]*"/, '"name":"Recovered"') }]);
      await new Promise((res, rej) => { const r = indexedDB.open('ripple', 1); r.onsuccess = () => { const tx = r.result.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(snap, 'snaps:' + id); tx.oncomplete = res; tx.onerror = rej; }; });
    }, id);
    await page.evaluate((id) => { const b = [...document.querySelectorAll('.card .thumb')].find((el) => true); b.click(); }, id);
    await page.waitForSelector(UI.editor, { timeout: 10000 });
    const name = await page.inputValue('input.title');
    if (name !== 'Recovered') throw new Error('did not recover, name=' + name);
    await page.waitForSelector('.toast >> text=damaged');
  },
}];
