import { useEffect, useState } from 'preact/hooks';
import { addAssetLayer, assetUsage, current, importMedia, removeAsset } from './state';
import { getAssetBlob } from '../io/assets';
import type { AssetMeta } from '../model/project';

function Thumb({ a }: { a: AssetMeta }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let u = '', dead = false;
    if (a.kind !== 'video') void getAssetBlob(a.hash).then((b) => { if (b && !dead) { u = URL.createObjectURL(b); setUrl(u); } });
    return () => { dead = true; if (u) URL.revokeObjectURL(u); };
  }, [a.hash]);
  return <div class="athumb">{url ? <img src={url} alt="" /> : <span>{a.kind === 'video' ? '▶︎' : '…'}</span>}</div>;
}

export function AssetsPanel() {
  const p = current.value!;
  const list = Object.values(p.assets);
  const fmt = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
  return (
    <div class="inspector">
      <h2>Assets</h2>
      <label class="btn sm filebtn">＋ Import media…
        <input type="file" multiple accept="image/*,video/*,.svg,.heic,.avif" hidden onChange={(e) => { const fs = Array.from((e.target as HTMLInputElement).files ?? []); if (fs.length) void importMedia(fs); (e.target as HTMLInputElement).value = ''; }} />
      </label>
      {!list.length && <p class="hint">Images, SVG and video you import appear here. You can also drop files onto the viewer.</p>}
      <ul class="assets">
        {list.map((a) => {
          const used = assetUsage(p, a.hash);
          return (
            <li key={a.hash}>
              <Thumb a={a} />
              <div class="ameta"><strong title={a.name}>{a.name}</strong>
                <span>{a.kind} · {a.width}×{a.height}{a.duration ? ` · ${a.duration.toFixed(1)} s` : ''} · {fmt(a.size)}</span>
                <span>{used ? `Used in ${used} layer${used > 1 ? 's' : ''}` : 'Unused'}</span></div>
              <div class="seg">
                <button class="btn sm" onClick={() => addAssetLayer(a)} aria-label={`Add ${a.name} to composition`}>Add</button>
                <button class="btn sm danger" disabled={used > 0} onClick={() => removeAsset(a.hash)} aria-label={`Remove ${a.name}`}>✕</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
