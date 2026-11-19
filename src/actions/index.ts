// @ts-nocheck
import { appActions } from './map/app';
import { proceduralActions } from './map/procedural';
import { presetsActions } from './map/presets';
import { shaderActions } from './map/shader';
import { penActions } from './map/pen';
import { keysActions } from './map/keys';
import { exportActions } from './map/export';
import { drawingActions } from './map/drawing';
import { layersActions } from './map/layers';
import { inspectorActions } from './map/inspector';
import { effectsActions } from './map/effects';
import { timelineActions } from './map/timeline';
import { viewActions } from './map/view';

/**
 * Every tap action, keyed by its data-act name. events/delegate.ts calls A[el.dataset.act](el, event).
 * The handlers live in ./map/, one file per area.
 */
export const A = {
  ...appActions,
  ...proceduralActions,
  ...presetsActions,
  ...shaderActions,
  ...penActions,
  ...keysActions,
  ...exportActions,
  ...drawingActions,
  ...layersActions,
  ...inspectorActions,
  ...effectsActions,
  ...timelineActions,
  ...viewActions,
};
