import { getSectionBySlug } from "@/lib/vault";
import { renderMarkdown } from "@/lib/markdown";

/** Home page — renders vault/Home/main.md. */
export default async function HomePage() {
  const home = getSectionBySlug("home");

  if (!home) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <p className="text-[var(--text-secondary)]">
          Create <code>vault/Home/main.md</code> to populate this page.
        </p>
      </div>
    );
  }

  const html = await renderMarkdown(home.content, home.dirName, home.slug);

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 lg:py-24">
      <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
