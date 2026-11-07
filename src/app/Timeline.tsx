import { useRef, useState } from 'preact/hooks';
import {
  addAdjustment, addComp, addLayer, addMarker, addShaderLayer, autoKey, current, deleteLayers, duplicateLayers, expanded, importMedia, keySel, moveLayer, moveSelectedKeys, playhead,
  hideShy, precompose, removeMarker, renameLayer, renameMarker, selMarker, selection, setParent, setTiming, setWorkArea, toggleExpanded, toggleLocked, toggleShy, toggleSolo, toggleVisible,
} from './state';
import { setTool } from './tools';
import { seek } from './playback';
import { isAnimated } from '../anim/interp';
import { sameKey, type KeyRef } from '../anim/keys';
import { workRange } from '../model/project';
import { Graph } from './Graph';
import { EasingPicker } from './EasingPicker';
import { animatedProps, propLabel } from './props';
import { allProps, propOf, type Layer, type Prop, type PropKey } from '../model/layer';

const NAME_W = 270; // keep in sync with --name-w in theme.css
const MIN_PPF = 0.5, MAX_PPF = 40;
const px = (n: number) => `${n}px`;

const keyTimes = (l: Layer): number[] => {
  const ts = new Set<number>();
  for (const [, p] of allProps(l)) if (isAnimated(p)) for (const k of p.keys) ts.add(k.t);
  return [...ts];
};

export function Timeline() {
  const p = current.value!;
  const { duration, fps } = p.settings;
  const [ppf, setPpf] = useState(4);
  const [mode, setMode] = useState<'dope' | 'graph'>('dope');
  const [easingOpen, setEasingOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const width = duration * ppf;
  const zoom = (f: number) => setPpf((v) => Math.min(MAX_PPF, Math.max(MIN_PPF, v * f)));
  const fit = () => setPpf(Math.max(MIN_PPF, ((scroller.current?.clientWidth ?? 600) - NAME_W - 16) / duration));
  const [waIn, waOut] = workRange(p);

  const step = [1, 2, 5, 10, 15, fps, fps * 2, fps * 5, fps * 10, fps * 30, fps * 60].find((s) => s * ppf >= 60) ?? fps * 60;
  const ticks: number[] = [];
  for (let f = 0; f < duration; f += step) ticks.push(f);

  const scrub = (e: PointerEvent) => seek((e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left) / ppf);
  const marker = p.markers.find((m) => m.id === selMarker.value);
  const nKeys = keySel.value.length;
  const sel = selection.value;
  const first = p.layers.find((l) => l.id === sel[0]);
  const idx = first ? p.layers.indexOf(first) : -1;

  return (
    <>
      <div class="tl-bar">
        <div class="seg" role="tablist" aria-label="Timeline view">
          <button role="tab" aria-selected={mode === 'dope'} onClick={() => setMode('dope')}>Dope sheet</button>
          <button role="tab" aria-selected={mode === 'graph'} onClick={() => setMode('graph')}>Graph</button>
        </div>
        <button class={`btn sm autokey ${autoKey.value ? 'on' : ''}`} aria-pressed={autoKey.value} onClick={() => (autoKey.value = !autoKey.value)}
          title="Auto-key (K): editing any property at the playhead creates a keyframe">● Auto-key</button>
        <button class="btn sm" disabled={!nKeys} onClick={() => setEasingOpen(true)}>Easing{nKeys ? ` (${nKeys})` : ''}</button>
        <span class="sep" />
        <button class="btn sm" onClick={() => addLayer('solid')} aria-label="Add solid layer">＋ Solid</button>
        <button class="btn sm" onClick={() => addLayer('null')} aria-label="Add null layer">＋ Null</button>
        <button class="btn sm" onClick={() => setTool('rect')} aria-label="Draw a shape">＋ Shape</button>
        <button class="btn sm" onClick={() => setTool('text')} aria-label="Add text">＋ Text</button>
        <button class="btn sm" onClick={addAdjustment} aria-label="Add adjustment layer">＋ Adjust</button>
        <button class="btn sm" onClick={addShaderLayer} aria-label="Add shader layer">＋ Shader</button>
        <button class="btn sm" onClick={addComp} aria-label="Add composition">＋ Comp</button>
        <label class="btn sm filebtn" aria-label="Import media">＋ Media
          <input type="file" multiple accept="image/*,video/*,.svg,.heic,.avif" hidden onChange={(e) => { const fs = Array.from((e.target as HTMLInputElement).files ?? []); if (fs.length) void importMedia(fs); (e.target as HTMLInputElement).value = ''; }} />
        </label>
        {sel.length > 0 && <>
          <span class="sep" />
          {first && <select class="parent" aria-label="Parent layer" value={first.parent ?? ''} onChange={(e) => setParent(first.id, (e.target as HTMLSelectElement).value || undefined)}>
            <option value="">No parent</option>
            {p.layers.filter((o) => o.id !== first.id).map((o) => <option key={o.id} value={o.id}>↳ {o.name}</option>)}
          </select>}
          <button class="btn sm" disabled={idx <= 0} onClick={() => first && moveLayer(first.id, -1)} aria-label="Move layer up">↑</button>
          <button class="btn sm" disabled={idx < 0 || idx === p.layers.length - 1} onClick={() => first && moveLayer(first.id, 1)} aria-label="Move layer down">↓</button>
          <button class="btn sm" onClick={() => duplicateLayers(sel)} aria-label="Duplicate layer">⧉</button>
          <button class="btn sm" onClick={() => precompose(sel)} aria-label="Pre-compose selected layers">▣</button>
          <button class="btn sm danger" onClick={() => deleteLayers(sel)} aria-label="Delete layer">✕</button>
        </>}
        <span class="spacer" />
        <button class={`btn sm ${hideShy.value ? 'on' : ''}`} aria-pressed={hideShy.value} onClick={() => (hideShy.value = !hideShy.value)}
          title="Hide layers marked shy from this list">Shy</button>
        <button class="btn sm" onClick={() => addMarker()} aria-label="Add marker at playhead">◆ Marker</button>
        {marker && <button class="btn sm danger" onClick={() => removeMarker(marker.id)} aria-label="Delete marker">✕ {marker.name}</button>}
        {p.workArea && <button class="btn sm" onClick={() => setWorkArea(null)}>Reset range</button>}
        {mode === 'dope' && <>
          <button class="btn sm" onClick={() => zoom(1 / 1.4)} aria-label="Zoom timeline out">−</button>
          <button class="btn sm" onClick={fit}>Fit</button>
          <button class="btn sm" onClick={() => zoom(1.4)} aria-label="Zoom timeline in">＋</button>
        </>}
      </div>

      {mode === 'graph' ? <Graph /> : (
        <div class="tl-scroll" ref={scroller}>
          <div class="tl-inner" style={{ width: px(NAME_W + width) }}>
            <div class="tl-row tl-ruler">
              <div class="tl-name" />
              <div class="tl-track" style={{ width: px(width) }}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); scrub(e); }}
                onPointerMove={(e) => { if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) scrub(e); }}>
                {ticks.map((f) => <span key={f} class="tick" style={{ left: px(f * ppf) }}>{Math.floor(f / fps)}s{f % fps ? `+${f % fps}` : ''}</span>)}
                {p.workArea && <>
                  <div class="wa-shade" style={{ left: '0px', width: px(waIn * ppf) }} />
                  <div class="wa-shade" style={{ left: px(waOut * ppf), width: px(Math.max(0, (duration - waOut) * ppf)) }} />
                </>}
                <WorkHandle kind="in" at={waIn} ppf={ppf} range={[waIn, waOut]} />
                <WorkHandle kind="out" at={waOut} ppf={ppf} range={[waIn, waOut]} />
                {p.markers.map((m) => (
                  <button key={m.id} class={`marker ${m.id === selMarker.value ? 'on' : ''}`} style={{ left: px(m.t * ppf) }} title={m.name} aria-label={`Marker ${m.name}`}
                    onPointerDown={(e) => { e.stopPropagation(); selMarker.value = m.id; seek(m.t); }}
                    onDblClick={() => { const n = prompt('Marker name', m.name); if (n) renameMarker(m.id, n); }}>
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
            </div>
            {p.layers.length === 0 && <p class="hint tl-empty">Add a solid to get started.</p>}
            {p.layers.filter((l) => !(hideShy.value && l.shy)).map((l) => (
              <LayerRows key={l.id} layer={l} ppf={ppf} on={selection.value.includes(l.id)} open={expanded.value.includes(l.id)} />
            ))}
            <div class="playhead" style={{ left: px(NAME_W + playhead.value * ppf) }} />
          </div>
        </div>
      )}
      {easingOpen && <EasingPicker onClose={() => setEasingOpen(false)} />}
    </>
  );
}

function WorkHandle({ kind, at, ppf, range }: { kind: 'in' | 'out'; at: number; ppf: number; range: [number, number] }) {
  const drag = useRef<{ x: number; at: number } | null>(null);
  return (
    <span class={`wa-handle ${kind}`} style={{ left: px(at * ppf) }} aria-label={`Work area ${kind}`}
      onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, at }; }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d) return;
        const f = d.at + Math.round((e.clientX - d.x) / ppf);
        setWorkArea(kind === 'in' ? [Math.min(f, range[1] - 1), range[1]] : [range[0], Math.max(f, range[0] + 1)], 'wa');
      }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
  );
}

function LayerRows({ layer: l, ppf, on, open }: { layer: Layer; ppf: number; on: boolean; open: boolean }) {
  const props = animatedProps(l);
  // Layer-bar drags live in a ref so the bar keeps working while commits re-render the row.
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
  const trackW = px(current.value!.settings.duration * ppf);
  return (
    <>
      <div data-testid="layer-row" data-selected={on} class={`tl-row layer ${on ? 'on' : ''} ${l.visible ? '' : 'dim'}`}
        onClick={(e) => { const cur = selection.peek(); selection.value = e.shiftKey ? (on ? cur.filter((x) => x !== l.id) : [...cur, l.id]) : [l.id]; }}>
        <div class="tl-name" title={l.name}>
          <button class="chev" disabled={!props.length} aria-expanded={open} aria-label={open ? 'Collapse properties' : 'Expand properties'}
            onClick={(e) => { e.stopPropagation(); toggleExpanded(l.id); }}>{props.length ? (open ? '▾' : '▸') : ''}</button>
          <button class={`eye ${l.visible ? '' : 'off'}`} aria-label={l.visible ? 'Hide layer' : 'Show layer'} aria-pressed={l.visible}
            onClick={(e) => { e.stopPropagation(); toggleVisible(l.id); }}>{l.visible ? '●' : '○'}</button>
          <button class={`lf ${l.solo ? 'on' : ''}`} aria-label={l.solo ? 'Unsolo layer' : 'Solo layer'} aria-pressed={!!l.solo} title="Solo"
            onClick={(e) => { e.stopPropagation(); toggleSolo(l.id); }}>S</button>
          <button class={`lf ${l.locked ? 'on' : ''}`} aria-label={l.locked ? 'Unlock layer' : 'Lock layer'} aria-pressed={!!l.locked} title="Lock"
            onClick={(e) => { e.stopPropagation(); toggleLocked(l.id); }}>{l.locked ? '🔒' : '🔓'}</button>
          <button class={`lf ${l.shy ? 'on' : ''}`} aria-label={l.shy ? 'Unmark shy' : 'Mark layer shy'} aria-pressed={!!l.shy} title="Shy"
            onClick={(e) => { e.stopPropagation(); toggleShy(l.id); }}>👁</button>
          <i class="chip" title={l.type} style={{ background: l.type === 'solid' || l.type === 'shape' || l.type === 'precomp' || l.type === 'image' || l.type === 'video' ? `rgb(${l.color.slice(0, 3).map((c) => Math.round(c * 255)).join()})` : 'transparent' }}>{({ text: 'T', adjustment: '◐', precomp: '▣', shader: '◈', image: '▨', video: '▶︎' } as Record<string, string>)[l.type] ?? ''}</i>
          <input class="name" value={l.name} aria-label="Layer name" onClick={(e) => e.stopPropagation()}
            onChange={(e) => renameLayer(l.id, (e.target as HTMLInputElement).value)} />
        </div>
        <div class="tl-track" style={{ width: trackW }}>
          <div class="bar" style={{ left: px(l.in * ppf), width: px(Math.max(4, (l.out - l.in) * ppf)) }}
            onPointerDown={begin('move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
            <span class="grip l" onPointerDown={begin('in')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
            <span class="grip r" onPointerDown={begin('out')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
          </div>
          {keyTimes(l).map((t) => <i key={t} class="kf" style={{ left: px(t * ppf) }} />)}
        </div>
      </div>
      {open && props.map((k) => <PropRow key={k} layer={l} prop={k} ppf={ppf} width={trackW} />)}
    </>
  );
}

/** One animated property: selectable, draggable keyframe diamonds; sweep on empty space to box-select in time. */
function PropRow({ layer: l, prop, ppf, width }: { layer: Layer; prop: PropKey; ppf: number; width: string }) {
  const p = propOf(l, prop) as Prop<unknown>;
  const keys = isAnimated(p) ? p.keys : [];
  const sel = keySel.value;
  const ref = (t: number): KeyRef => ({ layer: l.id, prop, t });
  const mode = useRef<{ kind: 'drag'; x: number; applied: number } | { kind: 'box'; x0: number; add: boolean; base: KeyRef[] } | null>(null);
  const frameAt = (e: PointerEvent) => (e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left) / ppf;

  const down = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    selection.value = [l.id];
    const tAttr = (e.target as HTMLElement).dataset?.t;
    if (tAttr !== undefined) {
      const r = ref(Number(tAttr));
      const cur = keySel.peek();
      if (e.shiftKey) keySel.value = cur.some((s) => sameKey(s, r)) ? cur.filter((s) => !sameKey(s, r)) : [...cur, r];
      else if (!cur.some((s) => sameKey(s, r))) keySel.value = [r];
      mode.current = { kind: 'drag', x: e.clientX, applied: 0 };
    } else {
      mode.current = { kind: 'box', x0: frameAt(e), add: e.shiftKey, base: e.shiftKey ? keySel.peek() : [] };
      if (!e.shiftKey) keySel.value = [];
    }
  };
  const move = (e: PointerEvent) => {
    const m = mode.current; if (!m) return;
    if (m.kind === 'drag') {
      const df = Math.round((e.clientX - m.x) / ppf);
      if (df !== m.applied) { moveSelectedKeys(df - m.applied); m.applied = df; }
    } else {
      const a = Math.min(m.x0, frameAt(e)), b = Math.max(m.x0, frameAt(e));
      const inside = keys.filter((k) => k.t >= a && k.t <= b).map((k) => ref(k.t));
      keySel.value = [...m.base.filter((s) => !inside.some((i) => sameKey(i, s))), ...inside];
    }
  };
  const end = () => { mode.current = null; };

  return (
    <div class="tl-row sub">
      <div class="tl-name" title={propLabel(prop, l)}>
        <button class="propname" onClick={() => { keySel.value = keys.map((k) => ref(k.t)); selection.value = [l.id]; }}>{propLabel(prop, l)}</button>
      </div>
      <div class="tl-track" style={{ width }} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        {keys.map((k) => (
          <i key={k.t} data-t={k.t} class={`kf live ${sel.some((s) => sameKey(s, ref(k.t))) ? 'sel' : ''} ${k.ease === 'hold' ? 'hold' : ''}`} style={{ left: px(k.t * ppf) }} />
        ))}
      </div>
    </div>
  );
}
