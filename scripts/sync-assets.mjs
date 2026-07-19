/**
 * Copies every non-markdown file from vault/ to public/vault-assets/,
 * preserving folder structure, so images pasted into Obsidian notes are
 * served by Next.js at /vault-assets/<Folder>/<file>.
 *
 * Runs automatically before `next dev` and `next build` (predev/prebuild).
 * public/vault-assets/ is gitignored — it is fully regenerated each run.
 */
import fs from "node:fs";
import path from "node:path";

const VAULT = path.join(process.cwd(), "vault");
const OUT = path.join(process.cwd(), "public", "vault-assets");

fs.rmSync(OUT, { recursive: true, force: true });

if (!fs.existsSync(VAULT)) {
  console.warn("[sync-assets] no vault/ folder found, skipping");
  process.exit(0);
}

let count = 0;

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
    }
  }
}

walk(VAULT);
console.log(`[sync-assets] copied ${count} asset(s) → public/vault-assets/`);
