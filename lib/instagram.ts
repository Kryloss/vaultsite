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
