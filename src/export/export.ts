// Offline frame rendering + encoders (spec §7.14, M4.5). Lazily imported by the export dialog.
// A dedicated GLRenderer at export resolution renders frames deterministically; MP4 uses WebCodecs + mp4-muxer,
// PNG sequences stream into a zip (fflate) so memory stays flat.
import { Zip, ZipPassThrough } from 'fflate';
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { GLRenderer } from '../render/gl';
import { workRange, type Project } from '../model/project';
import { prepareMedia } from '../render/media';

export type ExportKind = 'mp4' | 'png-seq' | 'png';
export interface ExportOptions {
  kind: ExportKind;
  scale: number; // 1, .5, .25
  range: 'work' | 'all';
  frame?: number; // for 'png'
  bitrate?: number; // bits/s for mp4
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}
export interface ExportResult { blob: Blob; name: string; mime: string; frames: number; ms: number }

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
const sleep0 = () => new Promise<void>((r) => setTimeout(r, 0));
const safe = (s: string) => s.replace(/[^\w.-]+/g, '_') || 'export';

/** Render frames of a project at a given scale. Reuse one instance for a whole export. */
export class FrameSource {
  readonly canvas = document.createElement('canvas');
  readonly renderer: GLRenderer;
  readonly width: number;
  readonly height: number;
  constructor(private p: Project, scale: number) {
    this.width = even(p.settings.width * scale); this.height = even(p.settings.height * scale);
    this.renderer = new GLRenderer(this.canvas);
    this.renderer.resize(this.width, this.height);
  }
  /** Make media (images, video frames) drawable at frame t. Await before `render`. */
  prepare(t: number) { return prepareMedia(this.p.layers, this.p.comps, t, this.p.settings.fps); }
  dispose() { this.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(); }
  /** Render frame `t` into `canvas` (valid until the next call). */
  render(t: number) {
    const { settings: s, layers, comps } = this.p;
    this.renderer.render(layers, { width: s.width, height: s.height, bg: s.bg, t, comps, fps: s.fps, linear: s.linearLight });
    return this.canvas;
  }
}

const frameRange = (p: Project, o: ExportOptions): [number, number] => (o.range === 'work' ? workRange(p) : [0, p.settings.duration]);
const toPNG = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'));

export async function exportPNG(p: Project, o: ExportOptions): Promise<ExportResult> {
  const t0 = performance.now(), src = new FrameSource(p, o.scale), f = o.frame ?? 0;
  await src.prepare(f);
  const blob = await toPNG(src.render(f));
  return { blob, name: `${safe(p.name)}-${String(f).padStart(5, '0')}.png`, mime: 'image/png', frames: 1, ms: performance.now() - t0 };
}

export async function exportPNGSequence(p: Project, o: ExportOptions): Promise<ExportResult> {
  const t0 = performance.now(), src = new FrameSource(p, o.scale), [a, b] = frameRange(p, o);
  const parts: BlobPart[] = [];
  const zip = new Zip((err, chunk) => { if (err) throw err; parts.push(chunk as Uint8Array<ArrayBuffer>); });
  for (let f = a; f < b; f++) {
    if (o.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    await src.prepare(f);
    const png = new Uint8Array(await (await toPNG(src.render(f))).arrayBuffer());
    const entry = new ZipPassThrough(`${safe(p.name)}_${String(f).padStart(5, '0')}.png`);
    zip.add(entry); entry.push(png, true);
    o.onProgress?.(f - a + 1, b - a);
    if ((f - a) % 4 === 3) await sleep0();
  }
  zip.end();
  return { blob: new Blob(parts, { type: 'application/zip' }), name: `${safe(p.name)}-frames.zip`, mime: 'application/zip', frames: b - a, ms: performance.now() - t0 };
}

export const mp4Supported = async (w: number, h: number, fps: number, bitrate = 8e6): Promise<string | null> => {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of ['avc1.640033', 'avc1.64002a', 'avc1.4d0028', 'avc1.42001f']) {
    try { if ((await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate, framerate: fps })).supported) return codec; } catch { /* try next */ }
  }
  return null;
};

export async function exportMP4(p: Project, o: ExportOptions): Promise<ExportResult> {
  const t0 = performance.now(), src = new FrameSource(p, o.scale), [a, b] = frameRange(p, o), fps = p.settings.fps;
  const bitrate = o.bitrate ?? Math.round(Math.min(40e6, Math.max(2e6, src.width * src.height * fps * 0.1)));
  const codec = await mp4Supported(src.width, src.height, fps, bitrate);
  if (!codec) throw new Error('H.264 encoding is not available in this browser. Use PNG sequence instead.');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: 'avc', width: src.width, height: src.height, frameRate: fps }, fastStart: 'in-memory' });
  let encErr: Error | null = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { encErr = e; } });
  enc.configure({ codec, width: src.width, height: src.height, bitrate, framerate: fps, latencyMode: 'quality' });
  const keyEvery = Math.max(1, Math.round(fps * 2));
  for (let f = a; f < b; f++) {
    if (o.signal?.aborted) { enc.close(); throw new DOMException('Export cancelled', 'AbortError'); }
    if (encErr) throw encErr;
    await src.prepare(f);
    const frame = new VideoFrame(src.render(f), { timestamp: Math.round(((f - a) * 1e6) / fps), duration: Math.round(1e6 / fps) });
    enc.encode(frame, { keyFrame: (f - a) % keyEvery === 0 });
    frame.close();
    o.onProgress?.(f - a + 1, b - a);
    while (enc.encodeQueueSize > 6) await sleep0();
    if ((f - a) % 4 === 3) await sleep0();
  }
  await enc.flush(); enc.close();
  if (encErr) throw encErr;
  muxer.finalize();
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), name: `${safe(p.name)}.mp4`, mime: 'video/mp4', frames: b - a, ms: performance.now() - t0 };
}

export function runExport(p: Project, o: ExportOptions): Promise<ExportResult> {
  return o.kind === 'mp4' ? exportMP4(p, o) : o.kind === 'png' ? exportPNG(p, o) : exportPNGSequence(p, o);
}
