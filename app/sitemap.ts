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

export default function sitemap(): MetadataRoute.Sitemap {
  const urls: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
  ];

  for (const section of getSections()) {
    if (section.slug !== "home") {
      urls.push({
        url: `${siteUrl}/${section.slug}`,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
    const entries = getEntries(section);

    // Shelf medium + category pages, e.g. /shelf/type/videos[/tech]
    if (isShelfSection(section)) {
      for (const group of shelfGroups(entries)) {
        if (group.medium === "unsorted") continue;
        urls.push({
          url: `${siteUrl}/${section.slug}/type/${group.slug}`,
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
