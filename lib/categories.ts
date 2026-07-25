/**
 * Category display names, in both languages.
 *
 * Deliberately free of server-only imports (no fs, no lib/vault) so client
 * components — the posts list — can import it. lib/shelf.ts re-exports
 * `categoryLabel` for the server-side callers that already import from there.
 *
 * Categories are written in English in frontmatter; this is the only place
 * their Ukrainian names live. Anything missing falls back to the English
 * string in both languages, so a new category never breaks — it just reads the
 * same either way until it's added here. URL slugs are always built from the
 * English name, so adding a translation never changes a page's address.
 */
import type { Str } from "./ui-strings";

const CATEGORY_LABELS: Record<string, Str> = {
  // video
  entertainment: { en: "Entertainment", uk: "Розваги" },
  politics: { en: "Politics", uk: "Політика" },
  tech: { en: "Tech", uk: "Технології" },
  education: { en: "Education", uk: "Освіта" },
  music: { en: "Music", uk: "Музика" },
  popsci: { en: "PopSci", uk: "Наукпоп" },
  // movie / show
  "sci-fi": { en: "Sci-Fi", uk: "Фантастика" },
  thriller: { en: "Thriller", uk: "Трилер" },
  drama: { en: "Drama", uk: "Драма" },
  action: { en: "Action", uk: "Бойовик" },
  comedy: { en: "Comedy", uk: "Комедія" },
  documentary: { en: "Documentary", uk: "Документальне" },
  anime: { en: "Anime", uk: "Аніме" },
  // book
  nonfiction: { en: "Nonfiction", uk: "Нонфікшн" },
  fiction: { en: "Fiction", uk: "Художня література" },
  history: { en: "History", uk: "Історія" },
  science: { en: "Science", uk: "Наука" },
  biography: { en: "Biography", uk: "Біографія" },
  // posts
  cybersecurity: { en: "Cybersecurity", uk: "Кібербезпека" },
  meta: { en: "Meta", uk: "Про сайт" },
};

/** Bilingual label for a category name from frontmatter. */
export function categoryLabel(category: string): Str {
  return (
    CATEGORY_LABELS[category.trim().toLowerCase()] ?? {
      en: category,
      uk: category,
    }
  );
}
