import { lay } from '../../anim/interpolate';
import { S } from '../../state/state';
import { commit } from '../../state/history';
import { buildCanvas, updateCanvas } from '../../render/stage';
import { renderRight } from '../../ui/inspector/index';
import { renderDialog } from '../../ui/dialog';
import { renderAll } from '../../ui/layout';
import { $ } from '../../core/dom';
import { toast } from '../../ui/toast';
import { SH } from '../../shader/presets';

/** Shader layer code dialog. Keys are data-act names. */
export const shaderActions = {
  shopaque: () => { const l = lay(S.sel); if (!l) return; l.opaque = l.opaque === false; commit('Shader alpha'); updateCanvas(); renderRight(); },
  shedit: () => { S.shImport = false; S.shDraft = null; S.dialog = 'shader'; renderDialog(); },
  shimport: () => { S.shImport = true; S.shDraft = ''; S.dialog = 'shader'; renderDialog(); },
  shrevert: () => { const l = lay(S.sel); if (!l) return; delete l.code; commit('Shader preset'); S.dialog = null; S.shDraft = null; buildCanvas(); renderAll(); renderDialog(); },
  shapply: () => {
    const l = lay(S.sel), ta = $('#shcode'); if (!l || !ta) return;
    const code = ta.value.trim(); if (!code) { toast('Paste some shader code first.'); return; }
    if (!/mainImage/.test(code)) { toast('No mainImage function found. Shadertoy code needs mainImage; WGSL needs fn mainImage(fragCoord: vec2f) -> vec4f.'); return; }
    l.code = code; if (S.shImport) { const m = /^\s*\/\/\s*(.{2,40})$/m.exec(code); l.name = m ? m[1].trim() : 'Imported shader'; }
    commit(S.shImport ? 'Import shader' : 'Edit shader'); S.shImport = false; S.shDraft = code; buildCanvas(); renderAll();
    const rt = SH[l.id];
    if (rt && rt.ok) { S.dialog = null; S.shDraft = null; toast(`Shader running (${rt.lang === 'wgsl' ? 'WebGPU' : 'WebGL'})`); }
    renderDialog();
  },
};
