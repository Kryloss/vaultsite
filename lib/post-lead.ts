/**
 * The Posts page's lead (page idea `postsLead`, DECISIONS #180): the newest
 * post's opening paragraph and first picture, read from its Markdown.
 *
 * Pure and client-safe — no `fs`. The caller resolves the image file name to
 * a URL (lib/vault.ts owns the asset index).
 */

/** Longest opening shown before it is cut at a word and given an ellipsis. */
export const LEAD_CHARS = 320;
/** An opening shorter than this takes the next paragraph too. */
export const LEAD_MIN = 160;

function plain(text: string): string {
  return text
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_m, t, l) => l || t)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/(\*\*|__|\*|_|`|~~)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The opening: the first real paragraph, and the ones straight after it while
 * it is still shorter than `LEAD_MIN` — a one-line hook ("I want to use the
 * honest word for this") says little on its own. Skips headings, embeds,
 * images, lists, quotes and callouts, tables, HTML blocks and bare links
 * (which become players on the page, not prose), and stops at the first of
 * those once it has started. Null when the body has no paragraph at all.
 */
export function openingParagraph(md: string): string | null {
  const body = md.replace(/```[\s\S]*?```/g, "\n\n").replace(/%%[\s\S]*?%%/g, "\n\n");
  let out = "";
  for (const block of body.split(/\n\s*\n/)) {
    const text = block.trim();
    if (!text) continue;
    const prose = !/^(#|!\[|>|[-*+] |\d+\. |\||<|https?:\/\/\S+$)/.test(text);
    if (!prose) {
      if (out) break;
      continue;
    }
    const para = plain(text);
    if (!para) continue;
    out = out ? `${out} ${para}` : para;
    if (out.length >= LEAD_MIN) break;
  }
  if (!out) return null;
  if (out.length <= LEAD_CHARS) return out;
  const cut = out.slice(0, LEAD_CHARS);
  const space = cut.lastIndexOf(" ");
  return `${(space > LEAD_CHARS / 2 ? cut.slice(0, space) : cut).replace(/[,;:—–-]$/, "").trimEnd()}…`;
}

/**
 * The file name of the first picture in the body — `![[file.webp|caption]]`
 * or `![alt](file.jpg)` — skipping anything that isn't a raster or vector
 * image (an embedded note, a PDF, an Excalidraw drawing's source).
 */
export function firstImage(md: string): string | null {
  const re = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;
  for (const m of md.matchAll(re)) {
    const file = (m[1] ?? m[2]).trim();
    if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(file) && !/^https?:/i.test(file)) {
      return decodeURIComponent(file.split("/").pop()!);
    }
  }
  return null;
}
