/**
 * Copies every non-markdown file from vault/ to public/vault-assets/,
 * preserving folder structure, so images pasted into Obsidian notes are
 * served by Next.js at /vault-assets/<Folder>/<file>.
 *
 * Also writes .blur-manifest.json: a tiny blurred placeholder for every raster
 * image, keyed by its public URL. lib/blur.ts reads it at build time and the
 * cover components paint it as a CSS background, so a card shows a soft
 * impression of its image instead of an empty box while the real file loads.
 *
 * Runs automatically before `next dev` and `next build` (predev/prebuild).
 * public/vault-assets/ is gitignored — it is fully regenerated each run.
 */
import fs from "node:fs";
import path from "node:path";

const VAULT = path.join(process.cwd(), "vault");
const OUT = path.join(process.cwd(), "public", "vault-assets");
const BLUR_MANIFEST = path.join(process.cwd(), ".blur-manifest.json");

/** Raster formats sharp can downsample. SVGs are already tiny; GIFs animate. */
const RASTER = /\.(jpe?g|png|webp|avif)$/i;
/** Placeholder edge length. Big enough to suggest the composition, ~300 bytes. */
const LQIP_PX = 16;

fs.rmSync(OUT, { recursive: true, force: true });

if (!fs.existsSync(VAULT)) {
  console.warn("[sync-assets] no vault/ folder found, skipping");
  process.exit(0);
}

let count = 0;
/** Absolute paths of copied raster images, for the placeholder pass below. */
const images = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue; // .obsidian, .trash, dotfiles
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (
      !entry.name.toLowerCase().endsWith(".md") &&
      // Skip Excalidraw source JSON (`*.excalidraw`); we ship the exported SVG.
      !entry.name.toLowerCase().endsWith(".excalidraw")
    ) {
      const rel = path.relative(VAULT, full);
      const dest = path.join(OUT, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(full, dest);
      count++;
      if (RASTER.test(entry.name)) images.push({ full, rel });
    }
  }
}

walk(VAULT);
console.log(`[sync-assets] copied ${count} asset(s) → public/vault-assets/`);

/** Same shape lib/vault.ts builds, so manifest keys match the src attributes. */
function publicUrl(rel) {
  return "/vault-assets/" + rel.split(path.sep).map(encodeURIComponent).join("/");
}

/**
 * Placeholders are a nicety, never a build blocker: if sharp is missing or an
 * image is corrupt, the manifest just doesn't get that entry and the card
 * renders exactly as it did before.
 */
async function writeBlurManifest() {
  let sharp;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    console.warn("[sync-assets] sharp unavailable — skipping blur placeholders");
    fs.writeFileSync(BLUR_MANIFEST, "{}");
    return;
  }

  const manifest = {};
  await Promise.all(
    images.map(async ({ full, rel }) => {
      try {
        const buf = await sharp(full)
          .resize(LQIP_PX, LQIP_PX, { fit: "inside" })
          .webp({ quality: 40 })
          .toBuffer();
        manifest[publicUrl(rel)] =
          `data:image/webp;base64,${buf.toString("base64")}`;
      } catch {
        /* unreadable image — no placeholder, no failure */
      }
    })
  );

  fs.writeFileSync(BLUR_MANIFEST, JSON.stringify(manifest));
  console.log(
    `[sync-assets] wrote ${Object.keys(manifest).length} blur placeholder(s)`
  );
}

await writeBlurManifest();
