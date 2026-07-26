import Link from "next/link";
import T from "@/components/T";
import NotFoundSuggestions from "@/components/NotFoundSuggestions";
import { getSearchIndex } from "@/lib/vault";
import { ui } from "@/lib/ui-strings";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
        404
      </h1>
      <p className="mt-3 text-[var(--text-secondary)]">
        <T {...ui.notFoundBody} />
      </p>

      {/* The index is built here; the matching happens in the browser, which
          is the only place the attempted URL exists. */}
      <NotFoundSuggestions items={getSearchIndex()} />

      <Link
        href="/"
        className="mt-8 inline-block text-sm text-[var(--accent)] hover:underline"
      >
        <T {...ui.backHome} />
      </Link>
    </div>
  );
}
