import { duplicateProject, library, newProject, openProject, removeProject } from './state';

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
              <button class="thumb" aria-label={`Open ${m.name}`} onClick={() => void openProject(m.id)}
                style={{ aspectRatio: `${m.width} / ${m.height}` }} />
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
