// @ts-nocheck
import { ic } from '../icons';
import { S, selIds } from '../../state/state';
import { TYPE_NAME } from '../left-panel';
import { esc } from '../../core/dom';

/** Inspector header: colour dot, layer type over the editable name, Hide / Lock / Solo toggles. */
export function inspectorHeader(l, multi) {
  const htog = (act, on, icn, lbl) => `<button class="ib ${on ? 'on' : ''}" data-act="${act}" data-v="${l.id}" aria-pressed="${on}" aria-label="${lbl}" title="${lbl}">${ic(icn, 's')}</button>`;
  const head = `<span class="chip-dot" style="background:${l.hue}"></span><div class="idn"><span class="ity" ${multi ? 'title="Edits apply to every selected layer"' : ''}>${multi ? selIds().length + ' layers · editing all' : (TYPE_NAME[l.type] || 'Layer') + ' layer'}</span><input class="lname" id="lname" value="${esc(l.name)}" aria-label="Layer name" placeholder="Layer name" enterkeyhint="done"></div>`
    + htog('vis', !l.vis, l.vis ? 'eye' : 'eyeoff', l.vis ? 'Hide layer' : 'Show layer')
    + htog('lock', !!l.lock, l.lock ? 'lock' : 'unlock', l.lock ? 'Unlock layer' : 'Lock layer')
    + htog('solo', S.solo.has(l.id), 'solo', S.solo.has(l.id) ? 'Stop soloing' : 'Solo: show only this layer');
  return head;
}
