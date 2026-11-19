// @ts-nocheck
import { S } from '../../state/state';
import { renderTL } from '../../ui/timeline';
import { toast } from '../../ui/toast';
import { DUR, markers } from '../../model/project';
import { play } from '../../playback/loop';
import { commit } from '../../state/history';
import { renderRight } from '../../ui/inspector/index';
import { tc } from '../../ui/inspector/controls';
import { seek } from '../../ui/layout';

/** Timeline, playback and markers. Keys are data-act names. */
export const timelineActions = {
  loopt: () => { S.loop = !S.loop; renderTL(); toast(S.loop ? 'Loop on' : 'Loop off: playback stops at the end'); },
  wareset: () => { S.wa = [0, DUR]; renderTL(); },
  twirl: (el, e) => { e.stopPropagation(); const id = el.dataset.v; S.open.has(id) ? S.open.delete(id) : S.open.add(id); renderTL(); },
  play: () => play(),
  tlmode: (el) => { S.tlMode = el.dataset.v; renderTL(); },
  marker: () => { markers.push({ f: Math.round(S.f), name: 'Marker ' + (markers.length + 1) }); markers.sort((a, b) => a.f - b.f); commit('Add marker'); renderTL(); renderRight(); toast('Marker added at ' + tc(S.f) + '. Rename it in the Composition panel.'); },
  mkjump: (el) => { const m = markers[+el.dataset.v]; if (m) { if (S.playing) play(false); seek(m.f); } },
  mkdel: (el) => { markers.splice(+el.dataset.v, 1); commit('Delete marker'); renderTL(); renderRight(); },
  step: (el) => { if (S.playing) play(false); seek(Math.round(S.f) + +el.dataset.v); renderTL(); },
};
