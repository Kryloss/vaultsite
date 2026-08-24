import { ogImage, ogCover, OG_SIZE } from "@/lib/og";
import {
  getSections,
  getSectionBySlug,
  getEntries,
  getEntry,
} from "@/lib/vault";
import { isShelfSection, toShelfItem, entryCreator } from "@/lib/shelf";
import { siteName } from "@/lib/site-config";
import { resolveCoverUrl } from "@/lib/markdown";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteName;

export function generateStaticParams() {
  return getSections().flatMap((section) =>
    getEntries(section).map((entry) => ({
      section: section.slug,
      slug: entry.slug,
    }))
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ section: string; slug: string }>;
}) {
  const { section: sectionSlug, slug } = await params;
  const section = getSectionBySlug(sectionSlug);
  const entry = getEntry(sectionSlug, slug);

  /* Shelf notes carry the artwork of the thing they're about, and that's what
     someone recognises in a shared link before they've read the title. The
     card uses it — the same ShelfItem the cards on the site are built from, so
     a video gets its YouTube thumbnail and its 16:9 frame without this route
     knowing anything about either.

     Everything else keeps the plain text card. A post has no cover, and the
     author photo on a People note is a person's face, which is not a thing to
     paste into a link preview. */
  const item =
    entry && section && isShelfSection(section) ? toShelfItem(entry) : undefined;

  /* A music note carries album art in the same `cover:` key but is no
     ShelfItem, so it resolves its own — otherwise a shared link to a note
     that HAS artwork falls back to the plain text card, which is the one
     place the section still looked unfinished. Square, because an album is. */
  const isMusic = section?.type === "music";
  const cover = ogCover(
    isMusic && entry
      ? resolveCoverUrl(entry.sectionDir, entry.meta.cover)
      : item?.coverUrl
  );

  const byline = isMusic && entry ? entryCreator(entry)?.name : item?.author;

  return ogImage(
    entry?.title ?? siteName,
    section ? `${section.title} · ${siteName}` : siteName,
    {
      cover,
      coverShape: isMusic ? "square" : item?.isVideo ? "wide" : "tall",
      // Only worth a line when there's art beside it; on the plain card it
      // would sit where the section name already is.
      byline: cover ? byline : undefined,
    }
  );
}
