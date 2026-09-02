import Link from "next/link";
import type { CSSProperties } from "react";
import NewBadge from "@/components/NewBadge";
import ShelfRow from "@/components/lists/ShelfRow";
import T from "@/components/T";
import { spineHeight, spineStyle } from "@/lib/spine";
import type { ShelfItem } from "@/lib/shelf";

/**
 * The books as an actual shelf: standing spines on one hairline.
 *
 * This is the SECTION page's books row (`/shelf`), where the other mediums
 * keep their Netflix strips of faces. The medium page behind it
 * (`/shelf/type/books`) shows the covers full size in a grid.
 *
 * That split is the way round it is because the two pages ask different
 * questions. `/shelf` is a glance at everything — four mediums sharing one
 * screen — and a shelf answers it in a fraction of the room a cover strip
 * needs: eleven books in about 500px, no scrolling, and it is the one row on
 * the page that looks like the thing the section is named after. The medium
 * page is where you have already chosen books and want to look at them, and
 * there the cover art — which was sourced with effort — is what you actually
 * recognise a book by. Compact overview, rich detail; see docs/DECISIONS.md
 * #110, including the earlier arrangement this replaced.
 *
 * Books only. A poster is meant to be seen face-on and nobody's mental model
 * of a film is its spine, so every other medium keeps its row.
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
 * no wood and no shadow under a plank. Same discipline as `.note-wash`.
 *
 * Real text, top-to-bottom (`writing-mode: vertical-rl`, no transform — the
 * North American convention and the one with no rotation to get wrong), so a
 * spine stays selectable, searchable and readable aloud. Never an image of
 * words.
 */
export default function BookSpines({
  items,
  sectionSlug,
  className = "mt-8",
}: {
  items: ShelfItem[];
  sectionSlug: string;
  /** Spacing differs by host: a medium page opens on it, a section row
      follows a heading. The shelf itself is identical in both. */
  className?: string;
}) {
  /* Both heights come from the same `spineHeight()` the spines themselves
     use, so the pull below cannot disagree with what gets painted. */
  const heights = items.map((item) => spineHeight(item.coverAr));
  const leadGap = heights.length ? Math.max(...heights) - heights[0] : 0;

  return (
    /* The same scroller the other medium rows use, so the shelf is dragged
       exactly the way they are — and `.shelf-row` is what its `cursor: grab`
       and `.is-dragging` rules are scoped to, so the class has to be here
       rather than reimplemented.

       `.stagger` stays on the <ul>: the j/k keyboard shortcuts find rows
       through it, and every list on the site already carries it. */
    <ShelfRow
      className={`shelf-row book-shelf stagger ${className}`}
      /* How much SHORTER the leftmost book is than the tallest one.
         `.book-shelf-gap` pulls the row up by exactly this, so the FIRST book
         — not the row's box — sits under the heading at the same distance a
         Shows card does. The books are bottom-aligned, so the box's top
         belongs to whichever book happens to be tallest, which is the wrong
         thing to match against a row of equal-height cards.

         It used to be a literal −38px: that difference, measured once on a
         shelf where a short book led the row and the tall ones stood far to
         its right, over empty space. 11/22/63 broke both halves of that at
         once — digits sort before letters so it leads the row, and it is one
         of the tallest books on it — and the fixed pull ran 34px too far and
         stood the book straight through the "Books" heading. Derived from the
         items, it cannot drift again whatever is added or however it sorts. */
      style={{ "--shelf-lead": `${leadGap}px` } as CSSProperties}
    >
      {items.map((item) => {
        const { bg, fg } = spineStyle(item.coverDom);
        const uk =
          item.titleUk && item.titleUk !== item.title ? item.titleUk : undefined;

        /* Custom properties rather than direct declarations: the CSS owns
           what to do with them, including the fallback spine when a book has
           no local cover and there is no colour to borrow. */
        const h = spineHeight(item.coverAr);
        /* A photographed spine stands at its MEASURED thickness; anything
           else keeps the shelf's uniform `--spine-w`. Deriving thickness from
           a page count was built and thrown away — see DECISIONS #110: it is
           within a pixel on paperbacks and ~10px under on hardbacks, where
           boards and stock carry the thickness and the page count does not.

           NOT rounded. The width is the image's own aspect ratio against the
           height, so leaving it fractional makes the box's ratio EXACTLY the
           artwork's and `object-fit: cover` has nothing to crop. Rounded to
           whole pixels it was off by up to half a pixel, which cost 9px of
           the source — enough to shave the wolf off the foot of The Last
           Wish, whose medallion sits a few pixels from the edge. */
        const width =
          item.spineUrl && item.spineAr ? h / item.spineAr : undefined;
        const widthUk =
          item.spineUkUrl && item.spineUkAr ? h / item.spineUkAr : undefined;
        const style = {
          "--spine-h": `${h}px`,
          /* The same two numbers UNITLESS, because `aspect-ratio` takes a
             ratio and not a pair of lengths. They are what lets the row
             shrink to fit: `.book-spine` sizes from `width` and derives its
             height from this, so when flexbox takes width off an overcrowded
             row every book loses the same FRACTION and the shelf keeps its
             proportions instead of clipping the last book. See #112. */
          "--spine-hn": `${h}`,
          ...(bg ? { "--spine-bg": bg, "--spine-fg": fg } : {}),
          /* Height stays the SHARED one either way: books on a shelf differ
             in height a little and in thickness a lot, and height is what the
             eye runs along. Only the width is per-book. */
          ...(width
            ? {
                "--spine-w": `${width.toFixed(2)}px`,
                "--spine-wn": `${width.toFixed(2)}`,
              }
            : {}),
          ...(widthUk
            ? {
                "--spine-w-uk": `${widthUk.toFixed(2)}px`,
                "--spine-wn-uk": `${widthUk.toFixed(2)}`,
              }
            : {}),
        } as CSSProperties;

        /* One line, ellipsised, with the full string in the tooltip — the
           treatment `.toc-link` already gets. Two elements when there is a
           translation, each with its own tooltip, because `title` is one
           attribute and cannot hold both languages (components/T.tsx). */
        /* The byline follows the title's language: a Latin name beside a
           Cyrillic title, on a 44px spine where the two are a few pixels
           apart, reads as a page that was only half translated. */
        /* Two photographs only when the vault actually holds the Ukrainian
           one; otherwise the single image shows in both languages, which is
           `T`'s contract (components/T.tsx). */
        const ukArt = Boolean(item.spineUrl && item.spineUkUrl);

        // eslint-disable-next-line @next/next/no-img-element
        const art = (src: string, blur?: string, langClass?: string) => (
          <img
            key={langClass ?? "one"}
            src={src}
            alt=""
            className={`book-spine-art${langClass ? ` ${langClass}` : ""}`}
            style={blur ? { backgroundImage: `url("${blur}")` } : undefined}
            /* NOT lazy, deliberately. The inactive language starts at
               `display: none`, and a lazy image that is hidden when the
               document is parsed never enters the viewport observer — it
               stays unloaded even after the toggle reveals it, so switching
               to Ukrainian showed an empty book. Same shape as #95, where a
               hidden lazy iframe never loads; there that was the POINT, here
               it is the bug. Two 25KB photographs is a cheap answer. */
          />
        );

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
          /* The custom properties live on the SLOT, not on the spine, because
             the slot needs `--spine-w` for its own shrink floor. They still
             reach `.book-spine` — custom properties inherit — so every rule
             that reads them is unchanged. */
          <li key={item.slug} className="book-slot" style={style}>
            <Link
              href={`/${sectionSlug}/${item.slug}`}
              className="book-spine press"
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
                   would announce the book twice.

                   A `<name>.uk.<ext>` sibling makes it two photographs, one
                   per language, shown the way everything bilingual here is
                   shown — both in the HTML, CSS picks one. The lang class can
                   sit straight on the <img> ONLY because `.book-spine-art`
                   declares no `display`; give it one and the toggle breaks
                   exactly as it did for `.book-spine-text`. */
                art(item.spineUrl, item.spineBlur, ukArt ? "lang-en" : undefined)
              ) : uk ? (
                [
                  label(item.title, item.author, "lang-en"),
                  label(uk, item.authorUk ?? item.author, "lang-uk"),
                ]
              ) : (
                label(item.title, item.author)
              )}
              {ukArt && art(item.spineUkUrl!, item.spineUkBlur, "lang-uk")}
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
              {/* The book's face, for hover. A spine says which book it is
                  only if you already know the book — the cover is what a
                  reader actually recognises, and it lives one click away on
                  the medium page, so bringing it out under the pointer costs
                  nothing and answers the question the spine raises.

                  A child of the spine, so it inherits the lift and the two
                  move as one object. `loading="lazy"` is CORRECT here and
                  wrong on the spine art: this is hidden with `opacity`, not
                  `display`, so it keeps its box, intersects the viewport and
                  loads normally. */}
              {item.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.coverUrl}
                  srcSet={item.coverSrcSet}
                  /* Painted about 170–190px wide, so the 256w variant is the
                     right pick — without this the browser assumes 100vw and
                     downloads the original for a hover state. */
                  sizes="200px"
                  alt=""
                  aria-hidden
                  className="book-spine-cover"
                  style={
                    {
                      "--cover-ar": item.coverAr ?? 1.5,
                      ...(item.coverBlur
                        ? { backgroundImage: `url("${item.coverBlur}")` }
                        : {}),
                    } as CSSProperties
                  }
                  loading="lazy"
                />
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
    </ShelfRow>
  );
}
