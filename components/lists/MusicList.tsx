import type { ListProps } from "@/lib/section-types";
import {
  appleMusicEmbedUrl,
  appleMusicEmbedHeight,
  isAppleMusicUrl,
  APPLE_MUSIC_IFRAME_ALLOW,
} from "@/lib/apple-music";
import { groupByArtist } from "@/lib/music";
import MusicNotes from "@/components/lists/MusicNotes";
import T from "@/components/T";

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
export default function MusicList({ section, entries, body }: ListProps) {
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

      {/* The section's prose sits UNDER the player, not above it: it reads as a
          note on what's in the playlist, and the embed is what the page is
          for. Handed down by app/[section]/page.tsx — see `listRendersBody`
          in lib/section-types.tsx and docs/DECISIONS.md #111. */}
      {body}

      {/* The notes, the search box and the language switch — a CLIENT
          component, so that filtering is instant and needs no round trip. The
          rows are still server-rendered into the static HTML; see the note at
          the top of components/lists/MusicNotes.tsx. */}
      {groups.length > 0 && (
        <MusicNotes sectionSlug={section.slug} groups={groups} />
      )}
    </div>
  );
}
