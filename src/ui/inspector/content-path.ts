import { capJoin, chip, dashF, trimRow } from './paint';
import { grid2, pf } from './controls';

/** Path layers: smooth, closed, fill; Stroke. */
export function pathContent(l) {
  let look, title, paint, paintTitle;
  const tg = (act, on, lbl) => `<div class="rowt"><span class="hint" style="padding:0;color:var(--text)">${lbl}</span><button class="tog" data-act="${act}" aria-pressed="${on}" aria-label="${lbl}"></button></div>`;
  title = 'Path';
  look = tg('pathsm', !!l.smooth, 'Smooth curves') + tg('pathcl', !!l.closed, 'Closed path') + (l.closed ? tg('pathfill', l.fill === true, 'Fill shape') : '');
  paintTitle = 'Stroke';
  paint = `<div class="fillrow">${chip(l, 'Stroke', 'hue')}${pf(l, 'lp', 0, 'sop', 'Opacity', 0, 100, .5, '%', true)}</div>`
    + grid2([pf(l, 'lp', 0, 'sw', 'Width', 0, 80, .2)].concat(dashF(l), capJoin(l))) + trimRow(l);
  return { title, look, paint, paintTitle };
}
