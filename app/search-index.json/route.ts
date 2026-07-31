/**
 * The Cmd+K index as one static file, fetched on the first search.
 *
 * It used to be a prop: the layout called getSearchIndex() and passed it to
 * components/CommandPalette.tsx, which put the full plain text of every note
 * into the RSC payload of every page — twice, once rendered and once for
 * hydration. A page with almost no content of its own was 184 KB, and the
 * floor rose with each note published.
 *
 * As a file it's fetched once, on the first ⌘K of a session, cached by the
 * browser, and shared by every page. Still built at build time, still no
 * backend, still no runtime filesystem access — `force-static` makes Next
 * write it during `next build` exactly like feed.xml and sitemap.xml.
 */
import { getSearchIndex } from "@/lib/vault";

export const dynamic = "force-static";

export function GET() {
  return Response.json(getSearchIndex());
}
