import { ogImage, OG_SIZE } from "@/lib/og";
import { getSectionBySlug, getEntry } from "@/lib/vault";
import { siteName } from "@/lib/site-config";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteName;

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
