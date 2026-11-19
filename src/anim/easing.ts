
/* ---------- easing ---------- */
export const EASES = { hold: [0, 0, 1, 1], linear: [0, 0, 1, 1], ease: [.25, .1, .25, 1], out: [0, 0, .58, 1], in: [.42, 0, 1, 1], inout: [.42, 0, .58, 1], back: [.34, 1.56, .64, 1], snap: [.7, 0, .2, 1], anticip: [.36, -0.5, .6, 1], bounce: [.2, 1.8, .5, .8] };
export const EASE_NAMES = { hold: 'Hold', linear: 'Linear', ease: 'Ease', out: 'Ease out', in: 'Ease in', inout: 'In & out', back: 'Back out', snap: 'Snap', anticip: 'Anticipate', bounce: 'Overshoot' };
export const EASE_ROW = ['linear', 'ease', 'out', 'in', 'inout', 'back', 'snap', 'anticip', 'bounce', 'hold'];
export const earr = (k) => Array.isArray(k.e) ? k.e : EASES[k.e || 'linear'];
export const ename = (k) => Array.isArray(k.e) ? 'Custom' : EASE_NAMES[k.e || 'linear'];
export function bez(a) {
  const [x1, y1, x2, y2] = a;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (u) => ((ax * u + bx) * u + cx) * u, Y = (u) => ((ay * u + by) * u + cy) * u;
  return (t) => { let lo = 0, hi = 1; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (X(m) < t) lo = m; else hi = m; } return Y((lo + hi) / 2); };
}
export const easeGlyph = (a) => a === EASES.hold ? '<svg viewBox="0 0 34 22" aria-hidden="true"><path d="M3 19H31V3"/></svg>' : `<svg viewBox="0 0 34 22" aria-hidden="true"><path d="M3 19C${3 + a[0] * 28} ${19 - a[1] * 16} ${3 + a[2] * 28} ${19 - a[3] * 16} 31 3"/></svg>`;
