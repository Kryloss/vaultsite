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
  /* Films, shows and games lead with a ranked list rather than the whole
     grid, so their first chip names the ordering instead of the absence of a
     filter. Books and videos still say "All". See DECISIONS #113, #138. */
  filterTop: { en: "Top", uk: "Топ" },
  /* Spoken after the number, for a reader who cannot see the label
     beside it — the stars are Kyrylo's, this one is IMDb's. */
  imdbRating: { en: "IMDb rating", uk: "Оцінка IMDb" },
  mediumBooks: { en: "Books", uk: "Книги" },
  mediumGames: { en: "Games", uk: "Ігри" },
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
  /* ONE WORD, because the field is 5.5rem on a phone and it has to survive
     there — the toolbar's two pills are the same size and that is the size.
     Measured at the field's own 13px: "Search…" is 52.8px and "Пошук…" 55.5
     against 64px of content box, so both fit with room to spare. The longer
     sentence this used to be needed 164px of field and was clipped mid-word
     at EVERY width, the 10rem desktop one included. The full sentence is on
     the aria-label, which is where a screen reader looks anyway. */
  musicSearch: { en: "Search…", uk: "Пошук…" },
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
  /* Names the cover deck for assistive tech. Not a heading — the section
     already has one ("Notes on what I'm hearing") and the deck is what sits
     under it. */
  musicDeck: { en: "Album covers", uk: "Обкладинки альбомів" },
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
  /** Sidebar tree disclosure — prefixed to the folder's own name. */
  expandFolder: { en: "Expand", uk: "Розгорнути" },
  collapseFolder: { en: "Collapse", uk: "Згорнути" },
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
  /* A third verb, not a synonym for watching: a game is the one thing on
     the shelf you operate rather than sit in front of. */
  currentlyPlaying: { en: "Playing", uk: "Граю" },
  wantToPlay: { en: "To play", uk: "Зіграти" },
  quotesCategory: { en: "Quotes", uk: "Цитати" },
  /* The studio index on the games page (#139). It says STUDIOS rather
     than the generic "Creators" because the chip is games-only and a
     game's `author:` is a studio — the word a reader would use. If the
     feature ever reaches books, that medium needs its own noun, not a
     word broad enough to cover both. */
  studiosCategory: { en: "Studios", uk: "Студії" },
  /* The same chip once you are inside the studios, where it is the way
     back. It names WHERE IT GOES, not where you are — which is what
     distinguishes it from every other chip in the row. */
  categoriesFilter: { en: "Categories", uk: "Категорії" },
  studiosLead: {
    en: "Everyone who made something on this shelf.",
    uk: "Усі, хто зробив щось із цієї полиці.",
  },

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
  /* A game names its STUDIO, not a person: the credit that means the same
     thing as "Director" here belongs to a team of hundreds, and picking one
     name out of it would be inventing an auteur. Same shape as a video
     note's Channel, which is also an organisation in the `author:` slot. */
  creatorStudio: { en: "Studio", uk: "Студія" },
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
  devGame: { en: "Game", uk: "Гра" },
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
  devCreateTranslation: {
    en: "Create the Ukrainian body from the English one",
    uk: "Створити українську версію з англійської",
  },
  devTranslationCreated: {
    en: "Ukrainian body created as a copy of the English one — translate it in place.",
    uk: "Українську версію створено як копію англійської — перекладіть її на місці.",
  },
  devTranslationFailed: {
    en: "Could not create the Ukrainian body.",
    uk: "Не вдалося створити українську версію.",
  },
  devInsertImage: { en: "Insert an image", uk: "Вставити зображення" },
  devUploading: { en: "Attaching image…", uk: "Додавання зображення…" },
  devUploadFailed: { en: "Could not attach the image.", uk: "Не вдалося додати зображення." },
  devUploaded: { en: "Image attached.", uk: "Зображення додано." },
  devLinkSuggestions: { en: "Note suggestions", uk: "Підказки нотаток" },
  devDate: { en: "Date", uk: "Дата" },
  devToday: { en: "Today", uk: "Сьогодні" },
  devStatus: { en: "Status", uk: "Статус" },
  devStatusFinished: { en: "Finished", uk: "Завершено" },
  devStatusProgress: { en: "In progress", uk: "У процесі" },
  devStatusQueued: { en: "Queued", uk: "У черзі" },
  devRating: { en: "Rating", uk: "Оцінка" },
  devCover: { en: "Cover", uk: "Обкладинка" },
  devChooseImage: { en: "Choose an image…", uk: "Обрати зображення…" },
  devNoCover: { en: "None", uk: "Немає" },
  devCoverSaved: { en: "Cover saved.", uk: "Обкладинку збережено." },
  devCoverFailed: { en: "Could not save the cover.", uk: "Не вдалося зберегти обкладинку." },
  devInvalidRating: {
    en: "A rating is a half-star value from 0 to 5.",
    uk: "Оцінка — від 0 до 5 з кроком у пів зірки.",
  },
  devSidecarOutdated: {
    en: "The editor sidecar is out of date — restart npm run dev.",
    uk: "Редактор застарів — перезапустіть npm run dev.",
  },
  devDraftRestored: {
    en: "Restored your unsaved draft.",
    uk: "Відновлено незбережену чернетку.",
  },
  devDraftDropped: {
    en: "An unsaved draft was discarded because the file changed in Obsidian.",
    uk: "Незбережену чернетку відкинуто, бо файл змінився в Obsidian.",
  },
  devPreviewUnavailable: {
    en: "Live preview unavailable — the page updates after Save.",
    uk: "Живий перегляд недоступний — сторінка оновиться після збереження.",
  },
  devLivePreview: { en: "Live preview", uk: "Живий перегляд" },
  devEditorDrawer: { en: "Markdown editor", uk: "Редактор Markdown" },
  devCloseEditor: { en: "Close the editor (Esc)", uk: "Закрити редактор (Esc)" },
  devResizeEditor: { en: "Resize the editor", uk: "Змінити висоту редактора" },
  devBold: { en: "Bold", uk: "Жирний" },
  devItalic: { en: "Italic", uk: "Курсив" },
  devLink: { en: "Link", uk: "Посилання" },
  devHeading: { en: "Heading", uk: "Заголовок" },
  devQuote: { en: "Quote", uk: "Цитата" },
  devCallout: { en: "Callout", uk: "Виноска" },
  devCodeBlock: { en: "Code", uk: "Код" },
  devListItem: { en: "List", uk: "Список" },
  devNewParagraph: { en: "New paragraph", uk: "Новий абзац" },
  devSourceMode: { en: "Source", uk: "Джерело" },
  devDoneBlock: { en: "Done", uk: "Готово" },
  devBlockPlaceholder: { en: "Write here…", uk: "Пишіть тут…" },
  devTipBold: { en: "Bold — wraps the selection in ** (Cmd+B)", uk: "Жирний — обгортає виділене в ** (Cmd+B)" },
  devTipItalic: { en: "Italic — wraps the selection in * (Cmd+I)", uk: "Курсив — обгортає виділене в * (Cmd+I)" },
  devTipLink: { en: "Link to a note — [[ ]] with suggestions (Cmd+K)", uk: "Посилання на нотатку — [[ ]] з підказками (Cmd+K)" },
  devTipHeading: { en: "Heading — toggles ## on the line", uk: "Заголовок — перемикає ## на рядку" },
  devTipQuote: { en: "Quote — toggles > on the lines", uk: "Цитата — перемикає > на рядках" },
  devTipList: { en: "List — toggles - on the lines", uk: "Список — перемикає - на рядках" },
  devTipCallout: { en: "Callout — a > [!note] box around the selection", uk: "Виноска — блок > [!note] навколо виділеного" },
  devTipCode: { en: "Code block — a ``` fence around the selection", uk: "Блок коду — огорожа ``` навколо виділеного" },
  devTipImage: { en: "Insert an image — picks a file; paste or drop works too", uk: "Вставити зображення — вибір файлу; вставлення чи перетягування теж працює" },
  devTipNewParagraph: { en: "New paragraph at the end of the note", uk: "Новий абзац наприкінці нотатки" },
  devTipSource: { en: "Whole note as Markdown source, with live preview above", uk: "Уся нотатка як Markdown-джерело, з живим переглядом угорі" },
  devTipDone: { en: "Finish this block and render it (Esc, Cmd+Enter)", uk: "Завершити блок і відрендерити його (Esc, Cmd+Enter)" },
  devTipClose: { en: "Close the source editor and keep the draft (Esc)", uk: "Закрити редактор джерела, зберігши чернетку (Esc)" },
  devEditHint: {
    en: "Click any paragraph to edit it in place. Click below the text to add one.",
    uk: "Натисніть на будь-який абзац, щоб редагувати на місці. Натисніть під текстом, щоб додати новий.",
  },
  devMoreFields: { en: "More fields", uk: "Більше полів" },
  devAliases: { en: "Aliases", uk: "Псевдоніми" },
  devAliasesHint: { en: "Other names notes may link with, comma-separated", uk: "Інші назви, якими нотатки можуть посилатися, через кому" },
  devSlug: { en: "URL slug", uk: "Слаг URL" },
  devSlugHint: { en: "Changes this note's address — old links break", uk: "Змінює адресу нотатки — старі посилання зламаються" },
  devMaturity: { en: "Maturity", uk: "Зрілість" },
  devMediumField: { en: "Medium", uk: "Тип" },
  devCreatorBio: { en: "Creator bio", uk: "Про автора" },
  devCreatorBioUk: { en: "Creator bio (Ukrainian)", uk: "Про автора (українською)" },
  devImdbId: { en: "IMDb id", uk: "IMDb id" },
  devImdbIdHint: { en: "tt… from Wikidata P345, never guessed", uk: "tt… з Wikidata P345, не вгадується" },
  devVideoUrl: { en: "Video link", uk: "Посилання на відео" },
  devArtistUk: { en: "Artist (Ukrainian)", uk: "Виконавець (українською)" },
  devArtistBio: { en: "About this record", uk: "Про цей запис" },
  devArtistBioUk: { en: "About this record (Ukrainian)", uk: "Про цей запис (українською)" },
  devDeleteNote: { en: "Delete this note", uk: "Видалити нотатку" },
  devDeleteConfirm: {
    en: "Move this note and its Ukrainian body to vault/.trash? Images stay where they are.",
    uk: "Перемістити нотатку та її українську версію до vault/.trash? Зображення залишаться.",
  },
  devDeleting: { en: "Deleting…", uk: "Видалення…" },
  devDeleteFailed: { en: "Could not delete the note.", uk: "Не вдалося видалити нотатку." },
  devTipDelete: { en: "Moves the note pair to vault/.trash — reversible from Obsidian", uk: "Переміщує пару файлів до vault/.trash — можна повернути в Obsidian" },
  devStrike: { en: "Strikethrough", uk: "Закреслення" },
  devInlineCode: { en: "Inline code", uk: "Код у рядку" },
  devRule: { en: "Divider", uk: "Роздільник" },
  devTable: { en: "Table", uk: "Таблиця" },
  devTipStrike: { en: "Strikethrough — wraps the selection in ~~", uk: "Закреслення — обгортає виділене в ~~" },
  devTipInlineCode: { en: "Inline code — wraps the selection in backticks", uk: "Код у рядку — обгортає виділене у зворотні лапки" },
  devTipRule: { en: "Divider — a --- line", uk: "Роздільник — рядок ---" },
  devTipTable: { en: "Table — a two-column fact table to fill in", uk: "Таблиця — двоколонкова таблиця фактів для заповнення" },
  devTipBlockKeys: {
    en: "↑ / ↓ at the edges move between blocks · Backspace on an empty block removes it",
    uk: "↑ / ↓ на краях — між блоками · Backspace у порожньому блоці видаляє його",
  },
  devFactValue: { en: "Fact value", uk: "Значення факту" },
  devCreatorName: { en: "Creator name", uk: "Ім’я автора" },
  devTipOptions: {
    en: "Title, description, draft, date, status, rating, cover, categories, more fields, delete",
    uk: "Назва, опис, чернетка, дата, статус, оцінка, обкладинка, категорії, більше полів, видалення",
  },
  devCalloutKind: { en: "Callout kind", uk: "Вид виноски" },
  devTipCalloutMenu: {
    en: "Callout — pick a kind: > [!note], [!tip], [!warning], [!spoiler], [!pull] …",
    uk: "Виноска — оберіть вид: > [!note], [!tip], [!warning], [!spoiler], [!pull] …",
  },
  devSubheading: { en: "Subheading", uk: "Підзаголовок" },
  devTipSubheading: { en: "Subheading — toggles ### on the line", uk: "Підзаголовок — перемикає ### на рядку" },
  devNumbered: { en: "Numbered list", uk: "Нумерований список" },
  devTipNumbered: { en: "Numbered list — toggles 1. on the lines", uk: "Нумерований список — перемикає 1. на рядках" },
  devTask: { en: "Task", uk: "Завдання" },
  devTipTask: { en: "Task list — toggles - [ ] on the lines", uk: "Список завдань — перемикає - [ ] на рядках" },
  devFootnote: { en: "Footnote", uk: "Виноска внизу" },
  devTipFootnote: {
    en: "Footnote — a [^n] mark here and its note at the end (renders as a sidenote too)",
    uk: "Виноска внизу — позначка [^n] тут і текст наприкінці (також як бічна нотатка)",
  },
  devFootnoteText: { en: "Footnote text", uk: "Текст виноски" },
  devTitleRequired: { en: "The English title cannot be empty.", uk: "Англійська назва не може бути порожньою." },
  devPlaylists: { en: "Playlists", uk: "Плейлисти" },
  devPlaylistsHint: { en: "Apple Music links, one per line — embedded at the top of the section", uk: "Посилання Apple Music, по одному в рядку — вбудовуються вгорі розділу" },
  devArtistSectionBio: { en: "About the artist", uk: "Про виконавця" },
  devArtistSectionBioUk: { en: "About the artist (Ukrainian)", uk: "Про виконавця (українською)" },
  devPlayerLink: { en: "Player", uk: "Плеєр" },
  devTipPlayer: { en: "Player — an Apple Music or YouTube link on its own line becomes a player", uk: "Плеєр — посилання Apple Music чи YouTube на окремому рядку стає плеєром" },
  devDismiss: { en: "Dismiss", uk: "Закрити" },
  devHelpConflict: {
    en: "The file changed in Obsidian after you opened it. Reload to see that version; your draft stays in the editor until you do. Copy anything you want to keep first.",
    uk: "Файл змінився в Obsidian після відкриття. Перезавантажте, щоб побачити ту версію; чернетка лишається в редакторі до того. Спершу скопіюйте, що хочете зберегти.",
  },
  devHelpUnavailable: {
    en: "The editor sidecar is not answering. Make sure the site runs through `npm run dev`, not `next dev`, then Retry.",
    uk: "Редактор не відповідає. Переконайтеся, що сайт запущено через `npm run dev`, а не `next dev`, і натисніть «Спробувати ще раз».",
  },
  devHelpOutdated: {
    en: "The running sidecar is older than this page. Stop the dev server and start it again with `npm run dev`, then reload.",
    uk: "Запущений редактор старіший за цю сторінку. Зупиніть dev-сервер і запустіть знову через `npm run dev`, потім перезавантажте.",
  },
  devHelpSaveFailed: {
    en: "The write did not land. Check the terminal running `npm run dev` for the sidecar's error, then Save again.",
    uk: "Запис не відбувся. Перевірте термінал із `npm run dev` на помилку редактора й збережіть знову.",
  },
  devHelpUploadFailed: {
    en: "Only JPEG, PNG, GIF, WebP and AVIF up to 10 MiB can be attached. Check the file and try again.",
    uk: "Можна додавати лише JPEG, PNG, GIF, WebP і AVIF до 10 МіБ. Перевірте файл і спробуйте знову.",
  },
  devHelpTranslationFailed: {
    en: "The Ukrainian file could not be created — it may already exist beside the note. Check the folder in Obsidian.",
    uk: "Не вдалося створити український файл — можливо, він уже є поруч із нотаткою. Перевірте теку в Obsidian.",
  },
  devHelpDraftDropped: {
    en: "The note changed in Obsidian while your draft waited, so the draft could not be applied safely. The page shows the current file.",
    uk: "Нотатка змінилася в Obsidian, поки чернетка чекала, тож її не можна було безпечно застосувати. Сторінка показує поточний файл.",
  },
  devHelpNoSource: {
    en: "This page is assembled from many notes. Open one of them to edit its text; section pages edit their own main.md.",
    uk: "Ця сторінка зібрана з багатьох нотаток. Відкрийте одну з них, щоб редагувати; сторінки розділів редагують свій main.md.",
  },
  devHelpDone: { en: "Nothing to do.", uk: "Нічого робити не треба." },
  devTipHelp: {
    en: "Click any paragraph to edit it in place · click below the text to add one · ↑/↓ at the edges move between blocks · Backspace on an empty block removes it · Esc or Cmd+Enter renders it",
    uk: "Натисніть на абзац, щоб редагувати на місці · під текстом — щоб додати · ↑/↓ на краях — між блоками · Backspace у порожньому блоці видаляє його · Esc чи Cmd+Enter рендерить",
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
