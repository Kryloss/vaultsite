/**
 * JSON-LD structured data — the machine-readable description of a page that
 * search engines read to build rich results.
 *
 * Emitted as a <script type="application/ld+json"> at build time: invisible,
 * static, and it costs nothing at runtime. Types are chosen from the section a
 * note lives in and its `medium:`, so nothing new goes in the frontmatter.
 */
import { authorName, siteName, siteUrl, socials } from "./site-config";
import { resolveCoverUrl } from "./markdown";
import { entryMedium } from "./shelf";
import {
  youtubeEmbedUrl,
  youtubeId,
  youtubeThumbnail,
  youtubeWatchUrl,
} from "./youtube";
import { formatDateValue, type Entry, type Section } from "./vault";

/** The author of everything here — referenced by @id rather than repeated. */
const PERSON_ID = `${siteUrl}/#person`;

function abs(path?: string): string | undefined {
  if (!path) return undefined;
  return path.startsWith("http") ? path : `${siteUrl}${path}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * schema.org type for a shelf entry, from its `medium:`.
 *
 * Videos are deliberately NOT typed VideoObject here: that type has required
 * fields this function can't see, and Google reports a partial VideoObject as
 * an error rather than ignoring it. `videoObject()` below builds the complete
 * one when the note has what it needs; this is the fallback when it doesn't.
 */
function shelfType(medium?: string): string {
  switch (medium) {
    case "book":
      return "Book";
    case "movie":
      return "Movie";
    case "show":
      return "TVSeries";
    default:
      return "CreativeWork";
  }
}

/**
 * A complete VideoObject for a shelf note whose `video:` points at YouTube —
 * or null, when the note can't fill in everything Google requires.
 *
 * Required by Google: `name`, `description`, `thumbnailUrl`, `uploadDate`
 * (plus `contentUrl` or `embedUrl`, which is only a recommendation but is free
 * here). Three of those come from the note and the video ID. `uploadDate` is
 * the video's own publication date, which nothing on this site knows — the
 * note's `date:` is when Kyrylo shelved it, so using it would state something
 * false — and deriving it needs the YouTube Data API, which the shelf
 * deliberately does without. So it's an explicit `uploaded:` frontmatter key,
 * and a note without one simply describes itself as a CreativeWork: no rich
 * result, but no invalid markup either.
 *
 * (DECISIONS #41 — this is what the Search Console "Missing field
 * thumbnailUrl / uploadDate" report was about.)
 */
function videoObject(entry: Entry, image?: string): any | null {
  const link = entry.meta.video ?? entry.meta.url;
  const id = typeof link === "string" ? youtubeId(link) : undefined;
  const uploaded = entry.meta.uploaded
    ? formatDateValue(entry.meta.uploaded)
    : undefined;
  if (!id || !uploaded || !entry.description) return null;

  return {
    "@type": "VideoObject",
    name: entry.title,
    description: entry.description,
    // An explicit `cover:` wins, since that's the art the note actually shows;
    // otherwise the video ID gives us YouTube's own thumbnail for free.
    thumbnailUrl: image ?? youtubeThumbnail(id),
    uploadDate: uploaded,
    // The player, not the media file: `contentUrl` wants a real video file,
    // which YouTube doesn't hand out. Either satisfies Google.
    embedUrl: youtubeEmbedUrl(id),
    // The video lives on YouTube too — `url` is left to the caller, which
    // fills in this note's own address like it does for every other medium.
    sameAs: youtubeWatchUrl(id),
  };
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
    const work: any = videoObject(entry, image) ?? {
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
        name: authorName,
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
