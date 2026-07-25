/**
 * UI string dictionary — every fixed interface string in both languages.
 * English is primary. Spread a pair straight into the <T> component:
 *
 *   import { ui } from "@/lib/ui-strings";
 *   <T {...ui.explore} />
 *
 * The language toggle (components/T.tsx + globals.css) shows the active one.
 * Add a new key here rather than hard-coding English anywhere in a component.
 */
export interface Str {
  en: string;
  uk: string;
}

export const ui = {
  // chrome / sidebar
  publishedFrom: { en: "Published from Obsidian", uk: "Опубліковано з Obsidian" },
  /** {n} is replaced with the day number — see components/ResistanceDay.tsx */
  resistanceDay: {
    en: "Day {n} of Ukraine’s resistance",
    uk: "{n}-й день українського спротиву",
  },
  searchPlaceholder: {
    en: "Search pages and posts…",
    uk: "Пошук сторінок і дописів…",
  },
  searchHint: {
    en: "↑↓ navigate · ↵ open · esc close",
    uk: "↑↓ навігація · ↵ відкрити · esc закрити",
  },
  noResultsFor: { en: "No results for", uk: "Немає результатів для" },

  // home
  recentPosts: { en: "Recent posts", uk: "Останні дописи" },
  allPosts: { en: "All posts →", uk: "Усі дописи →" },
  explore: { en: "Explore", uk: "Розділи" },

  // filters
  filterAll: { en: "All", uk: "Усі" },
  mediumBooks: { en: "Books", uk: "Книги" },
  mediumMovies: { en: "Movies", uk: "Фільми" },
  mediumShows: { en: "Shows", uk: "Серіали" },
  mediumVideos: { en: "Videos", uk: "Відео" },

  // lists
  notesOnHearing: {
    en: "Notes on what I’m hearing",
    uk: "Нотатки про почуте",
  },
  openInAppleMusic: { en: "Open in Apple Music", uk: "Відкрити в Apple Music" },
  continueReading: { en: "Continue reading →", uk: "Читати далі →" },
  emptyState: {
    en: "Nothing here yet. Add a .md file next to this section’s main.md in your vault and it will show up automatically.",
    uk: "Тут поки що порожньо. Додайте файл .md поряд із main.md цього розділу у вашому сховищі — і він з’явиться автоматично.",
  },
  nothingInCategory: {
    en: "No posts in this category yet.",
    uk: "У цій категорії поки що немає дописів.",
  },
  nothingOnShelf: {
    en: "Nothing on the shelf in this category yet.",
    uk: "На полиці поки що нічого немає в цій категорії.",
  },

  // entry pages
  draft: { en: "Draft", uk: "Чернетка" },
  minRead: { en: "min read", uk: "хв читання" },
  words: { en: "words", uk: "слів" },

  // code blocks
  copyCode: { en: "Copy code", uk: "Копіювати код" },
  copiedCode: { en: "Copied", uk: "Скопійовано" },

  // 404
  notFoundBody: {
    en: "This page doesn’t exist (or the note behind it was unpublished).",
    uk: "Цієї сторінки не існує (або нотатку за нею знято з публікації).",
  },
  backHome: { en: "← Back home", uk: "← На головну" },
} satisfies Record<string, Str>;
