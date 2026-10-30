import type { Metadata } from "next";
import Link from "next/link";
import Page from "@/components/Page";
import RoutineAccess from "@/components/RoutineAccess";
import T from "@/components/T";
import { pageMeta } from "@/lib/metadata";
import { ui } from "@/lib/ui-strings";

/**
 * /routine — the private organizer, behind Google sign-in.
 *
 * Still a static page: the root layout reads `vault/` from disk, so a dynamic
 * route here would read the vault at runtime. Nothing private is in this HTML.
 * What a visitor gets comes from `app/api/routine/`, and every rule about that
 * is in Postgres. See docs/ROUTINE.md.
 */
export const metadata: Metadata = {
  title: "Routine",
  description: "A private daily routine organizer.",
  robots: { index: false, follow: false },
  ...pageMeta({ path: "/routine" }),
};

export default function RoutinePage() {
  return (
    <Page>
      <h1 className="page-title text-2xl font-semibold tracking-tight text-[var(--text)]">
        <T {...ui.routineTitle} />
      </h1>
      <p className="routine-note">
        <T {...ui.routineIntro} />
      </p>
      <RoutineAccess />
      <p className="routine-note">
        <Link href="/routine/privacy">
          <T {...ui.routinePrivacyTitle} />
        </Link>
      </p>
    </Page>
  );
}
