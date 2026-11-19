// @ts-nocheck
import { advHtml, behHtml, normShape, repHtml } from './extras';
import { selIds } from '../../state/state';
import { inspectorHeader } from './header';
import { audioBody } from './content-audio';
import { transformSection } from './transform';
import { layerSection } from './layer';
import { textContent } from './content-text';
import { shapeContent } from './content-shape';
import { pathContent } from './content-path';
import { shaderLook } from '../../shader/ui';
import { chip } from './paint';
import { drawHtml } from './drawing';
import { TYPE_NAME } from '../left-panel';
import { sec } from './controls';
import { animHtml } from '../text-animators';
import { repN } from '../../anim/pose';

/** The Properties tab: header, then the sections in the v8 order (HANDOFF section 8). */
export function propsView(l) {
  normShape(l);
  const multi = selIds().length > 1;
  const head = inspectorHeader(l, multi);
  if (l.type === 'audio') return { head, body: audioBody(l) };
  const tf = transformSection(l, multi);
  const layerSec = layerSection(l);
  let look, title = 'Appearance', paint = '', paintTitle = '';
  if (l.type === 'text') ({ title, look, paint, paintTitle } = textContent(l));
  else if (['ellipse', 'ring', 'rect', 'star', 'polygon', 'line'].includes(l.type)) ({ title, look, paint, paintTitle } = shapeContent(l));
  else if (l.type === 'path') ({ title, look, paint, paintTitle } = pathContent(l));
  else if (l.type === 'shader') { title = 'Shader'; look = shaderLook(l); }
  else if (['solid', 'comp'].includes(l.type)) { title = 'Fill'; look = chip(l, 'Fill', 'hue'); }
  else if (l.type === 'draw') { title = 'Drawing'; look = drawHtml(l); }
  else look = `<p class="hint" style="padding:0">${TYPE_NAME[l.type]} layers have no fill or stroke.</p>`;
  const nm = (l.mods || []).length;
  const body = sec('tf', 'Transform', tf)
    + sec('cmp', 'Layer', layerSec)
    + sec('app', title, look)
    + (paint ? sec('fill', paintTitle, paint) : '')
    + (l.type === 'text' ? sec('tanim', 'Text animators', animHtml(l), (l.anims || []).length ? `<span class="count">${l.anims.length}</span>` : '') : '')
    + sec('rep', 'Duplicator', repHtml(l), l.rep && l.rep.on ? `<span class="count">${repN(l)} copies</span>` : '')
    + sec('beh', 'Behaviours', behHtml(l), nm ? `<span class="count">${nm}</span>` : '')
    + sec('adv', 'Timing & links', advHtml(l));
  return { head, body };
}
