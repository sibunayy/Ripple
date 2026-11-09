import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { effect, signal } from '@preact/signals';
import { flush, saveState, importMedia, addShape, addText, current, editablePath, frame, playhead, selection, setPath, setProp, setTransform, editText, pasteKeyframes, canUndo, canRedo, undo, redo, duplicateLayers, precompose, keySel, toggleStopwatch } from './state';
import { editingText, finishPen, nodeSel, penDraft, setTool, tool, type Tool } from './tools';
import { alignSelection } from './state';
import { snapEnabled, easingOpen } from './uistate';
import { distToPoly, flatten, insertNode, moveHandle, moveNode, nearestOnPath, node as mkNode } from '../shape/path';
import { layoutText, fontString, textStyle } from '../text/metrics';
import { layerBox } from '../shape/geometry';
import { css } from '../render/raster';
import { fontRev } from '../text/fonts';
import { mediaRev, syncVideos } from '../render/media';
import { playing } from './playback';
import { corners, evaluate, hitTest } from '../eval/evaluate';
import { evalProp, isAnimated } from '../anim/interp';
import { apply, invert, type Mat } from '../eval/affine';
import { GLRenderer } from '../render/gl';
import { propOf, type BezPath, type Layer, type Prop, type Vec2 } from '../model/layer';
import { Icon } from '../ui/Icon';
import { contextProps } from '../ui/ContextMenu';

const MAX_BUFFER = 2560; // longest side of the preview buffer; the canvas is CSS-scaled to the comp
const MIN_ZOOM = 0.05, MAX_ZOOM = 16;
interface View { zoom: number; x: number; y: number; fit: boolean }

declare global { interface Window { __ripple?: { renderer?: GLRenderer; doc?: () => import('../model/project').Project; load?: (p: import('../model/project').Project) => void; save?: () => Promise<void>; lottie?: () => Promise<unknown> } } }

export function Viewer() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const renderer = useRef<GLRenderer | null>(null);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0, fit: true });
  const [error, setError] = useState('');
  const viewRef = useRef(view); viewRef.current = view;

  const s = current.value!.settings;
  const fitView = (): View => {
    const el = wrap.current!;
    const zoom = Math.min((el.clientWidth - 32) / s.width, (el.clientHeight - 32) / s.height);
    return { zoom, x: (el.clientWidth - s.width * zoom) / 2, y: (el.clientHeight - s.height * zoom) / 2, fit: true };
  };

  // Keep the comp fitted until the user pans/zooms.
  useLayoutEffect(() => {
    const el = wrap.current!;
    const refit = () => { if (viewRef.current.fit && el.clientWidth > 0) setView(fitView()); };
    refit();
    const ro = new ResizeObserver(refit); ro.observe(el);
    return () => ro.disconnect();
  }, [s.width, s.height]);

  // GL renderer + redraw whenever the document or playhead changes.
  useEffect(() => {
    let r: GLRenderer;
    try { r = new GLRenderer(canvas.current!); } catch (e) { setError(String((e as Error).message)); return; }
    renderer.current = r; window.__ripple = { renderer: r, doc: () => current.peek()!, load: (p) => { current.value = p; }, save: () => { saveState.value = 'dirty'; return flush(); }, lottie: async () => (await (await import('../lottie/export')).exportLottie(current.peek()!)).json };
    let queued = 0, lastStart = 0, slow = 0, fast = 0, step = 0, avgInt = 16.7, avgCpu = 0;
    const draw = () => {
      queued = 0;
      const t0 = performance.now();
      if (playing.peek() && lastStart) {
        const dt = t0 - lastStart; avgInt = avgInt * 0.9 + dt * 0.1;
        if (previewQuality.peek() === 'auto') { // keep playback near the display rate by trading resolution
          if (dt > 24) { slow++; fast = 0; } else if (dt < 18) { fast++; slow = 0; } else { slow = 0; fast = 0; }
          if (slow >= 20 && step < STEPS.length - 1) { step++; slow = 0; } else if (fast >= 120 && step > 0) { step--; fast = 0; }
        }
      }
      lastStart = playing.peek() ? t0 : 0;
      const qf = previewQuality.peek() === 'auto' ? STEPS[step]! : (previewQuality.peek() as number);
      const p = current.peek(); if (!p) return;
      const { width, height, bg } = p.settings;
      const k = Math.min(1, MAX_BUFFER / Math.max(width, height)) * qf;
      r.resize(Math.round(width * k), Math.round(height * k));
      // Render in comp space; scale to the buffer via the resolution uniform.
      const t = playhead.peek();
      syncVideos(p.layers, p.comps, t, p.settings.fps, playing.peek());
      const c0 = performance.now();
      r.render(p.layers, { width, height, bg, t, comps: p.comps, fps: p.settings.fps, linear: p.settings.linearLight, motionBlur: p.settings.motionBlur?.on && mbPreview.value ? { shutter: p.settings.motionBlur.shutter, samples: Math.min(4, p.settings.motionBlur.samples) } : undefined });
      hudTick(performance.now() - c0, Math.round(width * k), Math.round(height * k));
    };
    const schedule = () => { if (!queued) queued = requestAnimationFrame(draw); };
    const hudTick = (cpu: number, w: number, h: number) => { avgCpu = avgCpu * 0.8 + cpu * 0.2; if (showHud.peek()) hudText.value = `${playing.peek() ? (1000 / avgInt).toFixed(0) : '–'} fps · cpu ${avgCpu.toFixed(1)} ms\nbuffer ${w}×${h}${previewQuality.peek() === 'auto' ? ` (auto ×${STEPS[step]})` : ''}\nRTs ${r.stats.rts} · passes ${r.stats.passes}`; };
    r.onRestore = schedule;
    const stop = effect(() => { current.value; playhead.value; fontRev.value; mediaRev.value; playing.value; mbPreview.value; previewQuality.value; schedule(); });
    return () => { stop(); cancelAnimationFrame(queued); renderer.current = null; };
  }, []);

  // ---- gestures ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; mx: number; my: number } | null>(null);
  type Drag =
    | { kind: 'marquee'; x0: Vec2; base: string[] }
    | { kind: 'move'; id: string; others: { id: string; pos: Vec2; lin: [number, number, number, number] }[]; start: Vec2; pos: Vec2; lin: [number, number, number, number]; box: [number, number, number, number]; targets: { xs: number[]; ys: number[] } }
    | { kind: 'pan'; x: number; y: number; vx: number; vy: number }
    | { kind: 'create'; tool: Tool; id: string | null; start: Vec2; sx: number; sy: number; moved: boolean }
    | { kind: 'node'; id: string; idx: number }
    | { kind: 'handle'; id: string; idx: number; which: 'i' | 'o' }
    | { kind: 'penhandle'; idx: number }
    | { kind: 'scale'; id: string; inv: Mat; a: Vec2; c0: Vec2; lp0: Vec2; s0: Vec2; uniform: boolean }
    | { kind: 'rotate'; id: string; c: Vec2; a0: number; r0: number };
  const drag = useRef<Drag | null>(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  const toComp = (cx: number, cy: number): Vec2 => {
    const r = stage.current!.getBoundingClientRect();
    return [((cx - r.left) / r.width) * s.width, ((cy - r.top) / r.height) * s.height];
  };
  const local = (e: PointerEvent) => { const r = wrap.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  const zoomAt = (px: number, py: number, factor: number) => setView((v) => {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor)), k = zoom / v.zoom;
    return { zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k, fit: false };
  });

  /** Comp point → layer space of the given resolved layer. */
  const toLayer = (world: readonly number[], c: Vec2): Vec2 => {
    const inv = invert(world as never); return inv ? apply(inv, c[0], c[1]) : c;
  };
  const doubleTap = (e: PointerEvent) => {
    const now = performance.now(), l = lastTap.current;
    const dbl = now - l.t < 350 && Math.hypot(e.clientX - l.x, e.clientY - l.y) < 20;
    lastTap.current = { t: dbl ? 0 : now, x: e.clientX, y: e.clientY };
    return dbl;
  };

  const startCreate = (e: PointerEvent, c: Vec2) => {
    const t = tool.peek();
    if (t === 'text') { const id = addText(c); if (id) { editingText.value = id; } tool.value = 'select'; return; }
    if (t === 'pen') {
      const d = penDraft.peek();
      const zoom = viewRef.current.zoom;
      if (d && d.nodes.length >= 3 && Math.hypot(d.nodes[0]!.p[0] - c[0], d.nodes[0]!.p[1] - c[1]) < 16 / zoom) { finishPen(true); return; }
      if (d && doubleTap(e)) { finishPen(false); return; }
      doubleTap(e);
      const next: BezPath = { closed: false, nodes: [...(d?.nodes ?? []), mkNode(c[0], c[1])] };
      penDraft.value = next;
      drag.current = { kind: 'penhandle', idx: next.nodes.length - 1 };
      return;
    }
    if (t === 'line') { penDraft.value = { closed: false, nodes: [mkNode(c[0], c[1]), mkNode(c[0], c[1])] }; drag.current = { kind: 'create', tool: t, id: null, start: c, sx: e.clientX, sy: e.clientY, moved: true }; return; }
    const kind = t === 'rect' || t === 'ellipse' || t === 'polygon' || t === 'star' ? t : null;
    if (!kind) return;
    const id = addShape(kind, c, undefined, 'create');
    drag.current = { kind: 'create', tool: t, id, start: c, sx: e.clientX, sy: e.clientY, moved: false };
  };

  const lastPen = useRef(0);
  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest?.('.tools, .zoombar, .tbox')) return;
    if (e.pointerType === 'pen') lastPen.current = performance.now();
    else if (e.pointerType === 'touch' && performance.now() - lastPen.current < 1500) return; // palm rejection while drawing with the Pencil
    wrap.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 2) {
      drag.current = null;
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    const p = current.peek()!;
    const [cx, cy] = toComp(e.clientX, e.clientY);
    const t = tool.peek();
    if (t === 'hand') { drag.current = { kind: 'pan', x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y }; return; }
    if (t !== 'select') { startCreate(e, [cx, cy]); return; }

    const time = playhead.peek();
    const resolved = evaluate(p.layers, time);
    const zoom = viewRef.current.zoom;

    const selId = selection.peek().length === 1 ? selection.peek()[0] : undefined;
    const sel = selId ? resolved.find((r) => r.layer.id === selId) : undefined;
    // transform handles (scale at the corners, rotate above the top edge)
    if (sel && !(sel.layer.shape?.kind === 'path' && nodeSel.peek() !== null)) {
      const cs = corners(sel, time), tol = 16 / zoom;
      const anchor = evalProp(sel.layer.transform.anchor, time) as Vec2, inv = invert(sel.world);
      const top: Vec2 = [(cs[0]![0] + cs[1]![0]) / 2, (cs[0]![1] + cs[1]![1]) / 2];
      const out = rotHandle(cs, zoom);
      if (inv && Math.hypot(out[0] - cx, out[1] - cy) < tol) {
        const aw = apply(sel.world, anchor[0], anchor[1]);
        drag.current = { kind: 'rotate', id: sel.layer.id, c: aw, a0: Math.atan2(cy - aw[1], cx - aw[0]), r0: evalProp(sel.layer.transform.rotation, time) as number };
        return;
      }
      void top;
      const bx = layerBoxOf(sel, time);
      const locals: Vec2[] = [[bx[0], bx[1]], [bx[2], bx[1]], [bx[2], bx[3]], [bx[0], bx[3]]];
      for (let i = 0; i < 4; i++) {
        if (inv && Math.hypot(cs[i]![0] - cx, cs[i]![1] - cy) < tol) {
          drag.current = { kind: 'scale', id: sel.layer.id, inv, a: anchor, c0: locals[i]!, lp0: apply(inv, cx, cy), s0: evalProp(sel.layer.transform.scale, time) as Vec2, uniform: e.shiftKey };
          return;
        }
      }
    }
    // node / handle editing on the selected path layer
    const path = sel ? editablePath(sel.layer, time)?.path : undefined;
    if (sel && path) {
      const tol = 18 / zoom;
      const ns = nodeSel.peek();
      if (ns !== null && path.nodes[ns]) {
        const n = path.nodes[ns]!;
        for (const which of ['i', 'o'] as const) {
          const h = apply(sel.world, n.p[0] + n[which][0], n.p[1] + n[which][1]);
          if ((n[which][0] || n[which][1]) && Math.hypot(h[0] - cx, h[1] - cy) < tol) { drag.current = { kind: 'handle', id: sel.layer.id, idx: ns, which }; return; }
        }
      }
      for (let i = path.nodes.length - 1; i >= 0; i--) {
        const q = apply(sel.world, ...path.nodes[i]!.p);
        if (Math.hypot(q[0] - cx, q[1] - cy) < tol) { nodeSel.value = i; drag.current = { kind: 'node', id: sel.layer.id, idx: i }; return; }
      }
      const lp = toLayer(sel.world, [cx, cy]);
      const near = nearestOnPath(path, lp[0], lp[1]);
      const scale = Math.sqrt(Math.abs(sel.world[0]! * sel.world[3]! - sel.world[1]! * sel.world[2]!)) || 1;
      if (near && near.dist * scale < 12 / zoom && doubleTap(e)) {
        setPath(sel.layer.id, insertNode(path, near.seg, near.t), 'node-add');
        nodeSel.value = near.seg + 1;
        return;
      }
    }
    nodeSel.value = null;

    const id = hitTest(resolved, cx, cy, time, 10 / zoom);
    if (!id) { // empty space: sweep a marquee (shift adds to the selection)
      const base = e.shiftKey ? selection.peek() : [];
      if (!e.shiftKey) selection.value = [];
      marquee.value = { a: [cx, cy], b: [cx, cy] };
      drag.current = { kind: 'marquee', x0: [cx, cy], base };
      return;
    }
    const r = resolved.find((x) => x.layer.id === id)!;
    if (r.layer.type === 'text' && doubleTap(e)) { selection.value = [id]; editingText.value = id; return; }
    const cur = selection.peek();
    if (e.shiftKey) { // toggle membership; a removed layer isn't dragged
      selection.value = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      if (!selection.peek().includes(id)) return;
    } else if (!cur.includes(id)) selection.value = [id];
    // every selected layer moves together, except those already carried by a selected ancestor
    const selNow = new Set(selection.peek());
    const byId = new Map(resolved.map((x) => [x.layer.id, x]));
    const carried = (l: Layer) => { for (let q = l.parent ? byId.get(l.parent) : undefined, n = 0; q && n < 64; q = q.layer.parent ? byId.get(q.layer.parent) : undefined, n++) if (selNow.has(q.layer.id)) return true; return false; };
    const others = resolved.filter((x) => selNow.has(x.layer.id) && x.layer.id !== id && !x.layer.locked && !carried(x.layer)).map((x) => {
      const pw = x.layer.parent ? byId.get(x.layer.parent)?.world : undefined;
      const iv = (pw ? invert(pw) : null) ?? [1, 0, 0, 1, 0, 0];
      return { id: x.layer.id, pos: evalProp(x.layer.transform.position, frame()) as Vec2, lin: [iv[0]!, iv[1]!, iv[2]!, iv[3]!] as [number, number, number, number] };
    });
    const parentW = r.layer.parent ? resolved.find((x) => x.layer.id === r.layer.parent)?.world : undefined;
    const inv = parentW ? invert(parentW) : [1, 0, 0, 1, 0, 0];
    const sx: number[] = [0, s.width / 2, s.width], sy: number[] = [0, s.height / 2, s.height];
    for (const o of resolved) {
      if (o.layer.id === id || !o.active) continue;
      const oc = corners(o, time), xs = oc.map((q) => q[0]), ys = oc.map((q) => q[1]);
      sx.push(Math.min(...xs), Math.max(...xs), (Math.min(...xs) + Math.max(...xs)) / 2); sy.push(Math.min(...ys), Math.max(...ys), (Math.min(...ys) + Math.max(...ys)) / 2);
    }
    const mc = corners(r, time), mxs = mc.map((q) => q[0]), mys = mc.map((q) => q[1]);
    drag.current = { kind: 'move', id, others, targets: { xs: sx, ys: sy }, box: [Math.min(...mxs), Math.min(...mys), Math.max(...mxs), Math.max(...mys)], start: [cx, cy], pos: evalProp(r.layer.transform.position, frame()) as Vec2, lin: inv ? [inv[0]!, inv[1]!, inv[2]!, inv[3]!] : [1, 0, 0, 1] };
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'pen') lastPen.current = performance.now();
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (g && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      setView((v) => {
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * (dist / (g.dist || 1)))), k = zoom / v.zoom;
        return { zoom, x: mx - (g.mx - v.x) * k, y: my - (g.my - v.y) * k, fit: false };
      });
      gesture.current = { dist, mx, my };
      return;
    }
    const d = drag.current; if (!d) return;
    if (d.kind === 'pan') { setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y, fit: false })); return; }
    const [cx, cy] = toComp(e.clientX, e.clientY);
    if (d.kind === 'marquee') {
      const a = d.x0, b: Vec2 = [cx, cy];
      marquee.value = { a, b };
      const lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1])], hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
      const t = playhead.peek();
      const hit = evaluate(current.peek()!.layers, t).filter((r) => {
        if (!r.active || r.layer.locked) return false;
        const cs = corners(r, t), xs = cs.map((q) => q[0]), ys = cs.map((q) => q[1]);
        return Math.max(...xs) >= lo[0]! && Math.min(...xs) <= hi[0]! && Math.max(...ys) >= lo[1]! && Math.min(...ys) <= hi[1]!;
      }).map((r) => r.layer.id);
      selection.value = [...d.base.filter((x) => !hit.includes(x)), ...hit];
    } else if (d.kind === 'move') {
      let dx = cx - d.start[0], dy = cy - d.start[1];
      if (snapEnabled.peek() && !e.altKey) { // snap box edges/centre to the comp and other layers
        const th = 6 / viewRef.current.zoom, g: { x?: number; y?: number } = {};
        const sn = (vals: number[], targets: number[]) => { let best: number | null = null; for (const v of vals) for (const t of targets) { const dd = t - v; if (Math.abs(dd) < th && (best === null || Math.abs(dd) < Math.abs(best))) best = dd; } return best; };
        const bx = sn([d.box[0] + dx, (d.box[0] + d.box[2]) / 2 + dx, d.box[2] + dx], d.targets.xs), by = sn([d.box[1] + dy, (d.box[1] + d.box[3]) / 2 + dy, d.box[3] + dy], d.targets.ys);
        if (bx !== null) { dx += bx; g.x = [d.box[0] + dx, (d.box[0] + d.box[2]) / 2 + dx, d.box[2] + dx].find((v) => d.targets.xs.some((t) => Math.abs(t - v) < 0.01)); }
        if (by !== null) { dy += by; g.y = [d.box[1] + dy, (d.box[1] + d.box[3]) / 2 + dy, d.box[3] + dy].find((v) => d.targets.ys.some((t) => Math.abs(t - v) < 0.01)); }
        guides.value = g;
      } else guides.value = {};
      for (const o of [{ id: d.id, pos: d.pos, lin: d.lin }, ...d.others])
        setTransform(o.id, 'position', [o.pos[0] + o.lin[0] * dx + o.lin[2] * dy, o.pos[1] + o.lin[1] * dx + o.lin[3] * dy], `move:${o.id}`);
    } else if (d.kind === 'scale') {
      const lp = apply(d.inv, cx, cy);
      const f = (n: number, c: number, a: number) => (Math.abs(c - a) < 1e-3 ? 1 : Math.max(-50, Math.min(50, (n - a) / (c - a))));
      let rx = f(lp[0], d.c0[0], d.a[0]), ry = f(lp[1], d.c0[1], d.a[1]);
      if (d.uniform || (Math.abs(d.c0[0] - d.a[0]) < 1e-3 || Math.abs(d.c0[1] - d.a[1]) < 1e-3)) { const u = Math.abs(rx) > Math.abs(ry) ? rx : ry; rx = ry = u; }
      setProp(d.id, 'scale', [d.s0[0] * rx, d.s0[1] * ry], `scale:${d.id}`);
    } else if (d.kind === 'rotate') {
      let a = Math.atan2(cy - d.c[1], cx - d.c[0]) - d.a0, deg = d.r0 + (a * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      setProp(d.id, 'rotation', deg, `rotate:${d.id}`);
    } else if (d.kind === 'penhandle') {
      const dr = penDraft.peek(); if (!dr) return;
      const n = dr.nodes[d.idx]!, o: Vec2 = [cx - n.p[0], cy - n.p[1]];
      if (Math.hypot(o[0], o[1]) < 3 / viewRef.current.zoom) return;
      penDraft.value = { ...dr, nodes: dr.nodes.map((q, i) => (i === d.idx ? { ...q, o, i: [-o[0], -o[1]] } : q)) };
    } else if (d.kind === 'create') {
      if (d.tool === 'line') { penDraft.value = { closed: false, nodes: [mkNode(d.start[0], d.start[1]), mkNode(cx, cy)] }; return; }
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return; // a tap keeps the default size
      d.moved = true;
      if (!d.id) return;
      const key = `create:${d.id}`;
      if (d.tool === 'rect' || d.tool === 'ellipse') {
        setProp(d.id, 'position', [(d.start[0] + cx) / 2, (d.start[1] + cy) / 2], key, true);
        setProp(d.id, 'shape.size', [Math.max(1, Math.abs(cx - d.start[0])), Math.max(1, Math.abs(cy - d.start[1]))], key, true);
      } else {
        const r = Math.max(5, Math.hypot(cx - d.start[0], cy - d.start[1]));
        setProp(d.id, 'shape.outer', r, key, true);
        if (d.tool === 'star') setProp(d.id, 'shape.inner', r * 0.42, key, true);
      }
    } else if (d.kind === 'node' || d.kind === 'handle') {
      const pl = current.peek()!.layers.find((l) => l.id === d.id);
      const path = pl && editablePath(pl, playhead.peek())?.path; if (!pl || !path) return;
      const w = evaluate(current.peek()!.layers, playhead.peek()).find((r) => r.layer.id === d.id)!.world;
      const lp = toLayer(w, [cx, cy]);
      if (d.kind === 'node') setPath(d.id, moveNode(path, d.idx, lp), 'node-move');
      else {
        const n = path.nodes[d.idx]!;
        setPath(d.id, moveHandle(path, d.idx, d.which, [lp[0] - n.p[0], lp[1] - n.p[1]], e.altKey), 'node-move');
      }
    }
  };

  const onUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    guides.value = {}; marquee.value = null;
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) {
      const d = drag.current;
      if (d?.kind === 'create') {
        if (d.tool === 'line') {
          const dr = penDraft.peek(); penDraft.value = null;
          const [a, b] = dr ? [dr.nodes[0]!.p, dr.nodes[1]!.p] : [d.start, d.start];
          if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 4) addShape('path', [0, 0], dr!, 'create');
        }
        tool.value = 'select';
      }
      drag.current = null;
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = wrap.current!.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (e.ctrlKey || e.metaKey) zoomAt(px, py, Math.exp(-e.deltaY * 0.01)); // trackpad pinch arrives as ctrl+wheel
    else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY, fit: false }));
  };
  useEffect(() => {
    const el = wrap.current!;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const zoomBy = (f: number) => { const el = wrap.current!; zoomAt(el.clientWidth / 2, el.clientHeight / 2, f); };

  /** Frame the selection: zoom/pan so every selected layer's bounds fit with a comfortable margin. */
  const fitSelection = () => {
    const ids = selection.peek(); const el = wrap.current; if (!ids.length || !el) return;
    const t = playhead.peek();
    const hit = evaluate(current.peek()!.layers, t).filter((r) => ids.includes(r.layer.id));
    if (!hit.length) return;
    const pts = hit.flatMap((r) => corners(r, t));
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = 64, w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const zoom = Math.min(MAX_ZOOM, Math.min((el.clientWidth - pad) / w, (el.clientHeight - pad) / h));
    setView({ zoom, x: (el.clientWidth - w * zoom) / 2 - x0 * zoom, y: (el.clientHeight - h * zoom) / 2 - y0 * zoom, fit: false });
  };

  /** Key every still transform property of the selected layers at the playhead. */
  const keyframeSelection = () => {
    const p = current.peek(); if (!p) return;
    for (const id of selection.peek()) {
      const l = p.layers.find((x) => x.id === id); if (!l) continue;
      for (const k of ['position', 'scale', 'rotation', 'opacity'] as const) {
        const cur = propOf(l, k);
        if (cur && !isAnimated(cur)) toggleStopwatch(id, k);
      }
    }
  };

  return (
    <div class="viewer-body">
      <div class="stage-bar">
        <button class="btn sm ghost" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / 1.25)}><Icon name="minus" size={16} /></button>
        <button class="zoom-readout" title="Fit to view" onClick={() => setView(fitView())}>{Math.round(view.zoom * 100)}%</button>
        <button class="btn sm ghost" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.25)}><Icon name="plus" size={16} /></button>
        <button class="btn sm ghost" onClick={() => setView(fitView())}>Fit</button>
        <button class="btn sm ghost" disabled={!selection.value.length} onClick={fitSelection}>Fit selection</button>
        <button class={`btn sm ghost ${snapEnabled.value ? 'on' : ''}`} aria-pressed={snapEnabled.value} onClick={() => (snapEnabled.value = !snapEnabled.value)}>
          <Icon name="magnet" size={15} /> Snap
        </button>
        <span class="spacer" />
        <button class={`btn sm ghost ${showHud.value ? 'on' : ''}`} aria-pressed={showHud.value} aria-label="Performance overlay" title="Performance overlay" onClick={() => (showHud.value = !showHud.value)}>ƒ</button>
      </div>
      <div class="viewport" ref={wrap} {...contextProps(() => (tool.peek() === 'select' ? [
        { label: 'Select all', icon: 'copy', onSelect: () => { selection.value = current.peek()!.layers.filter((l) => !l.locked).map((l) => l.id); } },
        { label: 'Paste keyframes', icon: 'layers', onSelect: pasteKeyframes },
        { label: 'Undo', icon: 'undo-2', disabled: !canUndo(), onSelect: undo },
        { label: 'Redo', icon: 'redo-2', disabled: !canRedo(), onSelect: redo },
      ] : []))} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const fs = Array.from(e.dataTransfer?.files ?? []); if (fs.length) void importMedia(fs); }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div class="stage" data-testid="stage" ref={stage} style={{ width: `${s.width}px`, height: `${s.height}px`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
          <canvas ref={canvas} aria-label="Composition viewer" />
          <Overlay zoom={view.zoom} />
          <TextEditor />
        </div>
        <div class="quickbar" role="toolbar" aria-label="Quick actions">
          <button class={`qbtn ${snapEnabled.value ? 'on' : ''}`} aria-pressed={snapEnabled.value} onClick={() => (snapEnabled.value = !snapEnabled.value)}><Icon name="magnet" size={15} />Snap</button>
          <button class="qbtn" disabled={!selection.value.length} onClick={() => { alignSelection('center'); alignSelection('middle'); }}><Icon name="align-center-h" size={15} />Align</button>
          <button class="qbtn" disabled={!selection.value.length} onClick={keyframeSelection}><Icon name="diamond" size={15} />Keyframe</button>
          <button class="qbtn" disabled={!keySel.value.length} onClick={() => (easingOpen.value = true)}><Icon name="spline" size={15} />Easing</button>
          <button class="qbtn" disabled={!selection.value.length} onClick={() => duplicateLayers(selection.value)}><Icon name="copy" size={15} />Duplicate</button>
          <button class="qbtn" disabled={!selection.value.length} onClick={() => precompose(selection.value)}><Icon name="layers" size={15} />Group</button>
        </div>
        {showHud.value && <div class="hud" aria-hidden="true">{hudText.value}</div>}
        {error && <p class="gl-error" role="alert">Rendering unavailable: {error}</p>}
      </div>
    </div>
  );
}

/** Selection outlines + anchor point, in comp coordinates (SVG scaled with the stage). */
function Overlay({ zoom }: { zoom: number }) {
  const p = current.value!;
  const sel = selection.value;
  const resolved = evaluate(p.layers, playhead.value);
  const px = 1 / zoom;
  return (
    <svg class="overlay" viewBox={`0 0 ${p.settings.width} ${p.settings.height}`} width={p.settings.width} height={p.settings.height}>
      {resolved.filter((r) => sel.includes(r.layer.id)).map((r) => {
        const pts = corners(r, playhead.value);
        const a = apply(r.world, ...(evalProp(r.layer.transform.anchor, playhead.value) as Vec2));
        return (
          <g key={r.layer.id} stroke-width={1.5 * px}>
            <polygon points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke="var(--accent)" />
            {pts.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r={4 * px} fill="var(--surface)" stroke="var(--accent)" />)}
            {sel.length === 1 && tool.value === 'select' && <RotHandle pts={pts} px={px} />}
            <MotionPath layer={r.layer} px={px} />
            <Nodes r={r} px={px} />
            <path d={`M${a[0] - 8 * px} ${a[1]}H${a[0] + 8 * px}M${a[0]} ${a[1] - 8 * px}V${a[1] + 8 * px}`} stroke="var(--accent)" />
          </g>
        );
      })}
      <PenDraft px={px} />
      {marquee.value && <rect x={Math.min(marquee.value.a[0], marquee.value.b[0])} y={Math.min(marquee.value.a[1], marquee.value.b[1])}
        width={Math.abs(marquee.value.a[0] - marquee.value.b[0])} height={Math.abs(marquee.value.a[1] - marquee.value.b[1])}
        fill="var(--accent)" fill-opacity=".12" stroke="var(--accent)" stroke-width={px} stroke-dasharray={`${4 * px} ${3 * px}`} />}
      {guides.value.x !== undefined && <line x1={guides.value.x} x2={guides.value.x} y1={0} y2={p.settings.height} stroke="var(--danger)" stroke-width={px} />}
      {guides.value.y !== undefined && <line y1={guides.value.y} y2={guides.value.y} x1={0} x2={p.settings.width} stroke="var(--danger)" stroke-width={px} />}
    </svg>
  );
}

/** Editable bezier nodes + handles of a selected path layer. */
function Nodes({ r, px }: { r: ReturnType<typeof evaluate>[number]; px: number }) {
  const path = editablePath(r.layer, playhead.value)?.path;
  if (!path || tool.value !== 'select') return null;
  const sel = nodeSel.value;
  const P = (v: Vec2) => apply(r.world, v[0], v[1]);
  return (
    <g stroke-width={1.25 * px}>
      {path.nodes.map((n, i) => {
        const q = P(n.p), on = sel === i;
        const hs = on ? (['i', 'o'] as const).filter((w) => n[w][0] || n[w][1]) : [];
        return (
          <g key={i}>
            {hs.map((w) => { const h = P([n.p[0] + n[w][0], n.p[1] + n[w][1]]); return (
              <g key={w}><line x1={q[0]} y1={q[1]} x2={h[0]} y2={h[1]} stroke="var(--accent)" /><circle cx={h[0]} cy={h[1]} r={5 * px} fill="var(--surface)" stroke="var(--accent)" /></g>
            ); })}
            <rect x={q[0] - 5 * px} y={q[1] - 5 * px} width={10 * px} height={10 * px} fill={on ? 'var(--accent)' : 'var(--surface)'} stroke="var(--accent)" />
          </g>
        );
      })}
    </g>
  );
}

/** The pen / line path being drawn, in comp coordinates. */
function PenDraft({ px }: { px: number }) {
  const d = penDraft.value; if (!d) return null;
  const poly = flatten(d, 16);
  return (
    <g stroke="var(--accent)" stroke-width={2 * px} fill="none">
      <polyline points={poly.pts.map((q) => q.join(',')).join(' ')} />
      {d.nodes.map((n, i) => <rect key={i} x={n.p[0] - 4 * px} y={n.p[1] - 4 * px} width={8 * px} height={8 * px} fill={i === 0 ? 'var(--accent)' : 'var(--surface)'} />)}
    </g>
  );
}

/** Floating tool palette. */

/** On-canvas text editing: a textarea laid over the layer, matching its transform and font. */
function TextEditor() {
  const id = editingText.value;
  const p = current.value!;
  const l = id ? p.layers.find((x) => x.id === id) : undefined;
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (l) { ref.current?.focus(); ref.current?.select(); } }, [id]);
  if (!l || !l.text) return null;
  const t = playhead.value;
  const r = evaluate(p.layers, t).find((x) => x.layer.id === id)!;
  const st = textStyle(l, t), lay = layoutText(l, t);
  const m = r.world;
  const fill = l.props?.['fill.color'] ? (evalProp(l.props['fill.color'] as Prop<number[]>, t) as [number, number, number, number]) : [1, 1, 1, 1];
  return (
    <textarea ref={ref} class="tbox" value={l.text.text} aria-label="Edit text" spellcheck={false}
      style={{
        position: 'absolute', left: '0px', top: '0px', transformOrigin: '0 0',
        transform: `matrix(${m[0]},${m[1]},${m[2]},${m[3]},${m[4]},${m[5]})`,
        font: fontString(l, st.size), lineHeight: `${(st.size * st.leading) / 100}px`, letterSpacing: `${(st.tracking / 1000) * st.size}px`,
        width: `${Math.max(lay.w + st.size, 120)}px`, height: `${Math.max(lay.h, st.size) + 4}px`, textAlign: l.text.align,
        color: css(fill as never), caretColor: 'var(--accent)',
      }}
      onInput={(e) => editText(l.id, { text: (e.target as HTMLTextAreaElement).value }, 'text')}
      onBlur={() => { editingText.value = null; }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); editingText.value = null; } }} />
  );
}


/** Motion path of an animated, unparented position: a polyline with dots at the keyframes. */
function MotionPath({ layer, px }: { layer: Layer; px: number }) {
  const pos = layer.transform.position as Prop<Vec2>;
  if (!isAnimated(pos) || layer.parent) return null;
  const keys = pos.keys, t0 = keys[0]!.t, t1 = keys[keys.length - 1]!.t;
  const pts: string[] = [];
  const stride = Math.max(1, Math.ceil((t1 - t0) / 400));
  for (let t = t0; t < t1; t += stride) pts.push(evalProp(pos, t).join(','));
  pts.push(keys[keys.length - 1]!.v.join(','));
  return (
    <g stroke="var(--accent)" stroke-opacity=".7" stroke-width={1.25 * px}>
      <polyline points={pts.join(' ')} fill="none" stroke-dasharray={`${4 * px} ${4 * px}`} />
      {keys.map((k) => <circle key={k.t} cx={k.v[0]} cy={k.v[1]} r={3.5 * px} fill="var(--accent)" stroke="none" />)}
    </g>
  );
}

const guides = signal<{ x?: number; y?: number }>({});
const marquee = signal<{ a: Vec2; b: Vec2 } | null>(null);
/** Preview motion blur in the viewer (4 samples max); exports always use the project's full setting. */
export const mbPreview = signal(false);
/** Preview resolution: 'auto' adapts to keep playback smooth (spec §10); numbers are fixed fractions of full size. */
export type Quality = 'auto' | 1 | 0.5 | 0.25;
const storedQ = (() => { try { const v = localStorage.getItem('rf-quality'); return v === 'auto' || v === null ? 'auto' : (Number(v) as Quality); } catch { return 'auto'; } })();
export const previewQuality = signal<Quality>(storedQ);
export const setPreviewQuality = (q: Quality) => { previewQuality.value = q; try { localStorage.setItem('rf-quality', String(q)); } catch { /* ignore */ } };
export const showHud = signal(false);
const hudText = signal('');
const STEPS = [1, 0.75, 0.5, 0.35, 0.25];
const layerBoxOf = (r: ReturnType<typeof evaluate>[number], t: number) => layerBox(r.layer, t);
/** Rotation handle: 28 screen px beyond the middle of the top edge. */
function rotHandle(cs: Vec2[], zoom: number): Vec2 {
  const mx = (cs[0]![0] + cs[1]![0]) / 2, my = (cs[0]![1] + cs[1]![1]) / 2, cx = (cs[0]![0] + cs[2]![0]) / 2, cy = (cs[0]![1] + cs[2]![1]) / 2;
  const dx = mx - cx, dy = my - cy, l = Math.hypot(dx, dy) || 1;
  return [mx + (dx / l) * (28 / zoom), my + (dy / l) * (28 / zoom)];
}
function RotHandle({ pts, px }: { pts: Vec2[]; px: number }) {
  const h = rotHandle(pts, 1 / px), mx = (pts[0]![0] + pts[1]![0]) / 2, my = (pts[0]![1] + pts[1]![1]) / 2;
  return <g><line x1={mx} y1={my} x2={h[0]} y2={h[1]} stroke="var(--accent)" /><circle cx={h[0]} cy={h[1]} r={6 * px} fill="var(--accent)" stroke="none" /></g>;
}
