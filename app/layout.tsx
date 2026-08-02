import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";
import Chrome from "@/components/Chrome";
import Lightbox from "@/components/Lightbox";
import CodeCopy from "@/components/CodeCopy";
import HeadingAnchors from "@/components/HeadingAnchors";
import JsonLd from "@/components/JsonLd";
import SelectionLink from "@/components/SelectionLink";
import ArrowThrow from "@/components/ArrowThrow";
import { Analytics } from "@vercel/analytics/next";
import { siteJsonLd } from "@/lib/jsonld";
import { getSections } from "@/lib/vault";
import { resistanceDay } from "@/lib/resistance";
import { siteName, siteNameUk, siteUrl, siteDescription } from "@/lib/site-config";

/**
 * Source Serif 4 — the site's one typeface, self-hosted by next/font so the
 * files are served from our own origin: no Google request from the visitor,
 * no extra DNS, no shift from a late webfont.
 *
 * It sets everything except code — prose, page titles, the sidebar, chips,
 * dates, diagram labels. The site used to load three families and render in
 * one: Inter had nothing left to set once the serif went on `body`, and Lora
 * was carrying the quotes voice on the strength of being "a serif against
 * Inter" — a distinction that stopped existing. Against another serif it
 * doesn't read as a second voice, it reads as a font that failed to load.
 * Source Serif's own italic does the job and costs no extra family.
 *
 * `axes: ["opsz"]` is the whole reason to bother with a variable serif here.
 * Optical size is a real axis in this typeface: the letterforms are DRAWN
 * differently for a 46px title (finer hairlines, tighter fit) than for 17px
 * body text. next/font ships only the default axis unless the others are
 * asked for by name, so without this line the titles are just body type
 * scaled up.
 *
 * The Cyrillic subset is not optional: every note carries a Ukrainian
 * translation, and without it those pages fall back to a system font and read
 * as a different typeface. `latin-ext` covers the transliterations and the odd
 * European name.
 *
 * NOT named `--font-serif`: Tailwind v4 owns that token, next/font defines its
 * variable on a class on <html>, and both land on the same element — the
 * winner would come down to bundle order. globals.css points Tailwind's tokens
 * at this one instead. One variable, one owner.
 */
const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
  axes: ["opsz"],
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
  const items = getSections().map((section) => ({
    slug: section.slug,
    title: section.title,
    titleUk: section.titleUk,
    icon: section.icon,
  }));

  return (
    // data-lang is set pre-paint by the inline script below (and toggled at
    // runtime), so the server HTML intentionally differs — suppress the warning.
    <html
      lang="en"
      className={sourceSerif.variable}
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
          siteNameUk={siteNameUk}
          resistanceDay={resistanceDay()}
        >
          {children}
        </Chrome>
        <Lightbox />
        <JsonLd data={siteJsonLd()} />
        <CodeCopy />
        <HeadingAnchors />
        <SelectionLink />
        {/* Keeps a thrown arrow thrown — see the note in the component. */}
        <ArrowThrow />
        {/* Vercel Analytics: page views only, no cookies and no cross-site
            identifier, so there's nothing to consent to. It injects a script
            tag on Vercel and is a no-op in local dev. */}
        <Analytics />
      </body>
    </html>
  );
}
