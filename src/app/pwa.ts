import { signal } from '@preact/signals';
import { registerSW } from 'virtual:pwa-register';

/** True when a new version is waiting. The UI offers a reload; we never reload automatically. */
export const updateReady = signal(false);
export const offlineReady = signal(false);

let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;

export function initPWA() {
  applyUpdate = registerSW({
    onNeedRefresh: () => { updateReady.value = true; },
    onOfflineReady: () => { offlineReady.value = true; },
  });
}

export const reloadForUpdate = () => applyUpdate?.(true);
