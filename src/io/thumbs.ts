// Library thumbnails: frame 0 rendered at ~320 px wide with the export renderer, stored in the blob store.
import { kvGet, kvPut } from './store';
import type { Project } from '../model/project';

export async function makeThumb(p: Project): Promise<void> {
  const { FrameSource } = await import('../export/export');
  const src = new FrameSource(p, Math.min(1, 320 / p.settings.width));
  try {
    await src.prepare(0);
    const blob = await new Promise<Blob | null>((res) => src.render(0).toBlob(res, 'image/jpeg', 0.8));
    if (blob) await kvPut(`thumb:${p.id}`, blob);
  } finally { src.dispose(); }
}
export const loadThumb = async (id: string): Promise<Blob | null> => ((await kvGet<Blob>(`thumb:${id}`)) as Blob | undefined) ?? null;
