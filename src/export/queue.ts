// Render queue (spec §7.14): jobs run one at a time in the background while editing continues. Job specs persist so
// an interrupted queue (reload, crash) is shown as "interrupted" and can be restarted from the saved project.
import { signal } from '@preact/signals';
import type { Project } from '../model/project';
import { kvGet, kvPut, loadProject } from '../io/store';
import type { ExportKind, ExportOptions, ExportResult } from './export';

export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled' | 'interrupted';
export interface JobSpec { id: string; projectId: string; name: string; kind: ExportKind; options: Omit<ExportOptions, 'onProgress' | 'signal'> }
export interface Job extends JobSpec { status: JobStatus; done: number; total: number; result?: ExportResult; error?: string; project?: Project }

export const jobs = signal<Job[]>([]);
const aborts = new Map<string, AbortController>();
let running = false;
let lock: { release(): Promise<void> } | null = null;

const persist = () => {
  const specs = jobs.peek().filter((j) => ['queued', 'running', 'interrupted'].includes(j.status)).map(({ id, projectId, name, kind, options, status }) => ({ id, projectId, name, kind, options, status }));
  void kvPut('jobs', JSON.stringify(specs)).catch(() => undefined);
};
const patch = (id: string, p: Partial<Job>) => { jobs.value = jobs.peek().map((j) => (j.id === id ? { ...j, ...p } : j)); };

/** Restore job specs from the previous session; anything unfinished becomes "interrupted". */
export async function restoreJobs() {
  try {
    const raw = (await kvGet<string>('jobs')) as string | undefined;
    if (!raw) return;
    const specs = JSON.parse(raw) as (JobSpec & { status: JobStatus })[];
    jobs.value = [...jobs.peek(), ...specs.filter((s) => !jobs.peek().some((j) => j.id === s.id)).map((s) => ({ ...s, status: 'interrupted' as const, done: 0, total: 0 }))];
  } catch { /* nothing to restore */ }
}

export function enqueue(project: Project, kind: ExportKind, options: JobSpec['options']): string {
  const id = Math.random().toString(36).slice(2, 10);
  jobs.value = [...jobs.peek(), { id, projectId: project.id, name: `${project.name} · ${kind}`, kind, options, status: 'queued', done: 0, total: 0, project }];
  persist(); void pump();
  return id;
}

/** Re-run an interrupted/failed/cancelled job from the saved copy of its project. */
export async function restart(id: string) {
  const j = jobs.peek().find((x) => x.id === id); if (!j) return;
  const p = j.project ?? (await loadProject(j.projectId));
  if (!p) { patch(id, { status: 'error', error: 'The project for this job no longer exists.' }); return; }
  patch(id, { status: 'queued', error: undefined, done: 0, project: p }); persist(); void pump();
}
export function cancel(id: string) { aborts.get(id)?.abort(); const j = jobs.peek().find((x) => x.id === id); if (j && j.status === 'queued') { patch(id, { status: 'cancelled' }); persist(); } }
export function dismiss(id: string) { cancel(id); jobs.value = jobs.peek().filter((j) => j.id !== id); persist(); }
export const activeJobs = () => jobs.value.filter((j) => j.status === 'queued' || j.status === 'running').length;

async function pump() {
  if (running) return;
  running = true;
  try {
    try { lock = (await (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen')) ?? null; } catch { lock = null; }
    for (;;) {
      const j = jobs.peek().find((x) => x.status === 'queued');
      if (!j || !j.project) break;
      const ac = new AbortController(); aborts.set(j.id, ac);
      patch(j.id, { status: 'running', done: 0 }); persist();
      try {
        const { runExport } = await import('./export');
        const result = await runExport(j.project, { ...j.options, signal: ac.signal, onProgress: (d, t) => patch(j.id, { done: d, total: t }) });
        patch(j.id, { status: 'done', result, project: undefined, done: result.frames, total: result.frames });
      } catch (e) {
        if ((e as Error).name === 'AbortError') patch(j.id, { status: 'cancelled' });
        else patch(j.id, { status: 'error', error: (e as Error).message });
      }
      aborts.delete(j.id); persist();
    }
  } finally { running = false; try { await lock?.release(); } catch { /* ignore */ } lock = null; }
}
