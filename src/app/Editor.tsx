import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import {
  notice, activeComp, compPath, exitComp, addMarker, canRedo, canUndo, closeProject, copySelectedKeys, current, deleteLayers, deleteSelectedKeys, duplicateLayers, flush, frame, jumpToKey,
  keySel, moveSelectedKeys, pasteKeyframes, playhead, redo, rename, saveState, selection, setSettings, setWorkArea, undo, undoLabel,
} from './state';
import { cancelPen, deleteSelectedNode, finishPen, nodeSel, penDraft, setTool, TOOLS, tool } from './tools';
import { pause, play, playing, seek, step, togglePlay } from './playback';
import { Viewer } from './Viewer';
import { Timeline } from './Timeline';
import { LayersPanel } from './LayersPanel';
import { Inspector } from './Inspector';
import { ExportDialog } from './ExportDialog';
import { EffectsPanel } from './EffectsPanel';
import { PresetsPanel } from './PresetsPanel';
import { AssetsPanel } from './AssetsPanel';
import { FPS_PRESETS, SIZE_PRESETS, fromHex, timecode, toHex } from '../model/project';

type Tab = 'inspector' | 'effects' | 'presets' | 'assets';
const panels = signal({ left: true, right: true, timeline: true });
const SAVE_LABEL = { saved: 'Saved', dirty: 'Unsaved…', saving: 'Saving…', error: 'Save failed' } as const;
const typing = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'color';

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') { if (typing(e.target) && (e.target as HTMLInputElement).type !== 'number') return; e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && k === 's') { e.preventDefault(); void flush(); return; }
      if (typing(e.target)) return;
      if (mod && k === 'd') { e.preventDefault(); duplicateLayers(selection.peek()); return; }
      if (mod && k === 'c' && keySel.peek().length) { e.preventDefault(); copySelectedKeys(); return; }
      if (mod && k === 'v') { e.preventDefault(); pasteKeyframes(); return; }
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const t = jumpToKey(e.key === 'ArrowRight' ? 1 : -1);
        if (t !== null) seek(t);
        return;
      }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && keySel.peek().length && e.shiftKey && mod) { e.preventDefault(); moveSelectedKeys(e.key === 'ArrowRight' ? 1 : -1); return; }
      if (e.key === 'Escape') { if (penDraft.peek()) cancelPen(); setTool('select'); return; }
      if (e.key === 'Enter' && penDraft.peek()) { e.preventDefault(); finishPen(false); return; }
      if (!mod && !e.altKey) { const tl = TOOLS.find((x) => x.key.toLowerCase() === k); if (tl) { e.preventDefault(); setTool(tl.id); return; } }
      if (k === 'm' && !mod) { e.preventDefault(); addMarker(); return; }
      if (k === 'i' && !mod) { e.preventDefault(); const p = current.peek()!; setWorkArea([frame(), p.workArea?.[1] ?? p.settings.duration]); return; }
      if (k === 'o' && !mod) { e.preventDefault(); const p = current.peek()!; setWorkArea([p.workArea?.[0] ?? 0, frame() + 1]); return; }
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(e.shiftKey ? -10 : -1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(e.shiftKey ? 10 : 1); }
      else if (e.key === 'Home') { e.preventDefault(); seek(0); }
      else if (e.key === 'End') { e.preventDefault(); seek(Infinity); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (nodeSel.peek() !== null && deleteSelectedNode()) return; if (keySel.peek().length) deleteSelectedKeys(); else deleteLayers(selection.peek()); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
}

export function Editor() {
  const p = current.value!;
  const s = p.settings;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('inspector');
  useShortcuts();
  useEffect(() => () => pause(), []);
  const toggle = (k: keyof typeof panels.value) => (panels.value = { ...panels.value, [k]: !panels.value[k] });

  return (
    <div class={`editor ${panels.value.left ? '' : 'no-left'} ${panels.value.right ? '' : 'no-right'} ${panels.value.timeline ? '' : 'no-timeline'}`}>
      <header class="topbar">
        {activeComp.value
          ? <button class="btn" onClick={exitComp} aria-label="Back to parent composition">‹ {compPath().length > 1 ? compPath()[compPath().length - 2] : 'Main'}</button>
          : <button class="btn" onClick={() => void closeProject()} aria-label="Back to library">‹ Library</button>}
        {activeComp.value && <strong class="crumb">{compPath()[compPath().length - 1]}</strong>}
        <input class="title" value={p.name} aria-label="Project name" onChange={(e) => rename((e.target as HTMLInputElement).value)} />
        <span class={`save ${saveState.value}`} role="status">{SAVE_LABEL[saveState.value]}</span>
        <span class="spacer" />
        <button class="btn" disabled={!canUndo()} onClick={undo} title={undoLabel()} aria-label="Undo">↶</button>
        <button class="btn" disabled={!canRedo()} onClick={redo} aria-label="Redo">↷</button>
        <button class="btn" aria-pressed={panels.value.left} onClick={() => toggle('left')}>Layers</button>
        <button class="btn" aria-pressed={panels.value.timeline} onClick={() => toggle('timeline')}>Timeline</button>
        <button class="btn" aria-pressed={panels.value.right} onClick={() => toggle('right')}>Panel</button>
        <button class="btn" onClick={() => setSettingsOpen(true)}>Settings</button>
        <button class="btn primary" onClick={() => setExportOpen(true)}>Export</button>
      </header>

      <aside class="panel left"><LayersPanel /></aside>

      <section class="viewer">
        <Viewer />
        <footer class="transport">
          <button class="btn" onClick={() => seek(0)} aria-label="Go to start">⏮</button>
          <button class="btn" onClick={() => step(-1)} aria-label="Previous frame">◀︎</button>
          <button class="btn primary" onClick={() => (playing.value ? pause() : play())} aria-label={playing.value ? 'Pause' : 'Play'}>{playing.value ? '❚❚' : '▶︎'}</button>
          <button class="btn" onClick={() => step(1)} aria-label="Next frame">▶︎▶︎</button>
          <span class="tc" aria-label="Current time">{timecode(Math.floor(playhead.value), s.fps)}</span>
          <span class="hint">/ {timecode(s.duration, s.fps)} · {s.width}×{s.height} · {s.fps} fps</span>
        </footer>
      </section>

      <aside class="panel right">
        <nav class="tabs" role="tablist">
          {(['inspector', 'effects', 'presets', 'assets'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        {tab === 'inspector' ? <Inspector /> : tab === 'effects' ? <EffectsPanel /> : tab === 'presets' ? <PresetsPanel /> : <AssetsPanel />}
      </aside>

      <section class="timeline"><Timeline /></section>

      {notice.value && <div class="toast" role="status"><span>{notice.value}</span><button class="btn sm" onClick={() => (notice.value = '')}>OK</button></div>}
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
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
