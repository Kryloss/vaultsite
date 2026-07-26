/**
 * Backlinks — "Mentioned in", the reverse of every [[wiki link]] in the vault.
 *
 * lib/vault.ts already builds the forward index (name → URL) that turns
 * [[Sapiens]] into /shelf/sapiens. This walks every note, resolves its links
 * the same way lib/markdown.ts does, and inverts the result: target URL → the
 * pages that point at it. Obsidian shows this in its backlinks pane; without it
 * the site only ever renders half of each connection.
 *
 * Build time only, memoized for the process — every entry page asks for the
 * whole map and looks up its own URL.
 */
import {
  getSections,
  getEntries,
  getWikiIndex,
  slugify,
  type Section,
} from "./vault";

export interface Backlink {
  /** Site-absolute URL of the page doing the linking. */
  href: string;
  title: string;
  titleUk?: string;
  /** Section it lives in, for the secondary label. */
  section: string;
  sectionUk?: string;
}

/**
 * Strip fenced blocks and inline code before scanning.
 *
 * Notes that document the syntax (the formatting playground) write [[Note]]
 * inside backticks. Those render as literal text, so they aren't links and must
 * not produce backlinks. Same reasoning as maskCode() in lib/markdown.ts.
 */
function withoutCode(md: string): string {
  return md
    .replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, " ")
    .replace(/(`+)(?:(?!\1)[^\n])+\1/g, " ");
}

/**
 * Every [[target]] in a note, as resolved URLs.
 *
 * Deliberately mirrors step 3 of preprocessObsidian(): same wiki index, same
 * same-section fallback, and `![[embeds]]` excluded (an image is not a link).
 */
function linkedHrefs(
  md: string,
  sectionSlug: string,
  wiki: Map<string, string>
): string[] {
  const out: string[] = [];
  const re = /(!?)\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g;
  for (const m of withoutCode(md).matchAll(re)) {
    if (m[1] === "!") continue; // embed, not a link
    const target = m[2].split("#")[0].trim();
    if (!target) continue;
    out.push(
      wiki.get(target.toLowerCase()) ?? `/${sectionSlug}/${slugify(target)}`
    );
  }
  return out;
}

function sectionHref(section: Section): string {
  return section.slug === "home" ? "/" : `/${section.slug}`;
}

/**
 * Memoized for the build, but never in dev: the vault isn't a module import, so
 * nothing would invalidate this when the owner adds a link in Obsidian.
 */
const MEMOIZE = process.env.NODE_ENV === "production";
let cache: Map<string, Backlink[]> | null = null;

/** Target URL → the pages linking to it, in section then entry order. */
export function getBacklinks(): Map<string, Backlink[]> {
  if (cache && MEMOIZE) return cache;

  const wiki = getWikiIndex();
  const map = new Map<string, Backlink[]>();

  /** Sources whose URL exists on the site — unresolved links are dropped. */
  const known = new Set<string>();
  const sources: { source: Backlink; bodies: (string | undefined)[]; sectionSlug: string }[] =
    [];

  for (const section of getSections()) {
    const href = sectionHref(section);
    known.add(href);
    sources.push({
      source: {
        href,
        title: section.title,
        titleUk: section.titleUk,
        section: "Section",
        sectionUk: "Розділ",
      },
      bodies: [section.content, section.contentUk],
      sectionSlug: section.slug,
    });

    for (const entry of getEntries(section)) {
      const entryHref = `/${section.slug}/${entry.slug}`;
      known.add(entryHref);
      sources.push({
        source: {
          href: entryHref,
          title: entry.title,
          titleUk: entry.titleUk,
          section: section.title,
          sectionUk: section.titleUk,
        },
        bodies: [entry.content, entry.contentUk],
        sectionSlug: section.slug,
      });
    }
  }

  for (const { source, bodies, sectionSlug } of sources) {
    // Both languages feed one list: a note usually links the same things in
    // each, and a UK-only link is still a real connection. Deduped by href.
    const targets = new Set<string>();
    for (const body of bodies) {
      if (!body) continue;
      for (const href of linkedHrefs(body, sectionSlug, wiki)) targets.add(href);
    }

    for (const target of targets) {
      if (target === source.href) continue; // a note linking itself
      if (!known.has(target)) continue; // link to a note that isn't published
      const list = map.get(target) ?? [];
      if (!list.some((b) => b.href === source.href)) list.push(source);
      map.set(target, list);
    }
  }

  cache = map;
  return map;
}

/** Backlinks for one page, or an empty list. */
export function backlinksFor(href: string): Backlink[] {
  return getBacklinks().get(href) ?? [];
}
