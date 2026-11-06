import { useRef, useState } from 'preact/hooks';
import { current, playhead, selection, setTiming } from './state';
import { seek } from './playback';
import { isAnimated } from '../anim/interp';
import type { Layer, Prop } from '../model/layer';

const NAME_W = 150;
const MIN_PPF = 0.5, MAX_PPF = 40;

const keyTimes = (l: Layer): number[] => {
  const ts = new Set<number>();
  for (const p of Object.values(l.transform) as Prop<unknown>[]) if (isAnimated(p)) for (const k of p.keys) ts.add(k.t);
  return [...ts];
};

export function Timeline() {
  const p = current.value!;
  const { duration, fps } = p.settings;
  const [ppf, setPpf] = useState(4);
  const scroller = useRef<HTMLDivElement>(null);
  const width = duration * ppf;
  const zoom = (f: number) => setPpf((v) => Math.min(MAX_PPF, Math.max(MIN_PPF, v * f)));
  const fit = () => setPpf(Math.max(MIN_PPF, ((scroller.current?.clientWidth ?? 600) - NAME_W - 16) / duration));

  // Ruler tick spacing: aim for ~60 px between labels, snapped to whole seconds / frame multiples.
  const step = [1, 2, 5, 10, 15, fps, fps * 2, fps * 5, fps * 10, fps * 30, fps * 60].find((s) => s * ppf >= 60) ?? fps * 60;
  const ticks: number[] = [];
  for (let f = 0; f < duration; f += step) ticks.push(f);

  const scrub = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    seek((e.clientX - r.left) / ppf);
  };
  const frameAt = playhead.value;

  return (
    <>
      <div class="tl-bar">
        <h2>Timeline</h2>
        <span class="spacer" />
        <button class="btn sm" onClick={() => zoom(1 / 1.4)} aria-label="Zoom timeline out">−</button>
        <button class="btn sm" onClick={fit}>Fit</button>
        <button class="btn sm" onClick={() => zoom(1.4)} aria-label="Zoom timeline in">＋</button>
      </div>
      <div class="tl-scroll" ref={scroller}>
        <div class="tl-inner" style={{ width: `${NAME_W + width}px` }}>
          <div class="tl-row tl-ruler">
            <div class="tl-name" />
            <div class="tl-track" style={{ width: `${width}px` }} onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); scrub(e); }}
              onPointerMove={(e) => { if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) scrub(e); }}>
              {ticks.map((f) => <span key={f} class="tick" style={{ left: `${f * ppf}px` }}>{Math.floor(f / fps)}s{f % fps ? `+${f % fps}` : ''}</span>)}
            </div>
          </div>
          {p.layers.map((l) => (
            <Row key={l.id} layer={l} ppf={ppf} on={selection.value.includes(l.id)} />
          ))}
          <div class="playhead" style={{ left: `${NAME_W + frameAt * ppf}px` }} />
        </div>
      </div>
    </>
  );
}

function Row({ layer: l, ppf, on }: { layer: Layer; ppf: number; on: boolean }) {
  // Drag state lives in a ref so the bar keeps working while commits re-render the row.
  const drag = useRef<{ x: number; in: number; out: number; mode: 'move' | 'in' | 'out' } | null>(null);
  const begin = (mode: 'move' | 'in' | 'out') => (e: PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, in: l.in, out: l.out, mode };
    selection.value = [l.id];
  };
  const move = (e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    const df = Math.round((e.clientX - d.x) / ppf);
    if (d.mode === 'move') setTiming(l.id, d.in + df, d.out + df, `trim:${l.id}`);
    else if (d.mode === 'in') setTiming(l.id, Math.min(d.in + df, d.out - 1), d.out, `trim:${l.id}`);
    else setTiming(l.id, d.in, d.out + df, `trim:${l.id}`);
  };
  const end = () => { drag.current = null; };
  return (
    <div class={`tl-row ${on ? 'on' : ''} ${l.visible ? '' : 'dim'}`} onClick={() => { selection.value = [l.id]; }}>
      <div class="tl-name" title={l.name}>{l.name}</div>
      <div class="tl-track" style={{ width: `${current.value!.settings.duration * ppf}px` }}>
        <div class="bar" style={{ left: `${l.in * ppf}px`, width: `${Math.max(4, (l.out - l.in) * ppf)}px` }}
          onPointerDown={begin('move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          <span class="grip l" onPointerDown={begin('in')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
          <span class="grip r" onPointerDown={begin('out')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
        </div>
        {keyTimes(l).map((t) => <i key={t} class="kf" style={{ left: `${t * ppf}px` }} />)}
      </div>
    </div>
  );
}
