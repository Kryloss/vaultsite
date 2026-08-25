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
        const h = spineHeight(item.coverAr);
        const style = {
          "--spine-h": `${h}px`,
          ...(bg ? { "--spine-bg": bg, "--spine-fg": fg } : {}),
          /* A photographed spine sets its OWN width from the artwork, so the
             book stands at its real thickness. This is the one number the
             generated spine deliberately refuses to invent — with a photo it
             is measured, not guessed. Height stays the shared one: books on a
             shelf differ in height a little and in thickness a lot, and
             height is what the eye runs along. */
          ...(item.spineUrl && item.spineAr
            ? { "--spine-w": `${Math.round(h / item.spineAr)}px` }
            : {}),
        } as CSSProperties;

        /* One line, ellipsised, with the full string in the tooltip — the
           treatment `.toc-link` already gets. Two elements when there is a
           translation, each with its own tooltip, because `title` is one
           attribute and cannot hold both languages (components/T.tsx). */
        /* The byline follows the title's language: a Latin name beside a
           Cyrillic title, on a 44px spine where the two are a few pixels
           apart, reads as a page that was only half translated. */
        const label = (title: string, author?: string, langClass?: string) => (
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
            title={author ? `${title} — ${author}` : title}
          >
            <span className="book-spine-lines">
              <span className="book-spine-title">{title}</span>
              {author && <span className="book-spine-author">{author}</span>}
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
              data-art={item.spineUrl ? "" : undefined}
              /* Only on a photographed spine. A generated one carries a
                 tooltip per LANGUAGE on the text itself (below); one here as
                 well would stack two tooltips on the same book. */
              title={
                item.spineUrl
                  ? item.author
                    ? `${item.title} — ${item.author}`
                    : item.title
                  : undefined
              }
            >
              {/* A dot at the HEAD of the spine — first in the flow, which in
                  `writing-mode: vertical-rl` is the top, and which also puts
                  "New" before the title for anyone hearing the link read out.
                  There is no room for the chip or the cover pill at 44px, and
                  it is client-only either way. */}
              <NewBadge date={item.date} variant="dot" />
              {item.spineUrl ? (
                /* The real thing. Its words are printed ON it, so the drawn
                   ones would be a second title over the first — the text
                   moves to `sr-only` below instead, where search, the reader
                   and `j`/`k` still get it. `alt=""` because that text is
                   already the link's accessible name; alt on the image too
                   would announce the book twice. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.spineUrl}
                  alt=""
                  className="book-spine-art"
                  style={
                    item.spineBlur
                      ? { backgroundImage: `url("${item.spineBlur}")` }
                      : undefined
                  }
                  loading="lazy"
                />
              ) : uk ? (
                [
                  label(item.title, item.author, "lang-en"),
                  label(uk, item.authorUk ?? item.author, "lang-uk"),
                ]
              ) : (
                label(item.title, item.author)
              )}
              {item.spineUrl && (
                /* The photograph's words are pixels, so this is the link's
                   only real name — and it follows the reader's language the
                   same way the drawn spine's two labels do. */
                <span className="sr-only">
                  <T
                    en={
                      item.author ? `${item.title} — ${item.author}` : item.title
                    }
                    uk={
                      uk &&
                      (item.authorUk ?? item.author
                        ? `${uk} — ${item.authorUk ?? item.author}`
                        : uk)
                    }
                  />
                </span>
              )}
              {item.statusLabel && (
                <span className="sr-only">
                  <T {...item.statusLabel} />
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
