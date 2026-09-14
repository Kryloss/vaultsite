/**
 * Instagram helpers — reels and posts as plain iframes, no API key and no
 * embed.js.
 *
 * Instagram serves every public post at `/<kind>/<shortcode>/embed/`, and that
 * page sets no frame-ancestors, so a bare iframe is the whole embed. Its own
 * scripts run inside the frame; none are added to this site's pages. There is
 * no stable thumbnail URL to derive (the CDN links expire), so a shelf note for
 * a reel carries a `cover:` saved into the vault instead (DECISIONS #171).
 */

/** Reel, post and IGTV URLs, with or without the account segment before them. */
const INSTAGRAM_RE =
  /^https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]{5,40})\/?(?:[?#][^\s]*)?$/;

export type InstagramPost = { kind: "reel" | "p" | "tv"; id: string };

/** Kind and shortcode, or undefined if this isn't an Instagram post URL. */
export function instagramPost(url: string): InstagramPost | undefined {
  const m = url.trim().match(INSTAGRAM_RE);
  if (!m) return undefined;
  const kind = m[1] === "reels" ? "reel" : (m[1] as InstagramPost["kind"]);
  return { kind, id: m[2] };
}

/** Canonical address, tracking parameters dropped. */
export function instagramUrl({ kind, id }: InstagramPost): string {
  return `https://www.instagram.com/${kind}/${id}/`;
}

export function instagramEmbedUrl(post: InstagramPost): string {
  return `${instagramUrl(post)}embed/`;
}

/**
 * The embed page posts `{"type":"MEASURE","details":{"height":N}}` to its
 * parent once it has laid itself out — the message embed.js sizes frames from.
 * Returns the height, or undefined for any other message.
 */
export function instagramMeasure(data: unknown): number | undefined {
  if (typeof data !== "string") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return undefined;
  }
  const msg = parsed as { type?: unknown; details?: { height?: unknown } } | null;
  const height = msg?.type === "MEASURE" ? msg.details?.height : undefined;
  return typeof height === "number" && Number.isFinite(height) && height > 0 && height < 5000
    ? Math.round(height)
    : undefined;
}

/**
 * The page measures once, on load, and never again — so a frame that has
 * changed width since has a stale height and must be reloaded to re-measure.
 * Only a real change counts: a hidden frame (width 0) and scrollbar-sized
 * wobble don't.
 */
export function instagramNeedsRemeasure(measuredAt: number, width: number): boolean {
  return measuredAt > 0 && width > 0 && Math.abs(width - measuredAt) >= 24;
}

/**
 * Instagram's embed page, measured 2026-09-14: a fixed 54px header (avatar,
 * name, View profile) above the media and a fixed 154px footer (View more,
 * actions, likes, comment box) below it, at every width. These are Instagram's
 * numbers, not ours, and can change without notice (DECISIONS #171).
 */
export const INSTAGRAM_HEADER = 54;
export const INSTAGRAM_FOOTER = 154;

export type InstagramCrop = { top: number; media: number; landscape: boolean };

/**
 * Where the video sits inside a frame that reported `total` pixels at `width`:
 * hide the header above it and the footer below it, and nothing else. The
 * media's own height is whatever is left, so no aspect ratio is assumed.
 *
 * A result no real post could have — a sliver, or taller than a 9:16 reel with
 * room to spare — means the layout has moved under us, and returns undefined
 * so the frame is shown whole rather than cut in the wrong place.
 */
export function instagramCrop(total: number, width: number): InstagramCrop | undefined {
  if (!(width > 0)) return undefined;
  const media = total - INSTAGRAM_HEADER - INSTAGRAM_FOOTER;
  const ratio = media / width;
  if (!(ratio >= 0.3 && ratio <= 2.2)) return undefined;
  return { top: INSTAGRAM_HEADER, media, landscape: media < width };
}

/** Embed iframe HTML — used by the markdown pipeline to auto-embed links. */
export function instagramEmbedHtml(post: InstagramPost): string {
  // Reels are portrait; a photo post's embed is closer to square.
  const shape = post.kind === "p" ? "instagram-embed-post" : "instagram-embed-reel";
  return (
    `<div class="instagram-block">` +
    `<iframe class="instagram-embed ${shape}" src="${instagramEmbedUrl(post)}" ` +
    `title="Instagram post" loading="lazy" allowfullscreen ` +
    `referrerpolicy="strict-origin-when-cross-origin"></iframe>` +
    `</div>`
  );
}
