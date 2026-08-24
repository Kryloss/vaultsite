import Link from "next/link";
import type { ListProps } from "@/lib/section-types";
import {
  appleMusicEmbedUrl,
  appleMusicEmbedHeight,
  isAppleMusicUrl,
  APPLE_MUSIC_IFRAME_ALLOW,
} from "@/lib/apple-music";
import { resolveCoverUrl } from "@/lib/markdown";
import { blurFor, srcSetFor } from "@/lib/blur";
import { displayDate, displayDateUk } from "@/lib/vault";
import T from "@/components/T";
import NewBadge from "@/components/NewBadge";
import { ui } from "@/lib/ui-strings";

/**
 * "music" section type — /music page:
 * Apple Music playlist embed(s) on top, thought posts below.
 *
 * Configure in the section's main.md frontmatter:
 *   type: music
 *   playlists:
 *     - https://music.apple.com/ca/playlist/<name>/<id>
 * (a single `playlist:` string also works)
 *
 * Entries can set `cover:` — an album cover filed beside the note, resolved
 * exactly the way the shelf and people lists resolve theirs. It does two jobs:
 * the artwork on the note's own row, and (for the newest one) the blurred wash
 * that gives the track-list card its colour. See DECISIONS #90.
 *
 * Embeds use Apple's free embed.music.apple.com iframes — no API key, no cost.
 */
export default function MusicList({ section, entries }: ListProps) {
  const raw = section.meta.playlists ?? section.meta.playlist;
  const playlists = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .map(String)
    .filter(isAppleMusicUrl);

  const rows = entries.map((entry) => {
    const cover = resolveCoverUrl(entry.sectionDir, entry.meta.cover);
    /* `Entry` carries no `descriptionUk` — only `Section` does, so no list has
       ever translated an entry's description. The notes here write one anyway,
       and a row is half the page, so it's read from `meta` (the documented
       escape hatch for keys the engine doesn't model) rather than by widening
       `Entry` for one section type. */
    const descriptionUk = entry.meta.description_uk;
    return {
      entry,
      cover,
      coverBlur: blurFor(cover),
      coverSrcSet: srcSetFor(cover),
      descriptionUk:
        typeof descriptionUk === "string" ? descriptionUk : undefined,
    };
  });

  /* The card's wash is the NEWEST note's artwork, so the list recolours
     itself every time one is published (DECISIONS #90). `entries` arrives
     newest-first, and a note without a cover is skipped rather than leaving
     the card untinted. */
  const washCover = rows.find((r) => r.cover)?.cover;

  return (
    <div>
      {playlists.length > 0 ? (
        <div
          className={`mt-8 grid grid-cols-1 gap-5 ${
            playlists.length > 1 ? "md:grid-cols-2" : ""
          }`}
        >
          {/* No wrapper card. Apple's widget draws its own rounded surface, so
              ours was a second frame around the first — a ring of `--surface`
              with the player's own card floating inside it, most visible in
              dark mode. The iframe IS the element now, and the player reaches
              both edges of the column (#94).

              credentialless: fresh ephemeral storage each load (Chromium) so
              stale Apple state can't stall the player — see DECISIONS #10. */}
          {playlists.map((url) => (
            /* `.am-crop` is the box Apple's chrome is clipped against — see
               the note on `--am-crop-top` in globals.css. */
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

      {rows.length > 0 && (
        <>
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-[var(--text)]">
            <T {...ui.notesOnHearing} />
          </h2>
          {/* A track list, not the shelf's rows: square artwork, then the
              title and description stacked tight against it, then the date.
              The divider is drawn by CSS from the TEXT column rather than the
              artwork's edge — see `.music-tracks` in globals.css. */}
          <div className="music-card">
            {washCover && (
              /* The card's own colour: the newest note's cover, blurred past
                 recognition, clipped to the card. Decorative — the same
                 artwork is on a row below it, where it carries a name. */
              <div className="music-wash" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={washCover} alt="" />
              </div>
            )}
            <ul className="music-tracks stagger">
              {rows.map(({ entry, cover, coverBlur, coverSrcSet, descriptionUk }) => (
                <li key={entry.slug}>
                  <Link
                    href={`/${section.slug}/${entry.slug}`}
                    className="press press-soft"
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="music-art"
                        src={cover}
                        srcSet={coverSrcSet}
                        /* Never painted wider than 44px, at up to 3x. */
                        sizes="132px"
                        alt=""
                        width={44}
                        height={44}
                        /* Blur-up: the placeholder is the image's OWN
                           background, so the cover paints straight over it with
                           no JS and no swap. See lib/blur.ts. */
                        style={
                          coverBlur
                            ? {
                                backgroundImage: `url(${coverBlur})`,
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
                    <span className="music-title">
                      <T en={entry.title} uk={entry.titleUk} />
                      {/* Client-only — see components/NewBadge.tsx. */}
                      <NewBadge date={entry.date} />
                    </span>
                    {entry.date && (
                      <time dateTime={entry.date} className="music-date">
                        <T
                          en={displayDate(entry.date)}
                          uk={displayDateUk(entry.date)}
                        />
                      </time>
                    )}
                    {/* Placed by grid area, not by source order: the date shares
                        the title's line and the description runs the full width
                        beneath both. On a phone that's the difference between a
                        readable sentence and four words and an ellipsis. */}
                    {entry.description && (
                      <span className="music-desc">
                        <T en={entry.description} uk={descriptionUk} />
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
