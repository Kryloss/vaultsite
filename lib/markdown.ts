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
 * <figure> + <figcaption> (skipping avatars).
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
import { slugify, getWikiIndex } from "./vault";
import { appleMusicEmbedHtml, isAppleMusicUrl } from "./apple-music";

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

  // 2. Obsidian embeds: ![[file.png]], ![[file.png|alt text]], ![[file.png|300]]
  md = md.replace(
    /!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
    (_m, file: string, alt?: string) => {
      const src = assetUrl(sectionDir, file);
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

  // 5. Apple Music links standing alone on a line → embedded player.
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
    .use(rehypeRaw)
    .use(rehypeFigures)
    .use(rehypeSlug)
    .use(rehypeStringify)
    .process(pre);
  return String(file);
}
