/**
 * Apple Music embed helpers — free iframe embeds via embed.music.apple.com,
 * no API key or developer account required.
 *
 * Any https://music.apple.com/... link (playlist, album, song, artist) can be
 * embedded by swapping the host to embed.music.apple.com.
 */
import { ui } from "./ui-strings";

const APPLE_MUSIC_RE = /^https:\/\/music\.apple\.com\/[^\s<>")]+$/;

export function isAppleMusicUrl(url: string): boolean {
  return APPLE_MUSIC_RE.test(url.trim());
}

/** music.apple.com → embed.music.apple.com */
export function appleMusicEmbedUrl(url: string): string {
  return url.trim().replace("://music.apple.com/", "://embed.music.apple.com/");
}

/** Single songs get the compact 175px player; playlists/albums the full 450px. */
export function appleMusicEmbedHeight(url: string): number {
  const isSong = url.includes("?i=") || url.includes("&i=") || url.includes("/song/");
  return isSong ? 175 : 450;
}

/** Feature policy for the embed iframe (matches Apple's official embed). */
export const APPLE_MUSIC_IFRAME_ALLOW =
  "autoplay *; encrypted-media *; fullscreen *; clipboard-write";

/**
 * Storage-isolating sandbox. Deliberately omits `allow-same-origin`, which
 * forces the iframe into a fresh, unique opaque origin on every load — so
 * Apple's player can't read cookies/localStorage/IndexedDB persisted from
 * earlier visits. That stale state is what makes the embed work in a clean
 * browser but stall on the gray skeleton after some reloads; denying it makes
 * every load behave like a first visit. `allow-scripts` keeps the player
 * running; popups/forms/presentation cover its controls and "View in Apple
 * Music" hand-off.
 */
export const APPLE_MUSIC_IFRAME_SANDBOX =
  "allow-scripts allow-popups allow-forms allow-presentation allow-top-navigation-by-user-activation";

/** iframe HTML string — used by the markdown pipeline to auto-embed pasted links. */
export function appleMusicEmbedHtml(url: string): string {
  const src = appleMusicEmbedUrl(url);
  const web = url.trim();
  const height = appleMusicEmbedHeight(url);
  // Card with an in-widget "Open in Apple Music" footer link so a stalled
  // gray-skeleton embed is never a dead end (mirrors the music-page embed).
  // Both languages are emitted as spans (the <T> pattern) so the label follows
  // the site's language toggle — CSS on html[data-lang] shows the active one.
  const label =
    `<span class="lang-en">${ui.openInAppleMusic.en}</span>` +
    `<span class="lang-uk">${ui.openInAppleMusic.uk}</span>`;
  return (
    `<div class="apple-music-block">` +
    `<iframe class="apple-music-embed" title="Apple Music player" allow="${APPLE_MUSIC_IFRAME_ALLOW}" sandbox="${APPLE_MUSIC_IFRAME_SANDBOX}" height="${height}" src="${src}"></iframe>` +
    `<div class="apple-music-footer"><a class="apple-music-fallback" href="${web}" target="_blank" rel="noopener noreferrer">${label} ↗</a></div>` +
    `</div>`
  );
}
