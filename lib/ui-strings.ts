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
  /* Arrows are rendered as their own `.arrow-glyph` span, never baked
     into the string — see continueReading below. */
  allPosts: { en: "All posts", uk: "Усі дописи" },
  explore: { en: "Explore", uk: "Розділи" },

  // filters
  filterAll: { en: "All", uk: "Усі" },
  mediumBooks: { en: "Books", uk: "Книги" },
  mediumMovies: { en: "Movies", uk: "Фільми" },
  mediumShows: { en: "Shows", uk: "Серіали" },
  mediumVideos: { en: "Videos", uk: "Відео" },

  // shelf rows
  shelfEverythingElse: { en: "Everything else", uk: "Інше" },

  // lists
  notesOnHearing: {
    en: "Notes on what I’m hearing",
    uk: "Нотатки про почуте",
  },
  openInAppleMusic: { en: "Open in Apple Music", uk: "Відкрити в Apple Music" },
  /* No arrow in the string: it's rendered as its own element so it can move
     on hover and be thrown on press (see `.arrow-glyph` in globals.css). An
     arrow baked into a translated string is also one more thing a translator
     can drop. */
  continueReading: { en: "Continue reading", uk: "Читати далі" },
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
  /** First link on every page, visible only when focused. */
  skipToContent: { en: "Skip to content", uk: "Перейти до вмісту" },
  previousEntry: { en: "Previous", uk: "Попереднє" },
  nextEntry: { en: "Next", uk: "Наступне" },
  /** Accessible name of the "#" link beside a heading (see lib/toc.ts). */
  headingAnchor: {
    en: "Link to this heading",
    uk: "Посилання на цей заголовок",
  },

  // code blocks
  copyCode: { en: "Copy code", uk: "Копіювати код" },
  copiedCode: { en: "Copied", uk: "Скопійовано" },
  copyMarkdown: { en: "Copy as Markdown", uk: "Копіювати як Markdown" },

  /* selection → text-fragment link (components/SelectionLink.tsx). One word:
     the pill appears attached to the text you just highlighted, where "Copy
     link to selection" spends three words restating what you can see. */
  copyLinkToSelection: {
    en: "Selection",
    uk: "Вибране",
  },
  linkCopied: { en: "Link copied", uk: "Посилання скопійовано" },

  // reading position (components/ReadingPosition.tsx)
  /** The pill's whole label. Short on purpose — the icon carries the rest. */
  resumeReading: { en: "Continue", uk: "Продовжити" },

  /** Follows the number in the time-remaining pill: "4 min left". */
  minLeft: { en: "min left", uk: "хв лишилось" },

  // keyboard shortcuts (components/Shortcuts.tsx)
  shortcutSheet: { en: "Keyboard shortcuts", uk: "Клавіатурні скорочення" },
  shortcutHome: { en: "Home", uk: "Головна" },
  shortcutSearch: { en: "Search", uk: "Пошук" },
  shortcutListDown: { en: "Down the list", uk: "Вниз списком" },
  shortcutListUp: { en: "Up the list", uk: "Вгору списком" },

  // command palette actions (components/CommandPalette.tsx)
  actionToggleLang: { en: "Switch language", uk: "Змінити мову" },
  actionCopyMarkdown: { en: "Copy page as Markdown", uk: "Копіювати сторінку як Markdown" },
  actionCopyLink: { en: "Copy link to this page", uk: "Копіювати посилання на сторінку" },
  actionRandom: { en: "Open a random note", uk: "Відкрити випадкову нотатку" },
  actionGithub: { en: "Open this note on GitHub", uk: "Відкрити нотатку на GitHub" },
  searchThisPage: { en: "Searching this page", uk: "Пошук на цій сторінці" },
  actionsGroup: { en: "Actions", uk: "Дії" },
  recentGroup: { en: "Recent", uk: "Нещодавні" },
  pagesGroup: { en: "Pages", uk: "Сторінки" },
  actionDone: { en: "Done", uk: "Готово" },

  // lightbox (components/Lightbox.tsx)
  previousImage: { en: "Previous image", uk: "Попереднє зображення" },
  nextImage: { en: "Next image", uk: "Наступне зображення" },
  closeImage: { en: "Close", uk: "Закрити" },

  // image notes (diagram reconstructed from a photographed handwritten note)
  imageNoteView: { en: "Image note view", uk: "Вигляд фотонататки" },
  imageNoteDiagram: { en: "Diagram", uk: "Схема" },
  imageNoteOriginal: { en: "Original", uk: "Оригінал" },
  imageNoteOriginalAlt: {
    en: "Original handwritten note",
    uk: "Оригінальна рукописна нотатка",
  },

  // shelf status
  currentlyReading: { en: "Reading", uk: "Читаю" },
  currentlyWatching: { en: "Watching", uk: "Дивлюся" },
  wantToRead: { en: "To read", uk: "Прочитати" },
  wantToWatch: { en: "To watch", uk: "Подивитись" },
  quotesCategory: { en: "Quotes", uk: "Цитати" },
  quotesEmpty: {
    en: "No quotes saved yet — add a > blockquote to a book’s note.",
    uk: "Цитат поки немає — додайте > цитату в нотатку книги.",
  },

  // note maturity
  maturitySeedling: { en: "Seedling", uk: "Паросток" },
  maturityBudding: { en: "Budding", uk: "Розвивається" },
  maturityEvergreen: { en: "Evergreen", uk: "Вічнозелена" },

  /* Series (multi-part notes): the popover shows the series' own name, and
     "Part 2 of 5" interpolates numbers, so it's built per note by
     seriesPartLabel() in lib/series.ts. These two are fixed, so they live
     here — they label the checkbox that ticks a part read by hand. */
  markRead: { en: "Mark as read", uk: "Позначити прочитаним" },
  markUnread: { en: "Mark as unread", uk: "Позначити непрочитаним" },

  // résumé (now page)
  resume: { en: "Résumé", uk: "Резюме" },
  resumeDownload: { en: "PDF", uk: "PDF" },
  resumeExperience: { en: "Experience", uk: "Досвід" },
  resumeEducation: { en: "Education", uk: "Освіта" },
  resumeCertifications: { en: "Certifications", uk: "Сертифікації" },
  resumeSkills: { en: "Strengths", uk: "Сильні сторони" },
  resumeLanguages: { en: "Languages", uk: "Мови" },
  resumeContact: { en: "Contact", uk: "Контакти" },
  resumeCurrent: { en: "Current", uk: "Зараз" },

  // 404
  notFoundBody: {
    en: "This page doesn’t exist (or the note behind it was unpublished).",
    uk: "Цієї сторінки не існує (або нотатку за нею знято з публікації).",
  },
  backHome: { en: "Back home", uk: "На головну" },
  didYouMean: { en: "Did you mean…", uk: "Можливо, ви шукали…" },
} satisfies Record<string, Str>;
