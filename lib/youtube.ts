/**
 * YouTube helpers — free iframe embeds, no API key.
 *
 * Uses youtube-nocookie.com (YouTube's "privacy-enhanced" host): it doesn't set
 * tracking cookies until the visitor actually presses play. Thumbnails come
 * from i.ytimg.com, derived from the video ID, so a shelf entry needs nothing
 * but the link.
 */

/** Every URL shape YouTube hands out, incl. Shorts, youtu.be, and /live/. */
const YOUTUBE_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#][^\s]*)?$/;

/** Extract the 11-character video ID, or undefined if this isn't a video URL. */
export function youtubeId(url: string): string | undefined {
  return url.trim().match(YOUTUBE_RE)?.[1];
}

export function isYouTubeUrl(url: string): boolean {
  return youtubeId(url) !== undefined;
}

/**
 * Thumbnail for a video ID. `hqdefault` is the one resolution guaranteed to
 * exist for every video ever uploaded — maxresdefault 404s on older or
 * lower-quality uploads, which would leave a broken image on the shelf.
 */
export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Canonical watch URL, for "open on YouTube" links. */
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Embed iframe HTML — used by the markdown pipeline to auto-embed links. */
export function youtubeEmbedHtml(id: string): string {
  const src = `https://www.youtube-nocookie.com/embed/${id}`;
  return (
    `<div class="youtube-block">` +
    `<iframe class="youtube-embed" src="${src}" title="YouTube video player" ` +
    `loading="lazy" allowfullscreen ` +
    `allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ` +
    `referrerpolicy="strict-origin-when-cross-origin"></iframe>` +
    `</div>`
  );
}
