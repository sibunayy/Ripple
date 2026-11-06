// `.ripple` project bundles (spec §7.14): a zip with manifest.json, project.json, assets/<sha256> and fonts/<family>.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { migrate, newId, type Project } from '../model/project';
import { getAssetBlob, sha256, storeAsset } from './assets';
import { loadFonts, saveProject } from './store';
import { addFontData } from '../text/fonts';

export const BUNDLE_FORMAT = 'ripple-project';
export interface Manifest { format: typeof BUNDLE_FORMAT; version: 1; app: string; name: string; created: number; assets: string[]; fonts: string[] }

const allLayers = (p: Project) => [p.layers, ...Object.values(p.comps).map((c) => c.layers)].flat();

/** Build a bundle for a (root) project: JSON + every referenced asset + imported fonts used by text layers. */
export async function buildBundle(p: Project): Promise<Blob> {
  const files: Zippable = {};
  const used = new Set(allLayers(p).map((l) => l.media?.asset).filter(Boolean) as string[]);
  const assets: string[] = [];
  for (const hash of used) {
    const b = await getAssetBlob(hash); if (!b) continue;
    files[`assets/${hash}`] = [new Uint8Array(await b.arrayBuffer()), { level: 0 }]; assets.push(hash);
  }
  const fontsUsed = new Set(allLayers(p).filter((l) => l.text).map((l) => l.text!.font));
  const fonts: string[] = [];
  try {
    for (const f of await loadFonts()) {
      if (![...fontsUsed].some((css) => css.includes(`"${f.family}"`))) continue;
      files[`fonts/${f.family}`] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }]; fonts.push(f.family);
    }
  } catch { /* fonts are optional */ }
  const manifest: Manifest = { format: BUNDLE_FORMAT, version: 1, app: 'RippleFlow', name: p.name, created: Date.now(), assets, fonts };
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  files['project.json'] = [strToU8(JSON.stringify(p)), { level: 6 }];
  return new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

export interface ImportResult { project: Project; warnings: string[] }

/** Read a bundle, store its assets/fonts, and save the project under a fresh id. */
export async function importBundle(file: Blob): Promise<ImportResult> {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(await file.arrayBuffer())); } catch { throw new Error('This file is not a valid .ripple bundle.'); }
  const mf = files['manifest.json'], pj = files['project.json'];
  if (!mf || !pj) throw new Error('This file is not a RippleFlow project bundle.');
  const manifest = JSON.parse(strFromU8(mf)) as Manifest;
  if (manifest.format !== BUNDLE_FORMAT) throw new Error('Unrecognised bundle format.');
  if (manifest.version > 1) throw new Error('This bundle was made by a newer version of RippleFlow.');
  const warnings: string[] = [];
  for (const [path, data] of Object.entries(files)) {
    if (path.startsWith('assets/')) {
      const hash = path.slice(7);
      if ((await sha256(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)) !== hash) { warnings.push(`Skipped a damaged asset (${hash.slice(0, 8)}…)`); continue; }
      const meta = (JSON.parse(strFromU8(pj)) as Project).assets?.[hash];
      await storeAsset(hash, new Blob([data as Uint8Array<ArrayBuffer>], { type: meta?.mime ?? '' }));
    } else if (path.startsWith('fonts/')) {
      try { await addFontData(path.slice(6), data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer); } catch { warnings.push(`Could not load font ${path.slice(6)}`); }
    }
  }
  const raw = JSON.parse(strFromU8(pj)) as Project;
  const now = Date.now();
  const project = migrate({ ...raw, id: newId(), name: raw.name ?? manifest.name ?? 'Imported', created: now, modified: now });
  await saveProject(project);
  return { project, warnings };
}
