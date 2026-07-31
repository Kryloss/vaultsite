import type { MetadataRoute } from "next";
import { getSections, getEntries } from "@/lib/vault";
import {
  categorySlug,
  groupCategories,
  isShelfSection,
  shelfGroups,
} from "@/lib/shelf";
import { siteUrl } from "@/lib/site-config";

export const dynamic = "force-static";

/**
 * The newest entry date in a list — a listing page is as fresh as the newest
 * thing on it. Without this a crawler sees `lastmod` on notes and nothing on
 * the pages that link to them, which is the wrong way round: the section page
 * is what changes every time a note is published.
 */
function newestDate(entries: { date?: string }[]): Date | undefined {
  const dates = entries.map((e) => e.date).filter((d): d is string => !!d);
  if (dates.length === 0) return undefined;
  return new Date(dates.reduce((a, b) => (a > b ? a : b)));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const allEntries = getSections().flatMap((section) => getEntries(section));
  const urls: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      // Home lists the most recent posts, so it changes with them.
      lastModified: newestDate(allEntries),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  for (const section of getSections()) {
    const entries = getEntries(section);

    if (section.slug !== "home") {
      urls.push({
        url: `${siteUrl}/${section.slug}`,
        lastModified: newestDate(entries),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Shelf medium + category pages, e.g. /shelf/type/videos[/tech]
    if (isShelfSection(section)) {
      for (const group of shelfGroups(entries)) {
        if (group.medium === "unsorted") continue;
        // ShelfItem carries no date — it's a card, not a note — so the
        // group's freshness comes from the entries behind it.
        const slugs = new Set(group.items.map((i) => i.slug));
        urls.push({
          url: `${siteUrl}/${section.slug}/type/${group.slug}`,
          lastModified: newestDate(entries.filter((e) => slugs.has(e.slug))),
          changeFrequency: "weekly",
          priority: 0.7,
        });
        for (const category of groupCategories(group)) {
          urls.push({
            url: `${siteUrl}/${section.slug}/type/${group.slug}/${categorySlug(category)}`,
            changeFrequency: "weekly",
            priority: 0.5,
          });
        }
      }
    }

    for (const entry of entries) {
      urls.push({
        url: `${siteUrl}/${section.slug}/${entry.slug}`,
        lastModified: entry.date ? new Date(entry.date) : undefined,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  return urls;
}
