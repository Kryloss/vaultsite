/**
 * Build-time image metadata: blur-up placeholders and intrinsic dimensions.
 *
 * scripts/sync-assets.mjs writes .image-manifest.json (public URL →
 * `{ blur, w, h }`) on every predev/prebuild; this reads it at build time.
 * Server only, like everything that touches `fs` — components must receive the
 * values as props, never import this. See DECISIONS #15 for what happens when
 * an fs-backed module leaks into a client bundle.
 *
 * There's no runtime cost and no client JS. The placeholder is set as the
 * <img>'s own background-image, so the real image simply paints over it; the
 * dimensions become width/height attributes on the tag.
 */
import fs from "fs";
import path from "path";

const MANIFEST = path.join(process.cwd(), ".image-manifest.json");

export interface ImageMeta {
  /** Base64 data URL, ~300 bytes. */
  blur?: string;
  /** Intrinsic pixel size. */
  w?: number;
  h?: number;
  /** Ready-made srcset over the narrower WebP copies sync-assets wrote. */
  srcset?: string;
}

let manifest: Record<string, ImageMeta> | null = null;

function load(): Record<string, ImageMeta> {
  if (manifest) return manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    // No manifest yet (first run, or sharp unavailable) — degrade silently.
    manifest = {};
  }
  return manifest!;
}

/** Everything known about a vault asset URL, or undefined for remote images. */
export function imageMeta(url?: string): ImageMeta | undefined {
  if (!url || !url.startsWith("/vault-assets/")) return undefined;
  // The manifest is keyed by encoded URL, which is what the resolvers emit —
  // but a caller may hand us a decoded one, so try both before giving up.
  const m = load();
  if (m[url]) return m[url];
  try {
    return m[encodeURI(url)] ?? m[decodeURI(url)];
  } catch {
    return undefined;
  }
}

/**
 * Placeholder for a vault asset URL, or undefined for remote covers
 * (`cover: https://…`) and anything sharp couldn't read.
 */
export function blurFor(url?: string): string | undefined {
  return imageMeta(url)?.blur;
}

/**
 * Intrinsic size for a vault asset URL. Stamped onto content images so the
 * browser can reserve the right box before the file arrives — without it the
 * image occupies zero height until it loads and everything below it jumps.
 */
export function dimsFor(url?: string): { w: number; h: number } | undefined {
  const meta = imageMeta(url);
  return meta?.w && meta.h ? { w: meta.w, h: meta.h } : undefined;
}

/**
 * Candidate widths for a vault asset, or undefined when there's only one file
 * worth having (an image already narrower than the smallest variant, an SVG,
 * a remote cover). Pair it with a `sizes` describing the box it's painted in
 * — without one the browser assumes 100vw and picks the largest candidate,
 * which is worse than not offering a choice at all.
 */
export function srcSetFor(url?: string): string | undefined {
  return imageMeta(url)?.srcset;
}
