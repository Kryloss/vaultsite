/**
 * Apple Music embed helpers — free iframe embeds via embed.music.apple.com,
 * no API key or developer account required.
 *
 * Any https://music.apple.com/... link (playlist, album, song, artist) can be
 * embedded by swapping the host to embed.music.apple.com.
 */

const APPLE_MUSIC_RE = /^https:\/\/music\.apple\.com\/[^\s<>")]+$/;

export function isAppleMusicUrl(url: string): boolean {
  return APPLE_MUSIC_RE.test(url.trim());
}

/** music.apple.com → embed.music.apple.com */
export function appleMusicEmbedUrl(url: string): string {
  return url.trim().replace("://music.apple.com/", "://embed.music.apple.com/");
}

/**
 * Is this a link to ONE track rather than to an album or playlist?
 *
 * A song carries its track id in `i=`, or is a `/song/` URL. The distinction
 * decides the player's height here, and on a music note it also decides where
 * the player goes: the album is the note's subject and moves to the gutter,
 * while a song is an example of a sentence and stays beside that sentence
 * (DECISIONS #94).
 */
export function isAppleMusicSong(url: string): boolean {
  return url.includes("?i=") || url.includes("&i=") || url.includes("/song/");
}

/** Single songs get the compact 175px player; playlists/albums the full 450px. */
export function appleMusicEmbedHeight(url: string): number {
  return isAppleMusicSong(url) ? 175 : 450;
}

/**
 * Feature policy for the embed iframe (matches Apple's official embed).
 *
 * Reliability note (see DECISIONS.md #10): the embed accumulates stale
 * localStorage under apple.com that eventually stalls the player on its gray
 * skeleton (works in a fresh browser, breaks after repeat visits). The iframes
 * carry the `credentialless` attribute so Chromium loads them in a fresh
 * ephemeral storage partition every time — a "first visit" each load. NO
 * `sandbox`: a storage-isolating sandbox was tested and breaks the player,
 * which needs same-origin storage to hydrate.
 */
export const APPLE_MUSIC_IFRAME_ALLOW =
  "autoplay *; encrypted-media *; fullscreen *; clipboard-write";

/**
 * iframe HTML string — used by the markdown pipeline to auto-embed pasted links.
 *
 * NO footer link. There was one — "Open in Apple Music", added so a stalled
 * gray-skeleton embed was never a dead end (DECISIONS #10) — and it is gone by
 * request (#92). A LOADED player already carries Apple's own "View in Apple
 * Music" and "View in App" links inside the iframe, which made ours the second
 * copy of the same link directly under the first. What it cost is the stalled
 * case: that one has no way out now, so if the gray skeleton comes back, this
 * is the thing to restore.
 */
export function appleMusicEmbedHtml(url: string): string {
  const src = appleMusicEmbedUrl(url);
  const height = appleMusicEmbedHeight(url);
  /* The kind is stamped on the block so CSS can tell an album from a track
     without re-parsing the URL — see `.music-note` in globals.css. */
  const kind = isAppleMusicSong(url) ? "song" : "album";
  return (
    `<div class="apple-music-block" data-kind="${kind}">` +
    `<iframe class="apple-music-embed" title="Apple Music player" allow="${APPLE_MUSIC_IFRAME_ALLOW}" credentialless height="${height}" src="${src}"></iframe>` +
    `</div>`
  );
}
