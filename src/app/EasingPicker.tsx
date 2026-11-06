import { EASINGS, sampleEase } from '../anim/easings';
import { isAnimated } from '../anim/interp';
import { sameKey } from '../anim/keys';
import { current, keySel, setEaseOnSelected } from './state';
import { propOf, type Ease, type Prop } from '../model/layer';

const same = (a: Ease, b: Ease) => JSON.stringify(a) === JSON.stringify(b);

/** Path for a 44×30 preview of an ease (handles over/undershoot down to −0.6 and up to 1.6). */
export function easePath(e: Ease): string {
  if (e === 'hold') return 'M2 26H42V4';
  const pts: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const u = i / 80, v = sampleEase(e, u);
    pts.push(`${i ? 'L' : 'M'}${(2 + u * 40).toFixed(1)} ${(28 - ((v + 0.6) / 2.2) * 26).toFixed(1)}`);
  }
  return pts.join('');
}

/** Ease of the first selected key (used to highlight / seed the numeric fields). */
function firstEase(): Ease | null {
  const p = current.value!, r = keySel.value[0];
  if (!r) return null;
  const lay = p.layers.find((l) => l.id === r.layer);
  const prop = lay && (propOf(lay, r.prop) as Prop<unknown> | undefined);
  return prop && isAnimated(prop) ? prop.keys.find((k) => sameKey({ ...r, t: k.t }, r))?.ease ?? null : null;
}

export function EasingPicker({ onClose }: { onClose: () => void }) {
  const cur = firstEase();
  const n = keySel.value.length;
  const bez = Array.isArray(cur) ? cur : null;
  const groups = [...new Set(EASINGS.map((e) => e.group))];
  const setNum = (i: number, v: number) => {
    if (!bez || !Number.isFinite(v)) return;
    const next = bez.slice() as [number, number, number, number];
    next[i] = Math.round((i % 2 === 0 ? Math.min(1, Math.max(0, v)) : v) * 1000) / 1000;
    setEaseOnSelected(next);
  };
  return (
    <div class="scrim light" onClick={onClose}>
      <div class="dialog easing" role="dialog" aria-label="Easing" onClick={(e) => e.stopPropagation()}>
        <div class="panel-head"><h2>Easing · {n} key{n === 1 ? '' : 's'}</h2><span class="spacer" /><button class="btn sm primary" onClick={onClose}>Done</button></div>
        <p class="hint">Applies to the segment after each selected keyframe.</p>
        {bez && (
          <div class="bez">
            {['x1', 'y1', 'x2', 'y2'].map((l, i) => (
              <label key={l}>{l}<input type="number" step="0.01" value={bez[i]} onChange={(e) => setNum(i, (e.target as HTMLInputElement).valueAsNumber)} /></label>
            ))}
          </div>
        )}
        <div class="ease-grid">
          {groups.map((g) => EASINGS.filter((e) => e.group === g).map((e) => (
            <button key={e.name} class={`ease ${cur && same(cur, e.ease) ? 'on' : ''}`} onClick={() => setEaseOnSelected(e.ease)} aria-label={e.name}>
              <svg viewBox="0 0 44 30" width="44" height="30"><path d={easePath(e.ease)} fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
              <span>{e.name}</span>
            </button>
          )))}
        </div>
      </div>
    </div>
  );
}
