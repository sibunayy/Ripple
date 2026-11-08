import { useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { applyPresetToSelection, current, selection } from './state';
import { BUILTIN_PRESETS, presetFromLayer, type Preset } from '../anim/presets';
import { deletePresetRecord, loadPresetRecords, savePresetRecord } from '../io/store';
import { newId } from '../model/project';
import { Icon } from '../ui/Icon';

const userPresets = signal<Preset[]>([]);
const load = async () => {
  try { userPresets.value = (await loadPresetRecords()).map((j) => JSON.parse(j) as Preset); } catch { /* storage unavailable */ }
};
const cats = ['In', 'Out', 'Emphasis', 'Loop', 'Shape', 'Custom'] as const;

export function PresetsPanel() {
  useEffect(() => { void load(); }, []);
  const [name, setName] = useState('My preset');
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const p = current.value!;
  const l = p.layers.find((x) => x.id === selection.value[0]);
  const all = [...BUILTIN_PRESETS, ...userPresets.value];

  const save = async () => {
    if (!l) return;
    const pr = presetFromLayer(l, name.trim() || 'Preset', p.settings.fps, newId());
    if (!pr) { setMsg('Animate something on the selected layer first.'); return; }
    await savePresetRecord(pr.id, JSON.stringify(pr)); await load(); setMsg(`Saved “${pr.name}”.`);
  };
  const exportOne = (pr: Preset) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(pr, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${pr.name}.ripple-preset`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const importFile = async (f: File) => {
    try {
      const pr = JSON.parse(await f.text()) as Preset;
      if (!Array.isArray(pr.targets) || typeof pr.duration !== 'number') throw new Error('not a preset');
      const rec = { ...pr, id: newId(), category: 'Custom' as const };
      await savePresetRecord(rec.id, JSON.stringify(rec)); await load(); setMsg(`Imported “${rec.name}”.`);
    } catch { setMsg('That file is not a RippleFlow preset.'); }
  };

  return (
    <div class="inspector">
      <h2>Presets</h2>
      {!l && <p class="hint">Select a layer, then tap a preset. In presets start at the playhead; Out presets end at the layer's out point.</p>}
      {cats.map((c) => {
        const items = all.filter((x) => x.category === c);
        if (!items.length) return null;
        return (
          <section class="sec" key={c}>
            <h3>{c}</h3>
            <div class="chips">{items.map((pr) => (
              <span class="chipbtn" key={pr.id}>
                <button class="btn sm" disabled={!l} onClick={() => applyPresetToSelection(pr)} title={`${pr.duration.toFixed(1)} s`}>{pr.name}</button>
                {pr.category === 'Custom' && <>
                  <button class="btn sm" aria-label={`Export ${pr.name}`} onClick={() => exportOne(pr)}><Icon name="share" /></button>
                  <button class="btn sm danger" aria-label={`Delete ${pr.name}`} onClick={() => void deletePresetRecord(pr.id).then(load)}><Icon name="trash-2" /></button>
                </>}
              </span>
            ))}</div>
          </section>
        );
      })}
      <section class="sec">
        <h3>Save current animation</h3>
        <input aria-label="Preset name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <div class="seg"><button class="btn sm" disabled={!l} onClick={() => void save()}>Save as preset</button><button class="btn sm" onClick={() => file.current?.click()}>Import…</button></div>
        <input ref={file} type="file" accept=".ripple-preset,application/json" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void importFile(f); (e.target as HTMLInputElement).value = ''; }} />
        {msg && <p class="hint" role="status">{msg}</p>}
      </section>
    </div>
  );
}
