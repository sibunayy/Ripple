// @ts-nocheck
import { $, app } from '../core/dom';
import { DUR, FPS } from '../model/project';
import { S } from '../state/state';
import { shaderDialog } from '../shader/ui';
import { exportDialog } from '../export/dialog';

export function renderDialog() {
  let d = $('#dlg'); if (d) d.remove();
  if (!S.dialog) return;
  let inner = '';
  if (S.dialog === 'export') {
    inner = exportDialog();
  } else if (S.dialog === 'shader') {
    inner = shaderDialog();
  } else if (S.dialog === 'settings') {
    inner = `<h2>Project settings</h2>
      <div class="seg" role="group" aria-label="Duration">${[3, 5, 10, 15].map((d) => `<button data-act="setdur" data-v="${d}" aria-pressed="${DUR === d * FPS}">${d} s</button>`).join('')}</div>
      <div class="kv"><span>Size</span><b class="tc">1920 × 1080</b></div>
      <div class="kv"><span>Frame rate</span><b class="tc">30 fps</b></div>
      <div class="kv"><span>Storage</span><b>Autosaved on this device</b></div>
      <button class="line-btn" data-act="resetproj">${S.resetArm ? 'Tap again to erase and reset' : 'Reset to demo project'}</button>
      <div class="foot"><button class="primary" data-act="close">Done</button></div>`;
  } else {
    inner = `<h2>Help</h2>
      <table class="keys"><tbody>
      <tr><td>Two-finger tap</td><td>Undo · three-finger tap: Redo</td></tr><tr><td>Pinch on canvas</td><td>Zoom · drag with Hand to pan</td></tr>
      <tr><td>Drag the timeline handle</td><td>Peek or dope sheet</td></tr><tr><td>Hold a keyframe</td><td>Quick ease presets</td></tr>
      <tr><td>Hold a layer</td><td>Duplicate, pre-compose, move, delete</td></tr><tr><td>Space · K</td><td>Play/pause · Auto-key</td></tr>
      <tr><td>Shape panel</td><td>Duplicator copies, Behaviours wiggle/oscillate/spin, Parent and Blend</td></tr><tr><td>V H P R T</td><td>Select, Hand, Pen, Shape, Text</td></tr><tr><td>⌘Z · ⇧⌘Z</td><td>Undo · Redo</td></tr><tr><td>⌘A · ⌘D · ⌘G</td><td>Select all · Duplicate · Group</td></tr><tr><td>Delete</td><td>Delete selected keyframes, or the layer</td></tr></tbody></table>
      <div class="foot"><button class="primary" data-act="close">Done</button></div>`;
  }
  d = document.createElement('div'); d.id = 'dlg'; d.className = 'dlg-scrim'; d.dataset.act = 'scrimclose';
  d.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="${S.dialog === 'export' ? 'Export' : S.dialog === 'settings' ? 'Project settings' : 'Help'}" tabindex="-1">${inner}</div>`;
  app.appendChild(d); setTimeout(() => d.querySelector('.dlg').focus(), 0);
}
