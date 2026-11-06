import { offlineReady, reloadForUpdate, updateReady } from './pwa';

export function UpdateToast() {
  if (updateReady.value) {
    return (
      <div class="toast" role="status">
        New version available
        <button class="btn primary" onClick={() => void reloadForUpdate()}>Reload</button>
        <button class="btn" onClick={() => (updateReady.value = false)}>Later</button>
      </div>
    );
  }
  if (offlineReady.value) {
    return (
      <div class="toast" role="status">
        Ready to work offline
        <button class="btn" onClick={() => (offlineReady.value = false)}>OK</button>
      </div>
    );
  }
  return null;
}
