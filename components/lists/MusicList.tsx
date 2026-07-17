import Link from "next/link";
import type { ListProps } from "@/lib/section-types";
import {
  appleMusicEmbedUrl,
  appleMusicEmbedHeight,
  isAppleMusicUrl,
} from "@/lib/apple-music";
import { displayDate } from "@/lib/vault";

/**
 * "music" section type — /listening-style page:
 * Apple Music playlist embed(s) on top, thought posts below.
 *
 * Configure in the section's main.md frontmatter:
 *   type: music
 *   playlists:
 *     - https://music.apple.com/ca/playlist/<name>/<id>
 * (a single `playlist:` string also works)
 *
 * Embeds use Apple's free embed.music.apple.com iframes — no API key, no cost.
 */
export default function MusicList({ section, entries }: ListProps) {
  const raw = section.meta.playlists ?? section.meta.playlist;
  const playlists = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .map(String)
    .filter(isAppleMusicUrl);

  return (
    <div>
      {playlists.length > 0 ? (
        <div className="mt-8 flex flex-col gap-6">
          {playlists.map((url) => (
            <iframe
              key={url}
              src={appleMusicEmbedUrl(url)}
              height={appleMusicEmbedHeight(url)}
              className="w-full overflow-hidden rounded-xl"
              style={{ border: 0 }}
              loading="lazy"
              allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
              sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
            />
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-tertiary)]">
          No playlist configured yet. In Apple Music: Share → Copy Link on your
          playlist, then add it under <code>playlists:</code> in this
          section&rsquo;s main.md frontmatter.
        </p>
      )}

      {entries.length > 0 && (
        <>
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-[var(--text)]">
            Notes on what I&rsquo;m hearing
          </h2>
          {/* Plain rows with full dates — the DD.MM/year grouping is posts-only */}
          <ul className="mt-2 flex flex-col">
            {entries.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={`/${section.slug}/${entry.slug}`}
                  className="group -mx-3 flex items-baseline justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
                      {entry.title}
                    </span>
                    {entry.description && (
                      <span className="mt-0.5 block truncate text-sm text-[var(--text-secondary)]">
                        {entry.description}
                      </span>
                    )}
                  </span>
                  {entry.date && (
                    <time
                      dateTime={entry.date}
                      className="shrink-0 text-sm tabular-nums text-[var(--text-tertiary)]"
                    >
                      {displayDate(entry.date)}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
