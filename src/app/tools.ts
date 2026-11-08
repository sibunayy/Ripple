// Tool state for the viewer (spec §9): select, hand, shape primitives, pen, text.
import { signal } from '@preact/signals';
import type { BezPath } from '../model/layer';
import { addShape, current, editablePath, selection, setPath } from './state';
import { removeNode } from '../shape/path';
import type { IconName } from '../ui/Icon';

export type Tool = 'select' | 'hand' | 'rect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'pen' | 'text';
export const TOOLS: { id: Tool; icon: IconName; label: string; key: string }[] = [
  { id: 'select', icon: 'mouse-pointer-2', label: 'Select', key: 'V' },
  { id: 'hand', icon: 'hand', label: 'Hand', key: 'H' },
  { id: 'rect', icon: 'square', label: 'Rectangle', key: 'R' },
  { id: 'ellipse', icon: 'circle', label: 'Ellipse', key: 'E' },
  { id: 'polygon', icon: 'pentagon', label: 'Polygon', key: 'Y' },
  { id: 'star', icon: 'star', label: 'Star', key: 'S' },
  { id: 'line', icon: 'slash', label: 'Line', key: 'L' },
  { id: 'pen', icon: 'pen-tool', label: 'Pen', key: 'P' },
  { id: 'text', icon: 'type', label: 'Text', key: 'T' },
];
export const tool = signal<Tool>('select');
/** Selected node of the selected path layer. */
export const nodeSel = signal<number | null>(null);
/** In-progress pen/line path in COMP coordinates (not part of the document until finished). */
export const penDraft = signal<BezPath | null>(null);
/** Layer id whose text is being edited on canvas. */
export const editingText = signal<string | null>(null);

export function setTool(t: Tool) {
  if (tool.peek() === 'pen' && t !== 'pen') cancelPen();
  tool.value = t;
  nodeSel.value = null;
  editingText.value = null;
}

export function finishPen(close = false) {
  const d = penDraft.peek();
  penDraft.value = null;
  if (d && d.nodes.length >= 2) addShape('path', [0, 0], { ...d, closed: close });
  tool.value = 'select';
}
export const cancelPen = () => { penDraft.value = null; };

/** Delete the selected node of the selected path layer. Returns true if something was handled. */
export function deleteSelectedNode(): boolean {
  const n = nodeSel.peek(), id = selection.peek()[0];
  const l = current.peek()?.layers.find((x) => x.id === id);
  const e = l && editablePath(l);
  if (n === null || !l || !e) return false;
  setPath(l.id, removeNode(e.path, n), 'node-del');
  nodeSel.value = null;
  return true;
}
