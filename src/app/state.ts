import { signal } from '@preact/signals';
import { createProject, newId, sanitizeSettings, workRange, type Project, type ProjectSettings } from '../model/project';
import { History } from '../model/history';
import { createLayer, createShapeLayer, createTextLayer, propOf, withProp, type BezPath, type Layer, type PropKey, type ShapeContent, type ShapeKind, type TextContent, type Vec2, type Prop } from '../model/layer';
import { recenter } from '../shape/path';
import { shapePath } from '../shape/geometry';
import { evalProp, writeProp, toggleAnimated } from '../anim/interp';
import { reparent } from '../eval/evaluate';
import { copyKeys, deleteKeys, moveKeys, nextKeyTime, pasteKeys, pruneRefs, setEaseOnKeys, setKeyValue, type ClipEntry, type KeyRef } from '../anim/keys';
import type { Ease } from '../model/layer';
import { deleteProject, listProjects, loadProject, saveProject, type ProjectMeta } from '../io/store';

export const library = signal<ProjectMeta[]>([]);
export const current = signal<Project | null>(null);
export const saveState = signal<'saved' | 'dirty' | 'saving' | 'error'>('saved');
/** Selected layer ids (UI state; never part of history). */
export const selection = signal<string[]>([]);
/** Selected keyframes (UI state). */
export const keySel = signal<KeyRef[]>([]);
/** Layers whose animated properties are expanded in the timeline. */
export const expanded = signal<string[]>([]);
export const selMarker = signal<string | null>(null);
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
  const p = current.value;
  if (p) {
    keySel.value = pruneRefs(p.layers, keySel.value);
    if (selMarker.value && !p.markers.some((m) => m.id === selMarker.value)) selMarker.value = null;
  }
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
export function setProp(id: string, prop: PropKey, value: number | number[], key?: string) {
  const t = frame();
  commit(`Edit ${prop}`, (p) => mapLayer(p, id, (l) => {
    const cur = propOf(l, prop); if (!cur) return l;
    return withProp(l, prop, writeProp(cur as Prop<never>, t, value as never));
  }), key ?? `${prop}:${id}`);
}
export const setTransform = setProp;

export function toggleStopwatch(id: string, prop: PropKey) {
  const t = frame();
  if (!expanded.peek().includes(id)) expanded.value = [...expanded.peek(), id];
  commit('Toggle animation', (p) => mapLayer(p, id, (l) => {
    const cur = propOf(l, prop); return cur ? withProp(l, prop, toggleAnimated(cur as Prop<never>, t)) : l;
  }));
}

export const valueAt = (l: Layer, prop: PropKey, t = frame()) => evalProp(propOf(l, prop) as Prop<never>, t) as number | Vec2;

// ---- shapes & text -------------------------------------------------------------------------------

/** Replace a layer through a pure function (shape/text content edits). */
export const editLayer = (id: string, label: string, fn: (l: Layer) => Layer, key?: string) =>
  commit(label, (p) => mapLayer(p, id, fn), key);

export const editShape = (id: string, fn: (s: ShapeContent) => ShapeContent, key?: string) =>
  editLayer(id, 'Edit shape', (l) => (l.shape ? { ...l, shape: fn(l.shape) } : l), key ? `${key}:${id}` : undefined);

export const editText = (id: string, patch: Partial<TextContent>, key?: string) =>
  editLayer(id, 'Edit text', (l) => (l.text ? { ...l, text: { ...l.text, ...patch } } : l), key ? `${key}:${id}` : undefined);

export const setPath = (id: string, path: BezPath, key?: string) =>
  editShape(id, (s) => ({ ...s, path }), key ?? 'path');

/** Add a shape layer; `key` lets a creation drag coalesce with later size edits into one undo step. */
export function addShape(kind: ShapeKind, at: Vec2, path?: BezPath, key?: string): string | null {
  const p = current.peek(); if (!p) return null;
  let layer = createShapeLayer(kind, p.settings, p.layers.length, at, path);
  if (kind === 'path' && path) { const r = recenter(path); layer = createShapeLayer(kind, p.settings, p.layers.length, [at[0] + r.offset[0], at[1] + r.offset[1]], r.path); }
  commit(`Add ${layer.name}`, (q) => ({ ...q, layers: [layer, ...q.layers] }), key ? `${key}:${layer.id}` : undefined);
  selection.value = [layer.id];
  return layer.id;
}

export function addText(at: Vec2): string | null {
  const p = current.peek(); if (!p) return null;
  const layer = createTextLayer(p.settings, p.layers.length, at);
  commit('Add text layer', (q) => ({ ...q, layers: [layer, ...q.layers] }));
  selection.value = [layer.id];
  return layer.id;
}

/** Turn a primitive (rect/ellipse/polygon/star) into an editable path at the current time. */
export function convertToPath(id: string) {
  const t = frame();
  editLayer(id, 'Convert to path', (l) => {
    if (l.type !== 'shape' || !l.shape || l.shape.kind === 'path') return l;
    const path = shapePath(l, t); if (!path) return l;
    const props = { ...l.props };
    for (const k of Object.keys(props)) if (k.startsWith('shape.')) delete props[k];
    return { ...l, props, shape: { ...l.shape, kind: 'path', path } };
  });
}


// ---- keyframes -----------------------------------------------------------------

export const toggleExpanded = (id: string) =>
  (expanded.value = expanded.value.includes(id) ? expanded.value.filter((x) => x !== id) : [...expanded.value, id]);

let clipboard: ClipEntry[] = [];

/** Move all selected keyframes by dt frames (drags coalesce into one undo step). */
export function moveSelectedKeys(dt: number) {
  if (!dt || !keySel.peek().length) return;
  let refs = keySel.peek();
  commit('Move keyframes', (p) => {
    const r = moveKeys(p.layers, keySel.peek(), dt, p.settings.duration - 1);
    refs = r.refs;
    return { ...p, layers: r.layers };
  }, 'kfmove');
  keySel.value = refs;
}

export function deleteSelectedKeys() {
  const refs = keySel.peek(); if (!refs.length) return;
  commit('Delete keyframes', (p) => ({ ...p, layers: deleteKeys(p.layers, refs) }));
  keySel.value = [];
}

export const setEaseOnSelected = (ease: Ease, refs: KeyRef[] = keySel.peek()) => {
  if (!refs.length) return;
  commit('Change easing', (p) => ({ ...p, layers: setEaseOnKeys(p.layers, refs, ease) }), refs.length === 1 ? `ease:${refs[0]!.layer}:${refs[0]!.prop}:${refs[0]!.t}` : undefined);
};

export const setKeyComponent = (ref: KeyRef, comp: number, value: number) =>
  commit('Edit keyframe value', (p) => ({ ...p, layers: setKeyValue(p.layers, ref, comp, value) }), 'kfmove');

export function copySelectedKeys() {
  const p = current.peek(); if (!p) return;
  clipboard = copyKeys(p.layers, keySel.peek());
}

export function pasteKeyframes() {
  const id = selection.peek()[0]; if (!id || !clipboard.length) return;
  let refs: KeyRef[] = [];
  commit('Paste keyframes', (p) => {
    const r = pasteKeys(p.layers, id, clipboard, frame(), p.settings.duration - 1);
    refs = r.refs; return { ...p, layers: r.layers };
  });
  keySel.value = refs;
  if (!expanded.peek().includes(id)) expanded.value = [...expanded.peek(), id];
}

/** Jump the playhead to the next/previous keyframe of the selected layers. Returns the target frame. */
export function jumpToKey(dir: 1 | -1): number | null {
  const p = current.peek(); if (!p) return null;
  return nextKeyTime(p.layers, selection.peek(), frame(), dir);
}

// ---- markers & work area ---------------------------------------------------------

export function addMarker(t = frame()) {
  const id = newId();
  commit('Add marker', (p) => p.markers.some((m) => m.t === t) ? p
    : { ...p, markers: [...p.markers, { id, t, name: `Marker ${p.markers.length + 1}` }].sort((a, b) => a.t - b.t) });
  selMarker.value = current.peek()?.markers.find((m) => m.t === t)?.id ?? null;
}
export const removeMarker = (id: string) => { commit('Delete marker', (p) => ({ ...p, markers: p.markers.filter((m) => m.id !== id) })); selMarker.value = null; };
export const renameMarker = (id: string, name: string) =>
  commit('Rename marker', (p) => ({ ...p, markers: p.markers.map((m) => (m.id === id ? { ...m, name: name.trim() || m.name } : m)) }));

/** Set the work area; null resets to the full duration. */
export function setWorkArea(range: [number, number] | null, key?: string) {
  commit('Work area', (p) => {
    if (!range) return p.workArea ? { ...p, workArea: null } : p;
    const d = p.settings.duration;
    const a = Math.min(Math.max(0, Math.round(range[0])), d - 1), b = Math.min(d, Math.max(a + 1, Math.round(range[1])));
    const next: [number, number] = a === 0 && b === d ? [0, d] : [a, b];
    return p.workArea && p.workArea[0] === next[0] && p.workArea[1] === next[1] ? p : { ...p, workArea: next };
  }, key);
}
export const currentWorkRange = (): [number, number] => workRange(current.peek()!);

// ---- project lifecycle -------------------------------------------------------

function open(p: Project) {
  history.clear(); historyRev.value++;
  selection.value = [];
  keySel.value = [];
  expanded.value = [];
  selMarker.value = null;
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
