/**
 * Per-page metadata helpers — canonical URLs and Open Graph.
 *
 * Two things make this worth a module rather than an object literal per page:
 *
 * 1. **Next merges metadata shallowly.** A page that sets `alternates` or
 *    `openGraph` REPLACES the layout's, it doesn't extend it. Setting a
 *    canonical URL by hand would silently drop the RSS `<link rel="alternate">`
 *    and `og:site_name`/`og:locale` from that page. Everything the layout
 *    provides is repeated here so it survives.
 *
 * 2. **Canonicals are the fix for `?lang=uk`.** components/SelectionLink.tsx
 *    hands out links carrying that query param, and without a canonical each
 *    one is a separate, indexable copy of the note as far as a crawler is
 *    concerned.
 *
 * Paths are site-relative ("/posts/x"); Next resolves them against
 * `metadataBase` in app/layout.tsx.
 */
import type { Metadata } from "next";
import { authorName, siteName } from "./site-config";

/** RSS autodiscovery, on every page — the layout's copy is replaced, not merged. */
const feedTypes = { "application/rss+xml": "/feed.xml" };

interface Options {
  /** Site-relative path of this page, e.g. "/posts/first-certification". */
  path: string;
  /**
   * A note rather than a listing: emits `og:type=article` plus
   * `article:published_time` and `article:author`, which is what turns a
   * shared link into a dated article card instead of a generic website one.
   */
  publishedTime?: string;
}

/**
 * The canonical + Open Graph half of a page's metadata. Spread it beside
 * `title` and `description`:
 *
 *   return { title, description, ...pageMeta({ path: `/${slug}` }) };
 */
export function pageMeta({ path, publishedTime }: Options): Metadata {
  return {
    alternates: { canonical: path, types: feedTypes },
    openGraph: {
      siteName,
      locale: "en_US",
      url: path,
      ...(publishedTime
        ? { type: "article", publishedTime, authors: [authorName] }
        : { type: "website" }),
    },
  };
}
