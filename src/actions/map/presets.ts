import { applyMine, applyPreset, savePreset } from '../presets';
import { store } from '../../core/store';
import { myPresets } from '../../ui/presets';
import { renderRight } from '../../ui/inspector/index';
import { toast } from '../../ui/toast';
import { S } from '../../state/state';

/** Motion presets and saved presets. Keys are data-act names. */
export const presetsActions = {
  psave: () => savePreset(),
  mypreset: (el) => applyMine(el.dataset.v),
  mypdel: (el) => { store.set('myPresets', myPresets().filter((p) => p.id !== el.dataset.v)); renderRight(); toast('Preset deleted'); },
  popt: (el) => { S[el.dataset.k] = el.dataset.v; renderRight(); },
  popreset: () => { Object.assign(S, { pDur: 100, pAmt: 100, pDir: 'up', pAt: 'head', pStag: 0 }); renderRight(); },
  preset: (el) => applyPreset(el.dataset.v),
};
