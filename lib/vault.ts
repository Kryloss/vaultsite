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

export const VAULT_DIR = path.join(process.cwd(), "vault");

/** Drafts are visible during `npm run dev` (with a badge), never in production builds. */
const SHOW_DRAFTS = process.env.NODE_ENV === "development";

export interface Section {
  /** URL slug, e.g. "posts". "home" is rendered at "/" */
  slug: string;
  /** Actual folder name in the vault, e.g. "Posts" */
  dirName: string;
  title: string;
  icon?: string;
  description?: string;
  /** Sidebar ordering (frontmatter `order`, lower = higher). Default 100. */
  order: number;
  /** Section type — decides how entries are listed. See lib/section-types.tsx */
  type: string;
  /** Raw markdown body of main.md */
  content: string;
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
  date?: string;
  description?: string;
  /** Raw markdown body */
  content: string;
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

    sections.push({
      slug: slugify((data.slug as string) ?? entry.name),
      dirName: entry.name,
      title: (data.title as string) ?? entry.name,
      icon: data.icon as string | undefined,
      description: data.description as string | undefined,
      order: typeof data.order === "number" ? data.order : 100,
      type: (data.type as string) ?? "posts",
      content,
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
    if (file.toLowerCase() === "main.md") continue;

    const { data, content } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
    if (isDraft(data) && !SHOW_DRAFTS) continue;

    const fileName = file.replace(/\.md$/i, "");
    entries.push({
      slug: slugify((data.slug as string) ?? fileName),
      fileName,
      sectionSlug: section.slug,
      sectionDir: section.dirName,
      title: (data.title as string) ?? fileName,
      date: data.date ? String(formatDateValue(data.date)) : undefined,
      description: data.description as string | undefined,
      content,
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

export interface SearchItem {
  title: string;
  section: string;
  href: string;
  text: string;
}

/** Flat index of all pages for the Cmd+K palette (plain text, capped). */
export function getSearchIndex(): SearchItem[] {
  const items: SearchItem[] = [];
  for (const section of getSections()) {
    items.push({
      title: section.title,
      section: "Section",
      href: section.slug === "home" ? "/" : `/${section.slug}`,
      text: plainText(section.content),
    });
    for (const entry of getEntries(section)) {
      items.push({
        title: entry.title,
        section: section.title,
        href: `/${section.slug}/${entry.slug}`,
        text: plainText(`${entry.description ?? ""} ${entry.content}`),
      });
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
export function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
