import { $, esc } from '../core/dom';
import { DUR } from '../model/project';
import { S } from '../state/state';
import { updateCanvas } from '../render/stage';
import { tc } from '../ui/inspector/controls';
import { exportGif } from './gif';
import { exportLottie } from './lottie';
import { exportPng } from './png';
import { exportMp4 } from './mp4';
import { renderDialog } from '../ui/dialog';
import { toast } from '../ui/toast';
import { setPF } from '../ui/layout';
import { play } from '../playback/loop';
import { saveFile } from '../host/save-file';

/* ---------- export: GIF + MP4 (all in the browser, no libraries) ---------- */
export const EX = { fmt: 'MP4', res: { MP4: 1080, GIF: 540, PNG: 1080 }, fps: { MP4: 30, GIF: 15, PNG: 30 }, trans: false };
const EX_RES = { MP4: [['720p', 720], ['1080p', 1080], ['4K', 2160]], GIF: [['360p', 360], ['540p', 540], ['720p', 720]], PNG: [['720p', 720], ['1080p', 1080], ['4K', 2160]] };
const EX_FPS = { MP4: [24, 30, 60], GIF: [10, 15, 24, 30], PNG: [12, 24, 30] };
export let exportJob = null;
export const exName = () => ((($('#pname') || {}).value || 'Logo sting').trim().replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'export');
const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
export async function runExport() {
  if (exportJob && exportJob.status === 'run') return;
  if (exportJob && exportJob.url) URL.revokeObjectURL(exportJob.url);
  if (S.playing) play(false);
  const fmt = EX.fmt, res = EX.res[fmt] || 1080, fps = EX.fps[fmt] || 30;
  const h = res % 2 ? res + 1 : res, w = Math.round(h * 16 / 9 / 2) * 2, nF = Math.round(DUR / 30 * fps);
  const job: any = exportJob = { status: 'run', p: 0, text: 'Starting', cancel: false, fmt, name: `${exName()}${fmt === 'PNG' ? '-png' : ''}.${{ GIF: 'gif', PNG: 'zip', Lottie: 'json' }[fmt] || 'mp4'}`, dims: fmt === 'Lottie' ? '1920×1080 vector' : `${w}×${h}`,
    set(p, t) { this.p = p; this.text = t; const bar = $('#dlg .prog i'); if (bar) { bar.style.width = p + '%'; $('#dlg .job .tc').textContent = Math.round(p) + '%'; $('#dlg .jtxt').textContent = t; } } };
  renderDialog();
  const f0 = S.f;
  try {
    const blob = fmt === 'Lottie' ? await exportLottie(job) : fmt === 'GIF' ? await exportGif(job, w, h, fps, nF) : fmt === 'PNG' ? await exportPng(job, w, h, fps, nF) : await exportMp4(job, w, h, fps, nF);
    if (job.cancel || !blob) { job.status = 'cancel'; }
    else { job.status = 'done'; job.p = 100; job.blob = blob; job.url = URL.createObjectURL(blob); job.size = blob.size; }
  } catch (e) { job.status = 'err'; job.msg = (e && e.message) || String(e); }
  S.f = f0; updateCanvas(); setPF && setPF();
  if (S.dialog === 'export') renderDialog();
}
export const exSave = async () => {
  const j = exportJob; if (!j || !j.blob) return;
  await saveFile(j.name, j.blob, j.url, (msg) => toast(msg));
};
export function exportDialog() {
  const fmt = EX.fmt, j = exportJob, run = j && j.status === 'run';
  const seg = (label, items, cur, act) => `<div class="seg" role="group" aria-label="${label}">${items.map(([t, v, dis]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${String(v) === String(cur)}" ${dis || run ? 'disabled' : ''} ${dis ? 'title="Not available yet"' : ''}>${t}</button>`).join('')}</div>`;
  const job = !j ? '' : j.status === 'run'
    ? `<div class="job"><div class="kv" style="min-height:0"><b>${esc(j.name)}</b><span class="tc">${Math.round(j.p)}%</span></div><div class="prog"><i style="width:${j.p}%"></i></div><span class="jtxt" style="color:var(--muted)">${esc(j.text)}</span></div>`
    : j.status === 'done'
      ? `<div class="job"><div class="kv" style="min-height:0"><b>${esc(j.name)}</b><span class="tc">${fmtSize(j.size)}</span></div>
          ${j.fmt === 'Lottie' ? `<span style="color:var(--muted)">Lottie JSON for web, iOS and Android players.${j.warn && j.warn.length ? ` Not included: ${esc(j.warn.join(', '))}.` : ' Everything in the composition was included.'}</span>` : j.fmt === 'PNG' ? '<span style="color:var(--muted)">ZIP of numbered PNG frames.</span>' : j.fmt === 'GIF' ? `<img src="${j.url}" alt="Exported GIF preview" style="border-radius:8px;max-height:150px;object-fit:contain;background:#0006">` : `<video src="${j.url}" controls muted loop playsinline style="border-radius:8px;max-height:150px;background:#0006"></video>`}
          <span style="color:var(--muted)">${j.dims} · ready. Tap Save to keep it.</span>
          <div style="display:flex;gap:6px"><button class="primary" data-act="exsave">Save file</button></div></div>`
      : j.status === 'err' ? `<div class="job"><span style="color:var(--danger)">${esc(j.msg)}</span></div>` : '';
  return `<h2>Export</h2>
      ${seg('Format', [['MP4', 'MP4'], ['GIF', 'GIF'], ['PNG seq', 'PNG'], ['Lottie', 'Lottie']], fmt, 'expfmt')}
      ${fmt === 'Lottie' ? '<p class="hint" style="padding:0">Vector animation at 1920×1080, 30 fps. Shapes, paths, text, images, trim paths, mattes and blend modes are kept, and motion is baked frame by frame. Effects and shader layers are left out.</p>' : `${seg('Resolution', EX_RES[fmt].map(([t, v]) => [t, v]), EX.res[fmt], 'expres')}
      ${seg('Frame rate', EX_FPS[fmt].map((v) => [v + ' fps', v]), EX.fps[fmt], 'expfps')}`}
      <div class="kv"><span>Range</span><b class="tc">00:00:00 – ${tc(DUR)}</b></div>
      <div class="kv"><span>Transparent background${fmt === 'MP4' ? ' (GIF and PNG only)' : fmt === 'Lottie' ? ' (always)' : ''}</span><button class="tog" data-act="exptrans" aria-pressed="${fmt === 'Lottie' || fmt !== 'MP4' && EX.trans}" aria-label="Transparent background" ${fmt === 'MP4' || fmt === 'Lottie' || run ? 'disabled' : ''}></button></div>
      ${job}
      <div class="foot">${run ? '<button class="line-btn ghost" data-act="excancel">Cancel</button>' : '<button class="line-btn ghost" data-act="close">Close</button><button class="primary" data-act="queue">' + (j && j.status === 'done' ? 'Export again' : 'Export') + '</button>'}</div>`;
}
