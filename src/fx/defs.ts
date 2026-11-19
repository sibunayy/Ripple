
/* ---- effects ---- */
// ps: [key, label, min, max, step per point, unit, default]
export const FXDEF = {
  glow: { name: 'Glow', ps: [['radius', 'Radius', 0, 80, .25, '', 18], ['amount', 'Amount', 0, 100, .5, '%', 70]] },
  shadow: { name: 'Drop shadow', ps: [['radius', 'Blur', 0, 80, .25, '', 20], ['amount', 'Opacity', 0, 100, .5, '%', 60]] },
  outline: { name: 'Outline', ps: [['radius', 'Width', 1, 40, .15, '', 6], ['amount', 'Opacity', 0, 100, .5, '%', 100]] },
  blur: { name: 'Gaussian blur', ps: [['radius', 'Radius', 0, 80, .25, '', 10]] },
  dirblur: { name: 'Directional blur', ps: [['radius', 'Length', 0, 120, .4, '', 30], ['amount', 'Angle', 0, 180, .5, '°', 0]] },
  ripple: { name: 'Ripple distort', ps: [["amount", "Strength", 0, 100, .4, "", 25], ["radius", "Size", 1, 100, .3, "", 40], ['speed', 'Speed', 0, 100, .5, '', 30]] },
  hue: { name: 'Hue shift', ps: [['amount', 'Angle', 0, 360, 1, '°', 90]] },
  sat: { name: 'Saturation', ps: [['amount', 'Amount', 0, 200, .7, '%', 130]] },
  bright: { name: 'Brightness', ps: [['amount', 'Amount', 0, 200, .7, '%', 120]] },
  bloom: { name: 'Bloom', ps: [['radius', 'Radius', 0, 100, .3, '', 30], ['amount', 'Intensity', 0, 200, .7, '%', 90], ['thresh', 'Threshold', 0, 100, .4, '%', 55]] },
  halftone: { name: 'Halftone', ps: [['radius', 'Dot size', 4, 60, .15, '', 14], ['amount', 'Density', 10, 300, .8, '%', 120]] },
  roughen: { name: 'Roughen edges', ps: [['amount', 'Border', 0, 60, .2, '', 12], ['radius', 'Scale', 1, 100, .3, '', 30], ['speed', 'Evolve', 0, 30, .1, ' fps', 0]] },
  rgbsplit: { name: 'RGB split', ps: [['radius', 'Offset', 0, 60, .2, '', 8], ['amount', 'Angle', 0, 360, 1, '°', 0]] },
  grain: { name: 'Film grain', ps: [['amount', 'Amount', 0, 100, .4, '%', 35], ['radius', 'Size', 1, 100, .3, '', 50]] },
  posterize: { name: 'Posterize colour', ps: [['amount', 'Levels', 2, 16, .06, '', 4]] },
  invert: { name: 'Invert', ps: [['amount', 'Amount', 0, 100, .5, '%', 100]] },
  duotone: { name: 'Duotone', ps: [['hue1', 'Shadow hue', 0, 360, 1, '°', 250], ['hue2', 'Highlight hue', 0, 360, 1, '°', 40], ['amount', 'Mix', 0, 100, .5, '%', 100]] },
  tint: { name: 'Tint', ps: [['hue1', 'Hue', 0, 360, 1, '°', 30], ['amount', 'Amount', 0, 100, .5, '%', 70]] },
  pixelate: { name: 'Pixelate', ps: [['radius', 'Block size', 2, 80, .2, '', 16]] },
  glitch: { name: 'Glitch', ps: [['amount', 'Strength', 0, 200, .6, '', 60], ['radius', 'Slices', 1, 100, .3, '', 30], ['speed', 'Rate', 0, 30, .1, ' fps', 12]] },
  longshadow: { name: 'Long shadow', ps: [['radius', 'Length', 0, 400, 1, '', 120], ['amount', 'Angle', 0, 360, 1, '°', 45], ['op', 'Opacity', 0, 100, .5, '%', 35]] },
  vignette: { name: 'Vignette', ps: [['amount', 'Amount', 0, 100, .5, '%', 60], ['radius', 'Size', 10, 100, .4, '%', 55]] },
  postime: { name: 'Posterize time', ps: [['amount', 'Frame rate', 1, 30, .08, ' fps', 8]] },
};
export const HT_TILE = (c) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${c}" height="${c}"><defs><radialGradient id="g"><stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><rect width="${c}" height="${c}" fill="url(#g)"/></svg>`);
export const hsl = (h, s = .75, L = .55) => { const k = (n) => (n + h / 30) % 12, a = s * Math.min(L, 1 - L); return [0, 8, 4].map((n) => L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))); };
export const VIG = (sz) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><radialGradient id="g" cx="50%" cy="50%" r="75%"><stop offset="${(sz / 100 * .9).toFixed(2)}" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="1"/></radialGradient></defs><rect width="1920" height="1080" fill="url(#g)"/></svg>`);
export const postT = (l, f) => { const e = !l.fxOff && l.fx.find((x) => x.on && x.id === 'postime'); if (!e) return f; const st = 30 / Math.max(1, e.amount || 8); return Math.floor(f / st) * st; };
export const rippleBF = (e) => 0.05 / (1 + (e.radius ?? 30) * 0.12);
