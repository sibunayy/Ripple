// Undo/redo via document snapshots. The document is treated as immutable with structural
// sharing, so a snapshot is a pointer, not a copy (same effect as patches, far simpler).
export interface HistoryEntry<T> { before: T; label: string; key?: string; at: number }

export class History<T> {
  private past: HistoryEntry<T>[] = [];
  private future: HistoryEntry<T>[] = [];
  constructor(private limit = 200, private coalesceMs = 800) {}

  /** Record that `before` is about to be replaced. Same-key edits within the window coalesce into one step. */
  record(before: T, label: string, key?: string, now = Date.now()) {
    const last = this.past[this.past.length - 1];
    if (key && last && last.key === key && now - last.at < this.coalesceMs) last.at = now;
    else {
      this.past.push({ before, label, key, at: now });
      if (this.past.length > this.limit) this.past.shift();
    }
    this.future = [];
  }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  get undoLabel() { return this.past[this.past.length - 1]?.label; }

  undo(current: T): T | undefined {
    const e = this.past.pop();
    if (!e) return undefined;
    this.future.push({ ...e, before: current });
    return e.before;
  }
  redo(current: T): T | undefined {
    const e = this.future.pop();
    if (!e) return undefined;
    this.past.push({ ...e, before: current, key: undefined });
    return e.before;
  }
  clear() { this.past = []; this.future = []; }
}
