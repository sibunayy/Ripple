import { useRef, useState } from 'preact/hooks';
import { addEffect, current, frame, moveEffect, playhead, removeEffect, selection, setCurves, setProp, toggleEffect, toggleStopwatch, valueAt } from './state';
import { NumField } from '../ui/NumField';
import { hasKeyAt, isAnimated } from '../anim/interp';
import { fromHex, toHex, type ColorRGBA } from '../model/project';
import { parseCube, type Lut3D } from '../render/lut';
import { notice, setEffectData } from './state';
import { propOf, type Layer, type Vec2 } from '../model/layer';
import { EFFECTS, EFFECT_BY_TYPE, defaultCurves, curveLUT, paramKey, type Curves, type ParamDef } from '../render/effects';

export function EffectsPanel() {
  const p = current.value!;
  const t = (playhead.value, frame());
  const l = p.layers.find((x) => x.id === selection.value[0]);
  if (!l) return <p class="hint">Select a layer to add effects.</p>;
  const cats = ['Colour', 'Blur', 'Stylise', 'Distort', 'Generate'] as const;
  return (
    <div class="inspector">
      <h2>{l.name} · effects</h2>
      <label class="prop"><span class="pname">Add effect</span><span />
        <div class="fields one"><select aria-label="Add effect" value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) addEffect(l.id, v); (e.target as HTMLSelectElement).value = ''; }}>
          <option value="">Choose…</option>
          {cats.map((c) => <optgroup key={c} label={c}>{EFFECTS.filter((d) => d.category === c).map((d) => <option key={d.type} value={d.type}>{d.name}</option>)}</optgroup>)}
        </select></div></label>
      {(l.effects ?? []).length === 0 && <p class="hint">No effects yet. Effects run top to bottom; on an adjustment layer they affect everything below.</p>}
      {(l.effects ?? []).map((e, i, all) => {
        const def = EFFECT_BY_TYPE.get(e.type);
        if (!def) return null;
        return (
          <section class={`sec fx ${e.enabled ? '' : 'off'}`} key={e.id}>
            <div class="seg">
              <button class="btn sm" aria-pressed={e.enabled} aria-label={e.enabled ? 'Disable effect' : 'Enable effect'} onClick={() => toggleEffect(l.id, e.id)}>{e.enabled ? '●' : '○'}</button>
              <h3 class="fxname">{def.name}</h3>
              <button class="btn sm" disabled={i === 0} aria-label="Move effect up" onClick={() => moveEffect(l.id, e.id, -1)}>↑</button>
              <button class="btn sm" disabled={i === all.length - 1} aria-label="Move effect down" onClick={() => moveEffect(l.id, e.id, 1)}>↓</button>
              <button class="btn sm danger" aria-label="Remove effect" onClick={() => removeEffect(l.id, e.id)}>✕</button>
            </div>
            {def.params.map((pd) => <Param key={pd.key} layer={l} effectId={e.id} def={pd} t={t} />)}
            {def.type === 'lut3d' && <LutPicker layerId={l.id} effectId={e.id} lut={e.data as Lut3D | undefined} />}
            {def.type === 'curves' && <CurvesEditor layer={l} effectId={e.id} data={(e.data as Curves) ?? defaultCurves()} />}
          </section>
        );
      })}
    </div>
  );
}

function Param({ layer: l, effectId, def, t }: { layer: Layer; effectId: string; def: ParamDef; t: number }) {
  const k = paramKey(effectId, def.key), prop = propOf(l, k);
  if (!prop) return null;
  const v = valueAt(l, k, t) as unknown;
  const anim = isAnimated(prop);
  const watch = <button class={`watch ${anim ? 'on' : ''} ${hasKeyAt(prop, t) ? 'key' : ''}`} aria-pressed={anim} aria-label={`${anim ? 'Remove animation from' : 'Animate'} ${def.label}`} onClick={() => toggleStopwatch(l.id, k)}>◷</button>;
  if (def.kind === 'number') return <div class="prop"><span class="pname">{def.label}</span>{watch}<div class="fields"><NumField label="" value={v as number} step={def.step ?? 1} min={def.min} max={def.max} onChange={(x) => setProp(l.id, k, x)} /></div></div>;
  if (def.kind === 'select') return <label class="prop"><span class="pname">{def.label}</span><span /><div class="fields one"><select value={v as number} onChange={(e) => setProp(l.id, k, Number((e.target as HTMLSelectElement).value))}>{def.options!.map((o, i) => <option key={o} value={i}>{o}</option>)}</select></div></label>;
  if (def.kind === 'vec2') { const q = v as Vec2; return <div class="prop"><span class="pname">{def.label}</span>{watch}<div class="fields"><NumField label="X" value={q[0]} onChange={(x) => setProp(l.id, k, [x, q[1]])} /><NumField label="Y" value={q[1]} onChange={(y) => setProp(l.id, k, [q[0], y])} /></div></div>; }
  const c = v as ColorRGBA;
  return <div class="prop"><span class="pname">{def.label}</span>{watch}<div class="fields one"><input type="color" aria-label={def.label} value={toHex(c)} onInput={(e) => setProp(l.id, k, fromHex((e.target as HTMLInputElement).value, c[3]), `${k}:${l.id}`)} /></div></div>;
}

const CH = ['master', 'r', 'g', 'b'] as const;
const CH_COLOR = { master: 'var(--text)', r: '#ff6b6b', g: '#5fd68a', b: '#6b9bff' };

/** Curves: tap empty space to add a point, drag to move, double-tap a point to remove it. */
function CurvesEditor({ layer, effectId, data }: { layer: Layer; effectId: string; data: Curves }) {
  const [ch, setCh] = useState<(typeof CH)[number]>('master');
  const box = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const last = useRef({ t: 0, i: -1 });
  const pts = data[ch];
  const set = (np: Vec2[]) => setCurves(layer.id, effectId, { ...data, [ch]: np.sort((a, b) => a[0] - b[0]) });
  const at = (e: PointerEvent): Vec2 => { const r = box.current!.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))]; };
  const down = (e: PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const q = at(e); let hit = pts.findIndex((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.06);
    const now = performance.now();
    if (hit >= 0 && last.current.i === hit && now - last.current.t < 350 && hit > 0 && hit < pts.length - 1) { set(pts.filter((_, i) => i !== hit)); last.current = { t: 0, i: -1 }; return; }
    if (hit < 0) { set([...pts, q]); hit = [...pts, q].sort((a, b) => a[0] - b[0]).findIndex((p) => p === q); }
    last.current = { t: now, i: hit }; drag.current = hit;
  };
  const move = (e: PointerEvent) => {
    const i = drag.current; if (i === null) return;
    const q = at(e), prev = pts[i - 1], next = pts[i + 1];
    const x = i === 0 ? 0 : i === pts.length - 1 ? 1 : Math.min((next?.[0] ?? 1) - 0.01, Math.max((prev?.[0] ?? 0) + 0.01, q[0]));
    set(pts.map((p, k) => (k === i ? [x, q[1]] : p)));
  };
  const lut = curveLUT(pts, 64);
  return (
    <div class="curves">
      <div class="seg">{CH.map((c) => <button key={c} class="btn sm" aria-pressed={ch === c} onClick={() => setCh(c)}>{c === 'master' ? 'RGB' : c.toUpperCase()}</button>)}
        <button class="btn sm" onClick={() => setCurves(layer.id, effectId, { ...data, [ch]: [[0, 0], [1, 1]] })}>Reset</button></div>
      <svg ref={box} viewBox="0 0 1 1" class="curve-svg" role="img" aria-label="Curve editor" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <path d="M0 1L1 0" stroke="var(--line)" stroke-width="0.004" fill="none" />
        <polyline points={Array.from(lut, (y, i) => `${i / 63},${1 - y}`).join(' ')} fill="none" stroke={CH_COLOR[ch]} stroke-width="0.012" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={1 - p[1]} r="0.03" fill="var(--surface)" stroke={CH_COLOR[ch]} stroke-width="0.012" />)}
      </svg>
    </div>
  );
}

function LutPicker({ layerId, effectId, lut }: { layerId: string; effectId: string; lut?: Lut3D }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div class="seg wrap">
      <button class="btn sm" onClick={() => input.current?.click()}>Import .cube…</button>
      <span class="hint">{lut?.name ?? 'Identity'}{lut ? ` · ${lut.size}³` : ''}</span>
      <input ref={input} type="file" accept=".cube,text/plain" hidden onChange={async (e) => {
        const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
        try { setEffectData(layerId, effectId, parseCube(await f.text(), f.name.replace(/\.cube$/i, ''))); } catch (err) { notice.value = (err as Error).message; }
        (e.target as HTMLInputElement).value = '';
      }} />
    </div>
  );
}
