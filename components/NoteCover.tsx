import type { CSSProperties } from "react";

/**
 * A shelf note's artwork, parked in the right gutter of its own note.
 *
 * The same idea as the album player on a music note (#98): a note about a
 * thing that HAS a face should show that face, and the gutter is where a wide
 * window has room for it without moving a word of the writing. Both are the
 * artwork of the work the page is about, both sit at `top: 5rem` in the column
 * the contents rail otherwise owns, and both push that rail below them.
 *
 * EVERY MEDIUM BUT VIDEO (#135). This was films and shows only for two
 * passes, on the grounds that a book's face is already the row of spines it
 * came from and its own medium page — but a film has a poster grid in exactly
 * the same way, and what this column is for is the note in front of you. A
 * VIDEO note is the one that still shows nothing here: it embeds the video a
 * few lines below, so the artwork would be a still of the thing already
 * playing under it. Its creator block and facts take the column anyway.
 *
 * **Gutter or nothing.** Below 1168px — the width where the gutter itself
 * arrives (#107, #136) — it is not shown at all: no inline fallback, unlike
 * the album embed, which drops into the writing because a player is something
 * you operate. A poster is something you look at, and the
 * note's opening is a designed sequence (creator block, then facts, then the
 * writing — #86, #87); inserting artwork into it at narrow widths would be
 * redesigning that page rather than enriching a wide one. Every list that
 * links here already leads with the cover, so nothing is lost.
 *
 * Decorative, hence `alt=""` and `aria-hidden`: the note's `<h1>` names the
 * work on the same screen, so announcing the artwork would be the title
 * twice.
 */
export default function NoteCover({
  src,
  srcSet,
  blur,
  /** Intrinsic h / w, so a 2:3 poster and a squarer one both keep their shape. */
  ar = 1.5,
}: {
  src: string;
  srcSet?: string;
  blur?: string;
  ar?: number;
}) {
  return (
    <aside
      className="note-cover"
      aria-hidden="true"
      style={{ "--cover-ar": ar } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        srcSet={srcSet}
        /* Painted at 13rem, so the 256w variant is the right pick; without
           `sizes` the browser assumes 100vw and fetches the original. */
        sizes="208px"
        alt=""
        /* Never fetched below the gutter's width, where this element is
           `display: none` — a lazy image that is never displayed is never
           requested (#95). Above it the poster is at the top of the window,
           so it loads at once. */
        loading="lazy"
        style={blur ? { backgroundImage: `url("${blur}")` } : undefined}
      />
    </aside>
  );
}
