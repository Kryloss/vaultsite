/**
 * Markdown → HTML with Obsidian syntax support.
 *
 * Preprocessing (regex, before the unified pipeline):
 * 1. Obsidian callouts: > [!note] Title  → styled <div class="callout">
 * 2. ![[image.png]] / ![[image.png|alt]] / ![[image.png|300]] → images
 *    (≤128px sized embeds render as circular avatars)
 * 3. [[Note Name]] / [[Note Name|label]] → internal links, resolved
 *    cross-section via the global wiki index (falls back to same-section)
 * 4. ![alt](relative.png) → rewritten to /vault-assets/
 * 5. Standalone Apple Music links → embedded players
 *
 * Post-processing (rehype): standalone images with alt text become
 * <figure> + <figcaption> (skipping avatars); fenced code blocks are
 * syntax-highlighted at build time (see lib/highlight.ts); headings get ids,
 * "#" anchors and an outline for the table of contents (see lib/toc.ts);
 * GFM footnotes are mirrored into margin sidenotes (see rehypeSidenotes).
 *
 * Assets resolve because scripts/sync-assets.mjs mirrors every non-.md vault
 * file into public/vault-assets/ before dev/build.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import fs from "fs";
import path from "path";
import { slugify, getWikiIndex, getAssetIndex, VAULT_DIR } from "./vault";
import { appleMusicEmbedHtml, isAppleMusicUrl } from "./apple-music";
import { youtubeEmbedHtml, youtubeId } from "./youtube";
import { highlightToHast, parseCodeMeta, langLabel } from "./highlight";
import { rehypeHeadings, type Heading } from "./toc";
import { dimsFor, srcSetFor } from "./blur";
import { ui } from "./ui-strings";

/** Encode each path segment but keep "/" separators. */
function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

/** Public URL for a file living inside a section folder (mirrored by sync-assets). */
export function assetUrl(sectionDir: string, file: string): string {
  return `/vault-assets/${encodePath(sectionDir)}/${encodePath(file.trim())}`;
}

/**
 * `cover:` frontmatter → image URL.
 * Accepts "photo.jpg", "![[photo.jpg]]", "[[photo.jpg]]" (vault files — the
 * preferred, permanent form) or a full https:// URL (fallback when a file
 * couldn't be downloaded into the vault). Returns undefined when unset.
 */
export function resolveCoverUrl(
  sectionDir: string,
  value: unknown
): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const clean = value.trim().replace(/^!?\[\[/, "").replace(/\]\]$/, "");
  if (/^https?:\/\//i.test(clean)) return clean;
  // Resolved like an embed — the note's own folder first, then anywhere in the
  // vault by name. Covers travel with their notes, so a book filed under
  // Shelf/Books/ has its jpg there too, not in Shelf/.
  return resolveImageUrl(sectionDir, clean);
}

/** Memoized wiki index (built once per build process). */
let wikiIndex: Map<string, string> | null = null;
function wiki(): Map<string, string> {
  return (wikiIndex ??= getWikiIndex());
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** basename → /vault-assets URL, from the vault-wide index (any folder). */
function assetByName(name: string): string | undefined {
  return getAssetIndex().get(name.trim().toLowerCase());
}

/** Resolve an image embed: same-folder file if it exists, else vault-wide by name. */
function resolveImageUrl(sectionDir: string, file: string): string {
  const clean = file.trim();
  const local = path.join(VAULT_DIR, sectionDir, clean);
  if (fs.existsSync(local)) return assetUrl(sectionDir, clean);
  return assetByName(path.basename(clean)) ?? assetUrl(sectionDir, clean);
}

/** "diagram.svg" → "diagram.dark.svg" (dark-theme variant filename), if any. */
function darkVariantUrl(file: string): string | undefined {
  const m = file.trim().match(/^(.*)\.(svg|png|jpe?g|webp)$/i);
  if (!m) return undefined;
  return assetByName(`${m[1]}.dark.${m[2]}`);
}

/** "diagram.svg" → "diagram.uk.svg" (Ukrainian-variant filename). */
function langVariantName(file: string): string | undefined {
  const m = file.trim().match(/^(.*)\.([a-z0-9]+)$/i);
  if (!m) return undefined;
  return `${m[1]}.uk.${m[2]}`;
}

/** Does an embeddable file exist (same-folder or anywhere in the vault)? */
function assetExists(sectionDir: string, file: string): boolean {
  const clean = file.trim();
  if (fs.existsSync(path.join(VAULT_DIR, sectionDir, clean))) return true;
  return getAssetIndex().has(path.basename(clean).toLowerCase());
}

/**
 * Is this match the only thing on its line?
 *
 * Raw HTML we emit needs blank lines around it when it stands alone, because a
 * line starting with a tag opens a markdown HTML block that runs to the next
 * blank line — swallowing whatever follows. That's how `![[me.jpg|93]]` on the
 * line above a `# Heading` turned the heading into literal text. Inline embeds
 * (mid-sentence) must NOT get the newlines, or they'd break the paragraph.
 */
function standalone(src: string, offset: number, length: number): boolean {
  const lineStart = src.lastIndexOf("\n", offset - 1) + 1;
  const nlAfter = src.indexOf("\n", offset + length);
  const before = src.slice(lineStart, offset).trim();
  const after = src.slice(offset + length, nlAfter === -1 ? undefined : nlAfter).trim();
  return before === "" && after === "";
}

/** Split an embed caption "English :: Українською" into parts (size params skipped). */
function captionParts(alt?: string): { en: string; uk?: string } {
  if (!alt) return { en: "" };
  const t = alt.trim();
  if (/^\d+(x\d+)?$/.test(t)) return { en: "" };
  const [en, uk] = t.split("::").map((s) => s.trim());
  return { en, uk: uk || undefined };
}

/** Shared bilingual caption markup for diagrams and image notes. */
function diagramCaption(alt?: string): string {
  const { en, uk } = captionParts(alt);
  if (!en) return "";
  return uk
    ? `<figcaption><span class="lang-en">${escapeHtml(
        en
      )}</span><span class="lang-uk">${escapeHtml(uk)}</span></figcaption>`
    : `<figcaption>${escapeHtml(en)}</figcaption>`;
}

/** Theme/language-aware diagram media without its outer figure or caption. */
function diagramMedia(
  en: { light: string; dark?: string },
  uk: { light: string; dark?: string } | undefined,
  alt?: string,
  extraClass = ""
): string {
  const { en: capEn, uk: capUk } = captionParts(alt);
  if (uk) {
    return `<span class="lang-en">${themedImg(
      en.light,
      en.dark,
      capEn,
      extraClass
    )}</span><span class="lang-uk">${themedImg(
      uk.light,
      uk.dark,
      capUk ?? capEn,
      extraClass
    )}</span>`;
  }
  return themedImg(en.light, en.dark, capEn, extraClass);
}

/**
 * A diagram figure with theme (light/dark) AND language (en/uk) swaps.
 * Each side is a {light, dark?} image set; `uk` omitted → single-language.
 */
function diagramFigure(
  en: { light: string; dark?: string },
  uk: { light: string; dark?: string } | undefined,
  alt: string | undefined,
  figClass: string
): string {
  const cls = figClass ? ` class="${figClass}"` : "";
  return `<figure${cls}>${diagramMedia(en, uk, alt)}${diagramCaption(
    alt
  )}</figure>`;
}

/**
 * Resolve an Excalidraw embed (`![[Drawing.excalidraw]]`) to its exported
 * image(s). The Obsidian Excalidraw plugin's Auto-export writes a sibling SVG;
 * exporting both themes gives light/dark files we can swap. Falls back to a
 * single SVG/PNG, then to nothing (drawing not exported yet).
 */
type ExcalSide = { light?: string; dark?: string; src?: string };

/** Resolve one language's exported files for a drawing base name. */
function resolveExcalidrawOne(base: string): ExcalSide {
  const idx = getAssetIndex();
  const find = (cands: string[]) => {
    for (const c of cands) {
      const u = idx.get(c.toLowerCase());
      if (u) return u;
    }
    return undefined;
  };
  const light = find([`${base}.excalidraw.light.svg`, `${base}.light.svg`]);
  const dark = find([`${base}.excalidraw.dark.svg`, `${base}.dark.svg`]);
  if (light || dark) return { light, dark };
  const src = find([
    `${base}.excalidraw.svg`,
    `${base}.svg`,
    `${base}.excalidraw.png`,
    `${base}.png`,
  ]);
  return { src };
}

/**
 * Resolve an Excalidraw embed to its exported image(s) for both languages.
 * English base `Drawing`, Ukrainian sibling `Drawing.uk` — each exporting
 * light/dark (or a single SVG/PNG). The Obsidian Excalidraw plugin's
 * Auto-export writes these siblings when you save the drawing.
 */
function resolveExcalidraw(name: string): { en: ExcalSide; uk?: ExcalSide } {
  const base = name
    .trim()
    .replace(/\.md$/i, "")
    .replace(/\.excalidraw$/i, "");
  const en = resolveExcalidrawOne(base);
  const uk = resolveExcalidrawOne(`${base}.uk`);
  const ukHas = uk.light || uk.dark || uk.src;
  return { en, uk: ukHas ? uk : undefined };
}

/** Normalize an ExcalSide to {light, dark} (src → light), or undefined if empty. */
function excalSideToImg(
  s: ExcalSide
): { light: string; dark?: string } | undefined {
  const primary = s.light ?? s.src;
  if (!primary) return undefined;
  return { light: primary, dark: s.light ? s.dark : undefined };
}

/** Largest SVG we're willing to paste into the HTML (keeps pages lean). */
const MAX_INLINE_SVG = 64 * 1024;

/** "/vault-assets/Posts/x.svg" → the file's real path inside the vault. */
function vaultPathFromUrl(url: string): string | undefined {
  if (!url.startsWith("/vault-assets/")) return undefined;
  const rel = url
    .slice("/vault-assets/".length)
    .split("/")
    .map(safeDecode)
    .join(path.sep);
  const full = path.join(VAULT_DIR, rel);
  return fs.existsSync(full) ? full : undefined;
}

/**
 * Prefix every selector in an SVG's <style> with `scope` so an inlined diagram
 * can't leak its generic class names (.bar, .lbl, .val…) onto the page or onto
 * another diagram. Handles plain rules and rules nested in @media.
 */
function scopeSvgCss(css: string, scope: string): string {
  return css.replace(
    /(^|[{}])([^{}@]+?)\{/g,
    (_m, pre: string, selectors: string) =>
      pre +
      selectors
        .split(",")
        .map((s) => (s.trim() ? `${scope} ${s.trim()}` : s))
        .join(", ") +
      "{"
  );
}

/**
 * Self-theming SVG diagrams are pasted into the page instead of loaded through
 * <img src>.
 *
 * Why: an <img>-referenced SVG renders in an isolated document that the browser
 * rasterizes once and caches. Its internal `prefers-color-scheme` is resolved at
 * that first decode and never re-evaluated, so a diagram can get stuck in the
 * wrong theme — and which one breaks shifts around, because lazy loading and
 * `display: none` (the language toggle) make different images decode at
 * different moments. Inlined, the media query is just page CSS: always live,
 * always correct, and it re-themes instantly with the language toggle.
 *
 * Only applies to SVGs that actually self-theme. Excalidraw's two-file exports
 * (`.light.svg` + `.dark.svg`) keep using <img> — they swap via CSS `display`,
 * which was never affected by this.
 */
function inlineSelfThemingSvg(
  url: string,
  altEscaped: string
): string | undefined {
  const file = vaultPathFromUrl(url);
  if (!file || !/\.svg$/i.test(file)) return undefined;

  let svg: string;
  try {
    if (fs.statSync(file).size > MAX_INLINE_SVG) return undefined;
    svg = fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  if (!/prefers-color-scheme/i.test(svg)) return undefined;

  // Strip anything that can't live inside an HTML body.
  svg = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  const open = svg.match(/^<svg\b[^>]*>/i);
  if (!open) return undefined;

  // Stable id derived from the filename, so builds are deterministic.
  const id = `d-${slugify(path.basename(file).replace(/\.svg$/i, ""))}`;
  svg = svg.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, css: string) => {
    return `<style>${scopeSvgCss(css, `#${id}`)}</style>`;
  });

  // Re-open the root tag with our id/class, keeping viewBox, role, aria-label.
  const attrs = open[0]
    .replace(/^<svg\b/i, "")
    .replace(/\/?>$/, "")
    .replace(/\s(id|class)="[^"]*"/gi, "");
  const a = altEscaped;
  const labelled = /aria-label=/i.test(attrs);
  const out = svg.replace(
    open[0],
    `<svg id="${id}" class="diagram"${attrs}${
      labelled || !a ? "" : ` role="img" aria-label="${a}"`
    }>`
  );

  // One line, for tidiness and so nothing downstream can mistake a blank line
  // inside the markup for a block boundary.
  return out.replace(/\s*\r?\n\s*/g, " ") || undefined;
}

/**
 * Swap <img src="…self-theming.svg"> for the SVG itself, in the FINAL HTML.
 *
 * This has to run after the whole pipeline, not during preprocessing. The
 * preprocessing steps (wiki links, progress bars, Apple Music embeds…) are
 * regexes over the document text — inline the SVG any earlier and those regexes
 * happily rewrite the diagram's own labels. A diagram that documents this very
 * syntax (`[progress:: 45]`, `[[x.excalidraw]]`) then gets HTML spans injected
 * into its markup, and a `<span>` inside SVG content makes the HTML parser
 * break out of foreign content — the diagram renders half-drawn with the rest
 * spilling onto the page as text.
 */
function inlineDiagrams(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\ssrc="([^"]+)"/i)?.[1];
    if (!src || !/\.svg$/i.test(src)) return tag;
    // alt is already HTML-escaped here — pass it through as-is.
    const alt = tag.match(/\salt="([^"]*)"/i)?.[1] ?? "";
    return inlineSelfThemingSvg(src, alt) ?? tag;
  });
}

/** A themed <img> pair (dark swapped via CSS), a single one, or an inline SVG. */
function themedImg(
  light: string,
  dark: string | undefined,
  alt: string,
  extraClass = ""
): string {
  const a = escapeHtml(alt);
  const cls = extraClass ? ` ${extraClass}` : "";
  if (dark && dark !== light) {
    return (
      `<img class="only-light${cls}" src="${light}" alt="${a}" loading="lazy" />` +
      `<img class="only-dark${cls}" src="${dark}" alt="${a}" loading="lazy" />`
    );
  }
  // Self-theming SVGs stay <img> here and are swapped for inline markup by
  // inlineDiagrams() once the pipeline is done — see the note there.
  return `<img class="${extraClass}" src="${light}" alt="${a}" loading="lazy" />`;
}

/** `![[Drawing.excalidraw|Caption]]` → theme- and language-aware figure. */
function excalidrawHtml(target: string, alt?: string): string {
  const { en, uk } = resolveExcalidraw(target);
  const enImg = excalSideToImg(en);
  const ukImg = uk ? excalSideToImg(uk) : undefined;
  if (enImg) return diagramFigure(enImg, ukImg, alt, "excalidraw");
  return `<span class="excalidraw-missing">⚠️ Drawing “${escapeHtml(
    target
  )}” isn’t exported yet — turn on Auto-export SVG in the Excalidraw plugin (see docs/EXCALIDRAW.md).</span>`;
}

/** Resolve an ordinary SVG diagram with its optional theme/language siblings. */
function resolveSvgDiagram(
  sectionDir: string,
  file: string
): {
  en: { light: string; dark?: string };
  uk?: { light: string; dark?: string };
} {
  const ukName = langVariantName(file);
  return {
    en: {
      light: resolveImageUrl(sectionDir, file),
      dark: darkVariantUrl(file),
    },
    uk:
      ukName && assetExists(sectionDir, ukName)
        ? {
            light: resolveImageUrl(sectionDir, ukName),
            dark: darkVariantUrl(ukName),
          }
        : undefined,
  };
}

/** A bilingual string pair rendered through the site's existing language CSS. */
function bilingual(en: string, uk: string): string {
  return `<span class="lang-en">${escapeHtml(
    en
  )}</span><span class="lang-uk">${escapeHtml(uk)}</span>`;
}

/**
 * Diagram-first figure paired with the source notebook photo.
 *
 * The two radios are intentionally plain HTML: the switch remains fully static,
 * keyboard-accessible, and usable with JavaScript disabled. The diagram stays
 * the default; CSS swaps the original in only when the reader asks for it.
 */
function imageNoteHtml(
  target: string,
  original: string,
  alt: string | undefined,
  sectionDir: string,
  id: string
): string {
  let diagram:
    | {
        en: { light: string; dark?: string };
        uk?: { light: string; dark?: string };
      }
    | undefined;

  if (/\.excalidraw(?:\.md)?$/i.test(target.trim())) {
    const resolved = resolveExcalidraw(target);
    const en = excalSideToImg(resolved.en);
    if (en) {
      diagram = {
        en,
        uk: resolved.uk ? excalSideToImg(resolved.uk) : undefined,
      };
    }
  } else if (/\.svg$/i.test(target.trim())) {
    diagram = resolveSvgDiagram(sectionDir, target);
  }

  if (!diagram) return excalidrawHtml(target, alt);

  const originalSrc = resolveImageUrl(sectionDir, original);
  const diagramId = `${id}-diagram`;
  const originalId = `${id}-original`;
  const groupName = `${id}-view`;
  const originalAlt = `${ui.imageNoteOriginalAlt.en} / ${ui.imageNoteOriginalAlt.uk}`;

  return (
    `<figure class="image-note">` +
    `<fieldset class="image-note-shell">` +
    `<legend class="image-note-legend">${bilingual(
      ui.imageNoteView.en,
      ui.imageNoteView.uk
    )}</legend>` +
    `<input class="image-note-radio image-note-radio-diagram" type="radio" id="${diagramId}" name="${groupName}" checked />` +
    `<input class="image-note-radio image-note-radio-original" type="radio" id="${originalId}" name="${groupName}" />` +
    `<div class="image-note-stage">` +
    `<div class="image-note-diagram">${diagramMedia(
      diagram.en,
      diagram.uk,
      alt,
      "image-note-drawing"
    )}</div>` +
    `<div class="image-note-original"><img src="${originalSrc}" alt="${escapeHtml(
      originalAlt
    )}" loading="lazy" /></div>` +
    `</div>` +
    `<div class="image-note-controls">` +
    `<label class="image-note-label image-note-label-diagram press" for="${diagramId}">${bilingual(
      ui.imageNoteDiagram.en,
      ui.imageNoteDiagram.uk
    )}</label>` +
    `<label class="image-note-label image-note-label-original press" for="${originalId}">${bilingual(
      ui.imageNoteOriginal.en,
      ui.imageNoteOriginal.uk
    )}</label>` +
    `</div>` +
    `</fieldset>` +
    `${diagramCaption(alt)}` +
    `</figure>`
  );
}

/**
 * Obsidian callouts → styled divs. The body is emitted as markdown between
 * raw HTML tags (separated by blank lines) so the pipeline still parses it.
 */
function transformCallouts(md: string, idPrefix = ""): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let spoilerN = 0;
  // The overlay is empty, so it needs an accessible name. The id prefix is the
  // only signal here for which language this pass is rendering — see the
  // idPrefix note in renderWithHeadings().
  const revealLabel = idPrefix.startsWith("uk-")
    ? "Показати спойлер"
    : "Reveal spoiler";
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^>\s*\[!(\w+)\][+-]?\s*(.*)$/);
    if (!m) {
      out.push(lines[i]);
      continue;
    }
    const type = m[1].toLowerCase();
    const title =
      m[2].trim() || type.charAt(0).toUpperCase() + type.slice(1);
    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length && /^>/.test(lines[j])) {
      body.push(lines[j].replace(/^>\s?/, ""));
      j++;
    }
    i = j - 1;

    // `> [!spoiler]` blurs its body until the blurred text itself is clicked.
    //
    // The label is a transparent overlay sitting on top of the body rather
    // than wrapping it: <label> only accepts phrasing content, and the body is
    // arbitrary markdown — paragraphs, lists, images. Overlaying keeps the
    // HTML valid and still makes the whole passage the target. It's removed
    // once revealed, so the text underneath stays selectable and any links in
    // it work. A checkbox does the toggling, so there's no JavaScript and no
    // dead control for anyone without it; in Obsidian it stays a plain callout.
    if (type === "spoiler") {
      const id = `${idPrefix}sp-${++spoilerN}`;
      out.push(
        `<div class="callout spoiler-callout" data-callout="spoiler">`,
        "",
        `<input type="checkbox" id="${id}" class="spoiler-toggle" />`,
        `<p class="callout-title">${escapeHtml(title)}</p>`,
        `<span class="spoiler-reveal">`,
        `<span class="spoiler-body">`,
        "",
        ...body,
        "",
        `</span>`,
        `<label for="${id}" class="spoiler-cover" aria-label="${escapeHtml(
          revealLabel
        )}"></label>`,
        `</span>`,
        "",
        `</div>`
      );
      continue;
    }

    out.push(
      `<div class="callout" data-callout="${type}">`,
      "",
      `<p class="callout-title">${escapeHtml(title)}</p>`,
      "",
      ...body,
      "",
      `</div>`
    );
  }
  return out.join("\n");
}

/* Sentinels for masked code (Unicode private-use area — never real content). */
const MASK_OPEN = "";
const MASK_CLOSE = "";

/**
 * Hide fenced blocks and inline code spans behind placeholders so the Obsidian
 * preprocessing regexes below can't rewrite them.
 *
 * Without this, a note that *documents* the syntax gets mangled: writing
 * `` `![[Name.excalidraw]]` `` in backticks still matched the embed regex, so
 * the code span ended up containing generated HTML instead of the literal text
 * the author typed.
 */
function maskCode(md: string): { text: string; slots: string[] } {
  const slots: string[] = [];
  const stash = (m: string) => `${MASK_OPEN}${slots.push(m) - 1}${MASK_CLOSE}`;

  // Strip any pre-existing sentinels so indices can't be spoofed by content.
  let text = md.split(MASK_OPEN).join("").split(MASK_CLOSE).join("");

  // Fenced blocks first — they may legitimately contain backticks.
  text = text.replace(
    /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm,
    stash
  );
  // Then inline spans, bounded to a single line.
  text = text.replace(/(`+)(?:(?!\1)[^\n])+\1/g, stash);

  return { text, slots };
}

function unmaskCode(text: string, slots: string[]): string {
  return text.replace(
    new RegExp(`${MASK_OPEN}(\\d+)${MASK_CLOSE}`, "g"),
    (_m, i: string) => slots[Number(i)] ?? ""
  );
}

export function preprocessObsidian(
  md: string,
  sectionDir: string,
  sectionSlug: string,
  idPrefix = ""
): string {
  // 0. Take code out of play — everything below is regex over the raw text.
  const { text, slots } = maskCode(md);
  md = text;

  // 1. Callouts first (they restructure blockquote syntax).
  md = transformCallouts(md, idPrefix);

  // 2. Image notes: a normal SVG/Excalidraw embed followed by a hidden source
  //    photo directive. Obsidian shows the drawing and ignores the comment;
  //    the site upgrades the pair into a diagram/original switch.
  let imageNoteN = 0;
  md = md.replace(
    /!\[\[([^\]|]+?\.(?:svg|excalidraw(?:\.md)?))(?:\|([^\]]*))?\]\][ \t]*\r?\n[ \t]*<!--\s*image-note:\s*([^\n>]+?)\s*-->/gi,
    (_m, target: string, alt: string | undefined, original: string) => {
      const id = `${idPrefix ?? ""}image-note-${++imageNoteN}-${slugify(
        target.replace(/\.(?:svg|excalidraw(?:\.md)?)$/i, "")
      )}`;
      return `\n${imageNoteHtml(
        target.trim(),
        original.trim(),
        alt,
        sectionDir,
        id
      )}\n`;
    }
  );

  // 2a. Remaining Excalidraw drawings: ![[Drawing.excalidraw]] / ![[Drawing.excalidraw.md]]
  //     → the exported SVG (theme-aware if light + dark were exported).
  md = md.replace(
    /!\[\[([^\]|]+?\.excalidraw(?:\.md)?)(?:\|([^\]]*))?\]\]/gi,
    (_m, target: string, alt?: string) => excalidrawHtml(target, alt)
  );

  // 2b. Obsidian embeds: ![[file.png]], ![[file.png|alt text]], ![[file.png|300]]
  md = md.replace(
    /!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
    (
      _m: string,
      file: string,
      alt: string | undefined,
      offset: number,
      whole: string
    ) => {
      const src = resolveImageUrl(sectionDir, file);
      const size = alt?.trim().match(/^(\d+)(?:x(\d+))?$/);
      // A tag alone on a line opens a markdown HTML block that eats the lines
      // after it, so pad it out — but only when it really is alone.
      const block = (html: string) =>
        standalone(whole, offset, _m.length) ? `\n${html}\n` : html;
      if (size) {
        const w = Number(size[1]);
        // Small sized embeds (≤128px, e.g. ![[me.jpeg|93]]) are avatars:
        // circular, square-cropped. Larger ones keep the regular style.
        if (w <= 128 && !size[2]) {
          return block(
            `<img src="${src}" width="${w}" height="${w}" class="avatar" alt="" />`
          );
        }
        const height = size[2] ? ` height="${size[2]}"` : "";
        return block(`<img src="${src}" width="${w}"${height} alt="" />`);
      }
      // Theme (<name>.dark.<ext>) and language (<name>.uk.<ext>) variants.
      const enDark = darkVariantUrl(file);
      const ukName = langVariantName(file);
      const hasUk = ukName ? assetExists(sectionDir, ukName) : false;
      const isSvg = /\.svg$/i.test(file.trim());
      const caps = captionParts(alt);

      // SVG diagrams (borderless), or any embed that has a dark/uk variant, or
      // a bilingual "en :: uk" caption → render as a swap-aware figure.
      if (isSvg || enDark || hasUk || caps.uk) {
        const uk =
          hasUk && ukName
            ? {
                light: resolveImageUrl(sectionDir, ukName),
                dark: darkVariantUrl(ukName),
              }
            : undefined;
        return `\n${diagramFigure(
          { light: src, dark: enDark },
          uk,
          alt,
          isSvg ? "excalidraw" : ""
        )}\n`;
      }
      return `![${alt ?? ""}](${src})`;
    }
  );

  // 3. Wiki links: [[Note]] or [[Note|label]] — resolved across ALL sections
  //    via the wiki index; unknown targets fall back to a same-section guess.
  md = md.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
    (_m, target: string, label?: string) => {
      const clean = target.split("#")[0].trim();
      const href =
        wiki().get(clean.toLowerCase()) ?? `/${sectionSlug}/${slugify(clean)}`;
      return `[${label ?? target}](${href})`;
    }
  );

  // 4. Standard-markdown images with relative paths: ![alt](photo.png)
  md = md.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/|\/|data:)([^)\s]+)\)/g,
    (_m, alt: string, src: string) =>
      `![${alt}](${assetUrl(sectionDir, safeDecode(src))})`
  );

  // 5. Inline progress bars: [progress:: 45%] (Dataview-style field — renders
  //    as plain text in Obsidian, as a styled bar on the site).
  md = md.replace(/\[progress::\s*(\d{1,3})\s*%?\s*\]/gi, (_m, n: string) => {
    const v = Math.min(100, Math.max(0, Number(n)));
    return (
      `<span class="progress" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100">` +
      `<span class="progress-fill" style="width:${v}%"></span></span>` +
      `<span class="progress-label">${v}%</span>`
    );
  });

  // 5b. Inline spoilers: ||hidden|| → blurred until clicked. Same checkbox
  //     mechanism as the [!spoiler] callout, so it needs no JavaScript.
  //     Bounded to one line and no inner pipes, so table rows can't match.
  let inlineN = 0;
  md = md.replace(/\|\|([^|\n]+)\|\|/g, (_m, text: string) => {
    const id = `${idPrefix}spi-${++inlineN}`;
    return (
      `<span class="spoiler-inline">` +
      `<input type="checkbox" id="${id}" class="spoiler-toggle" />` +
      `<label for="${id}"><span>${escapeHtml(text)}</span></label>` +
      `</span>`
    );
  });

  // 6. Apple Music links standing alone on a line → embedded player.
  md = md.replace(
    /^\s*<?(https:\/\/music\.apple\.com\/[^\s<>]+)>?\s*$/gm,
    (m, url: string) => (isAppleMusicUrl(url) ? `\n${appleMusicEmbedHtml(url)}\n` : m)
  );

  // 7. YouTube links standing alone on a line → embedded player.
  md = md.replace(
    /^\s*<?(https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/[^\s<>]+)>?\s*$/gm,
    (m, url: string) => {
      const id = youtubeId(url);
      return id ? `\n${youtubeEmbedHtml(id)}\n` : m;
    }
  );

  // 8. Put the code back, untouched, for remark to parse normally.
  return unmaskCode(md, slots);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * rehype step: a paragraph whose only child is a non-avatar <img> becomes
 * <figure><img/><figcaption>alt</figcaption></figure> (caption only when
 * alt text exists). Runs after rehype-raw so raw HTML images count too.
 */
function rehypeFigures() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!node.children) return;
      node.children = node.children.map((child: any) => {
        if (child.type === "element" && child.tagName === "p" && child.children) {
          const kids = child.children.filter(
            (c: any) => !(c.type === "text" && !c.value.trim())
          );
          if (kids.length === 1 && kids[0].tagName === "img") {
            const img = kids[0];
            const cls = img.properties?.className;
            const isAvatar = Array.isArray(cls)
              ? cls.includes("avatar")
              : cls === "avatar";
            if (!isAvatar) {
              const alt = String(img.properties?.alt ?? "").trim();
              const children: any[] = [img];
              if (alt) {
                children.push({
                  type: "element",
                  tagName: "figcaption",
                  properties: {},
                  children: [{ type: "text", value: alt }],
                });
              }
              return {
                type: "element",
                tagName: "figure",
                properties: {},
                children,
              };
            }
          }
        }
        walk(child);
        return child;
      });
    };
    walk(tree);
  };
}
/**
 * rehype step: carry a fence's info string (```bash title="scan.sh") onto the
 * <code> element as a real attribute.
 *
 * Must run BEFORE rehype-raw: mdast-util-to-hast parks the meta in the node's
 * `data`, but rehype-raw re-serializes and re-parses the whole tree, and `data`
 * doesn't survive that round trip. Attributes do.
 */
function rehypeCodeMeta() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!node.children) return;
      for (const child of node.children) {
        if (
          child.type === "element" &&
          child.tagName === "code" &&
          typeof child.data?.meta === "string" &&
          child.data.meta.trim()
        ) {
          child.properties = {
            ...(child.properties ?? {}),
            "data-meta": child.data.meta,
          };
        }
        walk(child);
      }
    };
    walk(tree);
  };
}

/**
 * rehype step: syntax-highlight every fenced code block at build time and wrap
 * it in <figure class="code-block">, with an optional header showing the
 * filename (```bash title="scan.sh") and the language. The copy button is added
 * client-side by components/CodeCopy.tsx so it never appears without JS.
 *
 * Async on purpose — Shiki loads its grammars lazily; unified awaits the
 * returned promise.
 */
/**
 * Fences that are a terminal rather than a file.
 *
 * The distinction is worth drawing because most of what gets pasted into these
 * notes is a session — an nmap run, a systemctl status, a failed login — and a
 * session is a window you were sitting at, not a file you wrote. Rendering the
 * two identically made every post read as source code.
 *
 * Written as the aliases people actually type, not the grammar names Shiki
 * resolves them to: the fence says ```bash, and this runs before Shiki has
 * been anywhere near it.
 */
const SHELL_LANGS = new Set([
  "bash",
  "sh",
  "shell",
  "shellscript",
  "shellsession",
  "console",
  "zsh",
  "fish",
  "powershell",
  "ps1",
  "cmd",
  "bat",
]);

function isShell(lang: string | undefined): boolean {
  return !!lang && SHELL_LANGS.has(lang.toLowerCase());
}

function rehypeCodeBlocks() {
  return async (tree: any) => {
    // Collect first, transform after: highlighting is async and we must not
    // mutate the tree while walking it.
    const jobs: { parent: any; node: any; code: string; lang?: string; meta?: string }[] =
      [];

    const textOf = (node: any): string => {
      if (node.type === "text") return String(node.value ?? "");
      if (!node.children) return "";
      return node.children.map(textOf).join("");
    };

    const walk = (node: any) => {
      if (!node.children) return;
      for (const child of node.children) {
        if (child.type === "element" && child.tagName === "pre") {
          const codeEl = child.children?.find(
            (c: any) => c.type === "element" && c.tagName === "code"
          );
          if (codeEl) {
            const raw = codeEl.properties?.className;
            const classes = Array.isArray(raw)
              ? raw.map(String)
              : raw
                ? [String(raw)]
                : [];
            const langClass = classes.find((c) => c.startsWith("language-"));
            jobs.push({
              parent: node,
              node: child,
              code: textOf(codeEl).replace(/\n$/, ""),
              lang: langClass?.slice("language-".length),
              // Set by rehypeCodeMeta above. rehype-raw re-parses the tree and
              // renames the attribute to hast's camelCase form, so check both;
              // `data.meta` covers a pipeline without rehype-raw.
              meta:
                (codeEl.properties?.dataMeta as string | undefined) ??
                (codeEl.properties?.["data-meta"] as string | undefined) ??
                codeEl.data?.meta,
            });
            continue; // don't descend into the code block
          }
        }
        walk(child);
      }
    };
    walk(tree);

    await Promise.all(
      jobs.map(async (job) => {
        const pre = await highlightToHast(job.code, job.lang);
        if (!pre) return;

        // Shiki already sets tabindex="0" on the <pre> (keyboard scrolling of
        // overflow), so don't add a second one.

        const { title } = parseCodeMeta(job.meta);
        const label = langLabel(job.lang);
        const terminal = isShell(job.lang);
        const children: any[] = [];

        /* A shell block gets a header whether or not it was given a title:
           the three dots ARE the header, and a terminal without its title bar
           is just a grey box. Everything else keeps the old rule — no title,
           no language, no bar. */
        if (title || label || terminal) {
          const bits: any[] = [];
          if (terminal) {
            // Three dots, and deliberately not red/amber/green: the site is
            // monochrome, and the shape is what says "terminal" — the traffic
            // lights would be the only colour on the page.
            bits.push({
              type: "element",
              tagName: "span",
              properties: { className: ["code-dots"] },
              children: [0, 1, 2].map(() => ({
                type: "element",
                tagName: "span",
                properties: {},
                children: [],
              })),
            });
          }
          if (title) {
            bits.push({
              type: "element",
              tagName: "span",
              properties: { className: ["code-file"] },
              children: [{ type: "text", value: title }],
            });
          }
          if (label) {
            bits.push({
              type: "element",
              tagName: "span",
              properties: { className: ["code-lang"] },
              children: [{ type: "text", value: label }],
            });
          }
          children.push({
            type: "element",
            tagName: "figcaption",
            properties: { className: ["code-head"] },
            children: bits,
          });
        }
        children.push(pre);

        const figure = {
          type: "element",
          tagName: "figure",
          properties: {
            className: ["code-block"],
            ...(label ? { "data-lang": label } : {}),
            ...(terminal ? { "data-terminal": "" } : {}),
          },
          children,
        };

        const i = job.parent.children.indexOf(job.node);
        if (i !== -1) job.parent.children[i] = figure;
      })
    );
  };
}
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * rehype step: stamp `width` and `height` on every vault image that doesn't
 * already carry them.
 *
 * Without an intrinsic size the browser reserves no space for an image, so
 * every image on a page pushes the text below it down the moment it decodes —
 * on a slow connection that means the paragraph you're reading slides out from
 * under you. With the attributes present, `max-width: 100%` + `height: auto`
 * in globals.css turns them into an aspect ratio, the box is reserved at the
 * right shape immediately, and nothing moves.
 *
 * A rehype step rather than a tweak to the `<img>` builders, because images
 * reach the tree three different ways — Obsidian embeds (`![[x.png]]`, raw
 * HTML), standard markdown (`![alt](x.png)`, built by remark), and hand-written
 * `<img>` in a note. This runs after rehype-raw, so it sees all three.
 *
 * Sizes come from the manifest scripts/sync-assets.mjs writes; a remote cover
 * or an image sharp couldn't read simply doesn't get attributes, exactly as
 * before.
 */
function rehypeImageSize() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!node.children) return;
      for (const child of node.children) {
        if (child.type === "element" && child.tagName === "img") {
          const p = child.properties ?? (child.properties = {});
          const src = typeof p.src === "string" ? p.src : undefined;
          // An explicitly sized embed (`![[me.jpeg|93]]`) already said what it
          // wants — overriding it would resize the avatar.
          const sized = p.width !== undefined || p.height !== undefined;
          if (!sized) {
            const dims = dimsFor(src);
            if (dims) {
              p.width = dims.w;
              p.height = dims.h;
            }
          }
          // Candidate widths, plus the box they're painted in. A sized embed
          // knows its box exactly; everything else fills the prose column,
          // which is max-w-2xl (42rem = 672px) until the viewport is narrower
          // than the column plus its 1.5rem gutters.
          const srcSet = srcSetFor(src);
          if (srcSet && !p.srcSet) {
            p.srcSet = srcSet;
            // p.width may be a string here: the sized embeds are built as raw
            // HTML and come back through rehype-raw.
            const box = sized ? Number(p.width) : NaN;
            p.sizes = Number.isFinite(box)
              ? `${box}px`
              : "(max-width: 42rem) 100vw, 672px";
          }
          continue;
        }
        walk(child);
      }
    };
    walk(tree);
  };
}

/**
 * rehype step: mirror every GFM footnote (`[^1]`) into a margin **sidenote**
 * placed right after its reference, so a wide screen can show the note beside
 * the sentence that raised it instead of sending the reader to the bottom.
 *
 * The footnote list remark-gfm builds is left exactly where it is — CSS hides
 * one or the other (`.sidenote` below 1280px, `section.footnotes.all-sidenoted`
 * above), the same show-one-hide-the-other trick the language toggle uses. That
 * keeps the note reachable without JS, in print, and in a feed reader, and it
 * keeps the `↩` backref working for anyone who lands there from a narrow
 * screen. Duplicated text in the DOM is the price; it is not indexed twice,
 * since the Cmd+K index is built from the raw markdown, not from this HTML.
 *
 * **Only all-paragraph footnotes are converted.** A sidenote has to live inside
 * the `<p>` that holds its reference, so its content must be phrasing — a
 * footnote containing a list or a code block would produce invalid HTML that
 * the browser silently reparses into a different tree. Those are skipped, and
 * skipping even one drops the `all-sidenoted` class so the bottom list stays
 * visible at every width. Nothing is ever lost, worst case it just isn't in
 * the margin.
 *
 * Sidenotes sit in the LEFT margin because the table-of-contents rail
 * (components/Toc.tsx) already owns the right one at exactly the same
 * breakpoint.
 */
function rehypeSidenotes({ idPrefix = "" }: { idPrefix?: string } = {}) {
  const clone = (n: any) => JSON.parse(JSON.stringify(n));

  const isEl = (n: any, tag: string) => n?.type === "element" && n.tagName === tag;

  /** hast renames `data-footnotes` → `dataFootnotes` (and rehype-raw keeps it). */
  const hasFlag = (node: any, camel: string, dashed: string) =>
    node?.properties?.[camel] !== undefined ||
    node?.properties?.[dashed] !== undefined;

  return (tree: any) => {
    // 1. Find the footnote list remark-gfm appended to the document.
    let section: any = null;
    const findSection = (node: any) => {
      if (section || !node.children) return;
      for (const c of node.children) {
        if (isEl(c, "section") && hasFlag(c, "dataFootnotes", "data-footnotes")) {
          section = c;
          return;
        }
        findSection(c);
      }
    };
    findSection(tree);
    if (!section) return;

    const list = section.children?.find((c: any) => isEl(c, "ol"));
    if (!list) return;

    // `clobberPrefix` namespaces the fn-/fnref- ids but not the list's own
    // screen-reader label, whose id is hard-coded by mdast-util-to-hast. Both
    // languages ship in one document, so prefix it here — and repoint the
    // aria-describedby on every reference at the prefixed id — or the two
    // copies collide and Ukrainian references describe the English list.
    const LABEL = "footnote-label";
    const labelId = `${idPrefix}${LABEL}`;
    const heading = section.children.find((c: any) => c.properties?.id === LABEL);
    if (heading) heading.properties.id = labelId;

    // 2. Index each definition by the id its reference points at. Paragraphs
    //    become <span class="sn-p"> (block-level via CSS) and the trailing
    //    backref arrow is dropped — it only makes sense at the bottom.
    const defs = new Map<string, any[]>();
    for (const li of list.children) {
      if (!isEl(li, "li")) continue;
      const id = li.properties?.id;
      if (typeof id !== "string") continue;

      const paras = li.children.filter(
        (c: any) => c.type !== "text" || c.value.trim()
      );
      if (!paras.length || !paras.every((c: any) => isEl(c, "p"))) continue;

      const body = paras.map((p: any) => ({
        type: "element",
        tagName: "span",
        properties: { className: ["sn-p"] },
        children: clone(p.children).filter(
          (c: any) =>
            !(
              isEl(c, "a") && hasFlag(c, "dataFootnoteBackref", "data-footnote-backref")
            )
        ),
      }));
      defs.set(id, body);
    }
    if (!defs.size) return;

    // 3. Insert a sidenote after every reference that has a definition.
    let converted = 0;
    let refs = 0;
    const walk = (node: any) => {
      if (!node.children) return;
      const out: any[] = [];
      for (const child of node.children) {
        out.push(child);
        if (isEl(child, "sup")) {
          const a = child.children?.find(
            (c: any) => isEl(c, "a") && hasFlag(c, "dataFootnoteRef", "data-footnote-ref")
          );
          const href = a?.properties?.href;
          if (typeof href === "string" && href.startsWith("#")) {
            refs++;
            // hast stores aria-describedby as a space-separated token LIST,
            // so this is an array, not a string.
            for (const key of ["ariaDescribedBy", "aria-describedby"]) {
              const v = a.properties[key];
              if (Array.isArray(v)) {
                a.properties[key] = v.map((t: string) => (t === LABEL ? labelId : t));
              } else if (v === LABEL) {
                a.properties[key] = labelId;
              }
            }
            const body = defs.get(decodeURIComponent(href.slice(1)));
            if (body) {
              converted++;
              const num = a.children?.[0]?.value ?? "";
              out.push({
                type: "element",
                tagName: "span",
                properties: { className: ["sidenote"], role: "note" },
                children: [
                  {
                    type: "element",
                    tagName: "span",
                    properties: { className: ["sidenote-num"], ariaHidden: "true" },
                    children: [{ type: "text", value: String(num) }],
                  },
                  ...clone(body),
                ],
              });
            }
          }
          continue; // never descend into a <sup>
        }
        walk(child);
      }
      node.children = out;
    };
    walk(tree);

    // Every reference got a margin copy → the bottom list is now redundant on
    // wide screens. One holdout and it stays, or that note would vanish.
    if (converted && converted === refs) {
      const cls = section.properties.className;
      section.properties.className = [
        ...(Array.isArray(cls) ? cls : cls ? [String(cls)] : []),
        "all-sidenoted",
      ];
    }
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface RenderOptions {
  /**
   * Prefix for heading ids. An entry's Ukrainian body renders as a second
   * <article> in the same document, so its ids need their own namespace —
   * see lib/toc.ts.
   */
  idPrefix?: string;
  /** Localized accessible name for the "#" anchor beside each heading. */
  anchorLabel?: string;
  /** Set false where an in-page link makes no sense — the RSS feed. */
  anchors?: boolean;
}

/**
 * Render markdown AND report the h2/h3 outline, for pages that show a table of
 * contents. Everything else calls renderMarkdown() and ignores the headings.
 */
export async function renderWithHeadings(
  md: string,
  sectionDir: string,
  sectionSlug: string,
  options: RenderOptions = {}
): Promise<{ html: string; headings: Heading[] }> {
  // idPrefix also namespaces spoiler checkbox ids — both languages ship in one
  // document, so an unprefixed id would toggle the other language's spoiler.
  const pre = preprocessObsidian(md, sectionDir, sectionSlug, options.idPrefix);
  const headings: Heading[] = [];
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, {
      allowDangerousHtml: true,
      // Footnote ids ("user-content-fn-1") are minted from the note's own
      // numbering, and an entry ships BOTH languages in one document — without
      // a per-language prefix the Ukrainian body would redefine every English
      // footnote id and `↩` would jump into the wrong article. Same reasoning
      // as the heading ids in lib/toc.ts (DECISIONS.md #17).
      clobberPrefix: `${options.idPrefix ?? ""}user-content-`,
    })
    .use(rehypeCodeMeta)
    .use(rehypeRaw)
    .use(rehypeFigures)
    .use(rehypeImageSize)
    .use(rehypeSidenotes, { idPrefix: options.idPrefix })
    .use(rehypeCodeBlocks)
    .use(rehypeSlug)
    // After rehype-slug on purpose — it needs the ids rehype-slug mints.
    .use(rehypeHeadings, { ...options, collect: headings })
    .use(rehypeStringify)
    .process(pre);
  // Last step on purpose — see inlineDiagrams().
  return { html: inlineDiagrams(String(file)), headings };
}

export async function renderMarkdown(
  md: string,
  sectionDir: string,
  sectionSlug: string,
  options: RenderOptions = {}
): Promise<string> {
  const { html } = await renderWithHeadings(md, sectionDir, sectionSlug, options);
  return html;
}
