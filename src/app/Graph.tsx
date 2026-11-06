import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { current, keySel, moveSelectedKeys, playhead, selection, setEaseOnSelected, setKeyComponent } from './state';
import { seek } from './playback';
import { evalProp, isAnimated } from '../anim/interp';
import { sameKey, type KeyRef } from '../anim/keys';
import { animatedProps, PROP_LABEL } from './props';
import type { Ease, Keyframe, Layer, Prop, TransformKey } from '../model/layer';

const COLORS = ['#ff6b6b', '#4cc9f0', '#ffd166', '#7bd88f', '#c792ea', '#ff9f68', '#9aa5ff', '#5eead4'];
const PAD = { l: 44, r: 16, t: 26, b: 12 };

interface Channel { id: string; layer: Layer; prop: TransformKey; comp: number; label: string; color: string }
type K = Keyframe<number | number[]>;
const comp = (v: number | number[], c: number) => (typeof v === 'number' ? v : v[c] ?? 0);

function channelsFor(layers: Layer[]): Channel[] {
  const out: Channel[] = [];
  for (const l of layers) for (const prop of animatedProps(l)) {
    const p = l.transform[prop] as Prop<number | number[]>;
    const n = isAnimated(p) && typeof p.keys[0]!.v !== 'number' ? 2 : 1;
    for (let c = 0; c < n; c++) out.push({
      id: `${l.id}:${prop}:${c}`, layer: l, prop, comp: c,
      label: `${PROP_LABEL[prop]}${n > 1 ? (c ? ' Y' : ' X') : ''}`, color: COLORS[out.length % COLORS.length]!,
    });
  }
  return out;
}

const bezierOf = (e: Ease): [number, number, number, number] | null =>
  Array.isArray(e) ? e : e === 'linear' ? [1 / 3, 1 / 3, 2 / 3, 2 / 3] : null;

export function Graph() {
  const p = current.value!;
  const duration = p.settings.duration;
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 200 });
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const layers = p.layers.filter((l) => selection.value.includes(l.id));
  const channels = useMemo(() => channelsFor(layers), [p.layers, selection.value]);
  const visible = channels.filter((c) => !hidden.includes(c.id));

  const W = Math.max(50, size.w - PAD.l - PAD.r), H = Math.max(50, size.h - PAD.t - PAD.b);
  const X = (t: number) => PAD.l + (t / duration) * W;
  const tOf = (x: number) => ((x - PAD.l) / W) * duration;

  // Sample curves once per document change; derive the value range from them.
  const { curves, lo, hi } = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    const curves = visible.map((c) => {
      const prop = c.layer.transform[c.prop] as Prop<number | number[]>;
      const keys = (prop as { keys: K[] }).keys;
      const t0 = keys[0]!.t, t1 = keys[keys.length - 1]!.t;
      const pts: [number, number][] = [];
      for (let t = t0; t < t1; t++) pts.push([t, comp(evalProp(prop, t), c.comp)]);
      pts.push([t1, comp(keys[keys.length - 1]!.v, c.comp)]);
      for (const [, v] of pts) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      return pts;
    });
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const m = (hi - lo) * 0.12;
    return { curves, lo: lo - m, hi: hi + m };
  }, [visible.map((c) => c.id).join(), p.layers]);
  const Y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * H;
  const vOf = (y: number) => lo + (1 - (y - PAD.t) / H) * (hi - lo);

  type Drag =
    | { kind: 'key'; c: Channel; t: number; x0: number; y0: number; v0: number; applied: number }
    | { kind: 'handle'; c: Channel; ref: KeyRef; which: 1 | 2; k0: K; k1: K; ease: [number, number, number, number] }
    | { kind: 'scrub' } | null;
  const drag = useRef<Drag>(null);
  const local = (e: PointerEvent) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  const onDown = (e: PointerEvent) => {
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    const q = local(e);
    const tgt = (e.target as SVGElement).dataset;
    if (tgt.key) {
      const c = channels.find((x) => x.id === tgt.ch)!, t = Number(tgt.key);
      const r: KeyRef = { layer: c.layer.id, prop: c.prop, t }, cur = keySel.peek();
      if (e.shiftKey) keySel.value = cur.some((s) => sameKey(s, r)) ? cur.filter((s) => !sameKey(s, r)) : [...cur, r];
      else if (!cur.some((s) => sameKey(s, r))) keySel.value = [r];
      const keys = (c.layer.transform[c.prop] as { keys: K[] }).keys;
      drag.current = { kind: 'key', c, t, x0: q.x, y0: q.y, v0: comp(keys.find((k) => k.t === t)!.v, c.comp), applied: 0 };
    } else if (tgt.handle) {
      const c = channels.find((x) => x.id === tgt.ch)!, t = Number(tgt.t);
      const keys = (c.layer.transform[c.prop] as { keys: K[] }).keys;
      const i = keys.findIndex((k) => k.t === t);
      const ease = bezierOf(keys[i]!.ease)!;
      drag.current = { kind: 'handle', c, ref: { layer: c.layer.id, prop: c.prop, t }, which: tgt.handle === '1' ? 1 : 2, k0: keys[i]!, k1: keys[i + 1]!, ease };
    } else if (q.y < PAD.t) { drag.current = { kind: 'scrub' }; seek(tOf(q.x)); }
    else { keySel.value = []; }
  };

  const onMove = (e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    const q = local(e);
    if (d.kind === 'scrub') { seek(tOf(q.x)); return; }
    if (d.kind === 'key') {
      const df = Math.round(tOf(q.x) - tOf(d.x0));
      if (df !== d.applied) { moveSelectedKeys(df - d.applied); d.applied = df; }
      const v = d.v0 + (vOf(q.y) - vOf(d.y0));
      setKeyComponent({ layer: d.c.layer.id, prop: d.c.prop, t: d.t + d.applied }, d.c.comp, Math.round(v * 100) / 100);
      return;
    }
    const dt = d.k1.t - d.k0.t, v0 = comp(d.k0.v, d.c.comp), dv = comp(d.k1.v, d.c.comp) - v0 || 1;
    const x = Math.min(1, Math.max(0, (tOf(q.x) - d.k0.t) / dt)), y = (vOf(q.y) - v0) / dv;
    const next = d.ease.slice() as [number, number, number, number];
    if (d.which === 1) { next[0] = x; next[1] = y; } else { next[2] = x; next[3] = y; }
    d.ease = next.map((n) => Math.round(n * 1000) / 1000) as typeof next;
    setEaseOnSelected(d.ease, [d.ref]);
  };
  const onUp = () => { drag.current = null; };

  // Handles for the most recently selected key (first visible channel of its property).
  const active = keySel.value[keySel.value.length - 1];
  const hc = active && visible.find((c) => c.layer.id === active.layer && c.prop === active.prop);
  const handles = (() => {
    if (!active || !hc) return null;
    const keys = (hc.layer.transform[hc.prop] as { keys: K[] }).keys;
    const i = keys.findIndex((k) => k.t === active.t);
    const k0 = keys[i], k1 = keys[i + 1];
    const e = k0 && bezierOf(k0.ease);
    if (!k0 || !k1 || !e) return null;
    const v0 = comp(k0.v, hc.comp), dv = comp(k1.v, hc.comp) - v0;
    if (!dv) return null;
    const dt = k1.t - k0.t;
    return { ch: hc, k0, k1, p1: [k0.t + e[0] * dt, v0 + e[1] * dv] as [number, number], p2: [k0.t + e[2] * dt, v0 + e[3] * dv] as [number, number], v0, v1: v0 + dv };
  })();

  const hGrid = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const step = Math.max(1, Math.round(duration / Math.max(2, Math.floor(W / 70))));

  if (!layers.length) return <p class="hint pad">Select a layer to see its animation curves.</p>;
  if (!channels.length) return <p class="hint pad">Animate a property (stopwatch in the inspector) to see its curve.</p>;

  return (
    <div class="graph">
      <ul class="channels">
        {channels.map((c) => (
          <li key={c.id}><button class={hidden.includes(c.id) ? 'off' : ''} aria-pressed={!hidden.includes(c.id)}
            onClick={() => setHidden((h) => (h.includes(c.id) ? h.filter((x) => x !== c.id) : [...h, c.id]))}>
            <i style={{ background: c.color }} />{layers.length > 1 ? `${c.layer.name} · ` : ''}{c.label}</button></li>
        ))}
      </ul>
      <div class="plot" ref={box}>
        <svg width={size.w} height={size.h} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <rect x="0" y="0" width={size.w} height={PAD.t} class="g-ruler" />
          {hGrid.map((v) => <g key={v}><line x1={PAD.l} x2={PAD.l + W} y1={Y(v)} y2={Y(v)} class="g-grid" /><text x={PAD.l - 6} y={Y(v) + 4} text-anchor="end" class="g-lbl">{Math.round(v * 10) / 10}</text></g>)}
          {Array.from({ length: Math.ceil(duration / step) }, (_, i) => i * step).map((t) => <g key={t}><line x1={X(t)} x2={X(t)} y1={PAD.t} y2={PAD.t + H} class="g-grid" /><text x={X(t) + 3} y={16} class="g-lbl">{t}</text></g>)}
          {visible.map((c, i) => <polyline key={c.id} points={curves[i]!.map(([t, v]) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')} fill="none" stroke={c.color} stroke-width="2" pointer-events="none" />)}
          {handles && <g>
            <line x1={X(handles.k0.t)} y1={Y(handles.v0)} x2={X(handles.p1[0])} y2={Y(handles.p1[1])} class="g-h" />
            <line x1={X(handles.k1.t)} y1={Y(handles.v1)} x2={X(handles.p2[0])} y2={Y(handles.p2[1])} class="g-h" />
            {([['1', handles.p1], ['2', handles.p2]] as const).map(([w, pt]) => (
              <g key={w}><circle cx={X(pt[0])} cy={Y(pt[1])} r="14" fill="transparent" data-handle={w} data-ch={handles.ch.id} data-t={handles.k0.t} />
                <circle cx={X(pt[0])} cy={Y(pt[1])} r="5" class="g-hd" pointer-events="none" /></g>
            ))}
          </g>}
          {visible.map((c) => (c.layer.transform[c.prop] as { keys: K[] }).keys.map((k) => {
            const on = keySel.value.some((s) => sameKey(s, { layer: c.layer.id, prop: c.prop, t: k.t }));
            return <g key={`${c.id}:${k.t}`}>
              <circle cx={X(k.t)} cy={Y(comp(k.v, c.comp))} r="14" fill="transparent" data-key={k.t} data-ch={c.id} />
              <circle cx={X(k.t)} cy={Y(comp(k.v, c.comp))} r={on ? 6 : 4.5} fill={on ? c.color : 'var(--surface)'} stroke={c.color} stroke-width="2" pointer-events="none" />
            </g>;
          }))}
          <line x1={X(playhead.value)} x2={X(playhead.value)} y1="0" y2={PAD.t + H} class="g-play" pointer-events="none" />
        </svg>
      </div>
    </div>
  );
}
