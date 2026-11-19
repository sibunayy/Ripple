// @ts-nocheck
import { aud } from '../../playback/audio';
import { grid2, pf, sec, tc } from './controls';
import { FPS } from '../../model/project';

/** Audio layers: the whole inspector body (volume, mute, length). */
export function audioBody(l) {
    const a = aud[l.id];
    return sec('app', 'Audio', grid2([pf(l, 'lp', 0, 'vol', 'Volume', 0, 100, .4, '%', true)])
        + `<div class="rowt"><span class="hint" style="padding:0">Mute</span><button class="tog" data-act="amute" aria-pressed="${!!l.mute}" aria-label="Mute"></button></div>`
        + `<div class="kv"><span>Length</span><b class="tc">${tc(Math.round((l.adur || 0) * FPS))}</b></div>`
        + (a ? '' : '<p class="hint" style="padding:0;color:var(--danger)">The audio file is not loaded. Import it again after a reload.</p>')
        + '<p class="hint" style="padding:0">Plays in the preview. Drag the clip in the timeline to move it, or its ends to trim. Exports are silent.</p>');
}
