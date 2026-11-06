import { setTool } from './tools';
import { addShaderLayer, importMedia, addAdjustment, addComp, precompose, addLayer, current, deleteLayers, duplicateLayers, moveLayer, renameLayer, selection, setParent, toggleVisible } from './state';

export function LayersPanel() {
  const p = current.value!;
  const sel = selection.value;
  return (
    <>
      <div class="panel-head">
        <h2>Layers</h2>
        <span class="spacer" />
        <button class="btn sm" onClick={() => addLayer('solid')} aria-label="Add solid layer">＋ Solid</button>
        <button class="btn sm" onClick={() => addLayer('null')} aria-label="Add null layer">＋ Null</button>
        <button class="btn sm" onClick={() => setTool('rect')} aria-label="Draw a shape">＋ Shape</button>
        <button class="btn sm" onClick={() => setTool('text')} aria-label="Add text">＋ Text</button>
        <button class="btn sm" onClick={addAdjustment} aria-label="Add adjustment layer">＋ Adjust</button>
        <button class="btn sm" onClick={addShaderLayer} aria-label="Add shader layer">＋ Shader</button>
        <button class="btn sm" onClick={addComp} aria-label="Add composition">＋ Comp</button>
        <label class="btn sm filebtn" aria-label="Import media">＋ Media
          <input type="file" multiple accept="image/*,video/*,.svg,.heic,.avif" hidden onChange={(e) => { const fs = Array.from((e.target as HTMLInputElement).files ?? []); if (fs.length) void importMedia(fs); (e.target as HTMLInputElement).value = ''; }} />
        </label>
      </div>
      {p.layers.length === 0 && <p class="hint">Add a solid to get started.</p>}
      <ul class="layers">
        {p.layers.map((l, i) => {
          const on = sel.includes(l.id);
          return (
            <li key={l.id} class={on ? 'on' : ''}>
              <div class="row1" onClick={(e) => { selection.value = e.shiftKey ? (on ? sel.filter((x) => x !== l.id) : [...sel, l.id]) : [l.id]; }}>
                <button class={`eye ${l.visible ? '' : 'off'}`} aria-label={l.visible ? 'Hide layer' : 'Show layer'} aria-pressed={l.visible}
                  onClick={(e) => { e.stopPropagation(); toggleVisible(l.id); }}>{l.visible ? '●' : '○'}</button>
                <i class="chip" title={l.type} style={{ background: l.type === 'solid' || l.type === 'shape' || l.type === 'precomp' || l.type === 'image' || l.type === 'video' ? `rgb(${l.color.slice(0, 3).map((c) => Math.round(c * 255)).join()})` : 'transparent' }}>{({ text: 'T', adjustment: '◐', precomp: '▣', shader: '◈', image: '▨', video: '▶︎' } as Record<string, string>)[l.type] ?? ''}</i>
                <input class="name" value={l.name} aria-label="Layer name" onClick={(e) => e.stopPropagation()}
                  onChange={(e) => renameLayer(l.id, (e.target as HTMLInputElement).value)} />
              </div>
              {on && (
                <div class="row2">
                  <select aria-label="Parent layer" value={l.parent ?? ''} onChange={(e) => setParent(l.id, (e.target as HTMLSelectElement).value || undefined)}>
                    <option value="">No parent</option>
                    {p.layers.filter((o) => o.id !== l.id).map((o) => <option key={o.id} value={o.id}>↳ {o.name}</option>)}
                  </select>
                  <button class="btn sm" disabled={i === 0} onClick={() => moveLayer(l.id, -1)} aria-label="Move layer up">↑</button>
                  <button class="btn sm" disabled={i === p.layers.length - 1} onClick={() => moveLayer(l.id, 1)} aria-label="Move layer down">↓</button>
                  <button class="btn sm" onClick={() => duplicateLayers([l.id])} aria-label="Duplicate layer">⧉</button>
                  <button class="btn sm" onClick={() => precompose(sel)} aria-label="Pre-compose selected layers">▣</button>
                  <button class="btn sm danger" onClick={() => deleteLayers([l.id])} aria-label="Delete layer">✕</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
