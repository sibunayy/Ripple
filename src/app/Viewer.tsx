import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { effect } from '@preact/signals';
import { current, frame, playhead, selection, setTransform } from './state';
import { corners, evaluate, hitTest } from '../eval/evaluate';
import { evalProp } from '../anim/interp';
import { apply, invert } from '../eval/affine';
import { GLRenderer } from '../render/gl';
import type { Vec2 } from '../model/layer';

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
      r.render(evaluate(p.layers, playhead.peek()), { width, height, bg });
    };
    const schedule = () => { if (!queued) queued = requestAnimationFrame(draw); };
    r.onRestore = schedule;
    const stop = effect(() => { current.value; playhead.value; schedule(); });
    return () => { stop(); cancelAnimationFrame(queued); renderer.current = null; };
  }, []);

  // ---- gestures ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; mx: number; my: number } | null>(null);
  const drag = useRef<{ id: string; start: Vec2; pos: Vec2; lin: [number, number, number, number] } | null>(null);

  const toComp = (cx: number, cy: number): Vec2 => {
    const r = stage.current!.getBoundingClientRect();
    return [((cx - r.left) / r.width) * s.width, ((cy - r.top) / r.height) * s.height];
  };
  const local = (e: PointerEvent) => { const r = wrap.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  const zoomAt = (px: number, py: number, factor: number) => setView((v) => {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor)), k = zoom / v.zoom;
    return { zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k, fit: false };
  });

  const onDown = (e: PointerEvent) => {
    wrap.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 2) {
      drag.current = null;
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    const p = current.peek()!;
    const resolved = evaluate(p.layers, playhead.peek());
    const [cx, cy] = toComp(e.clientX, e.clientY);
    const id = hitTest(resolved, cx, cy);
    if (!id) { selection.value = []; return; }
    selection.value = [id];
    const r = resolved.find((x) => x.layer.id === id)!;
    const parentW = r.layer.parent ? resolved.find((x) => x.layer.id === r.layer.parent)?.world : undefined;
    const inv = parentW ? invert(parentW) : [1, 0, 0, 1, 0, 0];
    drag.current = { id, start: [cx, cy], pos: evalProp(r.layer.transform.position, frame()) as Vec2, lin: inv ? [inv[0]!, inv[1]!, inv[2]!, inv[3]!] : [1, 0, 0, 1] };
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
    const [cx, cy] = toComp(e.clientX, e.clientY);
    const dx = cx - d.start[0], dy = cy - d.start[1];
    setTransform(d.id, 'position', [d.pos[0] + d.lin[0] * dx + d.lin[2] * dy, d.pos[1] + d.lin[1] * dx + d.lin[3] * dy], `move:${d.id}`);
  };

  const onUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) drag.current = null;
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
      </div>
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
        const pts = corners(r);
        const a = apply(r.world, ...(evalProp(r.layer.transform.anchor, playhead.value) as Vec2));
        return (
          <g key={r.layer.id} stroke-width={1.5 * px}>
            <polygon points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke="var(--accent)" />
            {pts.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r={4 * px} fill="var(--surface)" stroke="var(--accent)" />)}
            <path d={`M${a[0] - 8 * px} ${a[1]}H${a[0] + 8 * px}M${a[0]} ${a[1] - 8 * px}V${a[1] + 8 * px}`} stroke="var(--accent)" />
          </g>
        );
      })}
    </svg>
  );
}

