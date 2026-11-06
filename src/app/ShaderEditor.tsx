import { GALLERY, shaderErrors } from '../render/shader';

/** GLSL editor: plain textarea (tab inserts spaces), starter gallery, and compile errors with user line numbers. */
export function ShaderEditor({ code, onCode }: { code: string; onCode: (c: string) => void }) {
  const errs = shaderErrors.value[code];
  return (
    <div class="shader-ed">
      <label class="prop"><span class="pname">Starter</span><span />
        <div class="fields one"><select aria-label="Shader starter" value="" onChange={(e) => { const g = GALLERY.find((x) => x.name === (e.target as HTMLSelectElement).value); if (g) onCode(g.code); (e.target as HTMLSelectElement).value = ''; }}>
          <option value="">Load example…</option>{GALLERY.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
        </select></div></label>
      <textarea class="code" aria-label="Shader code" spellcheck={false} autocapitalize="off" autocorrect="off" rows={14} value={code}
        onInput={(e) => onCode((e.target as HTMLTextAreaElement).value)}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          e.preventDefault();
          const t = e.target as HTMLTextAreaElement, s = t.selectionStart;
          onCode(t.value.slice(0, s) + '  ' + t.value.slice(t.selectionEnd));
          requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
        }} />
      {errs?.length ? <ul class="shader-errors" role="alert">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p class="hint">GLSL ES 3.0 · <code>void mainImage(out vec4 fragColor, in vec2 fragCoord)</code> · uniforms: iResolution, iTime, iFrame, iChannel0. Declare controls with <code>// @uniform name float min max default</code>.</p>}
    </div>
  );
}
