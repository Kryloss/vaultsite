import type { Metadata } from "next";
import { Inter, Lora, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import Chrome from "@/components/Chrome";
import Lightbox from "@/components/Lightbox";
import CodeCopy from "@/components/CodeCopy";
import HeadingAnchors from "@/components/HeadingAnchors";
import JsonLd from "@/components/JsonLd";
import SelectionLink from "@/components/SelectionLink";
import { Analytics } from "@vercel/analytics/next";
import { siteJsonLd } from "@/lib/jsonld";
import { getSections, getEntries } from "@/lib/vault";
import { resistanceDay } from "@/lib/resistance";
import { isShelfSection, shelfGroups } from "@/lib/shelf";
import { siteName, siteUrl, siteDescription } from "@/lib/site-config";

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

/**
 * Lora, italic only — the quotes voice.
 *
 * A serif set against Inter is what makes a quoted passage read as someone
 * else's words rather than more of the page. Only the italic is loaded, since
 * that's the only cut used; Cyrillic is included for the same reason as above.
 */
const lora = Lora({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["italic"],
  display: "swap",
  // NOT --font-serif, for the same reason Inter isn't --font-sans: Tailwind
  // v4 owns that token too, both land on <html>, and the winner would come
  // down to stylesheet order. globals.css points the token at this one.
  variable: "--font-lora",
});

/**
 * Source Serif 4 — the site's typeface.
 *
 * Everything except code is set in this — prose, page titles, the sidebar, the
 * chips, the diagram labels. It began as the classic split (serif to read, sans
 * for the interface) and that was the wrong call for a site this size: when
 * half the page is chrome in a different family, the chrome reads as a product
 * someone else built and the writing reads as content pasted into it.
 *
 * NOT Newsreader, which was the first choice and is the better screen serif:
 * it has no Cyrillic subset, and every note on this site carries a Ukrainian
 * translation. A typeface that covers half the content isn't a candidate.
 * Source Serif has Cyrillic, is variable, and was drawn for text at reading
 * sizes.
 */
const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-source-serif",
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
    <html
      lang="en"
      className={`${inter.variable} ${lora.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Restore the language choice before first paint — no flash.
            `?lang=` in the URL wins over the stored preference and is NOT
            written back to localStorage: a shared link should open in the
            language it was written in (see components/SelectionLink.tsx)
            without permanently changing the reader's own choice.
            suppressHydrationWarning: browser extensions (e.g. Noir) rewrite
            this inline script before React hydrates, which would otherwise
            trip a dev-only hydration warning. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "try{var q=new URLSearchParams(location.search).get('lang');var l=q||localStorage.getItem('lang');if(l==='uk')document.documentElement.dataset.lang='uk';}catch(e){}",
          }}
        />
        {/* Speculation rules: once the pointer rests on an internal link, fetch
            that document in the background so a hard navigation — a new tab, a
            middle click, the first click after landing — has nothing left to
            download.

            `prefetch`, deliberately NOT `prerender`. Prerendering also RUNS the
            page, and @vercel/analytics doesn't check `document.prerendering`
            before reporting, so every hovered link would count as a visit and
            the numbers would quietly become fiction. Prefetch moves bytes and
            executes nothing.

            The win here is modest and worth stating: Next already prefetches
            route payloads for in-app clicks, so this covers the cases its own
            router never sees. Ignored by browsers that don't support it. */}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prefetch: [
                {
                  source: "document",
                  where: { and: [{ href_matches: "/*" }] },
                  eagerness: "moderate",
                },
              ],
            }),
          }}
        />
      </head>
      <body>
        {/* `socials` used to be threaded through here; the sidebar's icon row
            is now <SocialLinks />, which reads lib/site-config itself. */}
        <Chrome
          items={items}
          siteName={siteName}
          resistanceDay={resistanceDay()}
        >
          {children}
        </Chrome>
        <Lightbox />
        <JsonLd data={siteJsonLd()} />
        <CodeCopy />
        <HeadingAnchors />
        <SelectionLink />
        {/* Vercel Analytics: page views only, no cookies and no cross-site
            identifier, so there's nothing to consent to. It injects a script
            tag on Vercel and is a no-op in local dev. */}
        <Analytics />
      </body>
    </html>
  );
}
