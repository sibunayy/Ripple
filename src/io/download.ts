/** Save a Blob via a temporary link (works as a Files download on iPad). */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
/** Share via the system sheet when possible (needs a user gesture), else download. */
export async function shareBlob(blob: Blob, name: string, mime: string) {
  const file = new File([blob], name, { type: mime });
  try { if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name }); else downloadBlob(blob, name); }
  catch (e) { if ((e as Error).name !== 'AbortError') downloadBlob(blob, name); }
}
