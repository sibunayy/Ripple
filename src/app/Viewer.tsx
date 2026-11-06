import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { effect } from '@preact/signals';
import { addShape, addText, current, frame, playhead, selection, setPath, setProp, setTransform, editText } from './state';
import { editingText, finishPen, nodeSel, penDraft, setTool, tool, TOOLS, type Tool } from './tools';
import { distToPoly, flatten, insertNode, moveHandle, moveNode, nearestOnPath, node as mkNode } from '../shape/path';
import { layoutText, fontString, textStyle } from '../text/metrics';
import { shapePath } from '../shape/geometry';
import { css } from '../render/raster';
import { fontRev } from '../text/fonts';
import { corners, evaluate, hitTest } from '../eval/evaluate';
import { evalProp, isAnimated } from '../anim/interp';
import { apply, invert } from '../eval/affine';
import { GLRenderer } from '../render/gl';
import type { BezPath, Layer, Prop, Vec2 } from '../model/layer';

const MAX_BUFFER = 2560; // longest side of the preview buffer; the canvas is CSS-scaled to the comp
const MIN_ZOOM = 0.05, MAX_ZOOM = 16;
interface View { zoom: number; x: number; y: number; fit: boolean }

declare global { interface Window { __ripple?: { renderer?: GLRenderer } } }

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
    renderer.current = r; window.__ripple = { renderer: r };
    let queued = 0;
    const draw = () => {
      queued = 0;
      const p = current.peek(); if (!p) return;
      const { width, height, bg } = p.settings;
      const k = Math.min(1, MAX_BUFFER / Math.max(width, height));
      r.resize(Math.round(width * k), Math.round(height * k));
      // Render in comp space; scale to the buffer via the resolution uniform.
      const t = playhead.peek();
      r.render(evaluate(p.layers, t), { width, height, bg, t });
    };
    const schedule = () => { if (!queued) queued = requestAnimationFrame(draw); };
    r.onRestore = schedule;
    const stop = effect(() => { current.value; playhead.value; fontRev.value; schedule(); });
    return () => { stop(); cancelAnimationFrame(queued); renderer.current = null; };
  }, []);

  // ---- gestures ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; mx: number; my: number } | null>(null);
  type Drag =
    | { kind: 'move'; id: string; start: Vec2; pos: Vec2; lin: [number, number, number, number] }
    | { kind: 'pan'; x: number; y: number; vx: number; vy: number }
    | { kind: 'create'; tool: Tool; id: string | null; start: Vec2; sx: number; sy: number; moved: boolean }
    | { kind: 'node'; id: string; idx: number }
    | { kind: 'handle'; id: string; idx: number; which: 'i' | 'o' }
    | { kind: 'penhandle'; idx: number };
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

  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest?.('.tools, .zoombar, .tbox')) return;
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

    // node / handle editing on the selected path layer
    const selId = selection.peek().length === 1 ? selection.peek()[0] : undefined;
    const sel = selId ? resolved.find((r) => r.layer.id === selId) : undefined;
    const path = sel?.layer.shape?.kind === 'path' ? sel.layer.shape.path : undefined;
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
    if (!id) { selection.value = []; return; }
    const r = resolved.find((x) => x.layer.id === id)!;
    if (r.layer.type === 'text' && doubleTap(e)) { selection.value = [id]; editingText.value = id; return; }
    selection.value = [id];
    const parentW = r.layer.parent ? resolved.find((x) => x.layer.id === r.layer.parent)?.world : undefined;
    const inv = parentW ? invert(parentW) : [1, 0, 0, 1, 0, 0];
    drag.current = { kind: 'move', id, start: [cx, cy], pos: evalProp(r.layer.transform.position, frame()) as Vec2, lin: inv ? [inv[0]!, inv[1]!, inv[2]!, inv[3]!] : [1, 0, 0, 1] };
  };

  const onMove = (e: PointerEvent) => {
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
    if (d.kind === 'move') {
      const dx = cx - d.start[0], dy = cy - d.start[1];
      setTransform(d.id, 'position', [d.pos[0] + d.lin[0] * dx + d.lin[2] * dy, d.pos[1] + d.lin[1] * dx + d.lin[3] * dy], `move:${d.id}`);
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
        setProp(d.id, 'position', [(d.start[0] + cx) / 2, (d.start[1] + cy) / 2], key);
        setProp(d.id, 'shape.size', [Math.max(1, Math.abs(cx - d.start[0])), Math.max(1, Math.abs(cy - d.start[1]))], key);
      } else {
        const r = Math.max(5, Math.hypot(cx - d.start[0], cy - d.start[1]));
        setProp(d.id, 'shape.outer', r, key);
        if (d.tool === 'star') setProp(d.id, 'shape.inner', r * 0.42, key);
      }
    } else if (d.kind === 'node' || d.kind === 'handle') {
      const pl = current.peek()!.layers.find((l) => l.id === d.id);
      const path = pl?.shape?.path; if (!pl || !path) return;
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
  const k = Math.min(1, MAX_BUFFER / Math.max(s.width, s.height));

  return (
    <div class="viewport" ref={wrap} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div class="stage" ref={stage} style={{ width: `${s.width}px`, height: `${s.height}px`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        <canvas ref={canvas} width={Math.round(s.width * k)} height={Math.round(s.height * k)} aria-label="Composition viewer" />
        <Overlay zoom={view.zoom} />
        <TextEditor />
      </div>
      <Tools />
      {error && <p class="gl-error" role="alert">Rendering unavailable: {error}</p>}
      <div class="zoombar">
        <button class="btn sm" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">−</button>
        <button class="btn sm" onClick={() => setView(fitView())}>{Math.round(view.zoom * 100)}%</button>
        <button class="btn sm" onClick={() => zoomBy(1.25)} aria-label="Zoom in">＋</button>
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
            <MotionPath layer={r.layer} px={px} />
            <Nodes r={r} px={px} />
            <path d={`M${a[0] - 8 * px} ${a[1]}H${a[0] + 8 * px}M${a[0]} ${a[1] - 8 * px}V${a[1] + 8 * px}`} stroke="var(--accent)" />
          </g>
        );
      })}
      <PenDraft px={px} />
    </svg>
  );
}

/** Editable bezier nodes + handles of a selected path layer. */
function Nodes({ r, px }: { r: ReturnType<typeof evaluate>[number]; px: number }) {
  const path = r.layer.shape?.kind === 'path' && r.layer.type === 'shape' ? r.layer.shape.path : undefined;
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
function Tools() {
  const cur = tool.value, draft = penDraft.value;
  return (
    <div class="tools" role="toolbar" aria-label="Tools">
      {TOOLS.map((t) => (
        <button key={t.id} class="btn sm" aria-pressed={cur === t.id} title={`${t.label} (${t.key})`} aria-label={t.label} onClick={() => setTool(t.id)}>{t.icon}</button>
      ))}
      {draft && (
        <>
          <button class="btn sm primary" aria-label="Finish path" onClick={() => finishPen(false)}>✓</button>
          <button class="btn sm" aria-label="Close path" disabled={draft.nodes.length < 3} onClick={() => finishPen(true)}>⭘</button>
        </>
      )}
    </div>
  );
}

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
