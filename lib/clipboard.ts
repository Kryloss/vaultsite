/**
 * Clipboard write with a fallback, shared by the code-block copy buttons and
 * the copy-as-Markdown button.
 *
 * Browser-only, but safe to import anywhere — it touches no Node APIs.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // The Clipboard API rejects on insecure origins and denied permission.
  }
  // Fallback for older Safari and non-HTTPS previews.
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
