/**
 * Renders a structured-data blob (see lib/jsonld.ts) as the script tag search
 * engines look for. Nothing is visible; nothing runs.
 *
 * `<` is escaped so a title containing "</script>" can't break out of the tag.
 */
export default function JsonLd({ data }: { data: object | null }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
