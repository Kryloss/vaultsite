/**
 * TikTok helpers — TikTok's own Embed Player as a plain iframe, no API key and
 * no embed.js.
 *
 * `https://www.tiktok.com/player/v1/<id>` is the documented player
 * (developers.tiktok.com/doc/embed-player). Its query parameters switch off the
 * caption, music line, related videos and TikTok's context menu; play, volume
 * and fullscreen stay. What they can't remove is drawn over the picture — the
 * account header and the like/comment/share column — so unlike Instagram's
 * card there is nothing to crop, and the frame is simply the video's own 9:16.
 * The CDN thumbnail expires, so a note carries a saved `cover:` (DECISIONS #172).
 */

/**
 * A video's page, its v2 embed, or the player itself. `vt.tiktok.com` short
 * links are redirects that only a network request can resolve, and the build
 * makes none, so they are not accepted — write the full address in the note.
 */
const TIKTOK_RE =
  /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/(?:@[A-Za-z0-9._-]+\/video|embed(?:\/v2)?|player\/v1)\/(\d{15,21})\/?(?:[?#][^\s]*)?$/;

/** The numeric video id, or undefined if this isn't a TikTok video URL. */
export function tiktokId(url: string): string | undefined {
  return url.trim().match(TIKTOK_RE)?.[1];
}

/** The player with TikTok's extra layers off and its controls on. */
export function tiktokEmbedUrl(id: string): string {
  const params = new URLSearchParams({
    music_info: "0",
    description: "0",
    rel: "0",
    native_context_menu: "0",
    closed_caption: "0",
  });
  return `https://www.tiktok.com/player/v1/${id}?${params}`;
}

/** Embed iframe HTML — used by the markdown pipeline to auto-embed links. */
export function tiktokEmbedHtml(id: string): string {
  return (
    `<div class="tiktok-block">` +
    `<iframe class="tiktok-embed" src="${tiktokEmbedUrl(id).replace(/&/g, "&amp;")}" ` +
    `title="TikTok video" loading="lazy" allow="fullscreen" allowfullscreen ` +
    `referrerpolicy="strict-origin-when-cross-origin"></iframe>` +
    `</div>`
  );
}
