import type { Metadata } from "next";
import "./globals.css";
import Chrome from "@/components/Chrome";
import { getSections, getEntries } from "@/lib/vault";
import { siteName, socials } from "@/lib/site-config";

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description:
    "Kyrylo's writing, projects, notes, and the occasional strong opinion.",
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
        <Chrome items={items} socials={socials} siteName={siteName}>
          {children}
        </Chrome>
      </body>
    </html>
  );
}
