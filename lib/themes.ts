/**
 * TEMPORARY — the list behind the ⌘K "Theme: …" actions.
 *
 * Scaffolding for choosing a palette, not a feature: the ids match the
 * `:root[data-theme="…"]` blocks in app/themes.css, and that file's header
 * says what to delete when a direction is picked.
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

export const themes: ThemePreview[] = [
  { id: null, label: { en: "Default", uk: "Стандартна" } },
  { id: "paper", label: { en: "Paper", uk: "Папір" } },
  { id: "slate", label: { en: "Slate", uk: "Сланець" } },
  { id: "moss", label: { en: "Moss", uk: "Мох" } },
  { id: "terminal", label: { en: "Terminal", uk: "Термінал" } },
  { id: "ink", label: { en: "Ink", uk: "Чорнило" } },
  { id: "clay", label: { en: "Clay", uk: "Глина" } },
];

/** "Theme: Paper" — the row as it reads in the palette, in both languages. */
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
