// @ts-nocheck
import { grid2, pf } from './controls';
import { capJoin, chip, dashF, gradUi, grpHead, trimRow } from './paint';

/** Shape layers (rect, ellipse, polygon, star, line, ring): geometry; Fill & stroke or Stroke. */
export function shapeContent(l) {
  let look, title, paint, paintTitle;
  const P = { rect: [['w', 'Width', 10, 1800, 1.5], ['h', 'Height', 10, 1200, 1.5], ['cr', 'Corner', 0, 200, .5]], ellipse: [['r', 'Radius', 2, 600, 1]], ring: [['r', 'Radius', 2, 600, 1]], star: [['n', 'Points', 3, 12, .08, '', 1], ['ir', 'Inner', 5, 95, .3, '%']], polygon: [['n', 'Sides', 3, 12, .08, '', 1]], line: [['w', 'Length', 20, 1800, 1.5]] }[l.type];
  const strokeOnly = l.type === 'ring' || l.type === 'line';
  if (!l.sc) l.sc = '#ffffff';
  title = 'Shape';
  look = grid2(P.map(([k, lb, mn, mx, sp, u, int]) => pf(l, 'lp', 0, k, lb, mn, mx, sp, u || '', !!int)));
  paintTitle = strokeOnly ? 'Stroke' : 'Fill & stroke';
  const strokeBody = `<div class="fillrow">${chip(l, 'Stroke', strokeOnly ? 'hue' : 'sc')}${pf(l, 'lp', 0, 'sop', 'Opacity', 0, 100, .5, '%', true)}</div>`
    + grid2([pf(l, 'lp', 0, 'sw', 'Width', 0, 80, .2)].concat(dashF(l), strokeOnly ? [] : capJoin(l))) + trimRow(l);
  paint = strokeOnly ? strokeBody
    : grpHead('Fill', 'fillon', l.fill !== false) + (l.fill !== false ? `<div class="fillrow">${chip(l, 'Fill', 'hue')}${pf(l, 'lp', 0, 'fop', 'Opacity', 0, 100, .5, '%', true)}</div>` + gradUi(l) : '')
      + `<div class="sublbl">Stroke</div>` + strokeBody;
  return { title, look, paint, paintTitle };
}
