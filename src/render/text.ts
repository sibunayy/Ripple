import { esc } from '../core/dom';
import { fillVal } from './shapes';

export const FONTS = [['sys', 'SF Pro', "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif"], ['hn', 'Helvetica Neue', "'Helvetica Neue', Helvetica, Arial, sans-serif"], ['avn', 'Avenir Next', "'Avenir Next', Avenir, sans-serif"], ['fut', 'Futura', "Futura, 'Trebuchet MS', sans-serif"], ['gill', 'Gill Sans', "'Gill Sans', sans-serif"], ['opt', 'Optima', 'Optima, sans-serif'], ['verd', 'Verdana', 'Verdana, sans-serif'], ['treb', 'Trebuchet MS', "'Trebuchet MS', sans-serif"], ['impact', 'Impact', "Impact, 'Arial Narrow Bold', sans-serif"], ['georgia', 'Georgia', 'Georgia, serif'], ['times', 'Times New Roman', "'Times New Roman', Times, serif"], ['pal', 'Palatino', "Palatino, 'Palatino Linotype', serif"], ['bask', 'Baskerville', 'Baskerville, serif'], ['didot', 'Didot', "Didot, 'Bodoni 72', serif"], ['rock', 'Rockwell', 'Rockwell, serif'], ['amtype', 'American Typewriter', "'American Typewriter', serif"], ['mono', 'Menlo', "Menlo, 'SF Mono', monospace"], ['courier', 'Courier New', "'Courier New', monospace"], ['marker', 'Marker Felt', "'Marker Felt', 'Comic Sans MS', fantasy"]];
export const WNAME = { 300: 'Light', 400: 'Regular', 500: 'Medium', 650: 'Semibold', 700: 'Bold', 800: 'Heavy', 900: 'Black' };
const FW = { sys: [300, 400, 500, 650, 700, 800, 900], hn: [300, 400, 500, 700], avn: [400, 500, 650, 700, 800], fut: [500, 700], gill: [300, 400, 700], opt: [400, 700, 900], verd: [400, 700], treb: [400, 700], impact: [400], georgia: [400, 700], times: [400, 700], pal: [400, 700], bask: [400, 650, 700], didot: [400, 700], rock: [400, 700], amtype: [300, 400, 700], mono: [400, 700], courier: [400, 700], marker: [400] };
export const fontWeights = (l) => FW[(FONTS.find((f) => f[0] === l.font) || FONTS[0])[0]] || [400, 700];
export const snapW = (l) => fontWeights(l).reduce((b, w) => Math.abs(w - l.weight) < Math.abs(b - l.weight) ? w : b);
export function textSvg(l) {
  const F = FONTS.find((f) => f[0] === l.font) || FONTS[0], lead = (l.lead ?? 120) / 100, size = +l.size || 100;
  let t = String(l.text ?? '');
  if (l.tcase === 'upper') t = t.toUpperCase(); else if (l.tcase === 'lower') t = t.toLowerCase(); else if (l.tcase === 'title') t = t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const lines = t.split('\n'), n = lines.length, anchor = { left: 'start', center: 'middle', right: 'end' }[l.align || 'center'] || 'middle';
  let ci = 0; const per = (l.anims || []).length;
  const inner = (ln) => per && ln ? [...ln].map((ch) => `<tspan data-ci="${ci++}">${esc(ch)}</tspan>`).join('') : (esc(ln) || '&#160;');
  const tsp = lines.map((ln, i) => `<tspan x="0" dy="${(i === 0 ? -(n - 1) * lead * size / 2 : lead * size).toFixed(2)}">${inner(ln)}</tspan>`).join('');
  return `<text text-anchor="${anchor}" dominant-baseline="central" font-family="${esc(F[2]).replace(/'/g, '&#39;')}" font-size="${size}" font-weight="${snapW(l)}"${l.italic ? ' font-style="italic"' : ''}${l.under || l.strike ? ` text-decoration="${[l.under ? 'underline' : '', l.strike ? 'line-through' : ''].join(' ').trim()}"` : ''}${l.wsp ? ` word-spacing="${l.wsp}"` : ''}${(l.fop ?? 100) < 100 ? ` fill-opacity="${(l.fop / 100).toFixed(2)}"` : ''} letter-spacing="${l.track}" fill="${fillVal(l)}"${l.tsw > 0 ? ` stroke="${l.tsc || '#ffffff'}" stroke-width="${l.tsw}" stroke-linejoin="round" paint-order="stroke"` : ''}>${tsp}</text>`;
}
