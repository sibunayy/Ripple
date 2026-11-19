import { penFinish, penUndo } from '../../gestures/canvas';
import { S } from '../../state/state';
import { drawOverlay } from '../../drawing/overlay';
import { renderFloats } from '../../ui/floats';
import { lay } from '../../anim/interpolate';
import { commit } from '../../state/history';
import { buildCanvas } from '../../render/stage';
import { renderRight } from '../../ui/inspector/index';

/** Pen tool and path options. Keys are data-act names. */
export const penActions = {
  pendone: () => penFinish(false),
  penclose: () => penFinish(true),
  penundo: () => penUndo(),
  pencancel: () => { S.penPts = []; drawOverlay(); renderFloats(); },
  pathsm: () => { const l = lay(S.sel); if (!l) return; l.smooth = !l.smooth; commit('Smooth path'); buildCanvas(); renderRight(); },
  pathcl: () => { const l = lay(S.sel); if (!l) return; l.closed = !l.closed; if (!l.closed) l.fill = false; commit('Close path'); buildCanvas(); renderRight(); },
  pathfill: () => { const l = lay(S.sel); if (!l) return; l.fill = !(l.fill === true); commit('Path fill'); buildCanvas(); renderRight(); },
};
