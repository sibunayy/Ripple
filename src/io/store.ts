// Project library persistence (spec §3, §5.2): OPFS for project files, IndexedDB for the index.
// If OPFS is unavailable the project JSON is kept in IndexedDB as well.
import type { Project } from '../model/project';

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

export async function saveProject(p: Project): Promise<void> {
  const json = JSON.stringify(p);
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
  return json ? (JSON.parse(json) as Project) : null;
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
