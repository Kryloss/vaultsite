/**
 * RSS 2.0 feed for the Posts section, generated statically at build time.
 * Rendered post HTML is included with vault-asset URLs made absolute.
 */
import { getSectionBySlug, getEntries } from "@/lib/vault";
import { renderMarkdown } from "@/lib/markdown";
import { siteName, siteUrl, siteDescription } from "@/lib/site-config";

export const dynamic = "force-static";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const posts = getSectionBySlug("posts");
  const entries = posts ? getEntries(posts) : [];

  const items = await Promise.all(
    entries.map(async (entry) => {
      const url = `${siteUrl}/posts/${entry.slug}`;
      // No heading anchors in the feed: a bare "#" fragment link means nothing
      // in a reader, which strips the page they'd point into anyway.
      const html = (
        await renderMarkdown(entry.content, entry.sectionDir, "posts", {
          anchors: false,
        })
      ).replaceAll('src="/vault-assets', `src="${siteUrl}/vault-assets`);
      return `    <item>
      <title>${xmlEscape(entry.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      ${entry.date ? `<pubDate>${new Date(entry.date + "T12:00:00Z").toUTCString()}</pubDate>` : ""}
      ${entry.description ? `<description>${xmlEscape(entry.description)}</description>` : ""}
      <content:encoded><![CDATA[${html}]]></content:encoded>
    </item>`;
    })
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(siteName)} — Posts</title>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${xmlEscape(siteDescription)}</description>
    <language>en</language>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
