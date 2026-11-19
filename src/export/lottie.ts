import { DUR, FPS, layers, markers, projName } from '../model/project';
import { lay } from '../anim/interpolate';
import { hasStroke, pathSegs, polyOf } from '../render/shapes';
import { FONTS, WNAME, snapW } from '../render/text';
import { postT } from '../fx/defs';
import { mat, pose, relM, repN, repXf } from '../anim/pose';
import { TYPE_NAME } from '../ui/left-panel';

/* ---- Lottie (Bodymovin JSON) export: transforms are baked per frame so behaviours, parenting, duplicators and posterize time all match the preview ---- */
const LBM = { normal: 0, multiply: 1, screen: 2, overlay: 3, darken: 4, lighten: 5, 'color-dodge': 6, 'color-burn': 7, 'hard-light': 8, 'soft-light': 9, difference: 10, exclusion: 11, hue: 12, saturation: 13, color: 14, luminosity: 15 };
const LTT = { alpha: 1, alphainv: 2, luma: 3, lumainv: 4 };
const lrgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); const n = m ? parseInt(m[1], 16) : 0xffffff; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => Math.round(v * 1000) / 1000); };
const lr = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
function lprop(vals, ip) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (vals.every((v) => same(v, vals[0]))) return { a: 0, k: vals[0] };
  const k = []; let prev = null;
  vals.forEach((v, i) => {
    const nxt = vals[i + 1];
    if (prev !== null && nxt !== undefined && same(v, prev) && same(v, nxt)) { prev = v; return; }
    const dim = Array.isArray(v) ? v.length : 1, arr = (x) => (Array.isArray(v) ? Array(dim).fill(x) : [x]);
    k.push({ t: ip + i, s: Array.isArray(v) ? v : [v], i: { x: arr(1), y: arr(1) }, o: { x: arr(0), y: arr(0) } });
    prev = v;
  });
  delete k[k.length - 1].i; delete k[k.length - 1].o;
  return { a: 1, k };
}
function lgeom(l) {
  const sh = (P, closed, segs?) => ({ ty: 'sh', ks: { a: 0, k: { c: closed, v: P.map((p) => [lr(p[0]), lr(p[1])]), i: segs ? segs.i : P.map(() => [0, 0]), o: segs ? segs.o : P.map(() => [0, 0]) } } });
  switch (l.type) {
    case 'rect': { const w = l.w || 280, h = l.h || 180; return { g: { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [w, h] }, r: { a: 0, k: Math.min(l.cr ?? 24, w / 2, h / 2) }, d: 1 }, bb: [w, h] }; }
    case 'ellipse': case 'ring': return { g: { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [l.r * 2, l.r * 2] }, d: 1 }, bb: [l.r * 2, l.r * 2] };
    case 'line': { const w = l.w || 420; return { g: sh([[-w / 2, 0], [w / 2, 0]], false), bb: [w, 1] }; }
    case 'star': case 'polygon': { const P = polyOf(l), xs = P.map((p) => p[0]), ys = P.map((p) => p[1]); return { g: sh(P, true), bb: [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)] }; }
    case 'path': {
      const P = l.pts || [], xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), bb = [Math.max(...xs) - Math.min(...xs) || 1, Math.max(...ys) - Math.min(...ys) || 1];
      if (!l.smooth || P.length < 3) return { g: sh(P, !!l.closed && P.length > 2), bb };
      const segs = pathSegs(l), n = P.length, ii = P.map(() => [0, 0]), oo = P.map(() => [0, 0]);
      segs.forEach((q, k) => { const a = k, b = (k + 1) % n; oo[a] = [lr(q[1][0] - q[0][0]), lr(q[1][1] - q[0][1])]; ii[b] = [lr(q[2][0] - q[3][0]), lr(q[2][1] - q[3][1])]; });
      return { g: sh(P, !!l.closed, { i: ii, o: oo }), bb };
    }
  }
  return null;
}
function lpaint(l, bb, trim, part?) {
  const items = [], sw = l.type === 'ring' ? (l.sw ?? 14) : l.type === 'line' ? (l.sw ?? 12) : l.type === 'path' ? (l.sw ?? 8) : (l.sw || 0);
  const fillOn = l.type === 'path' ? l.fill === true && l.closed : !['ring', 'line'].includes(l.type) && l.fill !== false;
  if (fillOn && part !== 'stroke') {
    if (l.grad) {
      const a = (l.gang ?? 90) * Math.PI / 180, dx = Math.cos(a) * bb[0] / 2, dy = Math.sin(a) * bb[1] / 2, c1 = lrgb(l.hue), c2 = lrgb(l.hue2 || '#ff5ea8');
      items.push({ ty: 'gf', o: { a: 0, k: 100 }, r: 1, t: 1, s: { a: 0, k: [lr(-dx), lr(-dy)] }, e: { a: 0, k: [lr(dx), lr(dy)] }, g: { p: 2, k: { a: 0, k: [0, ...c1, 1, ...c2] } } });
    } else items.push({ ty: 'fl', c: { a: 0, k: [...lrgb(l.hue), 1] }, o: { a: 0, k: 100 }, r: 1 });
  }
  if (hasStroke(l) && sw > 0 && part !== 'fill') {
    const st: any = { ty: 'st', c: { a: 0, k: [...lrgb(l.type === 'ring' || l.type === 'path' || l.type === 'line' && !l.sw ? l.hue : (l.sc || '#ffffff')), 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: sw }, lc: { butt: 1, round: 2, square: 3 }[l.cap || 'round'], lj: { miter: 1, round: 2, bevel: 3 }[l.join || 'round'], ml: 4 };
    if (l.dash > 0 && !trim) st.d = [{ n: 'd', nm: 'dash', v: { a: 0, k: l.dash } }, { n: 'g', nm: 'gap', v: { a: 0, k: Math.round(l.dash * 1.2) } }, { n: 'o', nm: 'offset', v: { a: 0, k: 0 } }];
    items.push(st);
  }
  if (trim) items.unshift({ ty: 'tm', s: trim.s, e: trim.e, o: { a: 0, k: 0 }, m: 1 });
  return items;
}
export async function exportLottie(job) {
  const warn = new Set(), out = [], assets = [], fonts = [];
  const tr = (q) => ({ x: q.x, y: q.y });
  let idx = 1;
  for (let li = 0; li < layers.length; li++) {
    const l = layers[li]; if (job.cancel) return null;
    if (!l.vis || ['audio', 'null', 'adjust', 'comp', 'shader', 'draw'].includes(l.type)) { if (['shader', 'adjust', 'comp', 'draw'].includes(l.type) && l.vis) warn.add(`${TYPE_NAME[l.type] || l.type} layers`); continue; }
    if (l.fx.some((e) => e.on && e.id !== 'postime')) warn.add('effects');
    if (l.type === 'text' && (l.anims || []).length) warn.add('per-character text animators');
    const ip = Math.max(0, Math.round(l.inP ?? 0)), op = Math.min(DUR, Math.round(l.outP ?? DUR)); if (op <= ip) continue;
    const n = repN(l), src = li > 0 && l.matte ? layers[li - 1] : null, isSrc = layers[li + 1] && layers[li + 1].matte && li + 1 < layers.length;
    for (let c = 0; c < n; c++) {
      const P = [], R = [], Sc = [], O = [], TS = [], TE = []; let ang = null;
      for (let f = ip; f < op; f++) {
        const ff = postT(l, f), q = pose(l, ff, c); if (l.rep && l.rep.on) repXf(l, q, c);
        let m = mat(q); if (l.parent && lay(l.parent)) m = relM(l, ff, 0).multiply(m);
        let a = Math.atan2(m.b, m.a) * 180 / Math.PI; if (ang !== null) { while (a - ang > 180) a -= 360; while (a - ang < -180) a += 360; } ang = a;
        P.push([lr(m.e), lr(m.f)]); R.push(lr(a)); const s = lr(Math.hypot(m.a, m.b) * 100), sy = m.a * m.d - m.b * m.c < 0 ? -s : s; Sc.push([s, sy]); O.push(lr(Math.max(0, Math.min(100, q.o)), 1));
        TS.push(lr(Math.max(0, Math.min(100, Math.min(q.ts, q.te))))); TE.push(lr(Math.max(0, Math.min(100, Math.max(q.ts, q.te)))));
      }
      const L: any = { ddd: 0, ind: idx++, nm: n > 1 ? `${l.name} ${c + 1}` : l.name, sr: 1, ip, op, st: 0, bm: LBM[l.blend || 'normal'] || 0, ao: 0,
        ks: { o: lprop(O, ip), r: lprop(R, ip), p: lprop(P, ip), a: { a: 0, k: [0, 0] }, s: lprop(Sc, ip) } };
      if (src && c === 0) L.tt = LTT[l.matte] || 1;
      if (isSrc) L.td = 1;
      if (l.type === 'text') {
        const F = FONTS.find((x) => x[0] === l.font) || FONTS[0], fam = F[2].split(',')[0].replace(/['"]/g, '').trim(), w = snapW(l), fname = `${F[0]}-${w}${l.italic ? 'i' : ''}`;
        const style = (WNAME[w] || 'Regular') + (l.italic ? ' Italic' : '');
        if (!fonts.some((x) => x.fName === fname)) fonts.push({ fName: fname, fFamily: fam === '-apple-system' ? 'SF Pro Display' : fam, fStyle: style, fWeight: String(w), ascent: 75 });
        let t = String(l.text ?? ''); if (l.tcase === 'upper') t = t.toUpperCase(); else if (l.tcase === 'lower') t = t.toLowerCase();
        const size = +l.size || 100, lines = t.split('\n').length, lh = size * (l.lead ?? 120) / 100;
        L.ty = 5; L.ks.a = { a: 0, k: [0, lr(-size * .35 + (lines - 1) * lh / 2)] };
        L.t = { d: { k: [{ s: { s: size, f: fname, t: t.replace(/\n/g, '\r'), j: { left: 0, right: 1, center: 2 }[l.align || 'center'], tr: Math.round((+l.track || 0) / size * 1000), lh: lr(lh), ls: 0, fc: lrgb(l.hue) }, t: 0 }] }, p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } }, a: [] };
        if (l.grad) warn.add('gradient text');
      } else if (l.type === 'solid') { L.ty = 1; L.sc = l.hue; L.sw = 1920; L.sh = 1080; L.ks.a = { a: 0, k: [960, 540] }; }
      else if (l.type === 'image') {
        let p = ''; try { const b = await (await fetch(l.src)).blob(); p = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(b); }); } catch { warn.add('an image that could not be read'); continue; }
        const id = 'img_' + assets.length; assets.push({ id, w: Math.round(l.w), h: Math.round(l.h), u: '', p, e: 1 });
        L.ty = 2; L.refId = id; L.ks.a = { a: 0, k: [lr(l.w / 2), lr(l.h / 2)] };
      } else {
        const G = lgeom(l); if (!G) continue;
        const trimmed = TS.some((v) => v > .01) || TE.some((v) => v < 99.99);
        const TR = { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } };
        L.ty = 4;
        if (trimmed) { /* trim paths only cut the stroke, as in the preview */
          const st = lpaint(l, G.bb, { s: lprop(TS, ip), e: lprop(TE, ip) }, 'stroke'), fl = lpaint(l, G.bb, null, 'fill');
          L.shapes = [st.length > 1 ? { ty: 'gr', nm: 'Stroke', it: [G.g, ...st, TR] } : null, fl.length ? { ty: 'gr', nm: 'Fill', it: [JSON.parse(JSON.stringify(G.g)), ...fl, TR] } : null].filter(Boolean);
        } else L.shapes = [{ ty: 'gr', nm: l.name, it: [G.g, ...lpaint(l, G.bb, null), TR] }];
      }
      out.push(L);
    }
    job.set((li + 1) / layers.length * 95, `Layer ${li + 1} of ${layers.length}`);
    await new Promise((r) => setTimeout(r, 0));
  }
  const doc: any = { v: '5.7.4', fr: FPS, ip: 0, op: DUR, w: 1920, h: 1080, nm: projName, ddd: 0, assets, layers: out, markers: markers.map((m) => ({ tm: m.f, cm: m.name, dr: 0 })) };
  if (fonts.length) doc.fonts = { list: fonts };
  job.warn = [...warn];
  return new Blob([JSON.stringify(doc)], { type: 'application/json' });
}
