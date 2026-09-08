/**
 * TEMPORARY — the two lists behind the ⌘K "Theme: …" and "Font: …" actions.
 *
 * Scaffolding for choosing a direction, not a feature. The ids match the
 * `:root[data-theme="…"]` and `:root[data-font="…"]` blocks in
 * app/themes.css, and that file's header says what to delete when the choice
 * is made. The two axes are independent: any font can be tried against any
 * palette.
 *
 * Ukrainian labels live here rather than in lib/ui-strings.ts on purpose —
 * everything about this experiment should be removable by deleting whole
 * files, and the shared dictionary is not a file that gets deleted.
 */
import type { Str } from "@/lib/ui-strings";

/** localStorage keys. Both read pre-paint by the inline script in app/layout.tsx. */
export const THEME_KEY = "theme-preview";
export const FONT_KEY = "font-preview";

export interface Preview {
  /** Attribute value; `null` removes it and restores globals.css. */
  id: string | null;
  label: Str;
}

/**
 * Ten palettes, ordered from the one that could ship quietly to the one that
 * couldn't. Each is a whole proposal rather than a hue — see the notes above
 * each block in app/themes.css for what it is arguing.
 */
export const themes: Preview[] = [
  { id: null, label: { en: "Default", uk: "Стандартна" } },
  { id: "paper", label: { en: "Paper — warm cream", uk: "Папір — тепла кремова" } },
  { id: "solar", label: { en: "Solar — Solarized", uk: "Сонячна — Solarized" } },
  { id: "ember", label: { en: "Ember — retro amber", uk: "Жар — ретро-бурштин" } },
  { id: "frost", label: { en: "Frost — icy blue-grey", uk: "Іній — крижаний блакитний" } },
  { id: "rose", label: { en: "Rosé — muted mauve", uk: "Троянда — приглушений бузок" } },
  { id: "neon", label: { en: "Neon — deep violet", uk: "Неон — глибокий фіолет" } },
  { id: "forest", label: { en: "Forest — deep green", uk: "Ліс — темно-зелена" } },
  { id: "blueprint", label: { en: "Blueprint — drafting navy", uk: "Креслення — синя" } },
  { id: "newsprint", label: { en: "Newsprint — hard rules", uk: "Газета — жорсткі лінії" } },
  { id: "terminal", label: { en: "Terminal — phosphor", uk: "Термінал — фосфор" } },
];

/**
 * Eight typefaces, all of them carrying `cyrillic` AND `cyrillic-ext` — see
 * the header of the TYPEFACES section in app/themes.css for why the second
 * one is the filter that matters, and app/layout.tsx for how they are loaded.
 */
export const fonts: Preview[] = [
  { id: null, label: { en: "Default — Source Serif 4", uk: "Стандартний — Source Serif 4" } },
  { id: "literata", label: { en: "Literata — reading serif", uk: "Literata — читацька антиква" } },
  { id: "garamond", label: { en: "EB Garamond — old-style", uk: "EB Garamond — стара антиква" } },
  { id: "cormorant", label: { en: "Cormorant — high contrast", uk: "Cormorant — контрастна" } },
  { id: "spectral", label: { en: "Spectral — screen serif", uk: "Spectral — екранна антиква" } },
  { id: "plex-serif", label: { en: "IBM Plex Serif — technical", uk: "IBM Plex Serif — технічна" } },
  { id: "arsenal", label: { en: "Arsenal — Ukrainian sans", uk: "Arsenal — український гротеск" } },
  { id: "inter", label: { en: "Inter — neutral sans", uk: "Inter — нейтральний гротеск" } },
  { id: "mono", label: { en: "JetBrains Mono — everything mono", uk: "JetBrains Mono — усе моноширинним" } },
];

/** "Theme: Paper — warm cream" / "Шрифт: Inter — нейтральний гротеск". */
export function previewLabel(prefix: Str, item: Preview): Str {
  return {
    en: `${prefix.en}: ${item.label.en}`,
    uk: `${prefix.uk}: ${item.label.uk}`,
  };
}

export const themePrefix: Str = { en: "Theme", uk: "Тема" };
export const fontPrefix: Str = { en: "Font", uk: "Шрифт" };

/**
 * Write a choice to <html> and remember it. The attribute is REMOVED for the
 * default rather than set to "default", so the untouched site is the literal
 * absence of this experiment.
 */
export function applyPreview(
  attr: "theme" | "font",
  key: string,
  id: string | null
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (id) root.dataset[attr] = id;
  else delete root.dataset[attr];
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    /* Private mode — the choice still applies for this page view. */
  }
}
