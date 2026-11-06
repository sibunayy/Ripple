// Offline frame rendering + encoders (spec §7.14, M4.5/M7). Lazily imported by the export dialog.
// A dedicated GLRenderer at export resolution renders frames deterministically. MP4/WebM use WebCodecs +
// mp4-muxer/webm-muxer; GIF uses gifenc; image sequences stream into a zip (fflate) so memory stays flat.
import { Zip, ZipPassThrough } from 'fflate';
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { ArrayBufferTarget as WebMTarget, Muxer as WebMMuxer } from 'webm-muxer';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { GLRenderer } from '../render/gl';
import { workRange, type Project } from '../model/project';
import { prepareMedia } from '../render/media';
import { buildBundle } from '../io/bundle';

export type ExportKind = 'lottie' | 'mp4' | 'webm' | 'gif' | 'png-seq' | 'jpeg-seq' | 'webp-seq' | 'png' | 'jpeg' | 'webp' | 'ripple';
export const KIND_INFO: Record<ExportKind, { label: string; ext: string; mime: string; video?: boolean; seq?: boolean; still?: boolean; alpha?: boolean }> = {
  mp4: { label: 'MP4 video (H.264)', ext: 'mp4', mime: 'video/mp4', video: true },
  webm: { label: 'WebM video (VP9)', ext: 'webm', mime: 'video/webm', video: true },
  gif: { label: 'Animated GIF', ext: 'gif', mime: 'image/gif', video: true, alpha: true },
  'png-seq': { label: 'PNG sequence (.zip)', ext: 'png', mime: 'image/png', seq: true, alpha: true },
  'jpeg-seq': { label: 'JPEG sequence (.zip)', ext: 'jpg', mime: 'image/jpeg', seq: true },
  'webp-seq': { label: 'WebP sequence (.zip)', ext: 'webp', mime: 'image/webp', seq: true, alpha: true },
  png: { label: 'Current frame (PNG)', ext: 'png', mime: 'image/png', still: true, alpha: true },
  jpeg: { label: 'Current frame (JPEG)', ext: 'jpg', mime: 'image/jpeg', still: true },
  webp: { label: 'Current frame (WebP)', ext: 'webp', mime: 'image/webp', still: true, alpha: true },
  lottie: { label: 'Lottie animation (.json)', ext: 'json', mime: 'application/json' },
  ripple: { label: 'Project backup (.ripple)', ext: 'ripple', mime: 'application/zip' },
};

export interface ExportOptions {
  kind: ExportKind;
  scale: number; // 1, .5, .25
  range: 'work' | 'all';
  frame?: number; // for stills
  fps?: number; // output frame rate (default: project fps)
  bitrate?: number; // bits/s for video
  transparent?: boolean; // alpha formats: transparent background
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}
export interface ExportResult { blob: Blob; name: string; mime: string; frames: number; ms: number; notes?: string[] }

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
const sleep0 = () => new Promise<void>((r) => setTimeout(r, 0));
const safe = (s: string) => s.replace(/[^\w.-]+/g, '_') || 'export';
const abortCheck = (o: ExportOptions) => { if (o.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError'); };

/** Render frames of a project at a given scale. Reuse one instance for a whole export. */
export class FrameSource {
  readonly canvas = document.createElement('canvas');
  readonly renderer: GLRenderer;
  readonly width: number;
  readonly height: number;
  constructor(private p: Project, scale: number, private transparent = false, forceEven = true) {
    const f = forceEven ? even : (n: number) => Math.max(1, Math.round(n));
    this.width = f(p.settings.width * scale); this.height = f(p.settings.height * scale);
    this.renderer = new GLRenderer(this.canvas, { alpha: transparent });
    this.renderer.resize(this.width, this.height);
  }
  /** Make media (images, video frames) drawable at frame t. Await before `render`. */
  prepare(t: number) { return prepareMedia(this.p.layers, this.p.comps, t, this.p.settings.fps); }
  dispose() { this.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(); }
  /** Render frame `t` into `canvas` (valid until the next call). */
  render(t: number) {
    const { settings: s, layers, comps } = this.p;
    this.renderer.render(layers, { width: s.width, height: s.height, bg: this.transparent ? [s.bg[0], s.bg[1], s.bg[2], 0] : s.bg, t, comps, fps: s.fps, linear: s.linearLight, motionBlur: s.motionBlur?.on ? { shutter: s.motionBlur.shutter, samples: s.motionBlur.samples } : undefined });
    return this.canvas;
  }
}

/** Output frame list: `n` frames sampled at times `t(i)` (fractional when resampling to another frame rate). */
function plan(p: Project, o: ExportOptions) {
  const [a, b] = o.range === 'work' ? workRange(p) : [0, p.settings.duration];
  const fps = o.fps && o.fps > 0 ? o.fps : p.settings.fps, ratio = p.settings.fps / fps;
  const n = Math.max(1, Math.floor((b - a) / ratio + 1e-9));
  return { n, fps, t: (i: number) => a + i * ratio };
}

const toBlob = (c: HTMLCanvasElement, mime: string) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Image encode failed'))), mime, 0.92));

async function exportStill(p: Project, o: ExportOptions): Promise<ExportResult> {
  const t0 = performance.now(), info = KIND_INFO[o.kind], src = new FrameSource(p, o.scale, !!o.transparent && !!info.alpha, false), f = o.frame ?? 0;
  try {
    await src.prepare(f);
    const blob = await toBlob(src.render(f), info.mime);
    return { blob, name: `${safe(p.name)}-${String(f).padStart(5, '0')}.${info.ext}`, mime: info.mime, frames: 1, ms: performance.now() - t0 };
  } finally { src.dispose(); }
}

async function exportSequence(p: Project, o: ExportOptions): Promise<ExportResult> {
  const t0 = performance.now(), info = KIND_INFO[o.kind], src = new FrameSource(p, o.scale, !!o.transparent && !!info.alpha, false), pl = plan(p, o);
  const parts: BlobPart[] = [];
  const zip = new Zip((err, chunk) => { if (err) throw err; parts.push(chunk as Uint8Array<ArrayBuffer>); });
  try {
    for (let i = 0; i < pl.n; i++) {
      abortCheck(o);
      await src.prepare(pl.t(i));
      const data = new Uint8Array(await (await toBlob(src.render(pl.t(i)), info.mime)).arrayBuffer());
      const entry = new ZipPassThrough(`${safe(p.name)}_${String(i).padStart(5, '0')}.${info.ext}`);
      zip.add(entry); entry.push(data, true);
      o.onProgress?.(i + 1, pl.n);
      if (i % 4 === 3) await sleep0();
    }
    zip.end();
    return { blob: new Blob(parts, { type: 'application/zip' }), name: `${safe(p.name)}-frames.zip`, mime: 'application/zip', frames: pl.n, ms: performance.now() - t0 };
  } finally { src.dispose(); }
}

const supportedCodec = async (codecs: string[], w: number, h: number, fps: number, bitrate: number): Promise<string | null> => {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of codecs) {
    try { if ((await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate, framerate: fps })).supported) return codec; } catch { /* try next */ }
  }
  return null;
};
const H264 = ['avc1.640033', 'avc1.64002a', 'avc1.4d0028', 'avc1.42001f'], VP9 = ['vp09.00.10.08', 'vp09.00.41.08'];
export const mp4Supported = (w: number, h: number, fps: number, bitrate = 8e6) => supportedCodec(H264, w, h, fps, bitrate);
export const webmSupported = (w: number, h: number, fps: number, bitrate = 8e6) => supportedCodec(VP9, w, h, fps, bitrate);

async function exportVideo(p: Project, o: ExportOptions): Promise<ExportResult> {
  const mp4 = o.kind === 'mp4';
  const t0 = performance.now(), src = new FrameSource(p, o.scale), pl = plan(p, o);
  const bitrate = o.bitrate ?? Math.round(Math.min(40e6, Math.max(2e6, src.width * src.height * pl.fps * 0.1)));
  try {
    const codec = await supportedCodec(mp4 ? H264 : VP9, src.width, src.height, pl.fps, bitrate);
    if (!codec) throw new Error(`${mp4 ? 'H.264' : 'VP9'} encoding is not available in this browser. Try ${mp4 ? 'WebM, GIF or a PNG sequence' : 'MP4'} instead.`);
    const mp4Target = new ArrayBufferTarget(), webmTarget = new WebMTarget();
    const m4 = mp4 ? new Muxer({ target: mp4Target, video: { codec: 'avc', width: src.width, height: src.height, frameRate: pl.fps }, fastStart: 'in-memory' }) : null;
    const wm = mp4 ? null : new WebMMuxer({ target: webmTarget, video: { codec: 'V_VP9', width: src.width, height: src.height, frameRate: pl.fps } });
    let encErr: Error | null = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => (m4 ? m4.addVideoChunk(chunk, meta) : wm!.addVideoChunk(chunk, meta)), error: (e) => { encErr = e; } });
    enc.configure({ codec, width: src.width, height: src.height, bitrate, framerate: pl.fps, latencyMode: 'quality' });
    const keyEvery = Math.max(1, Math.round(pl.fps * 2));
    for (let i = 0; i < pl.n; i++) {
      if (o.signal?.aborted) { enc.close(); throw new DOMException('Export cancelled', 'AbortError'); }
      if (encErr) throw encErr;
      await src.prepare(pl.t(i));
      const frame = new VideoFrame(src.render(pl.t(i)), { timestamp: Math.round((i * 1e6) / pl.fps), duration: Math.round(1e6 / pl.fps) });
      enc.encode(frame, { keyFrame: i % keyEvery === 0 });
      frame.close();
      o.onProgress?.(i + 1, pl.n);
      while (enc.encodeQueueSize > 6) await sleep0();
      if (i % 4 === 3) await sleep0();
    }
    await enc.flush(); enc.close();
    if (encErr) throw encErr;
    if (m4) m4.finalize(); else wm!.finalize();
    const buf = m4 ? mp4Target.buffer : webmTarget.buffer;
    return { blob: new Blob([buf], { type: mp4 ? 'video/mp4' : 'video/webm' }), name: `${safe(p.name)}.${mp4 ? 'mp4' : 'webm'}`, mime: mp4 ? 'video/mp4' : 'video/webm', frames: pl.n, ms: performance.now() - t0 };
  } finally { src.dispose(); }
}

async function exportGIF(p: Project, o: ExportOptions): Promise<ExportResult> {
  const t0 = performance.now(), transparent = !!o.transparent, src = new FrameSource(p, o.scale, transparent, false), pl = plan(p, o);
  const c2 = document.createElement('canvas'); c2.width = src.width; c2.height = src.height;
  const g = c2.getContext('2d', { willReadFrequently: true })!;
  const gif = GIFEncoder();
  const delay = Math.max(20, Math.round(1000 / pl.fps / 10) * 10); // GIF delays are centiseconds; browsers clamp tiny ones
  try {
    for (let i = 0; i < pl.n; i++) {
      abortCheck(o);
      await src.prepare(pl.t(i));
      g.clearRect(0, 0, c2.width, c2.height);
      g.drawImage(src.render(pl.t(i)), 0, 0);
      const { data } = g.getImageData(0, 0, c2.width, c2.height);
      const palette = quantize(data, 256, transparent ? { format: 'rgba4444', oneBitAlpha: true } : { format: 'rgb565' });
      const index = applyPalette(data, palette, transparent ? 'rgba4444' : 'rgb565');
      const ti = transparent ? palette.findIndex((c) => c[3] === 0) : -1;
      gif.writeFrame(index, c2.width, c2.height, { palette, delay, repeat: 0, first: i === 0, transparent: ti >= 0, transparentIndex: Math.max(0, ti) });
      o.onProgress?.(i + 1, pl.n);
      if (i % 2 === 1) await sleep0();
    }
    gif.finish();
    return { blob: new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: 'image/gif' }), name: `${safe(p.name)}.gif`, mime: 'image/gif', frames: pl.n, ms: performance.now() - t0 };
  } finally { src.dispose(); }
}

export async function runExport(p: Project, o: ExportOptions): Promise<ExportResult> {
  const info = KIND_INFO[o.kind];
  if (o.kind === 'lottie') {
    const t0 = performance.now();
    const { exportLottie } = await import('../lottie/export');
    const { getAssetBlob } = await import('../io/assets');
    const r = await exportLottie(p, { assetData: async (h) => { const b = await getAssetBlob(h); return b ? { mime: b.type, bytes: new Uint8Array(await b.arrayBuffer()) } : null; } });
    return { blob: new Blob([JSON.stringify(r.json)], { type: 'application/json' }), name: `${safe(p.name)}.json`, mime: 'application/json', frames: 0, ms: performance.now() - t0, notes: r.report.map((x) => x.msg) };
  }
  if (o.kind === 'ripple') { const t0 = performance.now(), blob = await buildBundle(p); return { blob, name: `${safe(p.name)}.ripple`, mime: 'application/zip', frames: 0, ms: performance.now() - t0 }; }
  if (info.still) return exportStill(p, o);
  if (info.seq) return exportSequence(p, o);
  if (o.kind === 'gif') return exportGIF(p, o);
  return exportVideo(p, o);
}
