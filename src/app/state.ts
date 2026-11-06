import { signal } from '@preact/signals';
import { createProject, sanitizeSettings, type Project, type ProjectSettings } from '../model/project';
import { History } from '../model/history';
import { createLayer, type Layer, type TransformKey, type Vec2, type Prop } from '../model/layer';
import { evalProp, writeProp, toggleAnimated } from '../anim/interp';
import { reparent } from '../eval/evaluate';
import { deleteProject, listProjects, loadProject, saveProject, type ProjectMeta } from '../io/store';

export const library = signal<ProjectMeta[]>([]);
export const current = signal<Project | null>(null);
export const saveState = signal<'saved' | 'dirty' | 'saving' | 'error'>('saved');
/** Selected layer ids (UI state; never part of history). */
export const selection = signal<string[]>([]);
/** Playhead in frames. Integer when paused; fractional while playing. */
export const playhead = signal(0);
/** Bumped on undo/redo/commit so toolbar buttons can re-render. */
export const historyRev = signal(0);

const history = new History<Project>();
export const canUndo = () => (historyRev.value, history.canUndo);
export const canRedo = () => (historyRev.value, history.canRedo);
export const undoLabel = () => (historyRev.value, history.undoLabel);

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

const touch = () => {
  saveState.value = 'dirty';
  historyRev.value++;
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
};

/** Apply an undoable edit. Edits sharing `key` within ~0.8 s (e.g. a drag) collapse into one undo step. */
export function commit(label: string, fn: (p: Project) => Project, key?: string) {
  const before = current.value;
  if (!before) return;
  const after = fn(before);
  if (after === before) return;
  history.record(before, label, key);
  current.value = { ...after, modified: Date.now() };
  touch();
}

const restoreSelection = () => {
  const ids = new Set(current.value?.layers.map((l) => l.id));
  selection.value = selection.value.filter((id) => ids.has(id));
};
export function undo() {
  const cur = current.value; if (!cur) return;
  const prev = history.undo(cur);
  if (prev) { current.value = prev; restoreSelection(); touch(); }
}
export function redo() {
  const cur = current.value; if (!cur) return;
  const next = history.redo(cur);
  if (next) { current.value = next; restoreSelection(); touch(); }
}

export const rename = (name: string) => commit('Rename project', (p) => ({ ...p, name: name.trim() || 'Untitled' }));
export const setSettings = (patch: Partial<ProjectSettings>) =>
  commit('Project settings', (p) => ({ ...p, settings: sanitizeSettings({ ...p.settings, ...patch }) }), 'settings');

// ---- layers ----------------------------------------------------------------

export const frame = () => Math.round(playhead.peek());
const mapLayer = (p: Project, id: string, fn: (l: Layer) => Layer): Project =>
  ({ ...p, layers: p.layers.map((l) => (l.id === id ? fn(l) : l)) });

export function addLayer(type: Layer['type']) {
  const p = current.value; if (!p) return;
  const layer = createLayer(type, p.settings, p.layers.length);
  commit(`Add ${type} layer`, (q) => ({ ...q, layers: [layer, ...q.layers] }));
  selection.value = [layer.id];
}

export function deleteLayers(ids: string[]) {
  if (!ids.length) return;
  const gone = new Set(ids);
  commit('Delete layer', (p) => ({
    ...p,
    layers: p.layers.filter((l) => !gone.has(l.id)).map((l) => (l.parent && gone.has(l.parent) ? { ...l, parent: undefined } : l)),
  }));
  restoreSelection();
}

export function duplicateLayers(ids: string[]) {
  const p = current.value; if (!p || !ids.length) return;
  const src = p.layers.filter((l) => ids.includes(l.id));
  const copies = src.map((l) => ({ ...l, id: createProject().id, name: `${l.name} copy` }));
  commit('Duplicate layer', (q) => ({ ...q, layers: [...copies, ...q.layers] }));
  selection.value = copies.map((l) => l.id);
}

export function moveLayer(id: string, dir: -1 | 1) {
  commit('Reorder layer', (p) => {
    const i = p.layers.findIndex((l) => l.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= p.layers.length) return p;
    const layers = p.layers.slice();
    [layers[i], layers[j]] = [layers[j]!, layers[i]!];
    return { ...p, layers };
  });
}

export const renameLayer = (id: string, name: string) =>
  commit('Rename layer', (p) => mapLayer(p, id, (l) => ({ ...l, name: name.trim() || l.name })));
export const toggleVisible = (id: string) =>
  commit('Toggle visibility', (p) => mapLayer(p, id, (l) => ({ ...l, visible: !l.visible })));
export const setParent = (id: string, parentId: string | undefined) =>
  commit('Set parent', (p) => ({ ...p, layers: reparent(p.layers, id, parentId, frame()) }));
export const setLayerColor = (id: string, color: Layer['color']) =>
  commit('Layer colour', (p) => mapLayer(p, id, (l) => ({ ...l, color })), `color:${id}`);

export function setTiming(id: string, inF: number, outF: number, key?: string) {
  commit('Trim layer', (p) => mapLayer(p, id, (l) => {
    const i = Math.round(inF), o = Math.max(i + 1, Math.round(outF));
    return i === l.in && o === l.out ? l : { ...l, in: i, out: o };
  }), key);
}

/** Write a transform value at the playhead (auto-keys when the property is animated). */
export function setTransform(id: string, prop: TransformKey, value: number | Vec2, key?: string) {
  const t = frame();
  commit(`Edit ${prop}`, (p) => mapLayer(p, id, (l) => ({
    ...l, transform: { ...l.transform, [prop]: writeProp(l.transform[prop] as Prop<never>, t, value as never) },
  })), key ?? `${prop}:${id}`);
}

export function toggleStopwatch(id: string, prop: TransformKey) {
  const t = frame();
  commit('Toggle animation', (p) => mapLayer(p, id, (l) => ({
    ...l, transform: { ...l.transform, [prop]: toggleAnimated(l.transform[prop] as Prop<never>, t) },
  })));
}

export const valueAt = (l: Layer, prop: TransformKey, t = frame()) => evalProp(l.transform[prop] as Prop<never>, t) as number | Vec2;

// ---- project lifecycle -------------------------------------------------------

function open(p: Project) {
  history.clear(); historyRev.value++;
  selection.value = [];
  playhead.value = 0;
  current.value = p;
  saveState.value = 'saved';
}

export async function newProject(): Promise<void> {
  const p = createProject(`Untitled ${library.value.length + 1}`);
  await saveProject(p);
  open(p);
  await refreshLibrary();
}

export async function openProject(id: string): Promise<void> {
  const p = await loadProject(id);
  if (p) open(p);
}

export async function closeProject(): Promise<void> {
  await flush();
  current.value = null;
  history.clear();
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
