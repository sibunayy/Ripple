import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import {
  autoKey, restoreVersion, notice, activeComp, compPath, exitComp, addMarker, canRedo, canUndo, closeProject, copySelectedKeys, current, deleteLayers, deleteSelectedKeys, duplicateLayers, flush, frame, jumpToKey,
  keySel, moveSelectedKeys, pasteKeyframes, playhead, redo, rename, saveState, selection, setSettings, setWorkArea, undo, undoLabel,
} from './state';
import { activeJobs } from '../export/queue';
import { listSnapshots } from '../io/store';
import { cancelPen, deleteSelectedNode, finishPen, nodeSel, penDraft, setTool, TOOLS, tool } from './tools';
import { pause, play, playing, seek, step, togglePlay } from './playback';
import { Viewer, mbPreview, previewQuality, setPreviewQuality, type Quality } from './Viewer';
import { Timeline } from './Timeline';
import { Inspector } from './Inspector';
import { ExportDialog } from './ExportDialog';
import { EffectsPanel } from './EffectsPanel';
import { PresetsPanel } from './PresetsPanel';
import { AssetsPanel } from './AssetsPanel';
import { HelpDialog } from './HelpDialog';
import { EasingPicker } from './EasingPicker';
import { ToolRail } from './ToolRail';
import { PresetsDrawer } from './PresetsDrawer';
import { drawerOpen, easingOpen, theme, cycleTheme, themeLabel } from './uistate';
import { useDialog } from '../ui/dialog';
import { FPS_PRESETS, SIZE_PRESETS, fromHex, timecode, toHex } from '../model/project';
import { Icon } from '../ui/Icon';
import { ContextMenuHost } from '../ui/ContextMenu';
import { installGestures } from './gestures';

type Tab = 'inspector' | 'effects' | 'presets' | 'assets';
const panels = signal({ right: typeof window === 'undefined' ? true : window.innerWidth > 980, timeline: true });
const SAVE_LABEL = { saved: 'Saved', dirty: 'Unsaved…', saving: 'Saving…', error: 'Save failed' } as const;
const TYPE_LABEL: Record<string, string> = {
  shape: 'Shape layer', text: 'Text layer', solid: 'Solid layer', precomp: 'Composition', adjustment: 'Adjustment layer',
  shader: 'Shader layer', image: 'Image layer', video: 'Video layer', null: 'Null layer',
};
const typing = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'color';

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') { if (typing(e.target) && (e.target as HTMLInputElement).type !== 'number') return; e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && k === 's') { e.preventDefault(); void flush(); return; }
      if (typing(e.target)) return;
      if (mod && k === 'a') { e.preventDefault(); selection.value = current.peek()!.layers.filter((l) => !l.locked).map((l) => l.id); return; }
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
      if (k === 'k' && !mod && !e.altKey) { e.preventDefault(); autoKey.value = !autoKey.value; return; }
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
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === '?' && !typing(e.target)) { e.preventDefault(); setHelpOpen(true); } }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const [tab, setTab] = useState<Tab>('inspector');
  useShortcuts();
  useEffect(() => installGestures(), []);
  useEffect(() => () => pause(), []);
  const toggle = (k: keyof typeof panels.value) => (panels.value = { ...panels.value, [k]: !panels.value[k] });
  const selLayer = p.layers.find((l) => l.id === selection.value[0]);
  const chip = selLayer && (selLayer.type === 'solid' || selLayer.type === 'shape' || selLayer.type === 'text' || selLayer.type === 'precomp')
    ? `rgb(${selLayer.color.slice(0, 3).map((c) => Math.round(c * 255)).join()})` : 'var(--accent)';

  return (
    <div data-testid="editor" class={`editor ${panels.value.right ? '' : 'no-right'} ${panels.value.timeline ? '' : 'no-timeline'} ${drawerOpen.value ? '' : 'no-drawer'}`}>
      <header class="topbar" data-testid="topbar">
        {activeComp.value
          ? <button class="btn ghost" onClick={exitComp} aria-label="Back to parent composition"><Icon name="chevron-left" size={16} /> {compPath().length > 1 ? compPath()[compPath().length - 2] : 'Main'}</button>
          : <button class="btn ghost" onClick={() => void closeProject()} aria-label="Back to library"><Icon name="chevron-left" size={16} /> Library</button>}
        {activeComp.value && <strong class="crumb">{compPath()[compPath().length - 1]}</strong>}
        <input class="title" value={p.name} aria-label="Project name" onChange={(e) => rename((e.target as HTMLInputElement).value)} />
        <span class={`save ${saveState.value}`} role="status">{SAVE_LABEL[saveState.value]}</span>
        <span class="spacer" />
        <button class={`btn icon ${canUndo() ? 'accent' : ''}`} disabled={!canUndo()} onClick={undo} title={undoLabel()} aria-label="Undo"><Icon name="undo-2" size={17} /></button>
        <button class="btn icon" disabled={!canRedo()} onClick={redo} title="Redo" aria-label="Redo"><Icon name="redo-2" size={17} /></button>
        <button class="icon-btn" aria-label={`Appearance: ${themeLabel()}`} title={`Appearance: ${themeLabel()}`} onClick={cycleTheme}><Icon name={theme.value === 'light' ? 'sun' : theme.value === 'dark' ? 'moon' : 'sun'} size={18} /></button>
        <button class="btn ghost" aria-pressed={panels.value.timeline} onClick={() => toggle('timeline')} title="Toggle timeline"><Icon name="panel-bottom" size={17} /><span class="lbl">Timeline</span></button>
        <button class="btn ghost" aria-pressed={panels.value.right} onClick={() => toggle('right')} title="Toggle inspector panel"><Icon name="panel-right" size={17} /><span class="lbl">Panel</span></button>
        <button class="icon-btn" aria-label="Help and shortcuts" title="Help (?)" onClick={() => setHelpOpen(true)}><Icon name="help-circle" size={18} /></button>
        <button class="btn ghost" onClick={() => setSettingsOpen(true)} title="Project settings"><Icon name="settings" size={17} /><span class="lbl">Settings</span></button>
        <button class="btn primary" onClick={() => setExportOpen(true)}><Icon name="share" size={16} /> Export{activeJobs() ? ` ●${activeJobs()}` : ''}</button>
      </header>

      <ToolRail />
      <PresetsDrawer onManage={() => setTab('presets')} />

      <section class="viewer" data-testid="viewer-panel">
        <Viewer />
        <footer class="transport">
          <div class="transport-btns">
            <button class="btn icon" onClick={() => seek(0)} aria-label="Go to start"><Icon name="skip-back" size={17} /></button>
            <button class="btn icon" onClick={() => step(-1)} aria-label="Previous frame"><Icon name="step-back" size={17} /></button>
            <button class="btn primary play" onClick={() => (playing.value ? pause() : play())} aria-label={playing.value ? 'Pause' : 'Play'}><Icon name={playing.value ? 'pause' : 'play'} size={18} fill /></button>
            <button class="btn icon" onClick={() => step(1)} aria-label="Next frame"><Icon name="step-forward" size={17} /></button>
          </div>
          <div class="transport-readout">
            <span class="tc" aria-label="Current time">{timecode(Math.floor(playhead.value), s.fps)}</span>
            <span class="hint">/ {timecode(s.duration, s.fps)} · {s.width}×{s.height} · {s.fps} fps</span>
          </div>
          <button class="btn badge" aria-pressed={mbPreview.value} title="Preview motion blur (needs layers with motion blur and the project setting on)" onClick={() => (mbPreview.value = !mbPreview.value)}>MB</button>
        </footer>
      </section>

      <aside class="panel right" data-testid="side-panel">
        <header class="insp-head">
          <span class="insp-grip" aria-hidden="true" />
          <span class="chip" style={{ background: chip }} aria-hidden="true" />
          <div class="insp-id">
            <strong>{selLayer?.name ?? 'Inspector'}</strong>
            <span>{selLayer ? TYPE_LABEL[selLayer.type] ?? 'Layer' : 'No layer selected'}</span>
          </div>
          <button class="icon-btn" aria-label="Hide inspector" title="Hide inspector" onClick={() => toggle('right')}><Icon name="x" size={16} /></button>
        </header>
        <nav class="tabs" role="tablist">
          {(['inspector', 'effects', 'presets', 'assets'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        <div class="panel-body">
          {tab === 'inspector' ? <Inspector /> : tab === 'effects' ? <EffectsPanel /> : tab === 'presets' ? <PresetsPanel /> : <AssetsPanel />}
        </div>
      </aside>

      <section class="timeline" data-testid="timeline"><Timeline /></section>

      <ContextMenuHost />
      {easingOpen.value && <EasingPicker onClose={() => (easingOpen.value = false)} />}
      {notice.value && <div class="toast" role="status"><span>{notice.value}</span><button class="btn sm" onClick={() => (notice.value = '')}>OK</button></div>}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = current.value!.settings;
  const dlg = useDialog<HTMLDivElement>(onClose);
  const [snaps, setSnaps] = useState<{ t: number; size: number }[]>([]);
  useEffect(() => { void listSnapshots(current.peek()!.id).then(setSnaps).catch(() => undefined); }, []);
  const num = (k: 'width' | 'height' | 'fps' | 'duration') => (e: Event) =>
    setSettings({ [k]: Number((e.target as HTMLInputElement).value) });
  return (
    <div class="scrim" onClick={onClose}>
      <div class="dialog" role="dialog" aria-modal="true" aria-label="Project settings" ref={dlg} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
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
        <label>Preview quality
          <select value={String(previewQuality.value)} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setPreviewQuality(v === 'auto' ? 'auto' : (Number(v) as Quality)); }}>
            <option value="auto">Auto (adapts to keep playback smooth)</option><option value="1">Full</option><option value="0.5">Half</option><option value="0.25">Quarter</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" checked={!!s.motionBlur?.on} onChange={(e) => setSettings({ motionBlur: { on: (e.target as HTMLInputElement).checked, shutter: s.motionBlur?.shutter ?? 180, samples: s.motionBlur?.samples ?? 12 } })} /> Motion blur on export</label>
        {s.motionBlur?.on && <div class="two">
          <label>Shutter angle°<input type="number" inputMode="numeric" value={s.motionBlur.shutter} min={1} max={720} onChange={(e) => setSettings({ motionBlur: { ...s.motionBlur!, shutter: Math.min(720, Math.max(1, Number((e.target as HTMLInputElement).value) || 180)) } })} /></label>
          <label>Samples<input type="number" inputMode="numeric" value={s.motionBlur.samples} min={2} max={32} onChange={(e) => setSettings({ motionBlur: { ...s.motionBlur!, samples: Math.min(32, Math.max(2, Number((e.target as HTMLInputElement).value) || 12)) } })} /></label>
        </div>}
        <label class="check"><input type="checkbox" checked={s.linearLight} onChange={(e) => setSettings({ linearLight: (e.target as HTMLInputElement).checked })} /> Composite in linear light</label>
        {snaps.length > 0 && !activeComp.value && (
          <section class="sec"><h3>Earlier versions</h3>
            <ul class="jobs">{snaps.map((sn, i) => (
              <li key={sn.t} class="job"><div class="jtop"><span>{new Date(sn.t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <button class="btn sm" onClick={() => { void restoreVersion(i); onClose(); }}>Restore</button></div></li>
            ))}</ul>
            <p class="hint">Restoring is undoable.</p>
          </section>
        )}
        <div class="row"><button class="btn primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
