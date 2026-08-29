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
import { dimsFor, srcSetFor } from "./blur";

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
  /**
   * The cover's intrinsic width ÷ height. The card sizes the image from this
   * rather than cropping it into a fixed portrait box: the vault's covers run
   * from 0.60 (a tall paperback) through 1.00 (a square portrait) to 5.05 (a
   * show's logo banner), and a 2:3 box beheaded the square ones. Undefined for
   * remote `cover: https://…` images, which have no build-time size — the card
   * falls back to 2:3 and contains rather than crops. See DECISIONS #85.
   */
  coverAr?: number;
  /** Narrower WebP copies — the card paints the cover at ~80px, not 1000px. */
  coverSrcSet?: string;
}

/* Short enough that the card stays about as tall as its cover — nothing is
   line-clamped any more, so this is what bounds the card's height. */
const EXCERPT_CHARS = 140;

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
    // Bare URLs (a pasted YouTube/Apple Music link becomes an embed on the
    // page, so it's noise in a one-line excerpt).
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^>\s?\[![a-z]+\][+-]?\s*/gim, "")
    .replace(/[#>*_`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= EXCERPT_CHARS) return text;
  const cut = text.slice(0, EXCERPT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
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
      const cover = resolveCoverUrl(entry.sectionDir, entry.meta.cover);
      const dims = dimsFor(cover);
      out.push({
        href: `/${section.slug}/${entry.slug}`,
        title: entry.title,
        titleUk: entry.titleUk,
        section: section.title,
        sectionUk: section.titleUk,
        excerpt: entry.description?.trim() || excerpt(entry.content),
        excerptUk:
          entry.descriptionUk?.trim() ||
          (entry.contentUk ? excerpt(entry.contentUk) : undefined),
        dateLabel: entry.date ? displayDate(entry.date) : undefined,
        dateLabelUk: entry.date ? displayDateUk(entry.date) : undefined,
        cover,
        coverAr: dims ? Number((dims.w / dims.h).toFixed(3)) : undefined,
        coverSrcSet: cover ? srcSetFor(cover) : undefined,
      });
    }
  }

  return out;
}

/**
 * Just the previews a given page can actually use.
 *
 * The whole index used to be passed to components/LinkPreview.tsx from the
 * layout, which put every note's excerpt into every page — a note linking to
 * two others was carrying sixty. Each page now scans its own rendered HTML
 * and takes the handful of entries matching links that are really in it,
 * which for a typical note is two or three.
 *
 * Reading the HTML rather than the markdown is deliberate: by this point
 * `[[wiki links]]` have been resolved to real hrefs, so this sees exactly
 * what the reader can hover.
 */
export function previewsInHtml(...html: (string | null | undefined)[]): LinkPreview[] {
  const wanted = new Set<string>();
  for (const doc of html) {
    if (!doc) continue;
    for (const [, href] of doc.matchAll(/href="(\/[^"#?]*)/g)) {
      // Match the lookup key LinkPreview builds: no trailing slash, decoded.
      const path = href.replace(/\/$/, "") || "/";
      wanted.add(path);
      try {
        wanted.add(decodeURI(path));
      } catch {
        /* malformed escape — the raw path is already in the set */
      }
    }
  }
  if (wanted.size === 0) return [];
  return getLinkPreviews().filter((p) => wanted.has(p.href));
}
