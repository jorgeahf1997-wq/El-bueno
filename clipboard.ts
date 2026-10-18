/**
 * Copies text to the clipboard. `navigator.clipboard` only exists on secure pages (https/localhost) and in
 * recent browsers, so there is a fallback for the rest. Returns true when the text really was copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // permission denied or not focused: try the legacy path below
  }

  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '0';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  } finally {
    previous?.focus?.();
  }
}
