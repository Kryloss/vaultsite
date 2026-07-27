"use client";

import { useEffect, useState } from "react";
import { resistanceDay } from "@/lib/resistance";
import { ui } from "@/lib/ui-strings";
import T from "./T";

/**
 * Sidebar line: which day of Ukraine's resistance it is.
 *
 * `initial` is computed at build time and passed down from the layout, so the
 * static HTML carries a real number (correct for crawlers and without JS) and
 * hydration has nothing to disagree about. The effect then re-checks in the
 * browser, which keeps the count right between deploys — the site is fully
 * static, so the baked-in number would otherwise freeze until the next build.
 *
 * The line links to a donation jar. Deliberately styled as nothing: it
 * inherits colour and carries no underline, no hover state and no external-link
 * marker, so the sidebar looks exactly as it did — the line is a quiet offer to
 * anyone who thinks to click it, not a call to action.
 */

/** monobank jar. Owner-editable, like the socials in lib/site-config.ts. */
const DONATE_URL = "https://send.monobank.ua/jar/2JbpBYkhMv";

export default function ResistanceDay({ initial }: { initial: number }) {
  const [day, setDay] = useState(initial);

  useEffect(() => {
    setDay(resistanceDay());
  }, []);

  const n = String(day);
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-inherit no-underline"
    >
      <T
        en={ui.resistanceDay.en.replace("{n}", n)}
        uk={ui.resistanceDay.uk.replace("{n}", n)}
      />
    </a>
  );
}
