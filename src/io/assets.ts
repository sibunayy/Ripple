// Content-addressed asset store (spec §7.10): files are keyed by SHA-256, kept in OPFS (IndexedDB fallback),
// and referenced from projects by hash — so duplicate imports dedupe and duplicated projects share media.
import { kvDel, kvGet, kvPut, opfsAvailable, opfsSub } from './store';
import type { AssetMeta } from '../model/project';

export async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function storeAsset(hash: string, blob: Blob): Promise<void> {
  if (opfsAvailable()) {
    try {
      const f = await (await opfsSub('assets')).getFileHandle(hash, { create: true });
      const w = await f.createWritable(); await w.write(blob); await w.close();
      return;
    } catch { /* fall through to IndexedDB */ }
  }
  await kvPut(`asset:${hash}`, blob);
}

export async function getAssetBlob(hash: string): Promise<Blob | null> {
  if (opfsAvailable()) {
    try { return await (await (await opfsSub('assets')).getFileHandle(hash)).getFile(); } catch { /* maybe in IndexedDB */ }
  }
  return ((await kvGet<Blob>(`asset:${hash}`)) as Blob | undefined) ?? null;
}

export async function deleteAsset(hash: string): Promise<void> {
  if (opfsAvailable()) { try { await (await opfsSub('assets')).removeEntry(hash); } catch { /* not there */ } }
  await kvDel(`asset:${hash}`);
}

const kindOf = (f: Blob & { name?: string }): AssetMeta['kind'] | null => {
  const t = f.type, n = (f.name ?? '').toLowerCase();
  if (t === 'image/svg+xml' || n.endsWith('.svg')) return 'svg';
  if (t.startsWith('image/') || /\.(png|jpe?g|webp|avif|gif|heic|heif)$/.test(n)) return 'image';
  if (t.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/.test(n)) return 'video';
  return null;
};

function probeVideo(blob: Blob): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video'), url = URL.createObjectURL(blob);
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    v.onloadedmetadata = () => { resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration }); URL.revokeObjectURL(url); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This video format cannot be decoded by the browser.')); };
    v.src = url;
  });
}

function svgSize(text: string): { width: number; height: number } {
  const vb = /viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)/.exec(text);
  if (vb) return { width: Math.max(1, +vb[3]!), height: Math.max(1, +vb[4]!) };
  const w = /<svg[^>]*\swidth\s*=\s*["']([\d.]+)/.exec(text), h = /<svg[^>]*\sheight\s*=\s*["']([\d.]+)/.exec(text);
  return { width: w ? +w[1]! : 512, height: h ? +h[1]! : 512 };
}

/** Hash, store and describe a picked file. Throws with a user-readable message for unsupported files. */
export async function importAssetFile(file: File): Promise<AssetMeta> {
  const kind = kindOf(file);
  if (!kind) throw new Error(`“${file.name}” is not a supported image, SVG or video file.`);
  const buf = await file.arrayBuffer(), hash = await sha256(buf);
  const blob = new Blob([buf], { type: file.type || (kind === 'svg' ? 'image/svg+xml' : '') });
  let dims: { width: number; height: number; duration?: number };
  if (kind === 'video') dims = await probeVideo(blob);
  else if (kind === 'svg') dims = svgSize(await blob.text());
  else { const bm = await createImageBitmap(blob); dims = { width: bm.width, height: bm.height }; bm.close(); }
  await storeAsset(hash, blob);
  return { hash, name: file.name, kind, mime: blob.type, width: dims.width, height: dims.height, duration: dims.duration, size: blob.size };
}
