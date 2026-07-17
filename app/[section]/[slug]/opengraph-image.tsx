import { ogImage, OG_SIZE } from "@/lib/og";
import {
  getSections,
  getSectionBySlug,
  getEntries,
  getEntry,
} from "@/lib/vault";
import { siteName } from "@/lib/site-config";

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
  return ogImage(
    entry?.title ?? siteName,
    section ? `${section.title} · ${siteName}` : siteName
  );
}
