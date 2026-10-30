import type { Metadata } from "next";
import Page from "@/components/Page";
import T from "@/components/T";
import { pageMeta } from "@/lib/metadata";
import { socials } from "@/lib/site-config";
import { routinePrivacy, ui } from "@/lib/ui-strings";

/**
 * /routine/privacy — what sign-in stores. Google requires a privacy policy
 * before an OAuth app can leave Testing, on the same domain as the app's home
 * page (`/routine`) and linked from it. If the page starts collecting anything
 * new, this has to change with it.
 */
export const metadata: Metadata = {
  title: "Routine privacy",
  description: "What the Routine page stores when you sign in or ask for access.",
  ...pageMeta({ path: "/routine/privacy" }),
};

export default function RoutinePrivacyPage() {
  const mail = socials.find((social) => social.icon === "mail")?.href;

  return (
    <Page>
      <h1 className="page-title text-2xl font-semibold tracking-tight text-[var(--text)]">
        <T {...ui.routinePrivacyTitle} />
      </h1>
      <p className="routine-note">
        <T {...ui.routinePrivacyUpdated} />
      </p>
      {routinePrivacy.map(({ heading, body }) => (
        <section key={heading.en}>
          <h2 className="routine-heading">
            <T {...heading} />
          </h2>
          <p className="routine-note">
            <T {...body} />
          </p>
        </section>
      ))}
      <p className="routine-note">
        <a href={mail}>
          <T {...ui.routinePrivacyContact} />
        </a>
      </p>
    </Page>
  );
}
