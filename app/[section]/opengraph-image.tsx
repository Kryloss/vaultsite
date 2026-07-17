import { ogImage, OG_SIZE } from "@/lib/og";
import { getSections, getSectionBySlug } from "@/lib/vault";
import { siteName } from "@/lib/site-config";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteName;

export function generateStaticParams() {
  return getSections().map((s) => ({ section: s.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: slug } = await params;
  const section = getSectionBySlug(slug);
  return ogImage(section?.title ?? siteName, siteName);
}
