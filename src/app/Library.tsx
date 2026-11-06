import { useEffect, useRef, useState } from 'preact/hooks';
import { loadThumb } from '../io/thumbs';
import { duplicateProject, library, newProject, openProject, removeProject } from './state';

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

export function Library() {
  const items = library.value;
  return (
    <main class="library">
      <header>
        <h1>RippleFlow</h1>
        <button class="btn primary" onClick={() => void newProject()}>＋ New project</button>
      </header>
      {items.length === 0 ? (
        <p class="empty">No projects yet. Create one to get started.</p>
      ) : (
        <ul class="grid">
          {items.map((m) => (
            <li key={m.id} class="card">
              <Thumb id={m.id} modified={m.modified} label={`Open ${m.name}`} ratio={`${m.width} / ${m.height}`} onOpen={() => void openProject(m.id)} />
              <div class="meta">
                <strong>{m.name}</strong>
                <span>{m.width}×{m.height} · {m.fps} fps</span>
                <span>{ago(m.modified)}</span>
              </div>
              <div class="row">
                <button class="btn" onClick={() => void duplicateProject(m.id)}>Duplicate</button>
                <button class="btn danger" onClick={() => { if (confirm(`Delete “${m.name}”?`)) void removeProject(m.id); }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
