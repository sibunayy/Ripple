import { useRef } from 'preact/hooks';
import { editLayer, editMedia, activeComp, addMask, convertToPath, current, deleteMask, editMask, editShape, editText, editablePath, enterComp, frame, playhead, selMask, selection, setBlend, setClip, setLayerColor, setMatte, setPath, setProp, toggleStopwatch, togglePathAnim, valueAt } from './state';
import { nodeSel } from './tools';
import { NumField } from '../ui/NumField';
import { hasKeyAt, isAnimated } from '../anim/interp';
import { fromHex, toHex, type ColorRGBA } from '../model/project';
import { propOf, type Layer, type Paint, type PropKey, type StrokeStyle, type Vec2 } from '../model/layer';
import { layerBox } from '../shape/geometry';
import { toggleSmooth, isCorner } from '../shape/path';
import { BLEND_MODES, type BlendMode } from '../render/blend';
import { maskProp } from '../render/masks';
import type { MaskMode, MatteMode } from '../model/layer';
import { fonts, importFont } from '../text/fonts';
import { deleteSelectedNode } from './tools';

export function Inspector() {
  const p = current.value!;
  const t = (playhead.value, frame());
  const l = p.layers.find((x) => x.id === selection.value[0]);
  if (!l) return <p class="hint">Select a layer to edit its properties.</p>;

  const Watch = ({ k }: { k: PropKey }) => {
    const prop = propOf(l, k)!;
    const anim = isAnimated(prop);
    return (
      <button class={`watch ${anim ? 'on' : ''} ${hasKeyAt(prop, t) ? 'key' : ''}`} aria-pressed={anim}
        aria-label={`${anim ? 'Remove animation from' : 'Animate'} ${k}`} onClick={() => toggleStopwatch(l.id, k)}>◷</button>
    );
  };
  const has = (k: PropKey) => !!propOf(l, k);
  const vec = (k: PropKey, name: string, step = 1, min?: number) => {
    if (!has(k)) return null;
    const v = valueAt(l, k, t) as Vec2;
    return (
      <div class="prop"><span class="pname">{name}</span><Watch k={k} />
        <div class="fields">
          <NumField label="X" value={v[0]} step={step} min={min} onChange={(x) => setProp(l.id, k, [x, v[1]])} />
          <NumField label="Y" value={v[1]} step={step} min={min} onChange={(y) => setProp(l.id, k, [v[0], y])} />
        </div></div>
    );
  };
  const num = (k: PropKey, name: string, step = 1, min?: number, max?: number) => !has(k) ? null : (
    <div class="prop"><span class="pname">{name}</span><Watch k={k} />
      <div class="fields"><NumField label="" value={valueAt(l, k, t) as number} step={step} min={min} max={max} onChange={(v) => setProp(l.id, k, v)} /></div></div>
  );
  const colour = (k: PropKey, name: string) => {
    if (!has(k)) return null;
    const c = valueAt(l, k, t) as unknown as ColorRGBA;
    return (
      <div class="prop"><span class="pname">{name}</span><Watch k={k} />
        <div class="fields one"><input type="color" aria-label={name} value={toHex(c)} onInput={(e) => setProp(l.id, k, fromHex((e.target as HTMLInputElement).value, c[3]), `${k}:${l.id}`)} /></div></div>
    );
  };
  const sh = l.shape;
  const Section = ({ title, children }: { title: string; children: unknown }) => <section class="sec"><h3>{title}</h3>{children as never}</section>;

  return (
    <div class="inspector">
      <h2>{l.name}</h2>
      <Section title="Transform">
        {vec('position', 'Position')}
        {vec('scale', 'Scale')}
        {num('rotation', 'Rotation', 1)}
        {num('opacity', 'Opacity', 1, 0, 100)}
        {vec('anchor', 'Anchor')}
      </Section>
      <Section title="Layer">
        <label class="prop"><span class="pname">Blend</span><span />
          <div class="fields one"><select aria-label="Blend mode" value={l.blend ?? 'normal'} onChange={(e) => setBlend(l.id, (e.target as HTMLSelectElement).value as BlendMode)}>
            {BLEND_MODES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select></div></label>
        <label class="prop"><span class="pname">Track matte</span><span />
          <div class="fields">
            <select aria-label="Matte layer" value={l.matte?.layer ?? ''} onChange={(e) => setMatte(l.id, (e.target as HTMLSelectElement).value || null, l.matte?.mode)}>
              <option value="">None</option>
              {p.layers.filter((o) => o.id !== l.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select aria-label="Matte mode" disabled={!l.matte} value={l.matte?.mode ?? 'alpha'} onChange={(e) => setMatte(l.id, l.matte!.layer, (e.target as HTMLSelectElement).value as MatteMode)}>
              <option value="alpha">Alpha</option><option value="alphaInv">Alpha inverted</option><option value="luma">Luma</option><option value="lumaInv">Luma inverted</option>
            </select>
          </div></label>
        <label class="check"><input type="checkbox" checked={!!l.motionBlur} onChange={(e) => editLayer(l.id, 'Motion blur', (x) => ({ ...x, motionBlur: (e.target as HTMLInputElement).checked }))} /> Motion blur</label>
        <label class="check"><input type="checkbox" checked={!!l.clip} onChange={(e) => setClip(l.id, (e.target as HTMLInputElement).checked)} /> Clip to layer below</label>
        {l.type === 'precomp' && l.precomp && <button class="btn sm" onClick={() => enterComp(l.precomp!.comp)}>Open composition</button>}
      </Section>
      <Section title="Masks">
        {(l.masks ?? []).map((m) => (
          <div key={m.id} class={`mask ${selMask.value === m.id ? 'on' : ''}`}>
            <div class="seg">
              <button class="btn sm" aria-pressed={selMask.value === m.id} onClick={() => { selMask.value = selMask.value === m.id ? null : m.id; nodeSel.value = null; }}>{m.name}</button>
              <select aria-label="Mask mode" value={m.mode} onChange={(e) => editMask(l.id, m.id, { mode: (e.target as HTMLSelectElement).value as MaskMode })}>
                {(['add', 'subtract', 'intersect', 'lighten', 'darken', 'difference', 'none'] as const).map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <button class="btn sm" aria-pressed={m.invert} aria-label="Invert mask" onClick={() => editMask(l.id, m.id, { invert: !m.invert })}>⇄</button>
              <button class="btn sm danger" aria-label="Delete mask" onClick={() => deleteMask(l.id, m.id)}>✕</button>
            </div>
            {selMask.value === m.id && <>
              {num(maskProp(m.id, 'opacity'), 'Opacity', 1, 0, 100)}{num(maskProp(m.id, 'feather'), 'Feather', 1, 0)}{num(maskProp(m.id, 'expansion'), 'Expansion', 1)}
              <div class="seg wrap"><button class="btn sm" aria-pressed={!!m.path.keys?.length} onClick={() => togglePathAnim(l.id)}>◷ Animate shape</button></div>
              <PathTools layer={l} />
            </>}
          </div>
        ))}
        <div class="seg"><button class="btn sm" onClick={() => addMask(l.id, 'rect')}>＋ Rectangle</button><button class="btn sm" onClick={() => addMask(l.id, 'ellipse')}>＋ Ellipse</button></div>
      </Section>
      {l.media && (
        <Section title={l.type === 'video' ? 'Video' : 'Image'}>
          <span class="hint">{p.assets[l.media.asset]?.name ?? 'Missing asset'}</span>
          {l.type === 'video' && <>
            <div class="prop"><span class="pname">Source start (s)</span><span /><div class="fields"><NumField label="" value={l.media.start} step={0.1} min={0} onChange={(v) => editMedia(l.id, { start: v })} /></div></div>
            <div class="prop"><span class="pname">Speed %</span><span /><div class="fields"><NumField label="" value={l.media.speed * 100} step={5} min={6.25} max={1600} onChange={(v) => editMedia(l.id, { speed: v / 100 })} /></div></div>
            <p class="hint">Audio is not part of v1: video plays muted and exports without sound.</p>
          </>}
        </Section>
      )}
      {l.type === 'solid' && (
        <label class="prop color">
          <span class="pname">Colour</span>
          <input type="color" value={toHex(l.color)} onInput={(e) => setLayerColor(l.id, fromHex((e.target as HTMLInputElement).value, l.color[3]))} />
        </label>
      )}
      {l.type === 'shape' && sh && (
        <Section title={`Shape · ${sh.kind}`}>
          {vec('shape.size', 'Size', 1, 1)}
          {num('shape.round', 'Roundness', 1, 0)}
          {num('shape.points', 'Points', 1, 3, 40)}
          {num('shape.outer', 'Outer radius', 1, 1)}
          {num('shape.inner', 'Inner radius', 1, 1)}
          {sh.kind !== 'path' && <button class="btn sm" onClick={() => convertToPath(l.id)}>Convert to editable path</button>}
          {sh.kind === 'path' && sh.path && !selMask.value && <><div class="seg wrap"><button class="btn sm" aria-pressed={!!sh.path.keys?.length} onClick={() => togglePathAnim(l.id)}>◷ Animate path</button></div><PathTools layer={l} /></>}
        </Section>
      )}
      {sh && (
        <>
          <Section title="Fill">
            <label class="check"><input type="checkbox" checked={!!sh.fill} onChange={(e) => editShape(l.id, (s) => ({ ...s, fill: (e.target as HTMLInputElement).checked ? { kind: 'solid', stops: [{ at: 0, c: [1, 1, 1, 1] }, { at: 1, c: [0, 0, 0, 1] }], from: [-100, 0], to: [100, 0] } : null }))} /> Enabled</label>
            {sh.fill && <>
              <PaintEditor layer={l} paint={sh.fill} onChange={(f) => editShape(l.id, (s) => ({ ...s, fill: f }))} />
              {sh.fill.kind === 'solid' && colour('fill.color', 'Colour')}
              {num('fill.opacity', 'Opacity', 1, 0, 100)}
            </>}
          </Section>
          <Section title="Stroke">
            <label class="check"><input type="checkbox" checked={!!sh.stroke} onChange={(e) => editShape(l.id, (s) => ({ ...s, stroke: (e.target as HTMLInputElement).checked ? { cap: 'round', join: 'round', dash: 0, gap: 0, paint: { kind: 'solid', stops: [{ at: 0, c: [1, 1, 1, 1] }, { at: 1, c: [0, 0, 0, 1] }], from: [-100, 0], to: [100, 0] } } : null }))} /> Enabled</label>
            {sh.stroke && <StrokeEditor layer={l} stroke={sh.stroke} colour={colour} num={num} />}
          </Section>
          {l.type === 'shape' && (
            <>
              <Section title="Trim paths">
                <label class="check"><input type="checkbox" checked={sh.trim} onChange={(e) => editShape(l.id, (s) => ({ ...s, trim: (e.target as HTMLInputElement).checked }))} /> Enabled</label>
                {sh.trim && <>{num('trim.start', 'Start %', 1, 0, 100)}{num('trim.end', 'End %', 1, 0, 100)}{num('trim.offset', 'Offset °', 1)}</>}
              </Section>
              <Section title="Repeater">
                <label class="check"><input type="checkbox" checked={sh.repeater} onChange={(e) => editShape(l.id, (s) => ({ ...s, repeater: (e.target as HTMLInputElement).checked }))} /> Enabled</label>
                {sh.repeater && <>
                  {num('rep.copies', 'Copies', 1, 1, 200)}{vec('rep.position', 'Offset')}{num('rep.rotation', 'Rotation', 1)}{vec('rep.scale', 'Scale', 1)}
                  {num('rep.opacityStart', 'Start opacity', 1, 0, 100)}{num('rep.opacityEnd', 'End opacity', 1, 0, 100)}
                </>}
              </Section>
            </>
          )}
        </>
      )}
      {l.type === 'text' && l.text && (
        <Section title="Text">
          <textarea class="textin" aria-label="Text content" rows={3} value={l.text.text} onInput={(e) => editText(l.id, { text: (e.target as HTMLTextAreaElement).value }, 'text')} />
          <FontPicker layer={l} />
          {num('text.size', 'Size', 1, 1, 2000)}
          {num('text.tracking', 'Tracking', 1)}
          {num('text.leading', 'Line height %', 1, 20, 400)}
          <div class="seg" role="group" aria-label="Alignment">
            {(['left', 'center', 'right'] as const).map((a) => <button key={a} class="btn sm" aria-pressed={l.text!.align === a} onClick={() => editText(l.id, { align: a })}>{a}</button>)}
          </div>
          <div class="seg">
            <button class="btn sm" aria-pressed={l.text.bold} onClick={() => editText(l.id, { bold: !l.text!.bold })}><b>B</b></button>
            <button class="btn sm" aria-pressed={l.text.italic} onClick={() => editText(l.id, { italic: !l.text!.italic })}><i>I</i></button>
          </div>
        </Section>
      )}
    </div>
  );
}

function PathTools({ layer: l }: { layer: Layer }) {
  const e = editablePath(l, frame());
  if (!e) return null;
  const path = e.path;
  const n = nodeSel.value;
  const node = n !== null ? path.nodes[n] : undefined;
  return (
    <div class="seg wrap">
      <button class="btn sm" disabled={!node} onClick={() => n !== null && setPath(l.id, toggleSmooth(path, n), 'node-smooth')}>{node && !isCorner(node) ? 'Make corner' : 'Make smooth'}</button>
      <button class="btn sm" disabled={!node || path.nodes.length <= 2} onClick={() => deleteSelectedNode()}>Delete node</button>
      <button class="btn sm" aria-pressed={path.closed} onClick={() => setPath(l.id, { ...path, closed: !path.closed }, 'node-close')}>{path.closed ? 'Open path' : 'Close path'}</button>
      {!node && <p class="hint">Tap a node to edit it; double-tap the path to add one.</p>}
    </div>
  );
}

function PaintEditor({ layer: l, paint, onChange }: { layer: Layer; paint: Paint; onChange: (p: Paint) => void }) {
  const box = layerBox(l, frame());
  const kinds: Paint['kind'][] = ['solid', 'linear', 'radial'];
  const setKind = (kind: Paint['kind']) => {
    const cy = (box[1] + box[3]) / 2, cx = (box[0] + box[2]) / 2;
    onChange(kind === 'linear' ? { ...paint, kind, from: [box[0], cy], to: [box[2], cy] }
      : kind === 'radial' ? { ...paint, kind, from: [cx, cy], to: [box[2], cy] } : { ...paint, kind });
  };
  return (
    <>
      <div class="seg" role="group" aria-label="Paint type">
        {kinds.map((k) => <button key={k} class="btn sm" aria-pressed={paint.kind === k} onClick={() => setKind(k)}>{k}</button>)}
      </div>
      {paint.kind !== 'solid' && (
        <>
          {paint.stops.map((s, i) => (
            <div class="stop" key={i}>
              <input type="color" aria-label={`Stop ${i + 1} colour`} value={toHex(s.c)} onInput={(e) => onChange({ ...paint, stops: paint.stops.map((q, k) => (k === i ? { ...q, c: fromHex((e.target as HTMLInputElement).value, q.c[3]) } : q)) })} />
              <NumField label="" value={s.at * 100} step={1} min={0} max={100} onChange={(v) => onChange({ ...paint, stops: paint.stops.map((q, k) => (k === i ? { ...q, at: v / 100 } : q)).sort((a, b) => a.at - b.at) })} />
              <button class="btn sm" disabled={paint.stops.length <= 2} aria-label="Remove stop" onClick={() => onChange({ ...paint, stops: paint.stops.filter((_, k) => k !== i) })}>✕</button>
            </div>
          ))}
          <button class="btn sm" onClick={() => onChange({ ...paint, stops: [...paint.stops, { at: 0.5, c: [0.5, 0.5, 0.5, 1] as ColorRGBA }].sort((a, b) => a.at - b.at) })}>＋ Stop</button>
          <div class="prop"><span class="pname">{paint.kind === 'radial' ? 'Centre' : 'Start'}</span><span />
            <div class="fields"><NumField label="X" value={paint.from[0]} onChange={(x) => onChange({ ...paint, from: [x, paint.from[1]] })} /><NumField label="Y" value={paint.from[1]} onChange={(y) => onChange({ ...paint, from: [paint.from[0], y] })} /></div></div>
          <div class="prop"><span class="pname">{paint.kind === 'radial' ? 'Radius point' : 'End'}</span><span />
            <div class="fields"><NumField label="X" value={paint.to[0]} onChange={(x) => onChange({ ...paint, to: [x, paint.to[1]] })} /><NumField label="Y" value={paint.to[1]} onChange={(y) => onChange({ ...paint, to: [paint.to[0], y] })} /></div></div>
        </>
      )}
    </>
  );
}

function StrokeEditor({ layer: l, stroke, colour, num }: { layer: Layer; stroke: StrokeStyle; colour: (k: PropKey, n: string) => unknown; num: (k: PropKey, n: string, s?: number, min?: number, max?: number) => unknown }) {
  const set = (patch: Partial<StrokeStyle>) => editShape(l.id, (s) => (s.stroke ? { ...s, stroke: { ...s.stroke, ...patch } } : s));
  return (
    <>
      <PaintEditor layer={l} paint={stroke.paint} onChange={(paint) => set({ paint })} />
      {stroke.paint.kind === 'solid' && (colour('stroke.color', 'Colour') as never)}
      {num('stroke.width', 'Width', 1, 0) as never}
      {num('stroke.opacity', 'Opacity', 1, 0, 100) as never}
      <div class="seg" role="group" aria-label="Line cap">{(['butt', 'round', 'square'] as const).map((c) => <button key={c} class="btn sm" aria-pressed={stroke.cap === c} onClick={() => set({ cap: c })}>{c}</button>)}</div>
      <div class="seg" role="group" aria-label="Line join">{(['miter', 'round', 'bevel'] as const).map((c) => <button key={c} class="btn sm" aria-pressed={stroke.join === c} onClick={() => set({ join: c })}>{c}</button>)}</div>
      <div class="prop"><span class="pname">Dash / gap</span><span />
        <div class="fields"><NumField label="D" value={stroke.dash} min={0} onChange={(dash) => set({ dash })} /><NumField label="G" value={stroke.gap} min={0} onChange={(gap) => set({ gap })} /></div></div>
    </>
  );
}

function FontPicker({ layer: l }: { layer: Layer }) {
  const input = useRef<HTMLInputElement>(null);
  const list = fonts.value;
  const cur = l.text!.font;
  return (
    <div class="prop"><span class="pname">Font</span><span />
      <div class="fields one">
        <select aria-label="Font family" value={cur} onChange={(e) => editText(l.id, { font: (e.target as HTMLSelectElement).value })}>
          {!list.some((f) => f.css === cur) && <option value={cur}>{cur}</option>}
          {list.map((f) => <option key={f.family} value={f.css}>{f.family}{f.kind === 'imported' ? ' ★' : ''}</option>)}
        </select>
        <button class="btn sm" onClick={() => input.current?.click()}>Import font…</button>
        <input ref={input} type="file" accept=".ttf,.otf,.woff,.woff2,font/*" hidden onChange={async (e) => {
          const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
          editText(l.id, { font: await importFont(f) }); (e.target as HTMLInputElement).value = '';
        }} />
      </div>
    </div>
  );
}
