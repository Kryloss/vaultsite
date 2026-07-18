import Link from "next/link";
import type { ListProps } from "@/lib/section-types";
import {
  appleMusicEmbedUrl,
  appleMusicEmbedHeight,
  isAppleMusicUrl,
  APPLE_MUSIC_IFRAME_ALLOW,
} from "@/lib/apple-music";
import { displayDate, displayDateUk } from "@/lib/vault";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";

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
        <div
          className={`mt-8 grid grid-cols-1 gap-5 ${
            playlists.length > 1 ? "md:grid-cols-2" : ""
          }`}
        >
          {playlists.map((url) => (
            <div
              key={url}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-hover)] shadow-sm transition-shadow duration-300 hover:shadow-md"
            >
              {/* credentialless: fresh ephemeral storage each load (Chromium)
                  so stale Apple state can't stall the player — see DECISIONS #10 */}
              <iframe
                src={appleMusicEmbedUrl(url)}
                height={appleMusicEmbedHeight(url)}
                title="Apple Music player"
                className="block w-full"
                style={{ border: 0 }}
                allow={APPLE_MUSIC_IFRAME_ALLOW}
                credentialless=""
              />
              {/* In-widget fallback so a stalled gray embed is never a dead end */}
              <div className="flex justify-end border-t border-[var(--border)] px-3 py-2 text-xs">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
                >
                  <T {...ui.openInAppleMusic} /> ↗
                </a>
              </div>
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

      {entries.length > 0 && (
        <>
          <h2 className="mt-12 text-lg font-semibold tracking-tight text-[var(--text)]">
            <T {...ui.notesOnHearing} />
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
                    <span className="block truncate font-medium text-[var(--text)]">
                      <T en={entry.title} uk={entry.titleUk} />
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
                      <T
                        en={displayDate(entry.date)}
                        uk={displayDateUk(entry.date)}
                      />
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
