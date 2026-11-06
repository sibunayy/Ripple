import { signal } from '@preact/signals';
import { createProject, sanitizeSettings, type Project, type ProjectSettings } from '../model/project';
import { deleteProject, listProjects, loadProject, saveProject, type ProjectMeta } from '../io/store';

export const library = signal<ProjectMeta[]>([]);
export const current = signal<Project | null>(null);
export const saveState = signal<'saved' | 'dirty' | 'saving' | 'error'>('saved');

export const refreshLibrary = async () => { library.value = await listProjects(); };

let timer: ReturnType<typeof setTimeout> | undefined;

/** Write now. Called on idle, on leaving the editor, and on pagehide. */
export async function flush() {
  clearTimeout(timer);
  const p = current.value;
  if (!p || saveState.value === 'saved') return;
  saveState.value = 'saving';
  try { await saveProject(p); saveState.value = 'saved'; }
  catch (e) { console.error(e); saveState.value = 'error'; }
}

/** Replace the current project and schedule an autosave (spec §3: ~10 s idle; shorter here as M0 docs are tiny). */
export function update(fn: (p: Project) => Project) {
  const p = current.value;
  if (!p) return;
  current.value = { ...fn(p), modified: Date.now() };
  saveState.value = 'dirty';
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}

export const rename = (name: string) => update((p) => ({ ...p, name: name.trim() || 'Untitled' }));
export const setSettings = (patch: Partial<ProjectSettings>) =>
  update((p) => ({ ...p, settings: sanitizeSettings({ ...p.settings, ...patch }) }));

export async function newProject(): Promise<void> {
  const p = createProject(`Untitled ${library.value.length + 1}`);
  await saveProject(p);
  current.value = p;
  saveState.value = 'saved';
  await refreshLibrary();
}

export async function openProject(id: string): Promise<void> {
  const p = await loadProject(id);
  if (p) { current.value = p; saveState.value = 'saved'; }
}

export async function closeProject(): Promise<void> {
  await flush();
  current.value = null;
  await refreshLibrary();
}

export async function removeProject(id: string): Promise<void> {
  await deleteProject(id);
  await refreshLibrary();
}

export async function duplicateProject(id: string): Promise<void> {
  const src = await loadProject(id);
  if (!src) return;
  const now = Date.now();
  await saveProject({ ...src, id: createProject().id, name: `${src.name} copy`, created: now, modified: now });
  await refreshLibrary();
}

if (typeof window !== 'undefined') {
  addEventListener('pagehide', () => void flush());
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush(); });
}
