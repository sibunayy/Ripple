// @ts-nocheck
import { $, app, esc } from '../core/dom';

let toastTimer = 0;
export function toast(msg, undoable) {
  let t = $('#toast'); if (t) t.remove(); clearTimeout(toastTimer);
  t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${undoable ? '<button data-act="undo">Undo</button>' : ''}`;
  app.appendChild(t); toastTimer = setTimeout(() => t.remove(), 3600);
}
