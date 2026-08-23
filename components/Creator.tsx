import T from "@/components/T";
import type { ShelfCreator } from "@/lib/shelf";

/**
 * The person behind a shelf item — a round portrait, their role, their name
 * and one or two sentences — sitting above the note's own "At a glance"
 * table on every book, film, show and video page.
 *
 * Why it's above the table rather than a row inside it: the table is a list
 * of facts about the WORK (published, read, one-liner), and a maker is a
 * different kind of thing. As a table row the author was one line of type
 * indistinguishable from the publication year; as a block with a face it's
 * the first thing you meet, which is how you actually meet a book.
 *
 * Server-rendered, no state, no JS. Presentational only — lib/shelf.ts
 * (`entryCreator`) does the frontmatter reading and the fs-backed image
 * lookups, since neither may reach the browser.
 *
 * Every field below the name is optional and the block degrades one at a
 * time: no `author_photo:` falls back to initials on the card surface, no
 * `author_bio:` leaves role and name standing alone. That is not a rare
 * path — a novelist usually has a freely licensed portrait on Wikimedia
 * Commons and a YouTube channel usually has none, so both shapes ship.
 *
 * A plain <div>, not a <section>: a section is only worth having as a
 * landmark if it can be named, an `aria-label` takes one string, and this
 * site renders BOTH languages into every page (components/T.tsx) — so any
 * name I could give it would be English for a Ukrainian reader. The role and
 * the name are visible text and are read in order without it.
 */
export default function Creator({ creator }: { creator: ShelfCreator }) {
  const { name, nameUk, role, photoUrl, photoBlur, photoSrcSet, bio, bioUk } =
    creator;

  return (
    <div className="creator">
      <div className="creator-photo">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            srcSet={photoSrcSet}
            /* 72px, dropping to 56px below 480px (`--creator-size` in
               globals.css). One candidate covers both: the 256px variant is
               what a 2x phone wants either way, and naming the larger box
               errs toward the sharper file rather than a soft one. */
            sizes="72px"
            /* The name alone. "Portrait of X" is what the shape already
               says, and the role label sits right beside it in text. */
            alt={name}
            width={72}
            height={72}
            /* Blur-up placeholder as the image's own background, so the real
               photo paints straight over it — same trick as the covers, see
               lib/blur.ts. */
            style={
              photoBlur
                ? {
                    backgroundImage: `url("${photoBlur}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
            loading="lazy"
          />
        ) : (
          <span className="creator-initials" aria-hidden>
            {initials(name)}
          </span>
        )}
      </div>

      <div className="creator-text">
        <p className="creator-role">
          <T {...role} />
        </p>
        <p className="creator-name">
          <T en={name} uk={nameUk} />
        </p>
        {bio && (
          <p className="creator-bio">
            <T en={bio} uk={bioUk} />
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * "Yuval Noah Harari" → "YH", for the creators with no free portrait.
 *
 * FIRST and LAST word, not the first two the People grid takes: a person's
 * surname is the half you recognise, so a middle name must not push it out.
 * Anything after a `|` is dropped first — a YouTube channel is often written
 * "Nate Herk | AI Automation", where the tagline after the pipe is not part
 * of the name and would otherwise supply the second letter.
 */
function initials(name: string): string {
  const words = name.split("|")[0].trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
