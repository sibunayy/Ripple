import { S } from '../../state/state';
import { store } from '../../core/store';
import { buildCanvas, gEls, layoutStage, stage, vp } from '../../render/stage';
import { renderRight } from '../../ui/inspector/index';
import { renderFloats } from '../../ui/floats';
import { fitSelOn, setFitSelOn } from '../../events/delegate';
import { A } from '../index';

/** Canvas view: zoom, fit, snap and guides. Keys are data-act names. */
export const viewActions = {
  guide: (el) => { S.guide = el.dataset.v; store.set('guide', S.guide); buildCanvas(); renderRight(); renderFloats(); },
  zoom: (el) => { S.zoom = Math.max(.25, Math.min(6, S.zoom * +el.dataset.v)); layoutStage(); },
  fit: () => {
    /* One control for both: tap fits the selection (when there is one); tap again returns to the whole workspace. */
    if (S.sel && gEls[S.sel] && !fitSelOn) { A.fitsel(); return; }
    setFitSelOn(false); S.zoom = 1; S.pan = [0, 0]; layoutStage();
  },
  zslide: (el) => { S.zoom = Math.max(.25, Math.min(6, Math.exp(+el.value))); layoutStage(); },
  fitsel: () => {
    const g = S.sel && gEls[S.sel]; if (!g) return A.fit();
    S.zoom = 1; S.pan = [0, 0]; layoutStage(); setFitSelOn(true);
    const r = g.getBoundingClientRect(), s = stage.getBoundingClientRect();
    const k = Math.min(4, Math.min(vp.clientWidth / (r.width * 1.6), vp.clientHeight / (r.height * 1.6)));
    S.zoom *= k; S.pan = [0, 0]; layoutStage();
    const s2 = stage.getBoundingClientRect(), cx = (r.left + r.width / 2 - s.left) / s.width, cy = (r.top + r.height / 2 - s.top) / s.height;
    const v = vp.getBoundingClientRect();
    S.pan = [v.width / 2 - (s2.left - v.left + cx * s2.width), v.height / 2 - (s2.top - v.top + cy * s2.height)]; layoutStage();
  },
  snap: () => { S.snap = !S.snap; renderFloats(); },
};
