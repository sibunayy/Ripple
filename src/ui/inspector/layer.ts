// @ts-nocheck
import { BLENDS, propRow, selH } from './controls';

/** Layer section: opacity (can be keyframed) and blend mode. */
export function layerSection(l) {
  const layerSec = propRow(l, 'op') + `<div class="kv"><span>Blend mode</span>${selH('blend', 0, BLENDS, l.blend || 'normal', 'Blend mode')}</div>`;
  return layerSec;
}
