import { esc } from '../core/dom';
import { textSvg } from './text';
import { BLANK } from '../drawing/cels';

function ptsArr(n, ro, ri) { const a = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, t = Math.PI * i / n - Math.PI / 2; a.push([Math.cos(t) * r, Math.sin(t) * r]); } return a; }
function starPts(n, ro, ri) { return ptsArr(n, ro, ri).map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '); }
export const polyOf = (l) => l.type === 'star' ? ptsArr(l.n || 5, 120, 120 * (l.ir ?? 43) / 100) : ptsArr(l.n || 3, 120, 120 * Math.cos(Math.PI / (l.n || 3)));
export const STROKABLE = ['rect', 'ellipse', 'star', 'polygon'];
export const hasStroke = (l) => l.type === 'ring' || l.type === 'line' || l.type === 'path' || (STROKABLE.includes(l.type) && (l.sw || 0) > 0);
export function pathSegs(l) {
  const P = l.pts || [], n = P.length, segs = [], cl = !!l.closed && n > 2, g = (i) => cl ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
  const m = cl ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = P[i], b = P[(i + 1) % n];
    if (l.smooth && n > 2) { const p0 = g(i - 1), p3 = g(i + 2); segs.push([a, [a[0] + (b[0] - p0[0]) / 6, a[1] + (b[1] - p0[1]) / 6], [b[0] - (p3[0] - a[0]) / 6, b[1] - (p3[1] - a[1]) / 6], b]); }
    else segs.push([a, a, b, b]);
  }
  return segs;
}
function pathD(l) {
  const S0 = pathSegs(l); if (!S0.length) return ''; const f = (q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1);
  return 'M' + f(S0[0][0]) + S0.map((q) => (l.smooth && l.pts.length > 2 ? 'C' + f(q[1]) + ' ' + f(q[2]) + ' ' + f(q[3]) : 'L' + f(q[3]))).join('') + (l.closed && l.pts.length > 2 ? 'Z' : '');
}
function shapeLen(l) {
  switch (l.type) {
    case 'path': { let t = 0; for (const q of pathSegs(l)) { let pr = q[0]; for (let k = 1; k <= 12; k++) { const u = k / 12, v = 1 - u, x = v * v * v * q[0][0] + 3 * v * v * u * q[1][0] + 3 * v * u * u * q[2][0] + u * u * u * q[3][0], y = v * v * v * q[0][1] + 3 * v * v * u * q[1][1] + 3 * v * u * u * q[2][1] + u * u * u * q[3][1]; t += Math.hypot(x - pr[0], y - pr[1]); pr = [x, y]; } } return Math.max(1, t); }
    case 'ring': case 'ellipse': return 2 * Math.PI * l.r;
    case 'rect': return 2 * ((l.w || 280) + (l.h || 180));
    case 'line': return l.w || 420;
    case 'star': case 'polygon': { const p = polyOf(l); let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += Math.hypot(a[0] - b[0], a[1] - b[1]); } return s; }
    default: return 100;
  }
}
const gradId = (l) => 'gr-' + l.id;
const gradDef = (l) => { if (!l.grad) return ''; const stops = `<stop offset="0" stop-color="${l.hue}"/><stop offset="1" stop-color="${l.hue2 || '#ff5ea8'}"/>`;
  return l.gtype === 'radial' ? `<defs><radialGradient id="${gradId(l)}" cx="50%" cy="50%" r="${(l.grad_r ?? 70)}%">${stops}</radialGradient></defs>` : `<defs><linearGradient id="${gradId(l)}" gradientTransform="rotate(${l.gang ?? 90} .5 .5)">${stops}</linearGradient></defs>`; };
export const fillVal = (l) => l.grad ? `url(#${gradId(l)})` : l.hue;
export function shapeSvg(l) { return gradDef(l) + shapeSvg0(l); }
const dashGap = (l) => Math.max(1, Math.round(l.dgap ?? l.dash * 1.2));
function shapeSvg0(l) {
  const fillA = l.fill === false ? 'none' : fillVal(l);
  const sw = l.type === 'ring' ? (l.sw ?? 14) : l.type === 'line' ? (l.sw ?? 12) : l.type === 'path' ? (l.sw ?? 8) : (l.sw || 0);
  const stk = hasStroke(l) && sw > 0 ? ` stroke="${l.type === 'ring' || l.type === 'path' ? l.hue : (l.sc || '#ffffff')}" stroke-width="${sw}" stroke-linecap="${l.cap || 'round'}" stroke-linejoin="${l.join || 'round'}"${l.dash > 0 ? ` stroke-dasharray="${l.dash} ${dashGap(l)}" data-dash="${l.dash} ${dashGap(l)}"` : ''}${l.dash > 0 && l.doff ? ` stroke-dashoffset="${l.doff}" data-doff="${l.doff}"` : ''}${(l.sop ?? 100) < 100 ? ` stroke-opacity="${(l.sop / 100).toFixed(2)}"` : ''} class="tp" data-len="${shapeLen(l).toFixed(1)}"` : '';
  const fop = (l.fop ?? 100) < 100 ? ` fill-opacity="${(l.fop / 100).toFixed(2)}"` : '';
  switch (l.type) {
    case 'text': return textSvg(l);
    case 'path': return `<path d="${pathD(l)}" fill="${l.fill === true ? fillVal(l) : 'none'}"${fop}${stk}/>`;
    case 'ellipse': return `<circle r="${l.r}" fill="${fillA}"${fop}${stk}/>`;
    case 'ring': return `<circle r="${l.r}" fill="none"${stk}/>`;
    case 'line': return `<line x1="${-(l.w || 420) / 2}" y1="0" x2="${(l.w || 420) / 2}" y2="0" fill="none"${stk || ` stroke="${l.hue}" stroke-width="12" stroke-linecap="round" class="tp" data-len="${shapeLen(l).toFixed(1)}"`}/>`;
    case 'rect': { const w = l.w || 280, h = l.h || 180; return `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${Math.min(l.cr ?? 24, w / 2, h / 2)}" fill="${fillA}"${fop}${stk}/>`; }
    case 'star': case 'polygon': return `<polygon points="${polyOf(l).map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="${fillA}"${fop}${stk}/>`;
    case 'solid': return `<rect x="-960" y="-540" width="1920" height="1080" fill="${l.hue}"/>`;
    case 'shader': return `<rect x="-960" y="-540" width="1920" height="1080" fill="url(#shd-${l.id})" class="shph"/><foreignObject class="shfo" data-sh="${l.id}" x="-960" y="-540" width="1920" height="1080"></foreignObject>`;
    case 'audio': return '';
    case 'image': return `<image href="${l.src}" x="${-l.w / 2}" y="${-l.h / 2}" width="${l.w}" height="${l.h}"/>`;
    case 'draw': return `<g class="onion"></g><image class="cel" x="0" y="0" width="0" height="0" preserveAspectRatio="none" href="${BLANK}"/>`;
    case 'comp': return `<rect x="-300" y="-170" width="600" height="340" rx="10" fill="none" stroke="${l.hue}" stroke-width="4" stroke-dasharray="14 10"/><text text-anchor="middle" dominant-baseline="central" font-family="-apple-system, sans-serif" font-size="40" fill="${l.hue}">${esc(l.name)}</text>`;
    default: return `<rect x="-24" y="-24" width="48" height="48" fill="transparent"/>`;
  }
}
