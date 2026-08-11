/**
 * Which shortcut a keypress means, on any keyboard layout.
 *
 * The site's shortcuts are named by the character on the key — `j`, `l`, `[`,
 * `/` — and a `KeyboardEvent` answers "which character" and "which physical
 * key" separately. Neither one alone is right:
 *
 * - **`e.key` alone** is what the layout produced, so it breaks the moment the
 *   layout isn't Latin. Under a Ukrainian layout the physical `l` types `д`,
 *   and every letter shortcut on this site was simply dead — on a site where
 *   every note has a Ukrainian translation, i.e. exactly for the reader most
 *   likely to be typing in Cyrillic.
 * - **`e.code` alone** is the physical key, which fixes that and breaks
 *   punctuation instead: `/` is Shift+7 on a German layout and `?` is Shift+é
 *   on a French one, neither of them the key `e.code` calls `Slash`.
 *
 * So: take the character if it IS one of ours, and fall back to the physical
 * key's Latin label if it isn't. A layout that reaches `/` by another key
 * still works, and a layout that produces another character from our key still
 * works. The one case both readings can't help with is a layout that maps some
 * OTHER character onto our physical key — someone typing `-` on a German
 * keyboard opens search — but outside a text field that key did nothing
 * before, so the cost is a stray panel rather than a lost keystroke.
 *
 * Pure, and typed structurally rather than against `KeyboardEvent`, so
 * `npm test` can call it with plain objects.
 */

export interface KeyPress {
  /** The character the layout produced — `e.key`. */
  key: string;
  /** The physical key, layout-independent — `e.code`. */
  code: string;
  shiftKey?: boolean;
}

/** Every character the shortcut table names. */
const SHORTCUT_CHARS = /^[a-z0-9[\]/?]$/;

export function shortcutKey({ key, code, shiftKey }: KeyPress): string {
  const typed = key.toLowerCase();
  if (SHORTCUT_CHARS.test(typed)) return typed;

  // Not one of ours as typed — read the physical key instead. `KeyL` is the
  // key an English keyboard prints "l" on, whatever this one prints.
  if (code.startsWith("Key")) return code.slice(3).toLowerCase();
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "BracketLeft") return "[";
  if (code === "BracketRight") return "]";
  // The cheat sheet lists these as two shortcuts on one key, which is what
  // they are on the layout it's drawn for.
  if (code === "Slash") return shiftKey ? "?" : "/";

  // Escape, Tab, arrows, dead keys: not a shortcut character at all.
  return "";
}
