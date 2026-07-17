import type { MetadataRoute } from "next";
import { getSections, getEntries } from "@/lib/vault";
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
    for (const entry of getEntries(section)) {
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
