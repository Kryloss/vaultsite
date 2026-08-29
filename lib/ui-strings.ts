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
import type { ObservanceId } from "@/lib/observances";

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
    en: "↑↓ navigate · ↵ open · shift+? shortcuts · esc close",
    uk: "↑↓ навігація · ↵ відкрити · shift+? скорочення · esc закрити",
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
  /* Films and shows lead with a ranked list rather than the whole grid,
     so their first chip names the ordering instead of the absence of a
     filter. Books and videos still say "All". See DECISIONS #113. */
  filterTop: { en: "Top", uk: "Топ" },
  /* Spoken after the number, for a reader who cannot see the label
     beside it — the stars are Kyrylo's, this one is IMDb's. */
  imdbRating: { en: "IMDb rating", uk: "Оцінка IMDb" },
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
  /* The /music toolbar. The three language chips are CODES and stay identical
     in both languages — a code is a label for the language itself, so
     translating "UA" into Ukrainian would be translating the thing being
     named. Only "All" and the prose below get a pair. */
  /* Short enough to survive the field at its narrowest — the full sentence is
     on the aria-label, which is where a screen reader looks anyway. */
  musicSearch: { en: "Search artists, tracks…", uk: "Пошук виконавців…" },
  musicSearchLabel: {
    en: "Search artists, tracks, EPs and albums",
    uk: "Пошук виконавців, треків, EP та альбомів",
  },
  musicFilterLangLabel: { en: "Filter by language", uk: "Фільтр за мовою" },
  /* Shown when the literal pass found nothing and these are trigram
     near-misses instead — the palette labels its fallback for the same
     reason: a result that is approximately what you asked for must say so. */
  musicFuzzy: { en: "Closest matches", uk: "Найближчі збіги" },
  musicLangEn: { en: "English", uk: "Англійська" },
  musicLangUk: { en: "Ukrainian", uk: "Українська" },
  musicLangRu: { en: "Russian", uk: "Російська" },
  musicNoMatches: {
    en: "Nothing matches that. Try another word, or a different language.",
    uk: "Нічого не знайдено. Спробуйте інше слово або іншу мову.",
  },
  /* Parked, not dead: the embeds' footer link was removed (#92) and this is
     what restoring it needs, already translated. Delete it only when that
     decision is settled rather than "for now". */
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
  /** Dated after the day you were last here — see lib/new-notes.ts. */
  newBadge: { en: "New", uk: "Нове" },
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
  shortcutMenu: { en: "Menu", uk: "Меню" },
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

  /* Shelf creator block (components/Creator.tsx). The role is chosen by the
     note's medium, so a name never appears without saying what it is TO the
     work — "Andrzej Sapkowski" on its own is a byline, "Author · Andrzej
     Sapkowski" is a fact about the book. The Ukrainian for a show says
     "Автор серіалу" and not the bare "Автор" a book takes: the two are the
     same word in Ukrainian, and the longer one is what the credit reads. */
  creatorAuthor: { en: "Author", uk: "Автор" },
  creatorDirector: { en: "Director", uk: "Режисер" },
  creatorShowCreator: { en: "Creator", uk: "Автор серіалу" },
  creatorChannel: { en: "Channel", uk: "Канал" },
  creatorArtist: { en: "Artist", uk: "Виконавець" },

  /* What a music note is ABOUT, printed in grey after its title. Derived from
     `format:` — or, when the note doesn't say, from whether the Apple Music
     link it embeds points at one track or a whole release. Never written into
     the title itself, the same way a shelf creator's role never is. */
  formatAlbum: { en: "Album", uk: "Альбом" },
  formatTrack: { en: "Track", uk: "Трек" },
  formatSingle: { en: "Single", uk: "Сингл" },
  formatEp: { en: "EP", uk: "EP" },
  formatMixtape: { en: "Mixtape", uk: "Мікстейп" },
  formatLive: { en: "Live album", uk: "Концертний альбом" },
  formatCompilation: { en: "Compilation", uk: "Збірка" },

  /* The rating's row in a shelf note's fact list — the stars live there now
     rather than on the metadata line (`docs/DECISIONS.md` #88). */
  ratingRow: { en: "Rating", uk: "Оцінка" },

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

/** Local-only editor copy. Kept out of `ui` so public client chunks do not
 * carry authoring-only strings. */
export const devUi = {
  openPublicPage: {
    en: "Open this page on the public site",
    uk: "Відкрити цю сторінку на публічному сайті",
  },
  devToolsOpen: { en: "Open developer tools", uk: "Відкрити інструменти розробника" },
  devToolsClose: { en: "Close developer tools", uk: "Закрити інструменти розробника" },
  devToolsGroup: { en: "Developer tools", uk: "Інструменти розробника" },
  devPageFields: { en: "Page fields", uk: "Поля сторінки" },
  devUnsaved: { en: "Unsaved changes", uk: "Незбережені зміни" },
  devOpenObsidian: { en: "Open this file in Obsidian", uk: "Відкрити цей файл в Obsidian" },
  devUndo: { en: "Undo", uk: "Скасувати" },
  devRedo: { en: "Redo", uk: "Повторити" },
  devCancel: { en: "Cancel changes", uk: "Скасувати зміни" },
  devSave: { en: "Save to vault", uk: "Зберегти у сховищі" },
  devReload: { en: "Reload file", uk: "Перезавантажити файл" },
  devRetry: { en: "Retry", uk: "Спробувати ще раз" },
  devTitle: { en: "Title", uk: "Назва" },
  devDescription: { en: "Description", uk: "Опис" },
  devBody: { en: "Edit this page’s Markdown", uk: "Редагувати Markdown цієї сторінки" },
  devCreateEntry: { en: "Create a new entry", uk: "Створити новий запис" },
  devCreatesDraft: {
    en: "Creates a bilingual Draft with this section’s structure.",
    uk: "Створює двомовну чернетку зі структурою цього розділу.",
  },
  devCreate: { en: "Create Draft", uk: "Створити чернетку" },
  devCreating: { en: "Creating…", uk: "Створення…" },
  devCreateFailed: {
    en: "The new Draft could not be created.",
    uk: "Не вдалося створити нову чернетку.",
  },
  devFinishCurrentEdit: {
    en: "Save or cancel the current page edits first.",
    uk: "Спершу збережіть або скасуйте поточні зміни сторінки.",
  },
  devTitleEn: { en: "English title", uk: "Назва англійською" },
  devTitleUk: { en: "Ukrainian title", uk: "Назва українською" },
  devDescriptionEn: { en: "English description", uk: "Опис англійською" },
  devDescriptionUk: { en: "Ukrainian description", uk: "Опис українською" },
  devCategories: { en: "Categories (#)", uk: "Категорії (#)" },
  devCategoriesHint: {
    en: "Existing or new, comma-separated",
    uk: "Наявні або нові, через кому",
  },
  devCategoryTranslationNote: {
    en: "A new # label initially uses the same name in Ukrainian.",
    uk: "Нова #мітка спочатку матиме таку саму назву українською.",
  },
  devMedium: { en: "Shelf type", uk: "Тип полиці" },
  devBook: { en: "Book", uk: "Книга" },
  devMovie: { en: "Movie", uk: "Фільм" },
  devShow: { en: "Show", uk: "Серіал" },
  devVideo: { en: "Video", uk: "Відео" },
  devCreator: { en: "Author / director / creator", uk: "Автор / режисер / творець" },
  devCreatorUk: { en: "Creator name in Ukrainian (optional)", uk: "Ім’я творця українською (необов’язково)" },
  devArtist: { en: "Artist", uk: "Виконавець" },
  devFormat: { en: "Format", uk: "Формат" },
  devMusicLanguage: { en: "Music shelf", uk: "Мовна полиця" },
  devMusicEnglish: { en: "English", uk: "Англійська" },
  devMusicUkrainian: { en: "Ukrainian", uk: "Українська" },
  devMusicRussian: { en: "Russian", uk: "Російська" },
  devGenres: { en: "Apple genres (optional)", uk: "Жанри Apple (необов’язково)" },
  devGenresHint: { en: "Rock, Alternative", uk: "Rock, Alternative" },
  devMediaUrl: { en: "Apple Music / YouTube URL (optional)", uk: "Посилання Apple Music / YouTube (необов’язково)" },
  devCancelShort: { en: "Cancel", uk: "Скасувати" },
  devPageOptions: { en: "Page options", uk: "Параметри сторінки" },
  devDraft: { en: "Keep as Draft", uk: "Залишити чернеткою" },
  devSeries: { en: "Post series", uk: "Серія дописів" },
  devSeriesHint: { en: "Choose existing or enter a new series", uk: "Оберіть наявну або введіть нову серію" },
  devSeriesUk: { en: "Series name in Ukrainian", uk: "Назва серії українською" },
  devSeriesPart: { en: "Part number (optional)", uk: "Номер частини (необов’язково)" },
  devAutomatic: { en: "Automatic", uk: "Автоматично" },
  devSaveOptions: { en: "Save options", uk: "Зберегти параметри" },
  devOptionsSaved: { en: "Options saved.", uk: "Параметри збережено." },
  devOptionsFailed: { en: "Options could not be saved.", uk: "Не вдалося зберегти параметри." },
  devInvalidPart: { en: "Part must be a positive whole number.", uk: "Номер частини має бути додатним цілим числом." },
  devSeriesUkRequired: { en: "Add the Ukrainian name for this new series.", uk: "Додайте українську назву нової серії." },
  devGoal: { en: "Toggle goal", uk: "Змінити стан цілі" },
  devGoalSaved: { en: "Goal updated.", uk: "Ціль оновлено." },
  devGoalFailed: { en: "The goal could not be updated.", uk: "Не вдалося оновити ціль." },
  devRatingFor: { en: "Rating for", uk: "Оцінка для" },
  devUnrated: { en: "Unrated", uk: "Без оцінки" },
  devSaving: { en: "Saving…", uk: "Збереження…" },
  devReorderSaving: { en: "Saving Top-list order…", uk: "Збереження порядку списку…" },
  devReorderSaved: { en: "Top-list order saved.", uk: "Порядок списку збережено." },
  devReorderFailed: {
    en: "The Top-list order could not be saved.",
    uk: "Не вдалося зберегти порядок списку.",
  },
  devLoading: { en: "Loading page fields…", uk: "Завантаження полів сторінки…" },
  devNoSource: {
    en: "This generated view has no single vault file to edit.",
    uk: "Це згенероване подання не має одного файлу сховища для редагування.",
  },
  devSaved: { en: "Saved to the vault.", uk: "Збережено у сховищі." },
  devConflict: {
    en: "The file changed in Obsidian. Your draft was kept.",
    uk: "Файл змінився в Obsidian. Вашу чернетку збережено.",
  },
  devUnavailable: {
    en: "The local editor service is unavailable. Restart npm run dev.",
    uk: "Локальна служба редактора недоступна. Перезапустіть npm run dev.",
  },
  devSaveFailed: {
    en: "The file could not be saved. Your draft was kept.",
    uk: "Не вдалося зберегти файл. Вашу чернетку збережено.",
  },
  devDiscardNavigation: {
    en: "Discard unsaved developer-tool changes and leave this page?",
    uk: "Відкинути незбережені зміни в інструментах розробника й залишити сторінку?",
  },
} satisfies Record<string, Str>;

/**
 * The days the resistance counter steps aside for — keyed by ObservanceId, so
 * lib/observances.ts holds the dates and the kind, and this holds the words.
 * Its own export rather than a key inside `ui`, which is flat by construction
 * (`Record<string, Str>` above) and should stay that way.
 *
 * Both languages have to fit the w-56 sidebar on ONE line at 11px, which is
 * what rules out the fuller official titles — "День пам’яті Чорнобильської
 * трагедії", "День захисників і захисниць України". The counter is the width
 * budget, and it is about 32 characters. Every string here was measured.
 *
 * The remembrance days are named plainly and without adjectives. The line has
 * one job on those mornings, which is to say what the day is.
 */
export const observanceName = {
  // ---- celebrations (flag colours) ----
  unity: { en: "Ukraine’s Unity Day", uk: "День Соборності України" },
  vyshyvanka: { en: "Vyshyvanka Day", uk: "День вишиванки" },
  constitution: { en: "Constitution Day", uk: "День Конституції" },
  flag: { en: "Ukraine’s Flag Day", uk: "День Прапора України" },
  independence: { en: "Ukraine’s Independence Day", uk: "День Незалежності України" },
  defenders: { en: "Defenders Day", uk: "День захисників і захисниць" },
  dignity: { en: "Dignity and Freedom Day", uk: "День Гідності і Свободи" },
  armedForces: { en: "Armed Forces Day", uk: "День Збройних Сил України" },

  // ---- remembrance (monochrome) ----
  heavenlyHundred: { en: "Heroes of the Heavenly Hundred", uk: "День Героїв Небесної Сотні" },
  invasion: { en: "Full-scale invasion, 2022", uk: "Повномасштабне вторгнення" },
  chornobyl: { en: "Chornobyl, 1986", uk: "Чорнобильська трагедія" },
  victoryOverNazism: { en: "Remembrance and Victory Day", uk: "День пам’яті та перемоги" },
  mourning: { en: "Day of Mourning", uk: "День скорботи" },
  fallenDefenders: { en: "Remembering Ukraine’s fallen", uk: "День пам’яті захисників" },
  holodomor: { en: "Holodomor Remembrance Day", uk: "День пам’яті Голодомору" },
} satisfies Record<ObservanceId, Str>;
