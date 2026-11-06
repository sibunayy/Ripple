import { useState } from 'preact/hooks';
import { useDialog } from '../ui/dialog';
import { current, frame, rootProject } from './state';
import { workRange } from '../model/project';
import { KIND_INFO, type ExportKind } from '../export/export';
import { cancel, dismiss, enqueue, jobs, restart } from '../export/queue';
import { downloadBlob, shareBlob } from '../io/download';

const ORDER: ExportKind[] = ['mp4', 'webm', 'gif', 'png-seq', 'jpeg-seq', 'webp-seq', 'png', 'jpeg', 'webp', 'lottie', 'ripple'];

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<ExportKind>('mp4');
  const [scale, setScale] = useState(1);
  const [range, setRange] = useState<'work' | 'all'>('work');
  const [fps, setFps] = useState(0);
  const [transparent, setTransparent] = useState(false);
  const dlg = useDialog<HTMLDivElement>(onClose);
  const p = current.value!;
  const info = KIND_INFO[kind];
  const [a, b] = workRange(p);
  const outFps = fps || p.settings.fps;
  const span = range === 'work' ? b - a : p.settings.duration;
  const frames = info.still || kind === 'ripple' ? 1 : Math.max(1, Math.floor((span * outFps) / p.settings.fps));
  const dims = `${Math.max(2, Math.round(p.settings.width * scale))}×${Math.max(2, Math.round(p.settings.height * scale))}`;
  const media = kind !== 'ripple' && kind !== 'lottie';

  const start = () => enqueue(rootProject(), kind, { kind, scale: kind === 'gif' && scale === 1 ? 0.5 : scale, range, frame: frame(), fps: fps || undefined, transparent: transparent && !!info.alpha });
  const list = jobs.value;

  return (
    <div class="scrim" onClick={onClose}>
      <div class="dialog" role="dialog" aria-modal="true" aria-label="Export" ref={dlg} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <h2>Export</h2>
        <label>Format
          <select value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as ExportKind)}>
            {ORDER.map((k) => <option key={k} value={k}>{KIND_INFO[k].label}</option>)}
          </select>
        </label>
        {media && <>
          <div class="two">
            <label>Resolution
              <select value={scale} onChange={(e) => setScale(Number((e.target as HTMLSelectElement).value))}>
                <option value={1}>Full</option><option value={0.5}>Half</option><option value={0.25}>Quarter</option>
              </select>
            </label>
            <label>Range
              <select value={range} disabled={!!info.still} onChange={(e) => setRange((e.target as HTMLSelectElement).value as 'work' | 'all')}>
                <option value="work">Work area</option><option value="all">Whole comp</option>
              </select>
            </label>
          </div>
          {!info.still && <label>Frame rate
            <select value={fps} onChange={(e) => setFps(Number((e.target as HTMLSelectElement).value))}>
              <option value={0}>Project ({p.settings.fps} fps)</option>{[12, 15, 24, 25, 30, 50, 60].map((f) => <option key={f} value={f}>{f} fps</option>)}
            </select>
          </label>}
          {info.alpha && <label class="check"><input type="checkbox" checked={transparent} onChange={(e) => setTransparent((e.target as HTMLInputElement).checked)} /> Transparent background</label>}
          <p class="hint">{dims}{kind === 'gif' && scale === 1 ? ' (GIFs default to half size)' : ''} · {frames} frame{frames === 1 ? '' : 's'}{!info.still ? ` · ${(frames / outFps).toFixed(1)} s` : ''}</p>
        </>}
        {kind === 'lottie' && <p class="hint">Exports vector layers, transforms, keyframes, masks, mattes, precomps and basic text for lottie-web compatible players. Anything that can’t be represented is listed after export.</p>}
        {kind === 'ripple' && <p class="hint">A single file with the project, its media and imported fonts. Import it from the library on any device.</p>}
        <div class="row"><button class="btn" onClick={onClose}>Close</button><button class="btn primary" onClick={start}>{kind === 'ripple' ? 'Create backup' : kind === 'lottie' ? 'Export Lottie' : 'Add to queue'}</button></div>

        {list.length > 0 && (
          <section class="sec"><h3>Queue</h3>
            <ul class="jobs">
              {list.map((j) => (
                <li key={j.id} class={`job ${j.status}`}>
                  <div class="jtop"><strong>{j.name}</strong><span class="jstat">{j.status}</span></div>
                  {j.status === 'running' && <progress aria-label="Export progress" max={Math.max(1, j.total)} value={j.done} />}
                  {j.status === 'error' && <p class="gl-error-inline" role="alert">{j.error}</p>}
                  {j.status === 'done' && j.result && <p class="hint" role="status">{j.result.name} · {(j.result.blob.size / 1e6).toFixed(1)} MB{j.result.frames > 1 ? ` · ${(j.result.frames / p.settings.fps / (j.result.ms / 1000)).toFixed(1)}× realtime` : ''}</p>}
                  {j.status === 'done' && j.result?.notes && (j.result.notes.length ? <ul class="notes" aria-label="Compatibility report">{j.result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : <p class="hint">No compatibility issues.</p>)}
                  <div class="seg">
                    {j.status === 'done' && j.result && <><button class="btn sm" onClick={() => downloadBlob(j.result!.blob, j.result!.name)}>Download</button><button class="btn sm primary" onClick={() => void shareBlob(j.result!.blob, j.result!.name, j.result!.mime)}>Share…</button></>}
                    {(j.status === 'running' || j.status === 'queued') && <button class="btn sm danger" onClick={() => cancel(j.id)}>Cancel</button>}
                    {(j.status === 'interrupted' || j.status === 'error' || j.status === 'cancelled') && <button class="btn sm" onClick={() => void restart(j.id)}>Restart</button>}
                    {j.status !== 'running' && <button class="btn sm" aria-label="Remove job" onClick={() => dismiss(j.id)}>✕</button>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
