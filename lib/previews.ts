/**
 * Link preview index — the data behind hover cards on internal links.
 *
 * Built once at build time and passed to components/LinkPreview.tsx as props,
 * exactly like the Cmd+K search index (decision #8): no runtime fetch, no
 * backend. Excerpts are capped hard so the payload stays small — this is
 * roughly a tenth the size of the search index already in every page.
 */
import {
  getSections,
  getEntries,
  displayDate,
  displayDateUk,
} from "./vault";
import { resolveCoverUrl } from "./markdown";

export interface LinkPreview {
  /** Site-absolute URL, e.g. "/posts/how-was-my-day" — the lookup key. */
  href: string;
  title: string;
  titleUk?: string;
  /** Where it lives, e.g. "Posts" (sections themselves read "Section"). */
  section: string;
  sectionUk?: string;
  excerpt: string;
  excerptUk?: string;
  /** Pre-formatted so the client does no date work. */
  dateLabel?: string;
  dateLabelUk?: string;
  /** Cover image for section types that have one (people, shelf). */
  cover?: string;
}

const EXCERPT_CHARS = 180;

/** Markdown → a short, clean plain-text excerpt. */
function excerpt(md: string): string {
  const text = md
    // Drop fenced code, frontmatter-ish separators and embeds first.
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^---[\s\S]*?---/, " ")
    .replace(/!\[\[[^\]]*\]\]/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/<[^>]+>/g, " ")
    // Keep the readable half of links: [[Note|label]] and [text](url).
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, t, l) => l || t)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^>\s?\[![a-z]+\][+-]?\s*/gim, "")
    .replace(/[#>*_`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= EXCERPT_CHARS) return text;
  const cut = text.slice(0, EXCERPT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Every page on the site, keyed by URL. Entries carry their date and cover;
 * sections carry their description or body opening.
 */
export function getLinkPreviews(): LinkPreview[] {
  const out: LinkPreview[] = [];

  for (const section of getSections()) {
    out.push({
      href: section.slug === "home" ? "/" : `/${section.slug}`,
      title: section.title,
      titleUk: section.titleUk,
      section: "Section",
      sectionUk: "Розділ",
      excerpt: section.description?.trim() || excerpt(section.content),
      excerptUk:
        section.descriptionUk?.trim() ||
        (section.contentUk ? excerpt(section.contentUk) : undefined),
    });

    for (const entry of getEntries(section)) {
      out.push({
        href: `/${section.slug}/${entry.slug}`,
        title: entry.title,
        titleUk: entry.titleUk,
        section: section.title,
        sectionUk: section.titleUk,
        excerpt: entry.description?.trim() || excerpt(entry.content),
        excerptUk: entry.contentUk ? excerpt(entry.contentUk) : undefined,
        dateLabel: entry.date ? displayDate(entry.date) : undefined,
        dateLabelUk: entry.date ? displayDateUk(entry.date) : undefined,
        cover: resolveCoverUrl(entry.sectionDir, entry.meta.cover),
      });
    }
  }

  return out;
}
