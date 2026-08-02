/**
 * Validate every photographed-note diagram referenced by the vault.
 *
 * The website intentionally keeps Image notes as ordinary Obsidian embeds plus
 * a hidden `image-note` comment. This build-time check protects that lightweight
 * authoring contract without adding runtime code or metadata files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_NOTE_RE =
  /!\[\[([^\]|]+?\.(?:svg|excalidraw(?:\.md)?))(?:\|([^\]]*))?\]\][ \t]*\r?\n[ \t]*<!--\s*image-note:\s*([^\n>]+?)\s*-->/gi;

const MAX_ORIGINAL_EDGE = 2400;
const ASPECT_TOLERANCE = 0.02;

function walk(dir, accept, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, accept, out);
    else if (accept(full)) out.push(full);
  }
  return out;
}

function assetIndex(vaultDir) {
  const index = new Map();
  for (const file of walk(vaultDir, (candidate) => !candidate.endsWith(".md"))) {
    const key = path.basename(file).toLowerCase();
    const matches = index.get(key) ?? [];
    matches.push(file);
    index.set(key, matches);
  }
  return index;
}

function resolveAsset(noteFile, name, index) {
  const clean = name.trim();
  const local = path.resolve(path.dirname(noteFile), clean);
  if (fs.existsSync(local)) return local;
  const matches = index.get(path.basename(clean).toLowerCase()) ?? [];
  return matches.length === 1 ? matches[0] : undefined;
}

function parseViewBox(markup) {
  const match = markup.match(/\bviewBox\s*=\s*["']\s*([-+\d.e]+)[ ,]+([-+\d.e]+)[ ,]+([-+\d.e]+)[ ,]+([-+\d.e]+)\s*["']/i);
  if (!match) return undefined;
  const values = match.slice(1).map(Number);
  if (values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) {
    return undefined;
  }
  return values;
}

function sameViewBox(a, b) {
  return Boolean(a && b && a.every((value, index) => Math.abs(value - b[index]) < 0.001));
}

function rootSvg(markup) {
  return markup.match(/<svg\b[^>]*>/i)?.[0];
}

function attribute(tag, name) {
  const match = tag?.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2]?.trim();
}

function fullCanvasRect(markup, viewBox) {
  if (!viewBox) return false;
  const [, , width, height] = viewBox;
  for (const match of markup.matchAll(/<rect\b([^>]*)>/gi)) {
    const attrs = match[1];
    const w = attribute(attrs, "width");
    const h = attribute(attrs, "height");
    const x = attribute(attrs, "x") ?? "0";
    const y = attribute(attrs, "y") ?? "0";
    const fill = attribute(attrs, "fill") ?? "";
    const style = attribute(attrs, "style") ?? "";
    const filled = fill.toLowerCase() !== "none" && !/fill\s*:\s*none/i.test(style);
    const covers =
      (w === "100%" && h === "100%") ||
      (Number(w) === width && Number(h) === height && Number(x) === 0 && Number(y) === 0);
    if (filled && covers) return true;
  }
  return false;
}

function unsafeReasons(markup) {
  const checks = [
    [/<script\b/i, "script elements"],
    [/<foreignObject\b/i, "foreignObject elements"],
    [/<(?:iframe|object|embed)\b/i, "embedded documents"],
    [/\son[a-z]+\s*=/i, "event-handler attributes"],
    [/(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:|\/\/)/i, "external or executable resources"],
    [/url\(\s*["']?\s*(?:https?:|data:|javascript:|\/\/)/i, "external CSS resources"],
  ];
  return checks.filter(([pattern]) => pattern.test(markup)).map(([, reason]) => reason);
}

function svgFacts(file) {
  const markup = fs.readFileSync(file, "utf8");
  const root = rootSvg(markup);
  const viewBox = parseViewBox(markup);
  return {
    file,
    markup,
    root,
    viewBox,
    role: attribute(root, "role"),
    ariaLabel: attribute(root, "aria-label"),
    hasDarkMode: /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i.test(markup),
    unsafe: unsafeReasons(markup),
    hasCanvas: fullCanvasRect(markup, viewBox),
  };
}

function languageCaption(caption = "") {
  const [en, uk] = caption.split("::").map((part) => part.trim());
  return Boolean(en && uk);
}

function label(file, vaultDir) {
  return path.relative(vaultDir, file) || path.basename(file);
}

function excalidrawCandidates(base, language) {
  const langBase = language === "uk" ? `${base}.uk` : base;
  return {
    light: [`${langBase}.excalidraw.light.svg`, `${langBase}.light.svg`],
    dark: [`${langBase}.excalidraw.dark.svg`, `${langBase}.dark.svg`],
  };
}

function findCandidate(noteFile, candidates, index) {
  for (const candidate of candidates) {
    const found = resolveAsset(noteFile, candidate, index);
    if (found) return found;
  }
  return undefined;
}

function validateSvg(facts, options, errors, vaultDir) {
  const name = label(facts.file, vaultDir);
  if (!facts.root) errors.push(`${name}: file is not an SVG document`);
  if (!facts.viewBox) errors.push(`${name}: missing or invalid viewBox`);
  if (facts.unsafe.length) {
    errors.push(`${name}: unsafe SVG content (${facts.unsafe.join(", ")})`);
  }
  if (facts.hasCanvas) errors.push(`${name}: full-canvas fill prevents a transparent background`);
  if (options.selfTheming) {
    if (facts.role !== "img" || !facts.ariaLabel) {
      errors.push(`${name}: self-theming SVG requires role="img" and a non-empty aria-label`);
    }
    if (!facts.hasDarkMode) {
      errors.push(`${name}: self-theming SVG requires a prefers-color-scheme: dark style`);
    }
  }
}

function compareGeometry(svgFiles, photo, errors, vaultDir) {
  if (!svgFiles.length) return;
  const first = svgFiles[0];
  for (const facts of svgFiles.slice(1)) {
    if (!sameViewBox(first.viewBox, facts.viewBox)) {
      errors.push(`${label(facts.file, vaultDir)}: viewBox must match ${label(first.file, vaultDir)}`);
    }
  }
  if (!first.viewBox || !photo?.width || !photo?.height) return;
  const diagramRatio = first.viewBox[2] / first.viewBox[3];
  const photoRatio = photo.width / photo.height;
  const difference = Math.abs(diagramRatio - photoRatio) / photoRatio;
  if (difference > ASPECT_TOLERANCE) {
    errors.push(
      `${label(first.file, vaultDir)}: aspect ratio differs from the original photo by ${(difference * 100).toFixed(1)}% (maximum 2%)`
    );
  }
}

async function photoFacts(file, sharp) {
  try {
    return await sharp(file).metadata();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function validatePhoto(file, metadata, errors, vaultDir) {
  const name = label(file, vaultDir);
  if (metadata.error) {
    errors.push(`${name}: unreadable original photo (${metadata.error})`);
    return;
  }
  if (!metadata.width || !metadata.height) {
    errors.push(`${name}: original photo has no readable dimensions`);
    return;
  }
  if (Math.max(metadata.width, metadata.height) > MAX_ORIGINAL_EDGE) {
    errors.push(`${name}: original photo exceeds ${MAX_ORIGINAL_EDGE}px on its long edge`);
  }
  if (metadata.orientation || metadata.exif || metadata.iptc || metadata.xmp) {
    errors.push(`${name}: original photo still contains orientation or descriptive metadata`);
  }
  if (
    metadata.autoOrient?.width &&
    metadata.autoOrient?.height &&
    (metadata.autoOrient.width !== metadata.width || metadata.autoOrient.height !== metadata.height)
  ) {
    errors.push(`${name}: original photo orientation has not been baked into its pixels`);
  }
}

/**
 * Return build-blocking validation errors without mutating the vault.
 * `sharpImpl` is injectable so unit tests can exercise file discovery alone.
 */
export async function validateImageNotes({ vaultDir, sharpImpl } = {}) {
  const root = vaultDir ?? path.join(process.cwd(), "vault");
  const errors = [];
  const index = assetIndex(root);
  const markdown = walk(root, (file) => file.toLowerCase().endsWith(".md"));
  const seen = new Set();
  let count = 0;
  let sharp = sharpImpl;
  if (!sharp) ({ default: sharp } = await import("sharp"));

  for (const noteFile of markdown) {
    const source = fs.readFileSync(noteFile, "utf8");
    for (const match of source.matchAll(IMAGE_NOTE_RE)) {
      const [, target, caption, originalName] = match;
      const key = `${target.trim().toLowerCase()}\0${originalName.trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      count++;

      const location = `${label(noteFile, root)}:${source.slice(0, match.index).split("\n").length}`;
      if (!languageCaption(caption)) {
        errors.push(`${location}: Image note caption must contain English and Ukrainian text separated by ::`);
      }

      const original = resolveAsset(noteFile, originalName, index);
      let photo;
      if (!original) {
        errors.push(`${location}: original photo not found: ${originalName.trim()}`);
      } else {
        photo = await photoFacts(original, sharp);
        validatePhoto(original, photo, errors, root);
      }

      const svgFiles = [];
      if (/\.svg$/i.test(target.trim())) {
        const english = resolveAsset(noteFile, target, index);
        const ukrainianName = target.trim().replace(/\.svg$/i, ".uk.svg");
        const ukrainian = resolveAsset(noteFile, ukrainianName, index);
        if (!english) errors.push(`${location}: diagram not found: ${target.trim()}`);
        if (!ukrainian) errors.push(`${location}: Ukrainian diagram not found: ${ukrainianName}`);
        for (const file of [english, ukrainian].filter(Boolean)) {
          const facts = svgFacts(file);
          validateSvg(facts, { selfTheming: true }, errors, root);
          svgFiles.push(facts);
        }
      } else {
        const base = path.basename(target.trim()).replace(/\.md$/i, "").replace(/\.excalidraw$/i, "");
        for (const language of ["en", "uk"]) {
          const candidates = excalidrawCandidates(base, language);
          const light = findCandidate(noteFile, candidates.light, index);
          const dark = findCandidate(noteFile, candidates.dark, index);
          if (!light || !dark) {
            errors.push(
              `${location}: Excalidraw ${language.toUpperCase()} image note requires both light and dark SVG exports`
            );
          }
          for (const file of [light, dark].filter(Boolean)) {
            const facts = svgFacts(file);
            validateSvg(facts, { selfTheming: false }, errors, root);
            svgFiles.push(facts);
          }
        }
      }
      compareGeometry(svgFiles, photo, errors, root);
    }
  }

  return { count, errors };
}

async function main() {
  const result = await validateImageNotes();
  if (result.errors.length) {
    console.error(`[validate-image-notes] found ${result.errors.length} error(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[validate-image-notes] checked ${result.count} image note(s)`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) await main();
