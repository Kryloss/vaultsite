/**
 * The People card's paragraph.
 *
 * A person's note opens with an `## At a glance` fact table and only then says
 * anything in sentences, so the generic excerpt in `lib/previews.ts` — which
 * flattens whatever comes first — would print "At a glance Born January 21,
 * 1991 — Vasylivka…" on the card. This walks past the headings and the table
 * to the first real PARAGRAPH instead: the opening of "Why him", which is the
 * one bit of the note that is Kyrylo talking about the person.
 *
 * Text only, and no `fs` — the result is serialized into the client half of
 * the list (components/lists/PeopleGridClient.tsx) as a plain string.
 */

/* Two lines of the card's panel at its widest, three at its narrowest. Long
   enough to be a thought, short enough that the panel stays about as tall as
   the portrait beside it. */
const BLURB_CHARS = 190;

/** A person's note → the opening of its first prose paragraph. */
export function personBlurb(md: string, limit = BLURB_CHARS): string {
  const body = md
    .replace(/^---[\s\S]*?\n---\s*/, "") // frontmatter
    .replace(/```[\s\S]*?```/g, "");

  for (const block of body.split(/\n\s*\n/)) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      // Headings, table rows, images and embeds are not the paragraph.
      .filter((l) => !/^#{1,6}\s/.test(l) && !l.startsWith("|"));
    if (lines.length === 0) continue;

    const text = clean(lines.join(" "));
    // A stray line of link syntax or a one-word label isn't a paragraph.
    if (text.length < 40) continue;
    return truncate(text, limit);
  }
  return "";
}

/** Markdown inline syntax → readable plain text. Mirrors lib/previews.ts. */
function clean(md: string): string {
  return md
    .replace(/!\[\[[^\]]*\]\]/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, t, l) => l || t)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^>\s?\[![a-z]+\][+-]?\s*/gim, "")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut on a word boundary, never mid-word. */
function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:—-]+$/, "")}…`;
}
