// @ts-nocheck
import { DUR } from '../model/project';
import { EX, exName } from './dialog';
import { rasterFrame } from './raster';
import { zipStore } from './zip';

export async function exportPng(job, w, h, fps, nF) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d');
  const base = exName(), files = [];
  for (let i = 0; i < nF; i++) {
    if (job.cancel) return null;
    await rasterFrame(Math.min(DUR, i * 30 / fps), w, h, ctx, EX.trans);
    const b = await new Promise((r) => cv.toBlob(r, 'image/png'));
    if (!b) throw new Error('Could not encode a frame. Try a lower resolution.');
    files.push({ name: `${base}_${String(i + 1).padStart(4, '0')}.png`, data: new Uint8Array(await b.arrayBuffer()) });
    job.set((i + 1) / nF * 95, `Frame ${i + 1} of ${nF}`);
  }
  job.set(98, 'Packing ZIP'); return zipStore(files);
}
