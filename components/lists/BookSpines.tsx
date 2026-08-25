import Link from "next/link";
import type { CSSProperties } from "react";
import NewBadge from "@/components/NewBadge";
import T from "@/components/T";
import { spineHeight, spineStyle } from "@/lib/spine";
import type { ShelfItem } from "@/lib/shelf";

/**
 * The book medium page as an actual shelf: standing spines on one hairline.
 *
 * The section page (`/shelf`) keeps its Netflix row of faces. This is the
 * other half of a deliberate pair — **rows are faces, the shelf is spines** —
 * so the medium page is a different object rather than the same row one size
 * larger, which is all `/shelf/type/book` used to be. See docs/DECISIONS.md.
 *
 * Books only. A poster is meant to be seen face-on and nobody's mental model
 * of a film is its spine, so every other medium keeps the grid — the switch
 * is one line in ShelfTypeView.
 *
 * Everything visible here comes from the book:
 *
 * - the **colour** is the cover's own dominant hue (scripts/dominant-colour.mjs)
 *   clamped into a legible band (lib/spine.ts). It does not flip with the
 *   theme, because it belongs to the book rather than to the page — and it
 *   does not reopen the `--accent` question (#64) for the same reason: no
 *   colour here is the site's.
 * - the **height** is the cover's aspect ratio, so a tall book stands tall.
 *   Never a hash: a random height looks identical to this one and means
 *   nothing.
 * - the **width** is uniform. Thickness would want a page count, and inventing
 *   one is a lie about a real object.
 *
 * The furniture supplies nothing: one `--border` hairline is the whole shelf,
 * no wood and no shadow under a plank. Same discipline as `.music-wash`.
 *
 * Real text, top-to-bottom (`writing-mode: vertical-rl`, no transform — the
 * North American convention and the one with no rotation to get wrong), so a
 * spine stays selectable, searchable and readable aloud. Never an image of
 * words.
 */
export default function BookSpines({
  items,
  sectionSlug,
}: {
  items: ShelfItem[];
  sectionSlug: string;
}) {
  return (
    /* `.stagger` stays on the <ul>: the j/k keyboard shortcuts find rows
       through it, and every list on the site already carries it. */
    <ul className="book-shelf stagger mt-8">
      {items.map((item) => {
        const { bg, fg } = spineStyle(item.coverDom);
        const uk =
          item.titleUk && item.titleUk !== item.title ? item.titleUk : undefined;

        /* Custom properties rather than direct declarations: the CSS owns
           what to do with them, including the fallback spine when a book has
           no local cover and there is no colour to borrow. */
        const style = {
          "--spine-h": `${spineHeight(item.coverAr)}px`,
          ...(bg ? { "--spine-bg": bg, "--spine-fg": fg } : {}),
        } as CSSProperties;

        /* One line, ellipsised, with the full string in the tooltip — the
           treatment `.toc-link` already gets. Two elements when there is a
           translation, each with its own tooltip, because `title` is one
           attribute and cannot hold both languages (components/T.tsx). */
        const label = (title: string, langClass?: string) => (
          /* The element carrying `.lang-en`/`.lang-uk` must NEVER be given a
             `display` of its own: the language toggle works by setting
             `display: none` on the inactive one, and this file has no
             `@layer`, so a bare `.book-spine-text { display: flex }` written
             at the foot silently beats it and both languages paint at once
             (#51, #52, #81 — it did, on the first pass). The flex lives one
             level down, on an element the toggle never touches. */
          <span
            key={langClass ?? "one"}
            className={`book-spine-text${langClass ? ` ${langClass}` : ""}`}
            lang={langClass === "lang-uk" ? "uk" : undefined}
            title={item.author ? `${title} — ${item.author}` : title}
          >
            <span className="book-spine-lines">
              <span className="book-spine-title">{title}</span>
              {item.author && (
                <span className="book-spine-author">{item.author}</span>
              )}
            </span>
          </span>
        );

        return (
          <li key={item.slug} className="book-slot">
            <Link
              href={`/${sectionSlug}/${item.slug}`}
              className="book-spine press"
              style={style}
              /* Reading state is POSITION here — the book sits proud of the
                 shelf, which is what people actually do with one they are
                 part-way through. Position says nothing to a screen reader,
                 so the label it replaces is kept as text below. */
              data-status={item.status === "progress" ? "progress" : undefined}
            >
              {uk ? [label(item.title, "lang-en"), label(uk, "lang-uk")] : label(item.title)}
              {item.statusLabel && (
                <span className="sr-only">
                  <T {...item.statusLabel} />
                </span>
              )}
              {/* A dot at the head of the spine — there is no room for the
                  cover pill, and client-only either way. */}
              <NewBadge date={item.date} variant="dot" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
