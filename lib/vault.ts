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
    if (isDraft(data)) continue;

    sections.push({
      slug: slugify((data.slug as string) ?? entry.name),
      dirName: entry.name,
      title: (data.title as string) ?? entry.name,
      icon: data.icon as string | undefined,
      description: data.description as string | undefined,
      order: typeof data.order === "number" ? data.order : 100,
      type: (data.type as string) ?? "posts",
      content,
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
    if (isDraft(data)) continue;

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
