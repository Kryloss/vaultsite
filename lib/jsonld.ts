/**
 * JSON-LD structured data — the machine-readable description of a page that
 * search engines read to build rich results.
 *
 * Emitted as a <script type="application/ld+json"> at build time: invisible,
 * static, and it costs nothing at runtime. Types are chosen from the section a
 * note lives in and its `medium:`, so nothing new goes in the frontmatter.
 */
import { siteName, siteUrl, socials } from "./site-config";
import { resolveCoverUrl } from "./markdown";
import { entryMedium } from "./shelf";
import type { Entry, Section } from "./vault";

/** The author of everything here — referenced by @id rather than repeated. */
const PERSON_ID = `${siteUrl}/#person`;

function abs(path?: string): string | undefined {
  if (!path) return undefined;
  return path.startsWith("http") ? path : `${siteUrl}${path}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** schema.org type for a shelf entry, from its `medium:`. */
function shelfType(medium?: string): string {
  switch (medium) {
    case "book":
      return "Book";
    case "movie":
      return "Movie";
    case "show":
      return "TVSeries";
    case "video":
    case "youtube":
      return "VideoObject";
    default:
      return "CreativeWork";
  }
}

/**
 * A rating becomes a Review of the thing, not a property of it — the stars are
 * the owner's opinion, and saying otherwise would be claiming an aggregate
 * score that doesn't exist.
 */
function reviewWrapper(item: any, rating: number, url: string): any {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    url,
    itemReviewed: item,
    author: { "@id": PERSON_ID },
    reviewRating: {
      "@type": "Rating",
      ratingValue: rating,
      bestRating: 5,
      worstRating: 0,
    },
  };
}

/**
 * The trail from the site root to this page, which is what lets a search
 * result print "kryloss.com › Posts › Security+ journey" instead of a bare
 * URL. Two levels is the whole hierarchy here — a note's subfolder inside a
 * section is filing, not structure, and deliberately isn't in its URL either
 * (DECISIONS #27), so putting it in the trail would describe a path that
 * doesn't exist.
 *
 * English names only: a breadcrumb is one string per item, both languages ship
 * in the same document, and English is what the canonical URL and every other
 * bit of metadata already uses.
 */
export function breadcrumbJsonLd(
  section: Section,
  entry?: Entry
): object | null {
  // Home is the root of the trail, so it has no trail of its own.
  if (section.slug === "home") return null;

  const crumbs: { name: string; url: string }[] = [
    { name: siteName, url: siteUrl },
    { name: section.title, url: `${siteUrl}/${section.slug}` },
  ];
  if (entry) {
    crumbs.push({
      name: entry.title,
      url: `${siteUrl}/${section.slug}/${entry.slug}`,
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      // The last crumb is the page you're on; schema.org's guidance is to
      // leave it without an `item`, since it would link to itself.
      ...(i < crumbs.length - 1 ? { item: crumb.url } : {}),
    })),
  };
}

/** Structured data for one entry page, or null when there's nothing to say. */
export function entryJsonLd(section: Section, entry: Entry): object | null {
  const url = `${siteUrl}/${section.slug}/${entry.slug}`;
  const image = abs(resolveCoverUrl(entry.sectionDir, entry.meta.cover));
  const medium = entryMedium(entry);

  // People: the note is about a person, so the page describes one.
  if (section.type === "people") {
    return {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url,
      mainEntity: {
        "@type": "Person",
        name: entry.title,
        description: entry.description,
        ...(image ? { image } : {}),
      },
    };
  }

  // Shelf: the book/film itself, wrapped in a Review when it's rated.
  if (section.type === "shelf" || section.type === "books") {
    const work: any = {
      "@type": shelfType(medium),
      name: entry.title,
      ...(entry.description ? { description: entry.description } : {}),
      ...(image ? { image } : {}),
      ...(typeof entry.meta.author === "string"
        ? { author: { "@type": "Person", name: entry.meta.author } }
        : {}),
    };
    const rating = entry.meta.rating;
    if (typeof rating === "number") return reviewWrapper(work, rating, url);
    return { "@context": "https://schema.org", ...work, url };
  }

  // Everything else that has a date reads as an article.
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: entry.title,
    url,
    mainEntityOfPage: url,
    ...(entry.description ? { description: entry.description } : {}),
    ...(entry.date ? { datePublished: entry.date } : {}),
    ...(image ? { image } : {}),
    author: { "@id": PERSON_ID },
    publisher: { "@id": PERSON_ID },
    // Both languages ship in one document — say so rather than let a crawler
    // guess from the mixed text.
    inLanguage: entry.contentUk ? ["en", "uk"] : "en",
  };
}

/** Site-level identity, emitted once in the root layout. */
export function siteJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: "Kyrylo Leshchenko",
        url: siteUrl,
        // sameAs is how a search engine ties the profiles together as one
        // person; mailto: isn't a profile, so it's filtered out.
        sameAs: socials
          .map((s) => s.href)
          .filter((h) => h.startsWith("http")),
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: siteName,
        publisher: { "@id": PERSON_ID },
        inLanguage: ["en", "uk"],
      },
    ],
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
