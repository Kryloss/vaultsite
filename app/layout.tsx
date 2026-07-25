import type { Metadata } from "next";
import "./globals.css";
import Chrome from "@/components/Chrome";
import Lightbox from "@/components/Lightbox";
import CodeCopy from "@/components/CodeCopy";
import LinkPreview from "@/components/LinkPreview";
import { getSections, getEntries, getSearchIndex } from "@/lib/vault";
import { getLinkPreviews } from "@/lib/previews";
import { resistanceDay } from "@/lib/resistance";
import {
  categorySlug,
  groupCategories,
  isShelfSection,
  shelfGroups,
} from "@/lib/shelf";
import { siteName, siteUrl, siteDescription, socials } from "@/lib/site-config";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  openGraph: {
    siteName,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    types: { "application/rss+xml": "/feed.xml" },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Navigation (and breadcrumb titles) generated from the vault at build time.
  const items = getSections().map((section) => {
    const entries = getEntries(section);
    return {
      slug: section.slug,
      title: section.title,
      titleUk: section.titleUk,
      icon: section.icon,
      entries: entries.map(({ slug, title, titleUk }) => ({
        slug,
        title,
        titleUk,
      })),
      // Lets the breadcrumb name /<section>/type/<medium> pages.
      mediums: isShelfSection(section)
        ? shelfGroups(entries)
            .filter((g) => g.medium !== "unsorted")
            .map((g) => ({
              slug: g.slug,
              title: g.label.en,
              titleUk: g.label.uk,
              categories: groupCategories(g).map((c) => ({
                slug: categorySlug(c),
                title: c,
              })),
            }))
        : undefined,
    };
  });

  return (
    // data-lang is set pre-paint by the inline script below (and toggled at
    // runtime), so the server HTML intentionally differs — suppress the warning.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Restore the language choice before first paint — no flash.
            suppressHydrationWarning: browser extensions (e.g. Noir) rewrite
            this inline script before React hydrates, which would otherwise
            trip a dev-only hydration warning. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "try{var l=localStorage.getItem('lang');if(l==='uk')document.documentElement.dataset.lang='uk';}catch(e){}",
          }}
        />
      </head>
      <body>
        <Chrome
          items={items}
          socials={socials}
          siteName={siteName}
          searchIndex={getSearchIndex()}
          resistanceDay={resistanceDay()}
        >
          {children}
        </Chrome>
        <Lightbox />
        <CodeCopy />
        <LinkPreview previews={getLinkPreviews()} />
      </body>
    </html>
  );
}
