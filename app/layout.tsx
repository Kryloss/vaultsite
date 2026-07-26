import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Chrome from "@/components/Chrome";
import Lightbox from "@/components/Lightbox";
import CodeCopy from "@/components/CodeCopy";
import HeadingAnchors from "@/components/HeadingAnchors";
import LinkPreview from "@/components/LinkPreview";
import { getSections, getEntries, getSearchIndex } from "@/lib/vault";
import { getLinkPreviews } from "@/lib/previews";
import { resistanceDay } from "@/lib/resistance";
import { isShelfSection, shelfGroups } from "@/lib/shelf";
import { siteName, siteUrl, siteDescription, socials } from "@/lib/site-config";

/**
 * Inter, self-hosted by next/font — the files are fetched at build time and
 * served from our own origin, so there's no Google request from the visitor,
 * no extra DNS, and no layout shift from a late-arriving webfont.
 *
 * The Cyrillic subset is not optional here: every note carries a Ukrainian
 * translation, and without it those pages fall back to a system font and read
 * as a different typeface. `latin-ext` covers the Ukrainian transliterations
 * and the odd European name.
 */
const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  // NOT --font-sans: Tailwind v4 defines that as a theme token holding the
  // system stack, and both land on the same element (<html> is :root), so
  // which one won came down to stylesheet order. globals.css points
  // Tailwind's token at this one instead — one name, one owner.
  variable: "--font-inter",
});

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
            }))
        : undefined,
    };
  });

  return (
    // data-lang is set pre-paint by the inline script below (and toggled at
    // runtime), so the server HTML intentionally differs — suppress the warning.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
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
        <HeadingAnchors />
        <LinkPreview previews={getLinkPreviews()} />
      </body>
    </html>
  );
}
