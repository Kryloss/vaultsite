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

/** Single songs get the compact 175px player; playlists/albums the full 450px. */
export function appleMusicEmbedHeight(url: string): number {
  const isSong = url.includes("?i=") || url.includes("&i=") || url.includes("/song/");
  return isSong ? 175 : 450;
}

/**
 * Feature policy for the embed iframe. Matches Apple's official embed markup.
 * Note: we deliberately do NOT set a `sandbox` attribute — Apple's own embed
 * code ships without one, and a sandbox can block the third-party storage the
 * player needs to hydrate under strict privacy settings (a cause of the embed
 * getting stuck on its gray loading skeleton).
 */
export const APPLE_MUSIC_IFRAME_ALLOW =
  "autoplay *; encrypted-media *; fullscreen *; clipboard-write";

/** iframe HTML string — used by the markdown pipeline to auto-embed pasted links. */
export function appleMusicEmbedHtml(url: string): string {
  const src = appleMusicEmbedUrl(url);
  const web = url.trim();
  const height = appleMusicEmbedHeight(url);
  // Card with an in-widget "Open in Apple Music" footer link so a stalled
  // gray-skeleton embed is never a dead end (mirrors the music-page embed).
  return (
    `<div class="apple-music-block">` +
    `<iframe class="apple-music-embed" title="Apple Music player" allow="${APPLE_MUSIC_IFRAME_ALLOW}" height="${height}" src="${src}"></iframe>` +
    `<div class="apple-music-footer"><a class="apple-music-fallback" href="${web}" target="_blank" rel="noopener noreferrer">Open in Apple Music ↗</a></div>` +
    `</div>`
  );
}
