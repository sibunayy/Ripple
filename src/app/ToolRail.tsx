// Vertical tool rail (concept 1 v3): one 44 pt button per tool, Pencil/thumb reachable on the left edge.
import { Icon } from '../ui/Icon';
import { finishPen, penDraft, setTool, tool, TOOLS } from './tools';
import { drawerOpen } from './uistate';

export function ToolRail() {
  const cur = tool.value, draft = penDraft.value;
  return (
    <div class="rail" role="toolbar" aria-label="Tools">
      {TOOLS.map((t) => (
        <button key={t.id} class={`tool-btn ${cur === t.id ? 'on' : ''}`} aria-pressed={cur === t.id}
          title={`${t.label} · ${t.key}`} aria-label={t.label} onClick={() => setTool(t.id)}>
          <Icon name={t.icon} size={20} />
        </button>
      ))}
      {draft && (
        <div class="rail-group">
          <button class="tool-btn" aria-label="Finish path" title="Finish path" onClick={() => finishPen(false)}><Icon name="check" size={20} /></button>
          <button class="tool-btn" aria-label="Close path" title="Close path" disabled={draft.nodes.length < 3} onClick={() => finishPen(true)}><Icon name="circle-dot" size={20} /></button>
        </div>
      )}
      <span class="rail-spacer" />
      <button class="tool-btn" aria-label="Toggle presets drawer" title="Presets drawer" aria-pressed={drawerOpen.value}
        onClick={() => (drawerOpen.value = !drawerOpen.value)}>
        <Icon name="panel-left" size={20} />
      </button>
    </div>
  );
}
