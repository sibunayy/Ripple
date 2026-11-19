import { DUR } from '../model/project';
import { rasterFrame } from './raster';

/* ---- MP4 (WebCodecs H.264 + a small muxer) ---- */
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >> 8) & 255, n & 255];
const box = (t, ...kids) => { const body = kids.flat(Infinity); return [...u32(8 + body.length), ...[...t].map((c) => c.charCodeAt(0)), ...body]; };
const fullbox = (t, ver, flags, ...kids) => box(t, ver, 0, 0, flags, ...kids);
export function muxMp4(w, h, fps, avcC, samples) {
  const TS = 90000, dur = Math.round(samples.length * TS / fps), delta = Math.round(TS / fps);
  const Z12 = new Array(12).fill(0), mat = [...u32(0x10000), ...Z12, ...u32(0x10000), ...Z12, ...u32(0x40000000)];
  const sizes = samples.map((s) => s.data.length), sync = samples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean);
  const ftyp = box('ftyp', [...'isom'].map((c) => c.charCodeAt(0)), u32(512), [...'isomiso2avc1mp41'].map((c) => c.charCodeAt(0)));
  const mk = (off) => {
    const stbl = box('stbl',
      fullbox('stsd', 0, 0, u32(1), box('avc1', [0, 0, 0, 0, 0, 0], u16(1), u16(0), u16(0), u32(0), u32(0), u32(0), u16(w), u16(h), u32(0x480000), u32(0x480000), u32(0), u16(1), new Array(32).fill(0), u16(24), u16(0xFFFF), box('avcC', [...avcC]))),
      fullbox('stts', 0, 0, u32(1), u32(samples.length), u32(delta)),
      fullbox('stss', 0, 0, u32(sync.length), sync.map(u32)),
      fullbox('stsc', 0, 0, u32(1), u32(1), u32(samples.length), u32(1)),
      fullbox('stsz', 0, 0, u32(0), u32(sizes.length), sizes.map(u32)),
      fullbox('stco', 0, 0, u32(1), u32(off)));
    return box('moov',
      fullbox('mvhd', 0, 0, u32(0), u32(0), u32(TS), u32(dur), u32(0x10000), u16(0x100), u16(0), u32(0), u32(0), mat, new Array(24).fill(0), u32(2)),
      box('trak', fullbox('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(dur), u32(0), u32(0), u16(0), u16(0), u16(0), u16(0), mat, u32(w << 16), u32(h << 16)),
        box('mdia', fullbox('mdhd', 0, 0, u32(0), u32(0), u32(TS), u32(dur), u16(0x55C4), u16(0)),
          fullbox('hdlr', 0, 0, u32(0), [...'vide'].map((c) => c.charCodeAt(0)), u32(0), u32(0), u32(0), [...'VideoHandler'].map((c) => c.charCodeAt(0)), 0),
          box('minf', fullbox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), box('dinf', fullbox('dref', 0, 0, u32(1), fullbox('url ', 0, 1))), stbl))));
  };
  const moovLen = mk(0).length, off = ftyp.length + moovLen + 8, moov = mk(off);
  const total = samples.reduce((t, s) => t + s.data.length, 0);
  return new Blob([Uint8Array.from(ftyp), Uint8Array.from(moov), Uint8Array.from([...u32(8 + total), 109, 100, 97, 116]), ...samples.map((s) => s.data)], { type: 'video/mp4' });
}
export async function exportMp4(job, w, h, fps, nF) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') throw new Error('MP4 export needs a browser with WebCodecs (Safari on iPadOS 16.4 or later, or recent Chrome).');
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d');
  const bitrate = Math.round(w * h * fps * 0.14);
  let cfg = null;
  for (const codec of [w * h > 2100000 ? 'avc1.640033' : 'avc1.64002A', 'avc1.4D4028', 'avc1.42E01F']) {
    const c = { codec, width: w, height: h, bitrate, framerate: fps, avc: { format: 'avc' } };
    try { const s = await VideoEncoder.isConfigSupported(c as any); if (s.supported) { cfg = s.config || c; cfg.avc = { format: 'avc' }; break; } } catch { /* try next */ }
  }
  if (!cfg) throw new Error(`This device can't encode ${w}×${h} H.264. Try a lower resolution.`);
  const samples = []; let avcC = null, err = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description) avcC = new Uint8Array(meta.decoderConfig.description instanceof ArrayBuffer ? meta.decoderConfig.description : (meta.decoderConfig.description as ArrayBufferView).buffer.slice((meta.decoderConfig.description as ArrayBufferView).byteOffset, (meta.decoderConfig.description as ArrayBufferView).byteOffset + (meta.decoderConfig.description as ArrayBufferView).byteLength)); const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); samples.push({ data: d, key: chunk.type === 'key' }); },
    error: (e) => { err = e; },
  });
  enc.configure(cfg);
  for (let i = 0; i < nF; i++) {
    if (job.cancel) { try { enc.close(); } catch { /* closed */ } return null; }
    if (err) throw err;
    await rasterFrame(Math.min(DUR, i * 30 / fps), w, h, ctx, false);
    while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4));
    const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: i % Math.max(1, Math.round(fps)) === 0 }); vf.close();
    job.set((i + 1) / nF * 95, `Frame ${i + 1} of ${nF}`);
    if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
  }
  await enc.flush(); enc.close(); if (err) throw err;
  if (!avcC || !samples.length) throw new Error('The encoder returned no video. Try a lower resolution.');
  job.set(98, 'Writing file');
  return muxMp4(w, h, fps, avcC, samples);
}
