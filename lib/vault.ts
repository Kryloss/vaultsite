/**
 * Vault content engine.
 *
 * Convention (see docs/ARCHITECTURE.md):
 * - Every folder in vault/ that contains a main.md becomes a section page.
 *   e.g. vault/Posts/main.md → /posts   (vault/Home/main.md → /)
 * - Every other .md file in that folder becomes an entry within the section,
 *   with its own page. e.g. vault/Posts/How was my day.md → /posts/how-was-my-day
 * - All reads happen at build time (static generation). No runtime fs access.
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";
import type { ResumeData } from "@/lib/resume";
import { resumeHeadings, resumeSearchText } from "@/lib/resume";
import { ui } from "@/lib/ui-strings";

export const VAULT_DIR = path.join(process.cwd(), "vault");

/** Drafts are visible during `npm run dev` (with a badge), never in production builds. */
const SHOW_DRAFTS = process.env.NODE_ENV === "development";

export interface Section {
  /** URL slug, e.g. "posts". "home" is rendered at "/" */
  slug: string;
  /** Actual folder name in the vault, e.g. "Posts" */
  dirName: string;
  title: string;
  /** Ukrainian title from `title_uk:` frontmatter, shown when the site is in UK mode. */
  titleUk?: string;
  icon?: string;
  description?: string;
  /** Ukrainian description from `description_uk:` frontmatter. */
  descriptionUk?: string;
  /** Sidebar ordering (frontmatter `order`, lower = higher). Default 100. */
  order: number;
  /** Section type — decides how entries are listed. See lib/section-types.tsx */
  type: string;
  /** Raw markdown body of main.md */
  content: string;
  /** Ukrainian body from an optional sibling `main.uk.md` (toggle-swapped). */
  contentUk?: string;
  /**
   * Full frontmatter of main.md — lets section types read their own keys
   * (e.g. the "music" type reads `playlists:`) without changing this engine.
   */
  meta: Record<string, unknown>;
  /** True in dev preview when frontmatter has draft:true / published:false. */
  draft: boolean;
}

export interface Entry {
  /** URL slug, e.g. "how-was-my-day" */
  slug: string;
  /** File name without extension, e.g. "How was my day" */
  fileName: string;
  sectionSlug: string;
  sectionDir: string;
  title: string;
  /** Ukrainian title from `title_uk:` frontmatter, shown when the site is in UK mode. */
  titleUk?: string;
  date?: string;
  description?: string;
  /** Raw markdown body */
  content: string;
  /** Ukrainian body from an optional sibling `<name>.uk.md` (toggle-swapped). */
  contentUk?: string;
  /**
   * Full frontmatter of the entry — lets section types read their own keys
   * (e.g. the "people" type reads `cover:`) without changing this engine.
   */
  meta: Record<string, unknown>;
  /** True in dev preview when frontmatter has draft:true / published:false. */
  draft: boolean;
}

/** "How was my day" → "how-was-my-day" */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isDraft(data: Record<string, unknown>): boolean {
  return data.draft === true || data.published === false;
}

/** All sections (folders with a main.md), sorted for the sidebar. */
export function getSections(): Section[] {
  if (!fs.existsSync(VAULT_DIR)) return [];
  const sections: Section[] = [];

  for (const entry of fs.readdirSync(VAULT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const mainPath = path.join(VAULT_DIR, entry.name, "main.md");
    if (!fs.existsSync(mainPath)) continue;

    const { data, content } = matter(fs.readFileSync(mainPath, "utf8"));
    if (isDraft(data) && !SHOW_DRAFTS) continue;

    // Optional Ukrainian body: a sibling main.uk.md (frontmatter stripped).
    const ukPath = path.join(VAULT_DIR, entry.name, "main.uk.md");
    const contentUk = fs.existsSync(ukPath)
      ? matter(fs.readFileSync(ukPath, "utf8")).content
      : undefined;

    sections.push({
      slug: slugify((data.slug as string) ?? entry.name),
      dirName: entry.name,
      title: (data.title as string) ?? entry.name,
      titleUk: ukTitle(data),
      icon: data.icon as string | undefined,
      description: data.description as string | undefined,
      descriptionUk: (data.description_uk ?? data.descriptionUk) as
        | string
        | undefined,
      order: typeof data.order === "number" ? data.order : 100,
      type: (data.type as string) ?? "posts",
      content,
      contentUk,
      meta: data,
      draft: isDraft(data),
    });
  }

  return sections.sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title)
  );
}

export function getSectionBySlug(slug: string): Section | undefined {
  return getSections().find((s) => s.slug === slug);
}

/** Entries of a section: every .md except main.md, drafts excluded, newest first. */
export function getEntries(section: Section): Entry[] {
  const dir = path.join(VAULT_DIR, section.dirName);
  const entries: Entry[] = [];

  for (const file of fs.readdirSync(dir)) {
    if (!file.toLowerCase().endsWith(".md")) continue;
    // Skip the section body and its translations (main.md, main.uk.md, …).
    if (/^main(\.[a-z]{2})?\.md$/i.test(file)) continue;
    // Skip Excalidraw drawing source files (they render as embeds, not pages).
    if (/\.excalidraw\.md$/i.test(file)) continue;
    // Skip entry translation siblings (Foo.uk.md) — attached to Foo.md below.
    if (/\.uk\.md$/i.test(file)) continue;

    const { data, content } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
    if (isDraft(data) && !SHOW_DRAFTS) continue;

    const fileName = file.replace(/\.md$/i, "");
    // Optional Ukrainian body: a sibling <name>.uk.md (frontmatter stripped).
    const ukPath = path.join(dir, `${fileName}.uk.md`);
    const contentUk = fs.existsSync(ukPath)
      ? matter(fs.readFileSync(ukPath, "utf8")).content
      : undefined;
    entries.push({
      slug: slugify((data.slug as string) ?? fileName),
      fileName,
      sectionSlug: section.slug,
      sectionDir: section.dirName,
      title: (data.title as string) ?? fileName,
      titleUk: ukTitle(data),
      date: data.date ? String(formatDateValue(data.date)) : undefined,
      description: data.description as string | undefined,
      content,
      contentUk,
      meta: data,
      draft: isDraft(data),
    });
  }

  return entries.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.title.localeCompare(b.title);
  });
}

export function getEntry(sectionSlug: string, entrySlug: string): Entry | undefined {
  const section = getSectionBySlug(sectionSlug);
  if (!section) return undefined;
  return getEntries(section).find((e) => e.slug === entrySlug);
}

/** Normalizes frontmatter dates (Date objects or strings) to YYYY-MM-DD. */
function formatDateValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/**
 * `categories:` frontmatter → a clean list. Accepts a YAML list or a
 * comma-separated string, so both of these work in Obsidian:
 *
 *   categories: [Tech, Education]
 *   categories: Tech, Education
 *
 * Drives the category chips on an entry page, the shelf medium pages, and the
 * posts filter. The posts' single `category:` is accepted as a one-item list
 * so both sections share one code path.
 */
export function parseCategories(meta: Record<string, unknown>): string[] {
  const raw = meta.categories ?? meta.category;
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const out: string[] = [];
  for (const value of list) {
    const name = String(value).trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/** Ukrainian title from frontmatter (`title_uk:`), if present. */
export function ukTitle(meta: Record<string, unknown>): string | undefined {
  const v = meta.title_uk ?? meta.titleUk;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Word count + reading time (≈200 wpm) from raw markdown. */
export function readingStats(md: string): { words: number; minutes: number } {
  const words = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|\[\]()!-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return { words, minutes: Math.max(1, Math.round(words / 200)) };
}

/**
 * Global wiki-link index: lowercase file name / title / slug / aliases → URL,
 * across every section. Lets [[Sapiens]] in a post resolve to /shelf/sapiens,
 * and [[CompTIA Security+]] resolve to a post that declares it in `aliases:`.
 * Aliases are Obsidian-native frontmatter, so the same link works in both
 * places. First match wins; collisions favor the earliest section by order.
 */
export function getWikiIndex(): Map<string, string> {
  const map = new Map<string, string>();
  const add = (key: string, href: string) => {
    const k = key.trim().toLowerCase();
    if (k && !map.has(k)) map.set(k, href);
  };
  const addAliases = (meta: Record<string, unknown>, href: string) => {
    const raw = meta.aliases ?? meta.alias;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const a of list) add(String(a), href);
  };
  for (const section of getSections()) {
    const base = section.slug === "home" ? "/" : `/${section.slug}`;
    add(section.dirName, base);
    add(section.title, base);
    // Obsidian-friendly form: [[Folder/main|Label]] opens the section's
    // main.md in Obsidian AND resolves to the section page on the site.
    add(`${section.dirName}/main`, base);
    add(`${section.slug}/main`, base);
    addAliases(section.meta, base);
    for (const entry of getEntries(section)) {
      const href = `/${section.slug}/${entry.slug}`;
      add(entry.fileName, href);
      add(entry.title, href);
      add(entry.slug, href);
      addAliases(entry.meta, href);
    }
  }
  return map;
}

/**
 * Vault-wide asset index: lowercase basename → public /vault-assets URL, for
 * every non-markdown file. Lets embeds resolve a file by name regardless of
 * which folder it lives in (Excalidraw drawings often sit in a central folder).
 * First match wins on duplicate names.
 */
let _assetIndex: Map<string, string> | null = null;
export function getAssetIndex(): Map<string, string> {
  if (_assetIndex) return _assetIndex;
  const map = new Map<string, string>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (!e.name.toLowerCase().endsWith(".md")) {
        const rel = path.relative(VAULT_DIR, full);
        const url =
          "/vault-assets/" +
          rel.split(path.sep).map(encodeURIComponent).join("/");
        const key = e.name.toLowerCase();
        if (!map.has(key)) map.set(key, url);
      }
    }
  };
  walk(VAULT_DIR);
  _assetIndex = map;
  return map;
}

export interface SearchItem {
  title: string;
  /** Ukrainian title (shown + matched when the site is in UK mode). */
  titleUk?: string;
  section: string;
  sectionUk?: string;
  href: string;
  text: string;
  /**
   * Set on heading results only, which exist once per language because each
   * language's heading has its own anchor. The palette shows the matching one.
   * Page results leave this undefined and show in both.
   */
  lang?: "en" | "uk";
}

/**
 * Section headings inside a note, as jump-to-anchor search results.
 *
 * The ids have to match what rehype-slug minted at render time or the jump
 * lands nowhere, so this uses the same github-slugger — including its
 * per-document duplicate handling — rather than the site's own slugify(),
 * which strips Cyrillic entirely and would break every Ukrainian anchor.
 */
function headingItems(
  md: string,
  lang: "en" | "uk",
  pageTitle: string,
  href: string
): SearchItem[] {
  // Fenced code can contain lines starting with # that aren't headings.
  const body = md.replace(
    /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm,
    ""
  );
  const slugger = new GithubSlugger();
  const items: SearchItem[] = [];

  for (const m of body.matchAll(/^(#{2,3})[ \t]+(.+?)[ \t]*#*$/gm)) {
    // Slug the text as it will RENDER: wiki links collapse to their label,
    // markdown links to their text, emphasis markers disappear.
    const text = m[2]
      .replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (_x, t, l) => l || t)
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
    if (!text) continue;
    const id = slugger.slug(text);
    items.push({
      title: text,
      section: pageTitle,
      href: `${href}#${lang === "uk" ? `uk-${id}` : id}`,
      text,
      lang,
    });
  }
  return items;
}

/** Flat index of all pages for the Cmd+K palette (plain text, capped). */
export function getSearchIndex(): SearchItem[] {
  const items: SearchItem[] = [];
  for (const section of getSections()) {
    const href = section.slug === "home" ? "/" : `/${section.slug}`;
    // A résumé (the "now" type's optional `resume:` key — see lib/resume.ts)
    // has no markdown body to search, so its text is folded in here and its
    // blocks (Experience, Education, …) get their own jump-to-anchor results,
    // the same way headingItems() does for an entry's markdown headings.
    const resumeData = section.meta.resume as ResumeData | undefined;
    items.push({
      title: section.title,
      titleUk: section.titleUk,
      section: "Section",
      sectionUk: "Розділ",
      href,
      // Ukrainian title folded into the text so search matches in both languages.
      text: plainText(
        `${section.titleUk ?? ""} ${section.content} ${
          resumeData ? resumeSearchText(resumeData) : ""
        }`
      ),
    });
    if (resumeData) {
      // A dedicated "Résумé" result — typing "resume" wouldn't otherwise hit
      // anything, since the section itself is titled "Now" / "Зараз". Jumps
      // to the block's own heading (id="resume" on the wrapper in Resume.tsx),
      // not the page top, so it lands past the status cards.
      items.push({
        title: ui.resume.en,
        titleUk: ui.resume.uk,
        section: section.title,
        sectionUk: section.titleUk,
        href: `${href}#resume`,
        text: plainText(resumeSearchText(resumeData)),
      });
      const { en, uk } = resumeHeadings(resumeData);
      for (const h of en) {
        items.push({
          title: h.text,
          section: section.title,
          sectionUk: section.titleUk,
          href: `${href}#${h.id}`,
          text: h.text,
          lang: "en",
        });
      }
      for (const h of uk) {
        items.push({
          title: h.text,
          section: section.titleUk ?? section.title,
          sectionUk: section.titleUk,
          href: `${href}#${h.id}`,
          text: h.text,
          lang: "uk",
        });
      }
    }
    for (const entry of getEntries(section)) {
      const href = `/${section.slug}/${entry.slug}`;
      items.push({
        title: entry.title,
        titleUk: entry.titleUk,
        section: section.title,
        sectionUk: section.titleUk,
        href,
        text: plainText(
          `${entry.titleUk ?? ""} ${entry.description ?? ""} ${entry.content}`
        ),
      });
      // Headings become their own results, labelled with the note they're in,
      // so Cmd+K reaches a section of a long post and not just the post.
      items.push(...headingItems(entry.content, "en", entry.title, href));
      if (entry.contentUk) {
        items.push(
          ...headingItems(
            entry.contentUk,
            "uk",
            entry.titleUk ?? entry.title,
            href
          )
        );
      }
    }
  }
  return items;
}

/** Rough markdown → plain text for search matching. */
function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);
}

/** "2026-07-16" → "July 16, 2026" (UTC-safe, no timezone drift). */
export function displayDate(iso: string, locale = "en-US"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-07-16" → "16 липня 2026 р." (Ukrainian long date). */
export function displayDateUk(iso: string): string {
  return displayDate(iso, "uk-UA");
}
