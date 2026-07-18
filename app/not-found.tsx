import Link from "next/link";
import T from "@/components/T";
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
      <Link
        href="/"
        className="mt-6 inline-block text-sm text-[var(--accent)] hover:underline"
      >
        <T {...ui.backHome} />
      </Link>
    </div>
  );
}
