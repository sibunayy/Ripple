import { useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { closeProject, current, flush, rename, saveState, setSettings } from './state';
import { FPS_PRESETS, SIZE_PRESETS, fromHex, timecode, toHex } from '../model/project';

type Tab = 'layers' | 'inspector' | 'effects' | 'presets';
const panels = signal({ left: true, right: true, timeline: true });
const SAVE_LABEL = { saved: 'Saved', dirty: 'Unsaved…', saving: 'Saving…', error: 'Save failed' } as const;

export function Editor() {
  const p = current.value!;
  const s = p.settings;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('inspector');
  const toggle = (k: keyof typeof panels.value) => (panels.value = { ...panels.value, [k]: !panels.value[k] });

  return (
    <div class={`editor ${panels.value.left ? '' : 'no-left'} ${panels.value.right ? '' : 'no-right'} ${panels.value.timeline ? '' : 'no-timeline'}`}>
      <header class="topbar">
        <button class="btn" onClick={() => void closeProject()} aria-label="Back to library">‹ Library</button>
        <input class="title" value={p.name} aria-label="Project name"
          onChange={(e) => rename((e.target as HTMLInputElement).value)} />
        <span class={`save ${saveState.value}`} role="status">{SAVE_LABEL[saveState.value]}</span>
        <span class="spacer" />
        <button class="btn" aria-pressed={panels.value.left} onClick={() => toggle('left')}>Layers</button>
        <button class="btn" aria-pressed={panels.value.timeline} onClick={() => toggle('timeline')}>Timeline</button>
        <button class="btn" aria-pressed={panels.value.right} onClick={() => toggle('right')}>Panel</button>
        <button class="btn" onClick={() => setSettingsOpen(true)}>Project settings</button>
        <button class="btn" onClick={() => void flush()}>Save</button>
      </header>

      <aside class="panel left"><h2>Layers</h2><p class="hint">Layers arrive in M1.</p></aside>

      <section class="viewer">
        <div class="stage" style={{ aspectRatio: `${s.width} / ${s.height}`, background: toHex(s.bg) }}
          role="img" aria-label={`Composition ${s.width} by ${s.height}`} />
        <footer class="transport">
          <span class="tc">{timecode(0, s.fps)}</span>
          <span class="hint">/ {timecode(s.duration, s.fps)} · {s.width}×{s.height} · {s.fps} fps</span>
        </footer>
      </section>

      <aside class="panel right">
        <nav class="tabs" role="tablist">
          {(['inspector', 'effects', 'presets'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        <p class="hint">The {tab} panel arrives in a later milestone.</p>
      </aside>

      <section class="timeline"><h2>Timeline</h2><p class="hint">Keyframes arrive in M2.</p></section>

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = current.value!.settings;
  const num = (k: 'width' | 'height' | 'fps' | 'duration') => (e: Event) =>
    setSettings({ [k]: Number((e.target as HTMLInputElement).value) });
  return (
    <div class="scrim" onClick={onClose}>
      <div class="dialog" role="dialog" aria-modal="true" aria-label="Project settings" onClick={(e) => e.stopPropagation()}>
        <h2>Project settings</h2>
        <label>Size preset
          <select onChange={(e) => {
            const pr = SIZE_PRESETS[Number((e.target as HTMLSelectElement).value)];
            if (pr) setSettings({ width: pr.width, height: pr.height });
          }}>
            <option value="">Custom</option>
            {SIZE_PRESETS.map((pr, i) => <option key={pr.name} value={i}>{pr.name} ({pr.width}×{pr.height})</option>)}
          </select>
        </label>
        <div class="two">
          <label>Width<input type="number" inputMode="numeric" value={s.width} onChange={num('width')} /></label>
          <label>Height<input type="number" inputMode="numeric" value={s.height} onChange={num('height')} /></label>
        </div>
        <div class="two">
          <label>Frame rate
            <input type="number" inputMode="decimal" list="fps" value={s.fps} onChange={num('fps')} />
            <datalist id="fps">{FPS_PRESETS.map((f) => <option key={f} value={f} />)}</datalist>
          </label>
          <label>Duration (frames)<input type="number" inputMode="numeric" value={s.duration} onChange={num('duration')} /></label>
        </div>
        <label>Background colour
          <input type="color" value={toHex(s.bg)} onInput={(e) => setSettings({ bg: fromHex((e.target as HTMLInputElement).value, s.bg[3]) })} />
        </label>
        <label class="check"><input type="checkbox" checked={s.linearLight} onChange={(e) => setSettings({ linearLight: (e.target as HTMLInputElement).checked })} /> Composite in linear light</label>
        <div class="row"><button class="btn primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
