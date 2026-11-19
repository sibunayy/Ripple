// @ts-nocheck
import { esc } from '../core/dom';
import { lay } from '../anim/interpolate';
import { S } from '../state/state';
import { SH, SHP, shLang } from './presets';
import { gpuState, shSource } from './runtime';
import { grid2, pf, selH } from '../ui/inspector/controls';

export function shaderLook(l) {
  const rt = SH[l.id], P = SHP[l.preset] || SHP.liquid, custom = !!l.code;
  const labels = custom ? ['Param 1', 'Param 2', 'Param 3', 'Param 4'] : P.ps;
  const status = !rt ? '' : rt.err ? `<p class="hint sherr" style="padding:0;color:var(--danger);white-space:pre-wrap">${esc(rt.err)}</p>` : `<p class="hint" style="padding:0">${rt.ok ? `Running ${rt.lang === 'wgsl' ? 'WGSL on WebGPU' : 'GLSL on WebGL'}` : 'Compiling…'}</p>`;
  return `<div class="kv"><span>Preset</span>${selH('shp', 0, [...(custom ? [['__custom', 'Custom code']] : []), ...Object.entries(SHP).map(([k, v]) => [k, v.name])], custom ? '__custom' : (l.preset || 'liquid'), 'Shader preset')}</div>`
    + status
    + grid2(labels.map((lb, k) => pf(l, 'lp', 0, 'sp' + k, lb, 0, 1, .005, '')).concat([pf(l, 'lp', 0, 'spd', 'Speed', 0, 400, 1, '%')]))
    + `<div class="two">${['hue', 'hue2'].map((k, i) => { const cv = l[k] || '#ffffff'; return `<button class="cchip" data-act="colour" data-key="${k}" aria-haspopup="dialog" aria-label="Colour ${i ? 'B' : 'A'} ${cv}"><span class="cc" style="background:${cv}"></span><span>Colour ${i ? 'B' : 'A'}</span></button>`; }).join('')}</div>`
    + `<div class="rowt"><span class="hint" style="padding:0">Opaque (ignore shader alpha)</span><button class="tog" data-act="shopaque" aria-pressed="${l.opaque !== false}" aria-label="Opaque"></button></div>`
    + `<div class="two"><button class="line-btn" data-act="shedit">Edit code</button><button class="line-btn" data-act="shimport">Import shader…</button></div>`;
}
export function shaderDialog() {
  const l = lay(S.sel); if (!l || l.type !== 'shader') return '<h2>Shader</h2><p class="hint">Select a shader layer first.</p><div class="foot"><button class="primary" data-act="close">Close</button></div>';
  const rt = SH[l.id], imp = S.shImport, src = S.shDraft ?? (imp ? '' : shSource(l).code), lang = src.trim() ? shLang(src) : null;
  return `<h2>${imp ? 'Import shader' : 'Shader code'}</h2>
    ${imp ? `<p class="hint" style="padding:0">Paste a community shader. <b>Shadertoy</b>: open the shader, copy the code from its <i>Image</i> tab and paste it here. Single-pass shaders using iTime, iResolution and iMouse work best. Buffer tabs aren't supported, and iChannel0–3 get a noise texture. <b>WGSL</b> (WebGPU): write <code>fn mainImage(fragCoord: vec2f) -&gt; vec4f</code> using <code>u.res</code>, <code>u.time</code>, <code>u.params</code>, <code>u.color1</code> and <code>u.color2</code>.</p>` : ''}
    <textarea id="shcode" class="shcode" spellcheck="false" autocapitalize="off" autocorrect="off" aria-label="Shader code" placeholder="Paste GLSL (mainImage) or WGSL code">${esc(src)}</textarea>
    <div class="kv" style="min-height:0"><span>Language</span><b>${lang ? (lang === 'wgsl' ? 'WGSL · WebGPU' : 'GLSL · WebGL') : '—'}</b></div>
    ${lang === 'wgsl' && gpuState !== 'ok' ? '<p class="hint" style="padding:0;color:var(--danger)">WebGPU isn\'t available in this browser, so WGSL code can\'t run here.</p>' : ''}
    ${rt && rt.err && !imp ? `<p class="hint sherr" style="padding:0;color:var(--danger);white-space:pre-wrap">${esc(rt.err)}</p>` : ''}
    <div class="foot">${l.code ? '<button class="line-btn ghost" data-act="shrevert">Back to preset</button>' : ''}<button class="line-btn ghost" data-act="close">Cancel</button><button class="primary" data-act="shapply">Apply</button></div>`;
}
