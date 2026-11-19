// @ts-nocheck
import { S } from '../state/state';
import { clamp } from '../ui/graph';
import { BLANK, celIdx, exporting } from './cels';
import { liveHide } from './ink';

/* ---- rasteriser ---- */
const RC = document.createElement('canvas'); RC.width = 1920; RC.height = 1080;
const rx = RC.getContext('2d', { willReadFrequently: true });
const SC = document.createElement('canvas'); SC.width = 1920; SC.height = 1080;
const sx = SC.getContext('2d', { willReadFrequently: true });
export const celCache = new WeakMap();
const hash = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
function dab(s, p, alt) {
  const tf = Math.max(0, 1 - alt / 1.5708), sz = s.sz;
  switch (s.k === 'erase' ? 'erase' : s.pre) {
    case 'pencil': return { w: sz * (0.3 + 0.7 * p) * (1 + tf * 3), a: (0.55 + 0.45 * p) * (1 - tf * 0.6), grain: 1 };
    case 'marker': return { w: sz * (1 + tf), a: 1 };
    case 'air': return { w: sz * (0.5 + 0.5 * p) * (1 + tf), a: 0.05 + 0.2 * p, soft: 1 };
    case 'erase': return { w: sz * (0.4 + 0.6 * p), a: 1 };
    default: return { w: sz * (0.12 + 0.88 * Math.pow(p, 1.3)), a: 1 };
  }
}
function stamp(ctx, x, y, d, col, am) {
  const r = Math.max(0.35, d.w / 2);
  let a = d.a * am; if (d.grain) a *= 0.7 + 0.3 * hash(x, y);
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  if (d.soft) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; }
  else ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
// Stamps the stroke's points from st.i onwards (st carries progress so a live stroke can continue).
export function stampStroke(ctx, s, st, am = 1) {
  const P = s.pts, col = s.k === 'erase' ? '#000' : s.c; if (!P.length) return;
  if (!st.started) { const d = dab(s, P[0][2], P[0][3]); stamp(ctx, P[0][0], P[0][1], d, col, am); st.started = true; st.i = 1; st.acc = 0; st.w = d.w; }
  for (; st.i < P.length; st.i++) {
    const a = P[st.i - 1], b = P[st.i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]); let d0 = 0;
    for (let guard = 0; guard < 4000; guard++) {
      const need = Math.max(0.6, st.w * (s.pre === 'air' && s.k !== 'erase' ? 0.22 : 0.16)) - st.acc;
      if (d0 + need > seg) { st.acc += seg - d0; break; }
      d0 += need; st.acc = 0; const u = seg ? d0 / seg : 1;
      const p = a[2] + (b[2] - a[2]) * u, al = a[3] + (b[3] - a[3]) * u, d = dab(s, p, al);
      stamp(ctx, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, d, col, am); st.w = d.w;
    }
  }
}
function floodFill(ctx, s) {
  const W = 1920, H = 1080, px = Math.round(s.x + 960), py = Math.round(s.y + 540);
  if (px < 0 || py < 0 || px >= W || py >= H) return null;
  const src = ctx.getImageData(0, 0, W, H).data, i0 = (py * W + px) * 4;
  const t = [src[i0], src[i0 + 1], src[i0 + 2], src[i0 + 3]], emptySeed = t[3] < 60;
  const match = (i) => emptySeed ? src[i + 3] < 110 : Math.abs(src[i] - t[0]) + Math.abs(src[i + 1] - t[1]) + Math.abs(src[i + 2] - t[2]) + Math.abs(src[i + 3] - t[3]) < 90;
  const mask = new Uint8Array(W * H), stack = [px, py]; let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
  while (stack.length) {
    const y = stack.pop(); let x = stack.pop();
    while (x >= 0 && !mask[y * W + x] && match((y * W + x) * 4)) x--;
    x++; let up = false, dn = false;
    while (x < W && !mask[y * W + x] && match((y * W + x) * 4)) {
      mask[y * W + x] = 1; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (y > 0) { const m = !mask[(y - 1) * W + x] && match(((y - 1) * W + x) * 4); if (m && !up) { stack.push(x, y - 1); up = true; } else if (!m) up = false; }
      if (y < H - 1) { const m = !mask[(y + 1) * W + x] && match(((y + 1) * W + x) * 4); if (m && !dn) { stack.push(x, y + 1); dn = true; } else if (!m) dn = false; }
      x++;
    }
  }
  if (!n || (emptySeed && n > W * H * 0.97)) return null; // the area isn't closed: don't flood the whole cel
  const hx = s.c.replace('#', ''), R = parseInt(hx.slice(0, 2), 16), G = parseInt(hx.slice(2, 4), 16), B = parseInt(hx.slice(4, 6), 16);
  const out = sx.createImageData(W, H), o = out.data;
  for (let y = Math.max(0, y0 - 2); y <= Math.min(H - 1, y1 + 2); y++) for (let x = Math.max(0, x0 - 2); x <= Math.min(W - 1, x1 + 2); x++) {
    let on = mask[y * W + x];
    if (!on) for (let dy = -2; dy <= 2 && !on; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W && mask[yy * W + xx]) { on = 1; break; } }
    if (on) { const j = (y * W + x) * 4; o[j] = R; o[j + 1] = G; o[j + 2] = B; o[j + 3] = 255; }
  }
  sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, W, H); sx.putImageData(out, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'destination-over'; ctx.globalAlpha = 1; ctx.drawImage(SC, 0, 0); ctx.restore();
  return [x0 - 962, y0 - 542, x1 - 958, y1 - 538];
}
function paintStroke(ctx, s) {
  if (s.k === 'fill') return floodFill(ctx, s);
  ctx.setTransform(1, 0, 0, 1, 960, 540);
  if (s.k === 'erase') { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; stampStroke(ctx, s, {}, s.op / 100); ctx.restore(); return null; }
  sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, 1920, 1080); sx.setTransform(1, 0, 0, 1, 960, 540); sx.globalAlpha = 1;
  stampStroke(sx, s, {});
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = s.op / 100; ctx.drawImage(SC, 0, 0); ctx.restore();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const m = s.sz * 2.2 + 4;
  s.pts.forEach((p) => { x0 = Math.min(x0, p[0] - m); y0 = Math.min(y0, p[1] - m); x1 = Math.max(x1, p[0] + m); y1 = Math.max(y1, p[1] + m); });
  return [x0, y0, x1, y1];
}
export function rasterCel(c) {
  rx.setTransform(1, 0, 0, 1, 0, 0); rx.globalAlpha = 1; rx.globalCompositeOperation = 'source-over'; rx.clearRect(0, 0, 1920, 1080);
  let bb = null;
  for (const s of c.strokes) { const b = paintStroke(rx, s); if (b && s.k !== 'erase') bb = bb ? [Math.min(bb[0], b[0]), Math.min(bb[1], b[1]), Math.max(bb[2], b[2]), Math.max(bb[3], b[3])] : b; }
  rx.setTransform(1, 0, 0, 1, 0, 0);
  const e = { sig: c.strokes.length + ':' + (c.v || 0), url: BLANK, x: 0, y: 0, w: 0, h: 0 };
  if (bb) {
    const X0 = Math.max(0, Math.floor(bb[0] + 960)), Y0 = Math.max(0, Math.floor(bb[1] + 540)), X1 = Math.min(1920, Math.ceil(bb[2] + 960)), Y1 = Math.min(1080, Math.ceil(bb[3] + 540));
    if (X1 > X0 && Y1 > Y0) {
      const cc = document.createElement('canvas'); cc.width = X1 - X0; cc.height = Y1 - Y0; cc.getContext('2d').drawImage(RC, X0, Y0, cc.width, cc.height, 0, 0, cc.width, cc.height);
      Object.assign(e, { url: cc.toDataURL('image/png'), x: X0 - 960, y: Y0 - 540, w: cc.width, h: cc.height });
      e.img = new Image(); e.img.src = e.url;
    }
  }
  celCache.set(c, e); return e;
}
export function celRaster(c) { const e = celCache.get(c); return e && e.sig === c.strokes.length + ':' + (c.v || 0) ? e : rasterCel(c); }
const setImg = (im, e, op) => { im.setAttribute('href', e.url); im.setAttribute('x', e.x); im.setAttribute('y', e.y); im.setAttribute('width', e.w); im.setAttribute('height', e.h); if (op != null) im.setAttribute('opacity', op); };
/* ---- per-frame: exposed cel + onion skins ---- */
export function drawXf(l, xf, i, f) {
  const im = xf.querySelector('image.cel'), on = xf.querySelector('.onion'); if (!im) return;
  const cels = l.cels || [];
  let k = celIdx(l, f);
  if (S.flip != null && l.id === S.sel && !exporting) k = clamp(S.flip, 0, cels.length - 1);
  if (k >= 0 && cels[k]) setImg(im, celRaster(cels[k])); else setImg(im, { url: BLANK, x: 0, y: 0, w: 0, h: 0 });
  im.style.visibility = liveHide === l.id && i === 0 ? 'hidden' : '';
  if (!on) return;
  const O = S.onion, show = i === 0 && O.on && l.id === S.sel && !S.playing && !exporting && k >= 0;
  let key = '', parts = [];
  if (show) {
    const add = (j, d, before) => { const c = cels[j]; if (!c) return; const e = celRaster(c); if (!e.w) return; const op = (O.op / 100) * Math.pow(0.6, d - 1); parts.push([e, op.toFixed(3), O.tint ? (before ? 'onB' : 'onA') : '']); key += e.url.length + ':' + e.x + ':' + e.y + ':' + op.toFixed(3) + (before ? 'b' : 'a') + O.tint + '|'; };
    for (let d = O.nb; d >= 1; d--) add(k - d, d, true);
    for (let d = 1; d <= O.na; d++) add(k + d, d, false);
  }
  if (on.dataset.key === key) return;
  on.dataset.key = key;
  on.innerHTML = parts.map(([e, op, fl]) => `<image href="${e.url}" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" opacity="${op}" preserveAspectRatio="none"${fl ? ` filter="url(#${fl})"` : ''}/>`).join('');
}
