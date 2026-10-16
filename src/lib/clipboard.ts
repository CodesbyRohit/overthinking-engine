/** Copy text to the clipboard, falling back to a hidden textarea for older browsers / insecure contexts. */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  if (!ok) throw new Error('Clipboard unavailable');
}
