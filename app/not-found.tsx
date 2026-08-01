import Link from "next/link";
import T from "@/components/T";
import NotFoundSuggestions from "@/components/NotFoundSuggestions";
import { ui } from "@/lib/ui-strings";
import Page from "@/components/Page";

export default function NotFound() {
  return (
    <Page>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
        404
      </h1>
      <p className="mt-3 text-[var(--text-secondary)]">
        <T {...ui.notFoundBody} />
      </p>

      {/* Both the index and the matching land in the browser: a statically
          exported 404 is one file serving every bad URL, so the attempted
          path only exists there. */}
      <NotFoundSuggestions />

      <Link
        href="/"
        className="notfound-home press mt-8 inline-block text-sm"
      >
        <T {...ui.backHome} />
      </Link>
    </Page>
  );
}
