import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';

export async function setRange(page, n) {
  await page.click('text=＋ Solid');
  await page.keyboard.press('Home'); await page.keyboard.press('i');
  for (let i = 0; i < n - 1; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('o');
}
export const pngSize = (u8) => ({ sig: [...u8.slice(0, 4)].join(','), w: new DataView(u8.buffer, u8.byteOffset).getUint32(16), h: new DataView(u8.buffer, u8.byteOffset).getUint32(20) });
/** Configure the export dialog, enqueue and download the first finished job. */
export async function runExport(page, { kind, scale, range, fps, transparent }) {
  await page.click('button:has-text("Export")');
  await page.selectOption('.dialog select >> nth=0', kind);
  if (scale) await page.selectOption('.dialog select >> nth=1', String(scale));
  if (range) await page.selectOption('.dialog select >> nth=2', range);
  if (fps) await page.selectOption('.dialog select >> nth=3', String(fps));
  if (transparent) await page.check('.dialog input[type=checkbox]');
  await page.click('.dialog button.primary');
  await page.waitForSelector('.job.done', { timeout: 90000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.job.done button:has-text("Download")')]);
  return new Uint8Array(readFileSync(await dl.path()));
}

export const checks = [{
  name: 'PNG sequence export: work-area frames, correct size, valid PNGs',
  async run({ page }) {
    await setRange(page, 5);
    const files = unzipSync(await runExport(page, { kind: 'png-seq', scale: 0.25 }));
    const names = Object.keys(files).sort();
    if (names.length !== 5) throw new Error(`expected 5 frames, got ${names.length}`);
    const s = pngSize(files[names[0]]);
    if (s.sig !== '137,80,78,71' || s.w !== 480 || s.h !== 270) throw new Error('bad png ' + JSON.stringify(s));
  },
}, {
  name: 'single-frame PNG export',
  async run({ page }) {
    await page.click('text=＋ Solid');
    const u8 = await runExport(page, { kind: 'png', scale: 0.5 });
    const s = pngSize(u8);
    if (s.w !== 960 || s.h !== 540) throw new Error('bad size ' + JSON.stringify(s));
  },
}, {
  name: 'MP4 export produces an ISO-BMFF file (skipped when H.264 encoding is unavailable)',
  async run({ page }) {
    const ok = await page.evaluate(async () => typeof VideoEncoder !== 'undefined' && (await VideoEncoder.isConfigSupported({ codec: 'avc1.640028', width: 480, height: 270, bitrate: 1e6, framerate: 30 })).supported);
    if (!ok) { console.log('       (skipped: no H.264 encoder in this browser)'); return; }
    await setRange(page, 8);
    const u8 = await runExport(page, { kind: 'mp4', scale: 0.25 });
    if (String.fromCharCode(...u8.slice(4, 8)) !== 'ftyp') throw new Error('not an mp4');
  },
}];
