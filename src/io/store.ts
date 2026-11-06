// Project library persistence (spec §3, §5.2): OPFS for project files, IndexedDB for the index.
// If OPFS is unavailable the project JSON is kept in IndexedDB as well.
import { migrate, type Project } from '../model/project';

export interface ProjectMeta {
  id: string;
  name: string;
  modified: number;
  width: number;
  height: number;
  fps: number;
}

const DB = 'ripple';
const INDEX = 'index';
const BLOBS = 'blobs';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(INDEX, { keyPath: 'id' });
      req.result.createObjectStore(BLOBS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  try {
    return await new Promise<T>((resolve, reject) => {
      const r = fn(d.transaction(store, mode).objectStore(store));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    d.close();
  }
}

const hasOPFS = () => typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;

async function dir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('projects', { create: true });
}

let persistAsked = false;
async function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
}

// Version snapshots: at most one per minute, newest five, kept in IndexedDB. Used for restore and corruption recovery.
const lastJson = new Map<string, string>(), lastSnap = new Map<string, number>();
export interface Snapshot { t: number; json: string }
const SNAP_EVERY = 60_000, SNAP_KEEP = 5;
async function readSnaps(id: string): Promise<Snapshot[]> {
  try { return JSON.parse(((await tx<string | undefined>(BLOBS, 'readonly', (s) => s.get(`snaps:${id}`))) as string | undefined) ?? '[]') as Snapshot[]; } catch { return []; }
}
async function pushSnapshot(id: string, json: string) {
  const arr = (await readSnaps(id)).filter((s) => s.json !== json);
  arr.unshift({ t: Date.now(), json });
  await tx(BLOBS, 'readwrite', (s) => s.put(JSON.stringify(arr.slice(0, SNAP_KEEP)), `snaps:${id}`));
}
export async function listSnapshots(id: string): Promise<{ t: number; size: number }[]> { return (await readSnaps(id)).map((s) => ({ t: s.t, size: s.json.length })); }
export async function getSnapshot(id: string, i: number): Promise<Project | null> { const s = (await readSnaps(id))[i]; return s ? migrate(JSON.parse(s.json) as Project) : null; }
/** Set when the last loadProject had to fall back to a snapshot because the file was unreadable. */
export let lastLoadRecovered = false;

export async function saveProject(p: Project): Promise<void> {
  const json = JSON.stringify(p);
  const prev = lastJson.get(p.id), now = Date.now();
  if (prev && prev !== json && now - (lastSnap.get(p.id) ?? 0) > SNAP_EVERY) { lastSnap.set(p.id, now); try { await pushSnapshot(p.id, prev); } catch { /* best effort */ } }
  lastJson.set(p.id, json);
  if (hasOPFS()) {
    const f = await (await dir()).getFileHandle(`${p.id}.json`, { create: true });
    const w = await f.createWritable();
    await w.write(json);
    await w.close();
  } else {
    await tx(BLOBS, 'readwrite', (s) => s.put(json, p.id));
  }
  const meta: ProjectMeta = {
    id: p.id, name: p.name, modified: p.modified,
    width: p.settings.width, height: p.settings.height, fps: p.settings.fps,
  };
  await tx(INDEX, 'readwrite', (s) => s.put(meta));
  void askPersist();
}

export async function loadProject(id: string): Promise<Project | null> {
  let json: string | undefined;
  if (hasOPFS()) {
    try { json = await (await (await dir()).getFileHandle(`${id}.json`)).getFile().then((f) => f.text()); } catch { return null; }
  } else {
    json = await tx<string | undefined>(BLOBS, 'readonly', (s) => s.get(id));
  }
  lastLoadRecovered = false;
  if (!json) return null;
  try { const p = migrate(JSON.parse(json) as Project); lastJson.set(id, json); return p; }
  catch {
    for (const s of await readSnaps(id)) { try { const p = migrate(JSON.parse(s.json) as Project); lastLoadRecovered = true; lastJson.set(id, s.json); return p; } catch { /* next */ } }
    return null;
  }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const all = await tx<ProjectMeta[]>(INDEX, 'readonly', (s) => s.getAll());
  return all.sort((a, b) => b.modified - a.modified);
}

export async function deleteProject(id: string): Promise<void> {
  if (hasOPFS()) { try { await (await dir()).removeEntry(`${id}.json`); } catch { /* already gone */ } }
  else await tx(BLOBS, 'readwrite', (s) => s.delete(id));
  await tx(INDEX, 'readwrite', (s) => s.delete(id));
}

// ---- fonts (app-level, shared by all projects) -------------------------------------------------------

export interface FontRecord { family: string; blob: Blob }

export async function saveFont(family: string, blob: Blob): Promise<void> {
  await tx(BLOBS, 'readwrite', (s) => s.put(blob, `font:${family}`));
}
export async function loadFonts(): Promise<FontRecord[]> {
  const d = await db();
  try {
    return await new Promise<FontRecord[]>((resolve, reject) => {
      const out: FontRecord[] = [];
      const r = d.transaction(BLOBS, 'readonly').objectStore(BLOBS).openCursor(IDBKeyRange.bound('font:', 'font:\uffff'));
      r.onsuccess = () => {
        const c = r.result;
        if (c) { out.push({ family: String(c.key).slice(5), blob: c.value as Blob }); c.continue(); } else resolve(out);
      };
      r.onerror = () => reject(r.error);
    });
  } finally { d.close(); }
}
export async function deleteFont(family: string): Promise<void> {
  await tx(BLOBS, 'readwrite', (s) => s.delete(`font:${family}`));
}

// ---- user presets (app-level) ---------------------------------------------------------------------------------

export async function savePresetRecord(id: string, json: string): Promise<void> { await tx(BLOBS, 'readwrite', (s) => s.put(json, `preset:${id}`)); }
export async function deletePresetRecord(id: string): Promise<void> { await tx(BLOBS, 'readwrite', (s) => s.delete(`preset:${id}`)); }
export async function loadPresetRecords(): Promise<string[]> {
  const d = await db();
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const out: string[] = [];
      const r = d.transaction(BLOBS, 'readonly').objectStore(BLOBS).openCursor(IDBKeyRange.bound('preset:', 'preset:￿'));
      r.onsuccess = () => { const c = r.result; if (c) { out.push(String(c.value)); c.continue(); } else resolve(out); };
      r.onerror = () => reject(r.error);
    });
  } finally { d.close(); }
}

// ---- generic blob store (assets, thumbnails) ---------------------------------------------------------------------

export const kvPut = (key: string, value: Blob | string): Promise<unknown> => tx(BLOBS, 'readwrite', (s) => s.put(value, key));
export const kvGet = <T = Blob | string>(key: string): Promise<T | undefined> => tx<T | undefined>(BLOBS, 'readonly', (s) => s.get(key));
export const kvDel = (key: string): Promise<unknown> => tx(BLOBS, 'readwrite', (s) => s.delete(key));
export const opfsAvailable = hasOPFS;
export async function opfsSub(name: string): Promise<FileSystemDirectoryHandle> {
  return (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
}
