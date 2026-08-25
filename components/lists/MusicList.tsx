import Link from "next/link";
import type { ListProps } from "@/lib/section-types";
import {
  appleMusicEmbedUrl,
  appleMusicEmbedHeight,
  isAppleMusicUrl,
  APPLE_MUSIC_IFRAME_ALLOW,
} from "@/lib/apple-music";
import { groupByArtist, artistInitials, type MusicArtist } from "@/lib/music";
import { displayDate, displayDateUk } from "@/lib/vault";
import T from "@/components/T";
import NewBadge from "@/components/NewBadge";
import { ui } from "@/lib/ui-strings";

/**
 * "music" section type — the /music page.
 *
 * Apple Music playlist embed(s) on top, then the notes grouped BY ARTIST: one
 * card each, newest artist first, tinted with that artist's most recent cover.
 * The grouping and ordering live in `lib/music.ts`; this file only draws them.
 *
 * Section frontmatter (main.md):
 *   type: music
 *   playlists:  - https://music.apple.com/…      (a single `playlist:` works)
 *   artists:    - name / name_uk / photo / bio / bio_uk
 *
 * Entry frontmatter: `artist:` (what it is grouped under), `cover:` (the row's
 * artwork, and the card's tint when it is the newest), `format:` (the grey
 * label after the title — inferred from the embedded link when absent).
 *
 * The artist's `bio` here is about the ARTIST. A note's own `artist_bio:` is
 * about that RECORD, and the two are deliberately different texts — see
 * docs/DECISIONS.md #103.
 *
 * Embeds use Apple's free embed.music.apple.com iframes — no API key, no cost.
 */
export default function MusicList({ section, entries }: ListProps) {
  const raw = section.meta.playlists ?? section.meta.playlist;
  const playlists = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .map(String)
    .filter(isAppleMusicUrl);

  const groups = groupByArtist(section, entries);

  return (
    <div>
      {playlists.length > 0 ? (
        <div
          className={`mt-8 grid grid-cols-1 gap-5 ${
            playlists.length > 1 ? "md:grid-cols-2" : ""
          }`}
        >
          {/* No wrapper card. Apple's widget draws its own rounded surface, so
              ours was a second frame around the first. `.am-crop` is the box
              its chrome is clipped against — see globals.css.

              credentialless: fresh ephemeral storage each load (Chromium) so
              stale Apple state can't stall the player — see DECISIONS #10. */}
          {playlists.map((url) => (
            <div key={url} className="am-crop">
              <iframe
                src={appleMusicEmbedUrl(url)}
                height={appleMusicEmbedHeight(url)}
                title="Apple Music player"
                className="block w-full"
                style={{ border: 0 }}
                allow={APPLE_MUSIC_IFRAME_ALLOW}
                credentialless=""
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-tertiary)]">
          <T
            en={
              <>
                No playlist configured yet. In Apple Music: Share → Copy Link on
                your playlist, then add it under <code>playlists:</code> in this
                section&rsquo;s main.md frontmatter.
              </>
            }
            uk={
              <>
                Список відтворення ще не налаштовано. У Apple Music: Поділитися →
                Скопіювати посилання на плейлист, потім додайте його під ключем{" "}
                <code>playlists:</code> у frontmatter файлу main.md цього розділу.
              </>
            }
          />
        </p>
      )}

      {groups.length > 0 && (
        <>
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-[var(--text)]">
            <T {...ui.notesOnHearing} />
          </h2>

          {groups.map((group) => (
            <section className="music-card" key={group.key}>
              {group.cover && (
                /* The card's colour: this artist's newest cover, blurred past
                   recognition and clipped to the card. Decorative — the same
                   artwork is on a row below, where it carries a name. */
                <div className="music-wash" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={group.cover} alt="" />
                </div>
              )}

              {group.artist && <ArtistHead artist={group.artist} />}

              {/* A track list, not the shelf's rows: square artwork, then the
                  title and date on one line with the description under both.
                  The divider is drawn from the TEXT column rather than the
                  artwork's edge — see `.music-tracks` in globals.css. */}
              <ul className="music-tracks stagger">
                {group.notes.map((note) => (
                  <li key={note.slug}>
                    <Link
                      href={`/${section.slug}/${note.slug}`}
                      className="press press-soft"
                    >
                      {note.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="music-art"
                          src={note.cover}
                          srcSet={note.coverSrcSet}
                          /* Never painted wider than 44px, at up to 3x. */
                          sizes="132px"
                          alt=""
                          width={44}
                          height={44}
                          /* Blur-up: the placeholder is the image's OWN
                             background, so the cover paints straight over it
                             with no JS and no swap. See lib/blur.ts. */
                          style={
                            note.coverBlur
                              ? {
                                  backgroundImage: `url(${note.coverBlur})`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                }
                              : undefined
                          }
                        />
                      ) : (
                        /* No cover: an empty surface square, so every row keeps
                           the same text column and the dividers stay aligned. */
                        <span className="music-art" aria-hidden="true" />
                      )}

                      {/* Title and label share one cell as a flex pair: the
                          title shrinks and ellipsises, the label never does.
                          The label used to sit INSIDE the title span, where it
                          shared its ellipsis — a narrow row cut "Track" in half
                          and drew the dots in the title's colour. The title is
                          the part that gives way now, which is the right order:
                          it is repeated on the row's own page, the label is
                          not. */}
                      <span className="music-head">
                        <span className="music-title">
                          <T en={note.title} uk={note.titleUk} />
                        </span>
                        <span className="music-format">
                          <span aria-hidden="true">·</span>
                          <T {...note.format} />
                        </span>
                      </span>

                      {/* New sits with the DATE, not the title: it says when
                          the note arrived, which is the same kind of fact.
                          Client-only — see components/NewBadge.tsx. */}
                      <span className="music-meta">
                        <NewBadge date={note.date} />
                        {note.date && (
                          <time dateTime={note.date} className="music-date">
                            <T
                              en={displayDate(note.date)}
                              uk={displayDateUk(note.date)}
                            />
                          </time>
                        )}
                      </span>

                      {/* Placed by grid area, not by source order: the date
                          shares the title's line and the description runs the
                          full width beneath both. On a phone that's the
                          difference between a readable sentence and four words
                          and an ellipsis. */}
                      {note.description && (
                        <span className="music-desc">
                          <T en={note.description} uk={note.descriptionUk} />
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

/**
 * Who the card is about — a round portrait, the name, and a sentence or two.
 *
 * Deliberately the shelf creator block's shape rather than a new one, so an
 * artist here and an author there read as the same kind of thing. Each field
 * degrades on its own: no photo falls back to initials, no bio leaves the name
 * standing alone.
 */
function ArtistHead({ artist }: { artist: MusicArtist }) {
  const { name, nameUk, bio, bioUk, photoUrl, photoBlur, photoSrcSet, href } =
    artist;

  /* The portrait and the name open the artist's People note when one exists,
     and are plain text when it doesn't — an artist nobody has profiled is the
     normal case, so its absence must not look like a broken control. The BIO
     is never a link: it is a paragraph, and a paragraph-sized target that
     navigates is a trap for anyone trying to select it. */
  const portrait = photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      srcSet={photoSrcSet}
      /* 4rem, dropping to 3.25rem below 480px. The 256px variant covers both
         at 2x, which is what a phone wants either way. */
      sizes="64px"
      /* The name alone: the shape already says portrait, and the name is the
         next line of text. */
      alt={name}
      width={64}
      height={64}
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
    <span className="artist-initials" aria-hidden>
      {artistInitials(name)}
    </span>
  );

  return (
    <div className="artist-head">
      {href ? (
        <Link
          href={href}
          className="artist-photo press press-soft"
          aria-label={name}
        >
          {portrait}
        </Link>
      ) : (
        <div className="artist-photo">{portrait}</div>
      )}

      <div className="artist-text">
        <p className="artist-name">
          {href ? (
            <Link href={href} className="artist-link press">
              <T en={name} uk={nameUk} />
            </Link>
          ) : (
            <T en={name} uk={nameUk} />
          )}
        </p>
        {bio && (
          <p className="artist-bio">
            <T en={bio} uk={bioUk} />
          </p>
        )}
      </div>
    </div>
  );
}
