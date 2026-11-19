// Host adapter: how a finished export reaches the user. This is the only place that knows where
// the app runs (HANDOFF section 7, "Host-specific code to isolate").
//
// 1. Inside the Claude artifact host (the original prototype), use its downloads service.
// 2. On a touch device that can share files (iPad Safari), open the share sheet. It offers
//    "Save to Files", and "Save Video" or "Save Image" for MP4 and GIF.
// 3. Everywhere else, a normal download link.

type ClaudeHost = { use(name: 'downloads'): Promise<{ save(o: { filename: string; data: Blob }): Promise<void> }> };

const claudeHost = (): ClaudeHost | undefined => (window as unknown as { claude?: ClaudeHost }).claude;

function canShareFile(file: File): boolean {
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [file] }) && matchMedia('(pointer: coarse)').matches;
  } catch { return false; }
}

function downloadLink(name: string, url: string) {
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

/**
 * Saves an exported file. `url` is the object URL already made for `blob`. Errors are reported
 * through `fail`, except when the user closes the share sheet or declines the host's save prompt.
 */
export async function saveFile(name: string, blob: Blob, url: string, fail: (msg: string) => void): Promise<void> {
  const host = claudeHost();
  if (host) {
    let dl = null; try { dl = await host.use('downloads'); } catch { dl = null; }
    if (dl) { try { await dl.save({ filename: name, data: blob }); } catch (e) { if (e && e.code !== 'declined') fail('Could not save the file' + (e && e.message ? ': ' + e.message : '')); } return; }
  }
  // No await may come before navigator.share: Safari only allows it straight after the tap.
  const file = new File([blob], name, { type: blob.type });
  if (canShareFile(file)) {
    try { await navigator.share({ files: [file] }); return; } catch (e) {
      if (e && e.name === 'AbortError') return; // the user closed the share sheet
      // Any other share error: fall back to a download.
    }
  }
  downloadLink(name, url);
}
