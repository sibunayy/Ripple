// Left preset browser from concept 1 v3: search, category chips and a scrollable tile grid.
import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { applyPresetToSelection, current, notice, selection } from './state';
import { BUILTIN_PRESETS, type Preset } from '../anim/presets';
import { loadPresetRecords } from '../io/store';
import { Icon, type IconName } from '../ui/Icon';
import { drawerOpen } from './uistate';

const userPresets = signal<Preset[]>([]);
const loadUserPresets = async () => {
  try { userPresets.value = (await loadPresetRecords()).map((j) => JSON.parse(j) as Preset); } catch { /* storage unavailable */ }
};

const CATS = ['All', 'In', 'Out', 'Loop', 'Emphasis', 'Shape', 'Custom'] as const;
const ICON: Record<string, IconName> = {
  In: 'chevron-right', Out: 'chevron-left', Loop: 'redo-2', Emphasis: 'sparkles', Shape: 'square', Style: 'sun', Custom: 'star',
};

export function PresetsDrawer({ onManage }: { onManage: () => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  useEffect(() => { void loadUserPresets(); }, []);
  const all = [...BUILTIN_PRESETS, ...userPresets.value];
  const items = all.filter((pr) => (cat === 'All' || pr.category === cat) && pr.name.toLowerCase().includes(q.trim().toLowerCase()));
  const hasLayer = !!current.value?.layers.some((l) => selection.value.includes(l.id));

  const apply = (pr: Preset) => {
    if (!hasLayer) { notice.value = 'Select a layer, then tap a preset.'; return; }
    applyPresetToSelection(pr);
  };

  return (
    <aside class="drawer" aria-label="Presets">
      <header class="drawer-head">
        <strong>Presets</strong>
        <button class="icon-btn" aria-label="Collapse presets drawer" title="Collapse" onClick={() => (drawerOpen.value = false)}>
          <Icon name="chevron-left" size={18} />
        </button>
      </header>
      <label class="search">
        <Icon name="search" size={15} />
        <input aria-label="Search presets" placeholder="Search presets…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </label>
      <div class="chips drawer-chips" role="group" aria-label="Preset category">
        {CATS.map((c) => (
          <button key={c} class={`btn sm chip-tab ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div class="preset-grid">
        {items.map((pr) => (
          <button key={pr.id} class="preset-tile" disabled={!hasLayer} title={`${pr.name} · ${pr.duration.toFixed(1)} s`} onClick={() => apply(pr)}>
            <Icon name={ICON[pr.category] ?? 'sparkles'} size={22} />
            <span>{pr.name}</span>
          </button>
        ))}
        {!items.length && <p class="hint">No presets match.</p>}
      </div>
      <footer class="drawer-foot">
        <p class="hint">Tap a preset to animate the selected layer at the playhead.</p>
        <button class="btn sm" onClick={onManage}>Manage presets…</button>
      </footer>
    </aside>
  );
}
