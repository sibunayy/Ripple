import { signal } from '@preact/signals';
import { createProject, newId, sanitizeSettings, workRange, type Comp, type Project, type ProjectSettings } from '../model/project';
import { History } from '../model/history';
import { createLayer, createShapeLayer, createTextLayer, propOf, withProp, type BezPath, type Mask, type MaskMode, type MatteMode, type Layer, type PropKey, type ShapeContent, type ShapeKind, type TextContent, type Vec2, type Prop } from '../model/layer';
import { ellipsePath, evalPath, recenter, rectPath, togglePathAnimated, writePath } from '../shape/path';
import type { BlendMode } from '../render/blend';
import { createEffect, paramKey, type Curves } from '../render/effects';
import { GALLERY, parseUniforms, syncUniformProps } from '../render/shader';
import { applyPreset, type Preset } from '../anim/presets';
import { TEMPLATES, animatorProps, type AnimShape, type AnimUnit } from '../text/animate';
import { maskProp } from '../render/masks';
import { layerBox } from '../shape/geometry';
import { shapePath } from '../shape/geometry';
import { evalProp, isAnimated, setKey, writeProp, toggleAnimated } from '../anim/interp';
import { corners, evaluate, reparent } from '../eval/evaluate';
import { IDENT, invert } from '../eval/affine';
import { copyKeys, deleteKeys, moveKeys, nextKeyTime, pasteKeys, pruneRefs, setEaseOnKeys, setKeyValue, type ClipEntry, type KeyRef } from '../anim/keys';
import type { Ease } from '../model/layer';
import { deleteProject, getSnapshot, lastLoadRecovered, listProjects, loadProject, saveProject, type ProjectMeta } from '../io/store';
import { importBundle, buildBundle } from '../io/bundle';
import { downloadBlob } from '../io/download';
import { importAssetFile } from '../io/assets';
import { svgToLayers } from '../io/svg';
import { releaseMedia } from '../render/media';
import { makeThumb } from '../io/thumbs';
import type { AssetMeta } from '../model/project';

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

// ---- nested comps ----------------------------------------------------------------------------------------
// `current` is always the comp being edited, presented as a Project. While inside a precomp the root project is
// parked on a stack and merged back when saving or leaving, so every editing operation works unchanged.
const stack: { root: Project; compId: string }[] = [];
/** Id of the comp being edited, or null for the root comp. */
export const activeComp = signal<string | null>(null);

const asComp = (p: Project, id: string): Comp => ({ id, name: p.comps[id]?.name ?? 'Comp', width: p.settings.width, height: p.settings.height, fps: p.settings.fps, duration: p.settings.duration, layers: p.layers });
/** The full document (root comp + all nested comps), regardless of which comp is being edited. */
export function rootProject(): Project {
  let cur = current.peek()!;
  for (let i = stack.length - 1; i >= 0; i--) {
    const { root, compId } = stack[i]!;
    cur = { ...root, comps: { ...root.comps, ...cur.comps, [compId]: asComp(cur, compId) }, modified: cur.modified };
  }
  return cur;
}
const view = (root: Project, c: Comp): Project => ({ ...root, settings: { ...root.settings, width: c.width, height: c.height, fps: c.fps, duration: c.duration }, layers: c.layers, markers: [], workArea: null });

export function enterComp(id: string) {
  const p = current.peek(); const c = p?.comps[id];
  if (!p || !c || stack.some((s) => s.compId === id) || id === activeComp.peek()) return;
  stack.push({ root: p, compId: id });
  history.clear(); historyRev.value++;
  selection.value = []; keySel.value = []; expanded.value = []; playhead.value = 0;
  activeComp.value = id;
  current.value = view(p, c);
}
export function exitComp() {
  const top = stack.pop(); const p = current.peek();
  if (!top || !p) return;
  const merged = { ...top.root, comps: { ...top.root.comps, ...p.comps, [top.compId]: asComp(p, top.compId) }, modified: Date.now() };
  history.clear(); historyRev.value++;
  selection.value = []; keySel.value = []; expanded.value = []; playhead.value = 0;
  activeComp.value = stack.length ? stack[stack.length - 1]!.compId : null;
  current.value = stack.length ? view(merged, merged.comps[activeComp.value!]!) : merged;
  touch();
}
/** Names of the comps from the root down to the active one, for the breadcrumb. */
export const compPath = () => { const p = rootProject(); return stack.map((s) => p.comps[s.compId]?.name ?? 'Comp'); };
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
  try { await saveProject(rootProject()); saveState.value = 'saved'; }
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

export function addAdjustment() { addLayer('adjustment'); }

/** Create a new empty comp and a precomp layer pointing at it. */
export function addComp() {
  const p = current.peek(); if (!p) return;
  const id = newId();
  const comp: Comp = { id, name: `Comp ${Object.keys(p.comps).length + 1}`, width: p.settings.width, height: p.settings.height, fps: p.settings.fps, duration: p.settings.duration, layers: [] };
  const layer = { ...createLayer('precomp', p.settings, p.layers.length, comp.name), precomp: { comp: id, offset: 0 } };
  commit('Add comp', (q) => ({ ...q, comps: { ...q.comps, [id]: comp }, layers: [layer, ...q.layers] }));
  selection.value = [layer.id];
}

/** Move the selected layers into a new comp, replaced by one precomp layer. */
export function precompose(ids: string[]) {
  const p = current.peek(); if (!p || !ids.length) return;
  const picked = p.layers.filter((l) => ids.includes(l.id));
  if (!picked.length) return;
  const id = newId(), set = new Set(picked.map((l) => l.id));
  const comp: Comp = { id, name: `Precomp ${Object.keys(p.comps).length + 1}`, width: p.settings.width, height: p.settings.height, fps: p.settings.fps, duration: p.settings.duration,
    layers: picked.map((l) => (l.parent && !set.has(l.parent) ? { ...l, parent: undefined } : l)) };
  const layer = { ...createLayer('precomp', p.settings, p.layers.length, comp.name), precomp: { comp: id, offset: 0 } };
  commit('Pre-compose', (q) => {
    const idx = Math.min(...picked.map((l) => q.layers.indexOf(l)).filter((i) => i >= 0));
    const rest = q.layers.filter((l) => !set.has(l.id));
    rest.splice(Math.max(0, idx), 0, layer);
    return { ...q, comps: { ...q.comps, [id]: comp }, layers: rest.map((l) => (l.parent && set.has(l.parent) ? { ...l, parent: undefined } : l)) };
  });
  selection.value = [layer.id];
}

// ---- effects & presets -----------------------------------------------------------------------------------

/** Edit shader source for a shader layer (effectId null) or a custom-shader effect; declared uniforms become props. */
export function setShaderCode(layerId: string, effectId: string | null, code: string) {
  const decls = parseUniforms(code);
  editLayer(layerId, 'Edit shader', (l) => {
    if (effectId) return { ...l, effects: l.effects?.map((e) => (e.id === effectId ? { ...e, data: { code } } : e)), props: syncUniformProps(l.props, `fx:${effectId}:`, decls) };
    return { ...l, shader: { code }, props: syncUniformProps(l.props, 'sh:', decls) };
  }, `shader:${layerId}:${effectId ?? ''}`);
}

/** Add a text animator from a template and key its offset so the window sweeps across the text (from the playhead). */
export function addTextAnimator(layerId: string, templateId: string | null) {
  const p = current.peek(); if (!p) return;
  const tpl = templateId ? TEMPLATES.find((t) => t.id === templateId) : undefined;
  const id = newId(), t0 = frame(), fps = p.settings.fps;
  editLayer(layerId, 'Add text animator', (l) => {
    if (!l.text) return l;
    const n = Array.from(l.text.text.replace(/\n/g, '')).length;
    const sec = tpl ? Math.max(tpl.minSeconds, n * tpl.secondsPer) : 1, frames = Math.max(1, Math.round(sec * fps));
    const props = { ...l.props, ...animatorProps(id, tpl?.start ?? 0, tpl?.end ?? 100, tpl?.props ?? { opacity: 0 }) };
    if (tpl) props[`ta:${id}:offset`] = { keys: [{ t: t0, v: -100 - tpl.end + tpl.start, ease: 'linear' as const }, { t: t0 + frames, v: 100, ease: 'linear' as const }] };
    return { ...l, props, text: { ...l.text, animators: [...(l.text.animators ?? []), { id, name: tpl?.label ?? `Animator ${(l.text.animators?.length ?? 0) + 1}`, unit: tpl?.unit ?? 'chars', shape: tpl?.shape ?? 'ramp' }] } };
  });
  if (!expanded.peek().includes(layerId)) expanded.value = [...expanded.peek(), layerId];
}
export const editAnimator = (layerId: string, id: string, patch: { unit?: AnimUnit; shape?: AnimShape; colorOn?: boolean }) =>
  editLayer(layerId, 'Edit text animator', (l) => (l.text ? { ...l, text: { ...l.text, animators: l.text.animators?.map((a) => (a.id === id ? { ...a, ...patch } : a)) } } : l));
export const removeAnimator = (layerId: string, id: string) =>
  editLayer(layerId, 'Remove text animator', (l) => {
    if (!l.text) return l;
    const props = Object.fromEntries(Object.entries(l.props ?? {}).filter(([k]) => !k.startsWith(`ta:${id}:`)));
    return { ...l, props, text: { ...l.text, animators: (l.text.animators ?? []).filter((a) => a.id !== id) } };
  });

export function addShaderLayer() {
  const p = current.peek(); if (!p) return;
  const code = GALLERY[0]!.code;
  const layer = { ...createLayer('shader', p.settings, p.layers.length), shader: { code } };
  layer.props = syncUniformProps(undefined, 'sh:', parseUniforms(code));
  commit('Add shader layer', (q) => ({ ...q, layers: [layer, ...q.layers] }));
  selection.value = [layer.id];
}

export function addEffect(layerId: string, type: string) {
  const p = current.peek(); if (!p) return;
  const c = createEffect(type, p.settings, newId()); if (!c) return;
  editLayer(layerId, 'Add effect', (l) => ({ ...l, effects: [...(l.effects ?? []), c.effect], props: { ...l.props, ...c.props } }));
  expanded.value = expanded.peek().includes(layerId) ? expanded.peek() : [...expanded.peek(), layerId];
}
export const removeEffect = (layerId: string, effectId: string) =>
  editLayer(layerId, 'Remove effect', (l) => {
    const props = Object.fromEntries(Object.entries(l.props ?? {}).filter(([k]) => !k.startsWith(`fx:${effectId}:`)));
    return { ...l, props, effects: (l.effects ?? []).filter((e) => e.id !== effectId) };
  });
export const toggleEffect = (layerId: string, effectId: string) =>
  editLayer(layerId, 'Toggle effect', (l) => ({ ...l, effects: l.effects?.map((e) => (e.id === effectId ? { ...e, enabled: !e.enabled } : e)) }));
export const moveEffect = (layerId: string, effectId: string, dir: -1 | 1) =>
  editLayer(layerId, 'Reorder effect', (l) => {
    const fx = (l.effects ?? []).slice(), i = fx.findIndex((e) => e.id === effectId), j = i + dir;
    if (i < 0 || j < 0 || j >= fx.length) return l;
    [fx[i], fx[j]] = [fx[j]!, fx[i]!];
    return { ...l, effects: fx };
  });
export const setEffectData = (layerId: string, effectId: string, data: unknown) =>
  editLayer(layerId, 'Edit effect data', (l) => ({ ...l, effects: l.effects?.map((e) => (e.id === effectId ? { ...e, data } : e)) }));
export const setCurves = (layerId: string, effectId: string, data: Curves) =>
  editLayer(layerId, 'Edit curves', (l) => ({ ...l, effects: l.effects?.map((e) => (e.id === effectId ? { ...e, data } : e)) }), `curves:${effectId}`);

/** Apply a preset to the selected layers at the playhead. */
export function applyPresetToSelection(pr: Preset) {
  const p = current.peek(); if (!p) return;
  const ids = selection.peek(); if (!ids.length) return;
  const t = frame();
  commit(`Preset: ${pr.name}`, (q) => ({ ...q, layers: q.layers.map((l) => (ids.includes(l.id) ? applyPreset(l, pr, pr.anchor === 'out' ? l.in : Math.max(t, l.in), q.settings.fps, newId, q.settings) : l)) }));
  for (const id of ids) if (!expanded.peek().includes(id)) expanded.value = [...expanded.peek(), id];
}

export const setBlend = (id: string, blend: BlendMode) => editLayer(id, 'Blend mode', (l) => ({ ...l, blend }));
export const setMatte = (id: string, layer: string | null, mode: MatteMode = 'alpha') =>
  editLayer(id, 'Track matte', (l) => { const n = { ...l }; if (layer) n.matte = { layer, mode }; else delete n.matte; return n; });
export const setClip = (id: string, clip: boolean) => editLayer(id, 'Clip to layer below', (l) => ({ ...l, clip }));

// ---- masks -----------------------------------------------------------------------------------------------

/** Selected mask of the selected layer (UI state). */
export const selMask = signal<string | null>(null);

export function addMask(id: string, kind: 'rect' | 'ellipse' = 'rect') {
  const t = frame();
  let mid = '';
  editLayer(id, 'Add mask', (l) => {
    const b = layerBox(l, t), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    const w = Math.max(20, (b[2] - b[0]) * 0.7), h = Math.max(20, (b[3] - b[1]) * 0.7);
    const base = kind === 'rect' ? rectPath(w, h, 0) : ellipsePath(w, h);
    const path: BezPath = { closed: true, nodes: base.nodes.map((n) => ({ ...n, p: [n.p[0] + cx, n.p[1] + cy] })) };
    mid = newId();
    const m: Mask = { id: mid, name: `Mask ${(l.masks?.length ?? 0) + 1}`, mode: 'add', invert: false, path };
    return { ...l, masks: [...(l.masks ?? []), m], props: { ...l.props,
      [maskProp(mid, 'opacity')]: { value: 100 }, [maskProp(mid, 'feather')]: { value: 0 }, [maskProp(mid, 'expansion')]: { value: 0 } } };
  });
  selMask.value = mid;
}
export const editMask = (layer: string, mask: string, patch: Partial<Mask>, key?: string) =>
  editLayer(layer, 'Edit mask', (l) => ({ ...l, masks: l.masks?.map((m) => (m.id === mask ? { ...m, ...patch } : m)) }), key);
export function deleteMask(layer: string, mask: string) {
  editLayer(layer, 'Delete mask', (l) => {
    const props = { ...l.props };
    for (const w of ['opacity', 'feather', 'expansion'] as const) delete props[maskProp(mask, w)];
    return { ...l, props, masks: (l.masks ?? []).filter((m) => m.id !== mask) };
  });
  selMask.value = null;
}

/** The path being node-edited on a layer: the selected mask's, else a shape layer's own path. Always resolved at time t. */
export function editablePath(l: Layer, t = frame()): { path: BezPath; raw: BezPath; mask: string | null } | null {
  const m = selMask.value && l.masks?.find((x) => x.id === selMask.value);
  if (m) return { path: evalPath(m.path, t), raw: m.path, mask: m.id };
  if (l.type === 'shape' && l.shape?.kind === 'path' && l.shape.path) return { path: evalPath(l.shape.path, t), raw: l.shape.path, mask: null };
  return null;
}
/** Write back an edited (resolved-at-t) path to whichever target `editablePath` returned. */
export function setEditablePath(id: string, next: BezPath, key = 'path') {
  const t = frame();
  editLayer(id, 'Edit path', (l) => {
    const e = editablePath(l, t); if (!e) return l;
    // Auto-key: a still path gets a key at the playhead holding the edited shape.
    const base = autoKey.peek() && !e.raw.keys?.length ? { ...e.raw, keys: [{ t, nodes: e.raw.nodes }] } : e.raw;
    const written = writePath(base, next, t);
    if (e.mask) return { ...l, masks: l.masks!.map((m) => (m.id === e.mask ? { ...m, path: written } : m)) };
    return { ...l, shape: { ...l.shape!, path: written } };
  }, `${key}:${id}`);
}
export function togglePathAnim(id: string) {
  const t = frame();
  editLayer(id, 'Animate path', (l) => {
    const e = editablePath(l, t); if (!e) return l;
    const next = togglePathAnimated(e.raw, t);
    if (e.mask) return { ...l, masks: l.masks!.map((m) => (m.id === e.mask ? { ...m, path: next } : m)) };
    return { ...l, shape: { ...l.shape!, path: next } };
  });
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
const toggleFlag = (id: string, key: 'locked' | 'solo' | 'shy', label: string) =>
  commit(label, (p) => mapLayer(p, id, (l) => ({ ...l, [key]: !l[key] })));
export const toggleLocked = (id: string) => toggleFlag(id, 'locked', 'Toggle lock');
export const toggleSolo = (id: string) => toggleFlag(id, 'solo', 'Toggle solo');
export const toggleShy = (id: string) => toggleFlag(id, 'shy', 'Toggle shy');
/** Timeline filter: hide shy layers from the list. */
export const hideShy = signal(false);
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

/** Auto-key mode: editing a still property keys it at the playhead (animated properties always key). */
export const autoKey = signal(false);

/**
 * Write a value at the playhead. Animated properties key at t; with auto-key on, still properties start animating.
 * `still` opts out of auto-key (used when a layer is being created, not animated).
 */
export function setProp(id: string, prop: PropKey, value: number | number[], key?: string, still = false) {
  const t = frame();
  const auto = autoKey.peek() && !still;
  commit(`Edit ${prop}`, (p) => mapLayer(p, id, (l) => {
    const cur = propOf(l, prop); if (!cur) return l;
    const next = auto && !isAnimated(cur as Prop<never>) ? setKey(cur as Prop<never>, t, value as never) : writeProp(cur as Prop<never>, t, value as never);
    return withProp(l, prop, next);
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

/** Align the selected layers' shared bounding box to the composition edges or centre. */
export type AlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export function alignSelection(edge: AlignEdge) {
  const p = current.peek(); const ids = selection.peek();
  if (!p || !ids.length) return;
  const t = frame();
  const resolved = evaluate(p.layers, t);
  const chosen = resolved.filter((r) => ids.includes(r.layer.id));
  if (!chosen.length) return;
  const pts = chosen.flatMap((r) => corners(r, t));
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = p.settings.width, h = p.settings.height;
  const dx = edge === 'left' ? 0 - x0 : edge === 'right' ? w - x1 : edge === 'center' ? w / 2 - (x0 + x1) / 2 : 0;
  const dy = edge === 'top' ? 0 - y0 : edge === 'bottom' ? h - y1 : edge === 'middle' ? h / 2 - (y0 + y1) / 2 : 0;
  if (!dx && !dy) return;
  const byId = new Map(resolved.map((r) => [r.layer.id, r]));
  commit(`Align ${edge}`, (q) => ({
    ...q,
    layers: q.layers.map((l) => {
      if (!ids.includes(l.id)) return l;
      const cur = propOf(l, 'position'); if (!cur) return l;
      const inv = invert(l.parent ? byId.get(l.parent)?.world ?? IDENT : IDENT) ?? IDENT;
      const d: Vec2 = [inv[0] * dx + inv[2] * dy, inv[1] * dx + inv[3] * dy];
      const pos = valueAt(l, 'position', t) as Vec2;
      return withProp(l, 'position', writeProp(cur as Prop<never>, t, [pos[0] + d[0], pos[1] + d[1]] as never));
    }),
  }));
}

/** Space the selected layers evenly between the outermost two (centres), along one axis. */
export function distributeSelection(axis: 'h' | 'v') {
  const p = current.peek(); const ids = selection.peek();
  if (!p || ids.length < 3) return;
  const t = frame();
  const resolved = evaluate(p.layers, t);
  const chosen = resolved.filter((r) => ids.includes(r.layer.id)).map((r) => {
    const cs = corners(r, t), vs = cs.map((q) => (axis === 'h' ? q[0] : q[1]));
    return { r, c: (Math.min(...vs) + Math.max(...vs)) / 2 };
  }).sort((a, b) => a.c - b.c);
  const first = chosen[0]!, last = chosen[chosen.length - 1]!;
  const step = (last.c - first.c) / (chosen.length - 1);
  const deltas = new Map(chosen.map((o, i) => [o.r.layer.id, first.c + step * i - o.c]));
  const byId = new Map(resolved.map((r) => [r.layer.id, r]));
  commit(`Distribute ${axis === 'h' ? 'horizontally' : 'vertically'}`, (q) => ({
    ...q,
    layers: q.layers.map((l) => {
      const dd = deltas.get(l.id); if (dd === undefined || !dd) return l;
      const cur = propOf(l, 'position'); if (!cur) return l;
      const dx = axis === 'h' ? dd : 0, dy = axis === 'v' ? dd : 0;
      const inv = invert(l.parent ? byId.get(l.parent)?.world ?? IDENT : IDENT) ?? IDENT;
      const d: Vec2 = [inv[0] * dx + inv[2] * dy, inv[1] * dx + inv[3] * dy];
      const pos = valueAt(l, 'position', t) as Vec2;
      return withProp(l, 'position', writeProp(cur as Prop<never>, t, [pos[0] + d[0], pos[1] + d[1]] as never));
    }),
  }));
}

// ---- media -------------------------------------------------------------------------------------------------

/** Transient message shown as a toast (import errors/summaries). */
export const notice = signal('');
const say = (m: string) => { notice.value = m; setTimeout(() => { if (notice.value === m) notice.value = ''; }, 6000); };

function mediaLayer(meta: AssetMeta, s: Project['settings'], index: number): Layer {
  const kind = meta.kind === 'video' ? 'video' : 'image';
  const fit = Math.min(100, (100 * s.width) / meta.width, (100 * s.height) / meta.height);
  const l = createLayer(kind, s, index, meta.name.replace(/\.[^.]+$/, '') || kind);
  l.size = [meta.width, meta.height];
  l.transform.anchor = { value: [meta.width / 2, meta.height / 2] };
  l.transform.scale = { value: [fit, fit] };
  l.media = { asset: meta.hash, start: 0, speed: 1 };
  if (kind === 'video' && meta.duration) l.out = Math.max(1, Math.min(s.duration, Math.round(meta.duration * s.fps)));
  return l;
}

/** Add an already-imported asset as a layer. */
export function addAssetLayer(meta: AssetMeta) {
  const p = current.peek(); if (!p) return;
  const layer = mediaLayer(meta, p.settings, p.layers.length);
  commit('Add media', (q) => ({ ...q, assets: { ...q.assets, [meta.hash]: meta }, layers: [layer, ...q.layers] }));
  selection.value = [layer.id];
}

/** Import picked/dropped files: images, SVG (vector shapes by default) and video. */
export async function importMedia(files: File[], svgAsVector?: boolean) {
  for (const file of files) {
    try {
      const meta = await importAssetFile(file);
      const p = current.peek(); if (!p) return;
      if (meta.kind === 'svg') {
        const vector = svgAsVector ?? confirm(`Import “${meta.name}” as editable vector shapes?\n\nOK = shapes · Cancel = flat image`);
        if (vector) {
          const r = svgToLayers(await file.text(), p.settings, p.layers.length);
          if (!r.layers.length) throw new Error('No drawable shapes were found in this SVG.');
          commit('Import SVG', (q) => ({ ...q, layers: [...r.layers, ...q.layers] }));
          selection.value = r.layers.map((l) => l.id);
          if (r.skipped.length) say(`Imported ${r.layers.length} shapes. Not supported yet: ${r.skipped.join(', ')}.`);
          continue;
        }
      }
      addAssetLayer(meta);
    } catch (e) { say((e as Error).message); }
  }
}

export const editMedia = (id: string, patch: Partial<NonNullable<Layer['media']>>) =>
  editLayer(id, 'Edit media', (l) => (l.media ? { ...l, media: { ...l.media, ...patch } } : l), `media:${id}`);

/** Remove an asset entry from the project (the stored file stays — other projects may share it). */
export const removeAsset = (hash: string) => commit('Remove asset', (p) => { const a = { ...p.assets }; delete a[hash]; return { ...p, assets: a }; });
export const assetUsage = (p: Project, hash: string) => {
  const all = [p.layers, ...Object.values(p.comps).map((c) => c.layers)].flat();
  return all.filter((l) => l.media?.asset === hash).length;
};

// ---- shapes & text -------------------------------------------------------------------------------

/** Replace a layer through a pure function (shape/text content edits). */
export const editLayer = (id: string, label: string, fn: (l: Layer) => Layer, key?: string) =>
  commit(label, (p) => mapLayer(p, id, fn), key);

export const editShape = (id: string, fn: (s: ShapeContent) => ShapeContent, key?: string) =>
  editLayer(id, 'Edit shape', (l) => (l.shape ? { ...l, shape: fn(l.shape) } : l), key ? `${key}:${id}` : undefined);

export const editText = (id: string, patch: Partial<TextContent>, key?: string) =>
  editLayer(id, 'Edit text', (l) => (l.text ? { ...l, text: { ...l.text, ...patch } } : l), key ? `${key}:${id}` : undefined);

export const setPath = (id: string, path: BezPath, key?: string) => setEditablePath(id, path, key ?? 'path');

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
  stack.length = 0; activeComp.value = null;
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

export async function newFromTemplate(id: string, name?: string): Promise<void> {
  const { STARTERS } = await import('./templates');
  const t = STARTERS.find((x) => x.id === id); if (!t) return;
  const p = t.build();
  if (name) p.name = name;
  await saveProject(p);
  open(p);
  await refreshLibrary();
}

export async function openProject(id: string): Promise<void> {
  const p = await loadProject(id);
  if (!p) return;
  open(p);
  if (lastLoadRecovered) say('The project file was damaged, so an earlier automatic version was opened.');
}

/** Replace the project with an earlier automatic snapshot (undoable). Only from the root comp. */
export async function restoreVersion(index: number) {
  const cur = current.peek(); if (!cur || stack.length) return;
  const snap = await getSnapshot(cur.id, index); if (!snap) return;
  commit('Restore version', () => ({ ...snap, id: cur.id, created: cur.created, modified: Date.now() }));
  selection.value = []; keySel.value = [];
}

/** Library actions: import a .ripple bundle / back up a project without opening it. */
export async function importBundleFile(file: File) {
  try {
    const r = await importBundle(file);
    await refreshLibrary();
    say(r.warnings.length ? `Imported “${r.project.name}” with warnings: ${r.warnings.join('; ')}` : `Imported “${r.project.name}”.`);
  } catch (e) { say((e as Error).message); }
}
export async function importLottieFile(file: File) {
  try {
    const { importLottieBlob } = await import('../lottie/file');
    const r = await importLottieBlob(file);
    await saveProject(r.project); await refreshLibrary();
    say(r.report.length ? `Imported “${r.project.name}”. ${r.report.length} note${r.report.length > 1 ? 's' : ''}: ${r.report.slice(0, 3).map((x) => x.msg).join(' · ')}${r.report.length > 3 ? ' …' : ''}` : `Imported “${r.project.name}”.`);
  } catch (e) { say((e as Error).message); }
}
export async function backupProject(id: string) {
  const p = await loadProject(id); if (!p) return;
  downloadBlob(await buildBundle(p), `${p.name.replace(/[^\w.-]+/g, '_') || 'project'}.ripple`);
}

export async function closeProject(): Promise<void> {
  while (stack.length) exitComp();
  await flush();
  try { await makeThumb(rootProject()); } catch { /* thumbnails are best-effort */ }
  releaseMedia();
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
