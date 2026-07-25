import type { MetadataRoute } from "next";
import { getSections, getEntries } from "@/lib/vault";
import { isShelfSection, shelfMediumSlugs } from "@/lib/shelf";
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

    // Shelf medium pages, e.g. /shelf/type/videos
    if (isShelfSection(section)) {
      for (const medium of shelfMediumSlugs(entries)) {
        urls.push({
          url: `${siteUrl}/${section.slug}/type/${medium}`,
          changeFrequency: "weekly",
          priority: 0.7,
        });
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
