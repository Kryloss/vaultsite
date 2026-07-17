import type { Metadata } from "next";
import "./globals.css";
import Chrome from "@/components/Chrome";
import Lightbox from "@/components/Lightbox";
import { getSections, getEntries, getSearchIndex } from "@/lib/vault";
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
  const items = getSections().map((section) => ({
    slug: section.slug,
    title: section.title,
    icon: section.icon,
    entries: getEntries(section).map(({ slug, title }) => ({ slug, title })),
  }));

  return (
    <html lang="en">
      <body>
        <Chrome
          items={items}
          socials={socials}
          siteName={siteName}
          searchIndex={getSearchIndex()}
        >
          {children}
        </Chrome>
        <Lightbox />
      </body>
    </html>
  );
}
