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

/**
 * music.apple.com → embed.music.apple.com, in the reader's own theme.
 *
 * `theme=auto` makes the player follow `prefers-color-scheme` INSIDE the
 * iframe — verified against Apple directly: the same URL renders dark on a
 * dark system and light on a light one. That is the site's exact theming
 * model (#62 — there is no manual toggle, only the OS), so the players match
 * the page with no JavaScript, no second copy of the markup for the other
 * theme, and nothing that stops the site being static.
 *
 * Appended with `&` when the link already carries a query, which a song link
 * always does (`?i=<track id>`).
 */
export function appleMusicEmbedUrl(url: string): string {
  const embed = url
    .trim()
    .replace("://music.apple.com/", "://embed.music.apple.com/");
  if (/[?&]theme=/.test(embed)) return embed;
  return `${embed}${embed.includes("?") ? "&" : "?"}theme=auto`;
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

/**
 * Single songs get the compact player; playlists and albums the full 450px.
 *
 * 150px, not the 175px Apple's own snippet uses. The player does not reflow to
 * the height it is given — it lays out and is clipped (#93) — so the number is
 * only safe if it was measured, and it was: at 150px every part is still
 * there, at 130px Apple's data-disclosure line goes, and at 110px the Play
 * button is cut in half. 150 is the floor that loses nothing, and it makes a
 * track player 14% shorter in the middle of an article (#99).
 */
export function appleMusicEmbedHeight(url: string): number {
  return isAppleMusicSong(url) ? 150 : 450;
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
 * The first ALBUM or playlist link in a note's markdown, if it has one.
 *
 * Standalone links are what the pipeline turns into players, so this looks for
 * the same shape: a line that is nothing but an Apple Music URL. Songs are
 * skipped — a track is an example of the sentence it sits beside and is never
 * the note's subject (#94).
 */
export function firstAlbumUrl(markdown: string): string | undefined {
  for (const line of markdown.split("\n")) {
    const s = line.trim();
    if (isAppleMusicUrl(s) && !isAppleMusicSong(s)) return s;
  }
  return undefined;
}

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
    `<iframe class="apple-music-embed" title="Apple Music player" allow="${APPLE_MUSIC_IFRAME_ALLOW}" credentialless loading="lazy" height="${height}" src="${src}"></iframe>` +
    `</div>`
  );
}
