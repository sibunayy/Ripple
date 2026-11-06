import { current, frame, playhead, selection, setLayerColor, setTransform, toggleStopwatch, valueAt } from './state';
import { NumField } from '../ui/NumField';
import { hasKeyAt, isAnimated } from '../anim/interp';
import { fromHex, toHex } from '../model/project';
import type { Prop, TransformKey, Vec2 } from '../model/layer';

export function Inspector() {
  const p = current.value!;
  const t = (playhead.value, frame());
  const l = p.layers.find((x) => x.id === selection.value[0]);
  if (!l) return <p class="hint">Select a layer to edit its properties.</p>;

  const Watch = ({ k }: { k: TransformKey }) => {
    const prop: Prop<unknown> = l.transform[k];
    const anim = isAnimated(prop);
    return (
      <button class={`watch ${anim ? 'on' : ''} ${hasKeyAt(prop, t) ? 'key' : ''}`} aria-pressed={anim}
        aria-label={`${anim ? 'Remove animation from' : 'Animate'} ${k}`} onClick={() => toggleStopwatch(l.id, k)}>◷</button>
    );
  };
  const vec = (k: TransformKey, name: string, step = 1, min?: number) => {
    const v = valueAt(l, k, t) as Vec2;
    return (
      <div class="prop"><span class="pname">{name}</span><Watch k={k} />
        <div class="fields">
          <NumField label="X" value={v[0]} step={step} min={min} onChange={(x) => setTransform(l.id, k, [x, v[1]])} />
          <NumField label="Y" value={v[1]} step={step} min={min} onChange={(y) => setTransform(l.id, k, [v[0], y])} />
        </div></div>
    );
  };
  const num = (k: TransformKey, name: string, step = 1, min?: number, max?: number) => (
    <div class="prop"><span class="pname">{name}</span><Watch k={k} />
      <div class="fields"><NumField label="" value={valueAt(l, k, t) as number} step={step} min={min} max={max} onChange={(v) => setTransform(l.id, k, v)} /></div></div>
  );

  return (
    <div class="inspector">
      <h2>{l.name}</h2>
      {vec('position', 'Position')}
      {vec('scale', 'Scale')}
      {num('rotation', 'Rotation', 1)}
      {num('opacity', 'Opacity', 1, 0, 100)}
      {vec('anchor', 'Anchor')}
      {l.type === 'solid' && (
        <label class="prop color">
          <span class="pname">Colour</span>
          <input type="color" value={toHex(l.color)} onInput={(e) => setLayerColor(l.id, fromHex((e.target as HTMLInputElement).value, l.color[3]))} />
        </label>
      )}
    </div>
  );
}
