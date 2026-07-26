/**
 * Blur-up placeholders — the soft impression of a cover that shows while the
 * real image is still loading.
 *
 * scripts/sync-assets.mjs writes .blur-manifest.json (public URL → a ~300-byte
 * base64 WebP) on every predev/prebuild; this reads it at build time. Server
 * only, like everything that touches `fs` — cover components must receive the
 * string as a prop, never import this. See DECISIONS #15 for what happens when
 * an fs-backed module leaks into a client bundle.
 *
 * There's no runtime cost and no client JS: the placeholder is set as the
 * <img>'s own background-image, so the real image simply paints over it.
 */
import fs from "fs";
import path from "path";

const MANIFEST = path.join(process.cwd(), ".blur-manifest.json");

let manifest: Record<string, string> | null = null;

function load(): Record<string, string> {
  if (manifest) return manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    // No manifest yet (first run, or sharp unavailable) — degrade silently.
    manifest = {};
  }
  return manifest!;
}

/**
 * Placeholder for a vault asset URL, or undefined for remote covers
 * (`cover: https://…`) and anything sharp couldn't read.
 */
export function blurFor(url?: string): string | undefined {
  if (!url || !url.startsWith("/vault-assets/")) return undefined;
  return load()[url];
}
