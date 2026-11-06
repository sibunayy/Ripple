// Lottie file handling: plain JSON and .lottie (dotLottie zip: manifest.json + animations/*.json + images/*).
import { strFromU8, unzipSync } from 'fflate';
import { importAssetFile } from '../io/assets';
import type { AssetMeta } from '../model/project';
import { importLottie, type LottieImport } from './import';

const mimeOf = (name: string) => (/\.png$/i.test(name) ? 'image/png' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : /\.webp$/i.test(name) ? 'image/webp' : /\.svg$/i.test(name) ? 'image/svg+xml' : 'application/octet-stream');
const b64 = (u8: Uint8Array) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };

async function loadImage(dataUri: string, name: string): Promise<AssetMeta | null> {
  try {
    const blob = await (await fetch(dataUri)).blob();
    return await importAssetFile(new File([blob], `${name}.${blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'}`, { type: blob.type }));
  } catch { return null; }
}

export async function importLottieBlob(file: Blob): Promise<LottieImport> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  let json: any;
  if (head[0] === 0x50 && head[1] === 0x4b) { // PK — dotLottie
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const manifest = files['manifest.json'] ? JSON.parse(strFromU8(files['manifest.json'])) : null;
    const id = manifest?.animations?.[0]?.id;
    const path = (id && files[`animations/${id}.json`] ? `animations/${id}.json` : Object.keys(files).find((k) => /^animations\/.+\.json$/.test(k)));
    if (!path) throw new Error('This .lottie file contains no animation.');
    json = JSON.parse(strFromU8(files[path]!));
    for (const a of json.assets ?? []) { // inline relative images so the importer sees data URIs
      if (typeof a.p === 'string' && !a.p.startsWith('data:')) {
        const f = files[`images/${a.p}`] ?? files[`${a.u ?? ''}${a.p}`] ?? files[a.p];
        if (f) { a.p = `data:${mimeOf(a.p)};base64,${b64(f)}`; a.u = ''; }
      }
    }
  } else {
    try { json = JSON.parse(await file.text()); } catch { throw new Error('This file is not valid JSON or a .lottie archive.'); }
  }
  return importLottie(json, { loadImage });
}
