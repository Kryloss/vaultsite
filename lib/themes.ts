/**
 * TEMPORARY — the list behind the ⌘K "Theme: …" actions.
 *
 * Scaffolding for choosing a contrast direction, not a feature: the ids match
 * the `:root[data-theme="…"]` blocks in app/themes.css, and that file's header
 * carries the measured ratios and says what to delete when a direction is
 * picked.
 *
 * Ukrainian labels are here rather than in lib/ui-strings.ts on purpose —
 * everything about this experiment should be removable by deleting whole
 * files, and the shared dictionary is not a file that gets deleted.
 */
import type { Str } from "@/lib/ui-strings";

/** localStorage key. Read pre-paint by the inline script in app/layout.tsx. */
export const THEME_KEY = "theme-preview";

export interface ThemePreview {
  /** `data-theme` value; `null` removes the attribute and restores globals.css. */
  id: string | null;
  label: Str;
}

/**
 * Six palettes, ordered from the smallest change to the largest. Each is a
 * different answer to "higher contrast" — see the note above each block in
 * app/themes.css for what it is arguing and what it measures.
 */
export const themes: ThemePreview[] = [
  { id: null, label: { en: "Default", uk: "Стандартна" } },
  { id: "legible", label: { en: "Legible — raised floor", uk: "Читабельна — піднята межа" } },
  { id: "bone", label: { en: "Bone — warm, black ink", uk: "Кістка — тепла, чорне чорнило" } },
  { id: "steel", label: { en: "Steel — cool, navy ink", uk: "Сталь — холодна, синє чорнило" } },
  { id: "maximum", label: { en: "Maximum — everything pushed", uk: "Максимум — усе на межі" } },
  { id: "ruled", label: { en: "Ruled — hard borders", uk: "Розлінована — жорсткі межі" } },
  { id: "phosphor", label: { en: "Phosphor — green ink", uk: "Фосфор — зелене чорнило" } },
];

/** "Theme: Bone — warm, black ink" — the row as it reads, in both languages. */
export function themeActionLabel(theme: ThemePreview): Str {
  return {
    en: `Theme: ${theme.label.en}`,
    uk: `Тема: ${theme.label.uk}`,
  };
}

/**
 * Write the choice to <html> and remember it. The attribute is REMOVED for
 * the default rather than set to "default", so the untouched site is the
 * literal absence of this experiment.
 */
export function applyTheme(id: string | null): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (id) root.dataset.theme = id;
  else delete root.dataset.theme;
  try {
    if (id) localStorage.setItem(THEME_KEY, id);
    else localStorage.removeItem(THEME_KEY);
  } catch {
    /* Private mode — the theme still applies for this page view. */
  }
}
