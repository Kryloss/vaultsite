/**
 * Markdown → HTML with Obsidian syntax support.
 *
 * Preprocessing (regex, before the unified pipeline):
 * 1. ![[image.png]] / ![[image.png|alt]]  → standard image pointing at /vault-assets/
 * 2. [[Note Name]] / [[Note Name|label]]  → internal link to /<section>/<note-slug>
 * 3. ![alt](relative.png)                 → rewritten to /vault-assets/
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
import { slugify } from "./vault";
import { appleMusicEmbedHtml, isAppleMusicUrl } from "./apple-music";

/** Encode each path segment but keep "/" separators. */
function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

function assetUrl(sectionDir: string, file: string): string {
  return `/vault-assets/${encodePath(sectionDir)}/${encodePath(file.trim())}`;
}

export function preprocessObsidian(
  md: string,
  sectionDir: string,
  sectionSlug: string
): string {
  // 1. Obsidian embeds: ![[file.png]], ![[file.png|alt text]], ![[file.png|300]]
  //    A purely numeric param is Obsidian's width syntax (`|300` or `|300x200`),
  //    which needs a raw <img> since markdown has no width attribute.
  md = md.replace(
    /!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
    (_m, file: string, alt?: string) => {
      const src = assetUrl(sectionDir, file);
      const size = alt?.trim().match(/^(\d+)(?:x(\d+))?$/);
      if (size) {
        const height = size[2] ? ` height="${size[2]}"` : "";
        return `<img src="${src}" width="${size[1]}"${height} alt="" />`;
      }
      return `![${alt ?? ""}](${src})`;
    }
  );

  // 2. Obsidian wiki links: [[Note]] or [[Note|label]] → same-section entry link
  md = md.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
    (_m, target: string, label?: string) =>
      `[${label ?? target}](/${sectionSlug}/${slugify(target)})`
  );

  // 3. Standard-markdown images with relative paths: ![alt](photo.png)
  md = md.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/|\/|data:)([^)\s]+)\)/g,
    (_m, alt: string, src: string) =>
      `![${alt}](${assetUrl(sectionDir, safeDecode(src))})`
  );

  // 4. Apple Music links standing alone on a line → embedded player.
  //    Paste a playlist/album/song link from Apple Music (Share → Copy Link)
  //    on its own line and it renders as the embed widget. Free, no API.
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
    .use(rehypeSlug)
    .use(rehypeStringify)
    .process(pre);
  return String(file);
}
