/**
 * Shared Open Graph image renderer — an editorial vault card matching the
 * site. Used by app/opengraph-image.tsx and the per-section/per-entry
 * variants, so one treatment follows every link somebody shares.
 */
import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import { siteUrl } from "@/lib/site-config";

export const OG_SIZE = { width: 1200, height: 630 };

/** Formats Satori can decode. WebP and AVIF are not among them. */
const OG_RASTER = /\.(jpe?g|png|gif)$/i;

/**
 * The link cards should use the same face as the site rather than Satori's
 * default sans. These are the same Source Serif 4 family next/font self-hosts
 * for the live site, kept as build-only TTFs because Satori needs font bytes
 * directly rather than a CSS font class.
 */
const SOURCE_SERIF_REGULAR = fs.readFileSync(
  path.join(process.cwd(), "assets", "fonts", "source-serif-4-regular.ttf")
);
const SOURCE_SERIF_BOLD = fs.readFileSync(
  path.join(process.cwd(), "assets", "fonts", "source-serif-4-bold.ttf")
);

const SITE_HOST = new URL(siteUrl).hostname.replace(/^www\./, "");

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
 * to build would fail the whole page's build, so every branch here is a shrug
 * rather than a throw.
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
   * Cover shape. Book jackets and posters are tall, video thumbnails wide,
   * and album art square. The mount uses `contain`, so even an unusual jacket
   * keeps every edge rather than being cropped to our approximation.
   */
  coverShape?: "tall" | "wide" | "square";
  /** Third line under the subtitle: an author, director or channel. */
  byline?: string;
}

/** The favicon's double-chevron mark, redrawn in monochrome for link cards. */
function VaultMark({ size, fill }: { size: number; fill: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-20 -72 768 768"
      aria-hidden="true"
    >
      <g fill={fill}>
        <path d="M40 320 360 16h192L224 320l296 288H360Z" />
        <path d="M336 320 512 176h176L520 320l168 160H512Z" />
      </g>
    </svg>
  );
}

/**
 * A tiny deterministic fingerprint made from the title. It gives each shared
 * page its own mark without inventing a section colour or shipping decorative
 * artwork. The first and last dots stay on so even a sparse hash has a frame.
 */
function titleFingerprint(title: string): boolean[] {
  let hash = 2166136261;
  for (let i = 0; i < title.length; i += 1) {
    hash ^= title.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Array.from(
    { length: 20 },
    (_, i) => i === 0 || i === 19 || Boolean((hash >>> i) & 1)
  );
}

function Fingerprint({ title }: { title: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        width: 54,
        gap: 6,
      }}
    >
      {titleFingerprint(title).map((on, i) => (
        <div
          // The order is the identity; the index is the stable key.
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: on ? "#f3f3ef" : "#343438",
          }}
        />
      ))}
    </div>
  );
}

function titleSize(title: string, hasCover: boolean): number {
  if (hasCover) {
    if (title.length > 60) return 40;
    if (title.length > 42) return 46;
    if (title.length > 26) return 54;
    if (title.length > 14) return 64;
    return 76;
  }
  if (title.length > 70) return 50;
  if (title.length > 48) return 58;
  if (title.length > 28) return 70;
  return 92;
}

export function ogImage(title: string, subtitle?: string, opts: OgOptions = {}) {
  const { cover, coverShape = "tall", byline } = opts;

  /* One mount per native media shape. The image itself uses contain: a real
     paperback is not always exactly 2:3, and the old `cover` crop quietly cut
     those differences off despite the frame claiming otherwise. */
  const frame = {
    tall: { panel: 400, w: 288, h: 432 },
    wide: { panel: 510, w: 430, h: 242 },
    square: { panel: 440, w: 352, h: 352 },
  }[coverShape];

  const fontSize = titleSize(title, Boolean(cover));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 32,
          background: "#080809",
          color: "#f3f3ef",
          fontFamily: "Source Serif 4",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            border: "1px solid #29292d",
            borderRadius: 28,
            background: "#0c0c0e",
          }}
        >
          {/* The oversized mark gives text-only cards an image of their own.
              It stays behind artwork cards too, mostly hidden by the mount,
              so every variant is visibly from the same family. */}
          <div
            style={{
              position: "absolute",
              top: 52,
              right: cover ? frame.panel - 178 : -56,
              display: "flex",
              opacity: cover ? 0.32 : 1,
            }}
          >
            <VaultMark size={500} fill="#151518" />
          </div>

          {/* Registration ticks: an editorial detail, not another card
              inside the card. They also survive tiny social-feed previews. */}
          <div
            style={{
              position: "absolute",
              top: 25,
              left: 25,
              display: "flex",
              width: 42,
              height: 1,
              background: "#38383d",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 25,
              bottom: 25,
              display: "flex",
              width: 42,
              height: 1,
              background: "#38383d",
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              flex: 1,
              minWidth: 0,
              flexDirection: "column",
              padding: "48px 56px 50px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 17 }}>
                <VaultMark size={43} fill="#f3f3ef" />
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  {SITE_HOST}
                </div>
              </div>
              <Fingerprint title={title} />
            </div>

            <div
              style={{
                display: "flex",
                flex: 1,
                minWidth: 0,
                flexDirection: "column",
                justifyContent: "center",
                padding: "24px 0 20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  maxWidth: cover ? "100%" : 930,
                  fontSize,
                  fontWeight: 700,
                  lineHeight: 1.02,
                  letterSpacing: "-0.035em",
                }}
              >
                {title}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minHeight: 58,
              }}
            >
              {byline && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 29,
                    lineHeight: 1.15,
                    color: "#d5d5d0",
                  }}
                >
                  {byline}
                </div>
              )}
              {subtitle && (
                <div
                  style={{
                    display: "flex",
                    maxWidth: cover ? "100%" : 900,
                    fontSize: subtitle.length > 52 ? 27 : 29,
                    lineHeight: 1.25,
                    color: "#97979b",
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {cover && (
            <div
              style={{
                position: "relative",
                display: "flex",
                flex: "none",
                alignItems: "center",
                justifyContent: "center",
                width: frame.panel,
                height: "100%",
                background: "#101013",
                borderLeft: "1px solid #29292d",
              }}
            >
              {/* A crisp offset plate makes the image feel mounted rather
                  than pasted on. It is monochrome; the work supplies colour. */}
              <div
                style={{
                  position: "absolute",
                  width: frame.w,
                  height: frame.h,
                  border: "1px solid #3a3a3f",
                  borderRadius: 17,
                  background: "#17171a",
                  transform: "translate(15px, 15px)",
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt=""
                width={frame.w}
                height={frame.h}
                style={{
                  objectFit: "contain",
                  border: "1px solid #35353a",
                  borderRadius: 16,
                  background: "#0c0c0e",
                  boxShadow: "0 18px 42px rgba(0, 0, 0, 0.38)",
                }}
              />
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        {
          name: "Source Serif 4",
          data: SOURCE_SERIF_REGULAR,
          weight: 400,
          style: "normal",
        },
        {
          name: "Source Serif 4",
          data: SOURCE_SERIF_BOLD,
          weight: 700,
          style: "normal",
        },
      ],
    }
  );
}
