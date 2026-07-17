import { ogImage, OG_SIZE } from "@/lib/og";
import { siteName, siteDescription } from "@/lib/site-config";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteName;

export default function Image() {
  return ogImage(siteName, siteDescription);
}
