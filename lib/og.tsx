/**
 * Shared Open Graph image renderer — dark theme card matching the site.
 * Used by app/opengraph-image.tsx and the per-section/per-entry variants.
 */
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Formats Satori can decode. WebP and AVIF are not among them. */
const OG_RASTER = /\.(jpe?g|png|gif)$/i;

/**
 * A cover URL as something the OG renderer can actually draw.
 *
 * Vault covers are read off disk and inlined as data URLs rather than passed
 * as `/vault-assets/…` paths: these images are generated during the build,
 * when there is no server running to serve the site's own static files from.
 * A relative path would silently render as nothing.
 *
 * YouTube thumbnails are already absolute and remote, so they're handed
 * through — Satori fetches them itself.
 *
 * Returns undefined for anything it can't decode (WebP, AVIF, a missing file),
 * and the caller falls back to the plain text card. A preview image that fails
 * to build would fail the whole page's build, so every branch here is a
 * shrug rather than a throw.
 */
export function ogCover(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//.test(url)) return url;
  if (!url.startsWith("/vault-assets/")) return undefined;
  if (!OG_RASTER.test(url)) return undefined;

  // getAssetIndex() percent-encodes each segment; undo that to get a real path.
  const rel = url
    .slice("/vault-assets/".length)
    .split("/")
    .map(decodeURIComponent);
  const file = path.join(process.cwd(), "public", "vault-assets", ...rel);

  try {
    const ext = path.extname(file).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : "image/jpeg";
    return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
  } catch {
    return undefined;
  }
}

export interface OgOptions {
  /** Cover art, from ogCover(). Switches the card to the split layout. */
  cover?: string;
  /**
   * Cover shape. Book jackets and posters are 2:3, video thumbnails 16:9 —
   * the frame matches so nothing is cropped or letterboxed.
   */
  wide?: boolean;
  /** Third line under the subtitle: an author, director or channel. */
  byline?: string;
}

export function ogImage(title: string, subtitle?: string, opts: OgOptions = {}) {
  const { cover, wide, byline } = opts;

  /* Shelf notes are about a thing that already has a picture, and the picture
     is what someone recognises in a feed before they read a word of the title.
     With a cover the card splits: text on the left, artwork on the right,
     bled to the full height so it reads as a jacket rather than a thumbnail
     pasted onto a slide.

     The text column is narrower here than on the plain card, so the title
     steps down a size earlier — the same 40-character threshold would set a
     long book title in 56px inside a 560px column and run it to five lines. */
  const titleSize = cover
    ? title.length > 28
      ? 48
      : 60
    : title.length > 40
      ? 56
      : 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 88,
            flex: 1,
            // Without this the flex child refuses to shrink and a long
            // unbroken title pushes the artwork off the canvas.
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div
              style={{
                width: 72,
                height: 8,
                background: "#10b981",
                borderRadius: 4,
              }}
            />
            <div
              style={{
                fontSize: titleSize,
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                maxWidth: 1000,
              }}
            >
              {title}
            </div>
            {byline && (
              <div style={{ fontSize: 30, color: "#d4d4d8" }}>{byline}</div>
            )}
            {subtitle && (
              <div style={{ fontSize: 32, color: "#a1a1aa" }}>{subtitle}</div>
            )}
          </div>
        </div>

        {cover && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: wide ? 620 : 460,
              height: "100%",
              padding: wide ? 56 : 64,
              // A hairline of lift so the artwork doesn't dissolve into the
              // near-black panel when the cover itself is dark.
              background: "#111113",
              borderLeft: "1px solid #26262b",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              width={wide ? 508 : 332}
              height={wide ? 286 : 498}
              style={{ objectFit: "cover", borderRadius: 12 }}
            />
          </div>
        )}
      </div>
    ),
    OG_SIZE
  );
}
