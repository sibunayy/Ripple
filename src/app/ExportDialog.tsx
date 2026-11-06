import { useRef, useState } from 'preact/hooks';
import { current, frame, rootProject } from './state';
import { workRange } from '../model/project';
import type { ExportKind, ExportResult } from '../export/export';

const KIND_LABEL: Record<ExportKind, string> = { mp4: 'MP4 video (H.264)', 'png-seq': 'PNG sequence (.zip)', png: 'Current frame (PNG)' };

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<ExportKind>('mp4');
  const [scale, setScale] = useState(1);
  const [range, setRange] = useState<'work' | 'all'>('work');
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [prog, setProg] = useState<[number, number]>([0, 1]);
  const [msg, setMsg] = useState('');
  const [result, setResult] = useState<ExportResult | null>(null);
  const abort = useRef<AbortController | null>(null);
  const p = current.value!;
  const [a, b] = workRange(p);
  const frames = kind === 'png' ? 1 : range === 'work' ? b - a : p.settings.duration;
  const dims = `${Math.max(2, Math.floor((p.settings.width * scale) / 2) * 2)}×${Math.max(2, Math.floor((p.settings.height * scale) / 2) * 2)}`;

  const start = async () => {
    setState('running'); setMsg(''); setProg([0, frames]);
    abort.current = new AbortController();
    try {
      const { runExport } = await import('../export/export');
      const r = await runExport(rootProject(), { kind, scale, range, frame: frame(), signal: abort.current.signal, onProgress: (d, t) => setProg([d, t]) });
      setResult(r); setState('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setState('idle'); return; }
      setMsg((e as Error).message); setState('error');
    }
  };
  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob), el = document.createElement('a');
    el.href = url; el.download = result.name; document.body.append(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const share = async () => {
    if (!result) return;
    const file = new File([result.blob], result.name, { type: result.mime });
    try { if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: result.name }); else download(); }
    catch (e) { if ((e as Error).name !== 'AbortError') download(); }
  };

  return (
    <div class="scrim" onClick={() => state !== 'running' && onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-label="Export" onClick={(e) => e.stopPropagation()}>
        <h2>Export</h2>
        <label>Format
          <select value={kind} disabled={state === 'running'} onChange={(e) => setKind((e.target as HTMLSelectElement).value as ExportKind)}>
            {(Object.keys(KIND_LABEL) as ExportKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <div class="two">
          <label>Resolution
            <select value={scale} disabled={state === 'running'} onChange={(e) => setScale(Number((e.target as HTMLSelectElement).value))}>
              <option value={1}>Full</option><option value={0.5}>Half</option><option value={0.25}>Quarter</option>
            </select>
          </label>
          <label>Range
            <select value={range} disabled={state === 'running' || kind === 'png'} onChange={(e) => setRange((e.target as HTMLSelectElement).value as 'work' | 'all')}>
              <option value="work">Work area</option><option value="all">Whole comp</option>
            </select>
          </label>
        </div>
        <p class="hint">{dims} · {frames} frame{frames === 1 ? '' : 's'}{kind !== 'png' ? ` · ${(frames / p.settings.fps).toFixed(1)} s` : ''}</p>
        {state === 'running' && <progress aria-label="Export progress" max={prog[1]} value={prog[0]} />}
        {state === 'error' && <p class="gl-error-inline" role="alert">{msg}</p>}
        {state === 'done' && result && <p role="status">Done: {result.name} · {(result.blob.size / 1e6).toFixed(1)} MB · {(result.ms / 1000).toFixed(1)} s ({((result.frames / p.settings.fps) / (result.ms / 1000)).toFixed(1)}× realtime)</p>}
        <div class="row">
          {state === 'running' ? <button class="btn danger" onClick={() => abort.current?.abort()}>Cancel</button>
            : state === 'done' ? <><button class="btn" onClick={download}>Download</button><button class="btn primary" onClick={() => void share()}>Share…</button></>
            : <><button class="btn" onClick={onClose}>Close</button><button class="btn primary" onClick={() => void start()}>Export</button></>}
        </div>
      </div>
    </div>
  );
}
