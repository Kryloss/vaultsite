/**
 * Quotes collection — the blockquotes already written inside book notes,
 * gathered onto one page at /<section>/type/books/quotes.
 *
 * Nothing new to maintain: if you quote a passage in a book's note, it shows
 * up here. Callouts are excluded, since `> [!note]` is a blockquote to
 * markdown but an aside to a reader.
 */
import { type Entry } from "./vault";
import { entryMedium } from "./shelf";

export interface BookQuotes {
  slug: string;
  title: string;
  titleUk?: string;
  author?: string;
  /** Each quote in both languages; `uk` only when the counts line up. */
  quotes: { en: string; uk?: string }[];
}

/** Fenced code can contain `>` lines that aren't quotes. */
function withoutCode(md: string): string {
  return md.replace(
    /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm,
    ""
  );
}

/**
 * Blockquote blocks in a note, as single-paragraph strings.
 *
 * Markdown lets a quote run across lines; those are joined with spaces so a
 * quote reads as one passage regardless of how it was wrapped in Obsidian.
 */
export function extractQuotes(md: string): string[] {
  const out: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    // `> [!note] …` is a callout, not a quotation.
    if (!/^\s*\[!\w+\]/.test(current[0])) {
      // Kept verbatim. An earlier version stripped a trailing "— Attribution",
      // which also ate the second half of any quote containing an em dash —
      // silently truncating someone's words is far worse than the occasional
      // redundant byline.
      const text = current.join(" ").replace(/\s+/g, " ").trim();
      if (text) out.push(text);
    }
    current = [];
  };

  for (const line of withoutCode(md).split("\n")) {
    if (/^\s*>/.test(line)) {
      current.push(line.replace(/^\s*>\s?/, ""));
    } else if (line.trim() === "" && current.length > 0) {
      flush();
    } else if (current.length > 0) {
      flush();
    }
  }
  flush();

  return out.filter(Boolean);
}

/** Book entries that contain at least one quote, alphabetical by title. */
export function getBookQuotes(entries: Entry[]): BookQuotes[] {
  const out: BookQuotes[] = [];

  for (const entry of entries) {
    if (entryMedium(entry) !== "book") continue;

    const en = extractQuotes(entry.content);
    if (en.length === 0) continue;
    const uk = entry.contentUk ? extractQuotes(entry.contentUk) : [];
    // Only pair them when both bodies quote the same number of passages —
    // otherwise the translations would be attached to the wrong quotes.
    const paired = uk.length === en.length;

    out.push({
      slug: entry.slug,
      title: entry.title,
      titleUk: entry.titleUk,
      author:
        typeof entry.meta.author === "string" ? entry.meta.author : undefined,
      quotes: en.map((text, i) => ({
        en: text,
        uk: paired ? uk[i] : undefined,
      })),
    });
  }

  return out.sort((a, b) => a.title.localeCompare(b.title));
}
