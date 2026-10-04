/**
 * Prepares the résumé PDF for the standalone /resume page (app/resume/page.tsx).
 *
 *   node scripts/make-resume-page.mjs "path/to/Resume.pdf"
 *
 * With no argument it uses the PDF the Now page already offers
 * (`resume_file:` in vault/Now/main.md).
 *
 * Writes, and replaces on every run:
 *
 * - public/resume-assets/Kyrylo-Leshchenko-Resume.pdf — the download.
 * - public/resume-assets/page-N.svg — one picture per page. A browser's own
 *   PDF viewer brings a toolbar with it and does not work inline on phones at
 *   all, so the page shows pictures of the sheets instead; SVG keeps the type
 *   sharp at any zoom, and the fonts are drawn as outlines so nothing loads.
 * - lib/resume-page.json — the file names and page sizes the page reads.
 *
 * Run by hand, like scripts/build-resume-pdf.py, and never in `prebuild`: it
 * needs poppler (`brew install poppler`), which Vercel does not have. The
 * output is committed.
 *
 * The PDF is public the moment it lands in public/ — check it carries nothing
 * that should not be (DECISIONS #25 and #200: no street address).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "resume-assets");
const PDF_NAME = "Kyrylo-Leshchenko-Resume.pdf";

function defaultSource() {
  const main = fs.readFileSync(path.join(ROOT, "vault", "Now", "main.md"), "utf8");
  const name = main.match(/^resume_file:\s*(.+)$/m)?.[1].trim();
  if (!name) throw new Error("no PDF given and no resume_file: in vault/Now/main.md");
  return path.join(ROOT, "vault", "Now", name);
}

const source = path.resolve(process.argv[2] ?? defaultSource());
if (!fs.existsSync(source)) throw new Error(`not found: ${source}`);

const info = execFileSync("pdfinfo", [source], { encoding: "utf8" });
const count = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
const size = info.match(/^Page size:\s+([\d.]+) x ([\d.]+) pts/m);
if (!count || !size) throw new Error("pdfinfo could not read the page count or size");

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(source, path.join(OUT, PDF_NAME));

const pages = [];
for (let n = 1; n <= count; n++) {
  const file = `page-${n}.svg`;
  execFileSync("pdftocairo", ["-svg", "-f", String(n), "-l", String(n), source, path.join(OUT, file)]);
  pages.push({
    src: `/resume-assets/${file}`,
    width: Math.round(Number(size[1])),
    height: Math.round(Number(size[2])),
  });
}

fs.writeFileSync(
  path.join(ROOT, "lib", "resume-page.json"),
  JSON.stringify({ pdf: `/resume-assets/${PDF_NAME}`, pages }, null, 2) + "\n"
);

console.log(`[make-resume-page] ${count} page(s) from ${path.relative(ROOT, source)}`);
