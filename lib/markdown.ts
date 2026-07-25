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
 * syntax-highlighted at build time (see lib/highlight.ts).
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
import { highlightToHast, parseCodeMeta, langLabel } from "./highlight";

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
  return assetUrl(sectionDir, clean);
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

/** Split an embed caption "English :: Українською" into parts (size params skipped). */
function captionParts(alt?: string): { en: string; uk?: string } {
  if (!alt) return { en: "" };
  const t = alt.trim();
  if (/^\d+(x\d+)?$/.test(t)) return { en: "" };
  const [en, uk] = t.split("::").map((s) => s.trim());
  return { en, uk: uk || undefined };
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
  const { en: capEn, uk: capUk } = captionParts(alt);
  const cap = capEn
    ? capUk
      ? `<figcaption><span class="lang-en">${escapeHtml(
          capEn
        )}</span><span class="lang-uk">${escapeHtml(capUk)}</span></figcaption>`
      : `<figcaption>${escapeHtml(capEn)}</figcaption>`
    : "";
  const cls = figClass ? ` class="${figClass}"` : "";
  if (uk) {
    return `<figure${cls}><span class="lang-en">${themedImg(
      en.light,
      en.dark,
      capEn
    )}</span><span class="lang-uk">${themedImg(
      uk.light,
      uk.dark,
      capUk ?? capEn
    )}</span>${cap}</figure>`;
  }
  return `<figure${cls}>${themedImg(en.light, en.dark, capEn)}${cap}</figure>`;
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

/** A themed <img> pair (dark swapped via CSS) or a single one. */
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

/**
 * Obsidian callouts → styled divs. The body is emitted as markdown between
 * raw HTML tags (separated by blank lines) so the pipeline still parses it.
 */
function transformCallouts(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
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

export function preprocessObsidian(
  md: string,
  sectionDir: string,
  sectionSlug: string
): string {
  // 1. Callouts first (they restructure blockquote syntax).
  md = transformCallouts(md);

  // 2a. Excalidraw drawings: ![[Drawing.excalidraw]] / ![[Drawing.excalidraw.md]]
  //     → the exported SVG (theme-aware if light + dark were exported).
  md = md.replace(
    /!\[\[([^\]|]+?\.excalidraw(?:\.md)?)(?:\|([^\]]*))?\]\]/gi,
    (_m, target: string, alt?: string) => excalidrawHtml(target, alt)
  );

  // 2b. Obsidian embeds: ![[file.png]], ![[file.png|alt text]], ![[file.png|300]]
  md = md.replace(
    /!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
    (_m, file: string, alt?: string) => {
      const src = resolveImageUrl(sectionDir, file);
      const size = alt?.trim().match(/^(\d+)(?:x(\d+))?$/);
      if (size) {
        const w = Number(size[1]);
        // Small sized embeds (≤128px, e.g. ![[me.jpeg|93]]) are avatars:
        // circular, square-cropped. Larger ones keep the regular style.
        if (w <= 128 && !size[2]) {
          return `<img src="${src}" width="${w}" height="${w}" class="avatar" alt="" />`;
        }
        const height = size[2] ? ` height="${size[2]}"` : "";
        return `<img src="${src}" width="${w}"${height} alt="" />`;
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

  // 6. Apple Music links standing alone on a line → embedded player.
  md = md.replace(
    /^\s*<?(https:\/\/music\.apple\.com\/[^\s<>]+)>?\s*$/gm,
    (m, url: string) => (isAppleMusicUrl(url) ? `\n${appleMusicEmbedHtml(url)}\n` : m)
  );

  return md;
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
        const children: any[] = [];

        if (title || label) {
          const bits: any[] = [];
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
          },
          children,
        };

        const i = job.parent.children.indexOf(job.node);
        if (i !== -1) job.parent.children[i] = figure;
      })
    );
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function renderMarkdown(
  md: string,
  sectionDir: string,
  sectionSlug: string
): Promise<string> {
  const pre = preprocessObsidian(md, sectionDir, sectionSlug);
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeCodeMeta)
    .use(rehypeRaw)
    .use(rehypeFigures)
    .use(rehypeCodeBlocks)
    .use(rehypeSlug)
    .use(rehypeStringify)
    .process(pre);
  return String(file);
}
