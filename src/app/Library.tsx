import { useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { STARTERS_META as STARTERS } from './templateMeta';
import { HelpDialog } from './HelpDialog';
import { Onboarding, showOnboarding } from './Onboarding';
import { loadThumb } from '../io/thumbs';
import { newFromTemplate, importLottieFile, backupProject, importBundleFile, notice, duplicateProject, library, newProject, openProject, removeProject } from './state';

function Thumb({ id, modified, label, ratio, onOpen }: { id: string; modified: number; label: string; ratio: string; onOpen: () => void }) {
  const [url, setUrl] = useState('');
  const last = useRef('');
  useEffect(() => {
    let dead = false;
    void loadThumb(id).then((b) => {
      if (!b || dead) return;
      const u = URL.createObjectURL(b), prev = last.current;
      last.current = u; setUrl(u);
      if (prev) setTimeout(() => URL.revokeObjectURL(prev), 2000); // keep the old image alive until the new one paints
    }).catch(() => undefined);
    return () => { dead = true; };
  }, [id, modified]);
  useEffect(() => () => { if (last.current) URL.revokeObjectURL(last.current); }, []);
  return <button class="thumb" aria-label={label} onClick={onOpen} style={{ aspectRatio: ratio, backgroundImage: url ? `url(${url})` : undefined, backgroundSize: 'cover' }} />;
}

const ago = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const helpOpen = signal(false);
const installed = typeof matchMedia !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
const nudgeHidden = signal((() => { try { return localStorage.getItem('rf-nudge') === '1'; } catch { return false; } })());

export function Library() {
  const items = library.value;
  return (
    <main class="library" data-testid="library">
      {notice.value && <div class="toast" role="status"><span>{notice.value}</span><button class="btn sm" onClick={() => (notice.value = '')}>OK</button></div>}
      <header>
        <h1>RippleFlow</h1>
        <div class="row">
          <label class="btn filebtn">Import Lottie…<input type="file" accept=".json,.lottie,application/json" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void importLottieFile(f); (e.target as HTMLInputElement).value = ''; }} /></label>
          <label class="btn filebtn">Import .ripple…<input type="file" accept=".ripple,application/zip" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void importBundleFile(f); (e.target as HTMLInputElement).value = ''; }} /></label>
          <button class="btn" aria-label="Help" onClick={() => (helpOpen.value = true)}>?</button>
          <button class="btn primary" onClick={() => void newProject()}>＋ New project</button>
        </div>
      </header>
      {items.length > 0 && !installed && !nudgeHidden.value && (
        <div class="banner" role="note">
          <span>Safari can clear data from websites that aren't installed. Add RippleFlow to your Home Screen, and use <b>Backup</b> to keep copies of important projects.</span>
          <button class="btn sm" onClick={() => { nudgeHidden.value = true; try { localStorage.setItem('rf-nudge', '1'); } catch { /* ignore */ } }}>Got it</button>
        </div>
      )}
      <section class="starters" aria-label="Start from a template">
        <h2>Start from a template</h2>
        <ul>{STARTERS.map((t) => <li key={t.id}><button class="starter" onClick={() => void newFromTemplate(t.id)}><strong>{t.name}</strong><span>{t.description}</span></button></li>)}</ul>
      </section>
      {showOnboarding.value && <Onboarding />}
      {helpOpen.value && <HelpDialog onClose={() => (helpOpen.value = false)} />}
      {items.length === 0 ? (
        <p class="empty">No projects yet. Create one, or start from a template above.</p>
      ) : (
        <ul class="grid">
          {items.map((m) => (
            <li key={m.id} class="card" data-testid="project-card">
              <Thumb id={m.id} modified={m.modified} label={`Open ${m.name}`} ratio={`${m.width} / ${m.height}`} onOpen={() => void openProject(m.id)} />
              <div class="meta">
                <strong>{m.name}</strong>
                <span>{m.width}×{m.height} · {m.fps} fps</span>
                <span>{ago(m.modified)}</span>
              </div>
              <div class="row">
                <button class="btn" onClick={() => void duplicateProject(m.id)}>Duplicate</button>
                <button class="btn" onClick={() => void backupProject(m.id)}>Backup</button>
                <button class="btn danger" onClick={() => { if (confirm(`Delete “${m.name}”?`)) void removeProject(m.id); }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
