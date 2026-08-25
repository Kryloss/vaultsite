"use client";

import { useEffect, useState } from "react";
import { resistanceDay } from "@/lib/resistance";
import { observance, observanceKind, type ObservanceId } from "@/lib/observances";
import { observanceName, ui } from "@/lib/ui-strings";
import T from "./T";

/**
 * Sidebar line: which day of Ukraine's resistance it is — except on the
 * Ukrainian national days (lib/observances.ts), when it names the day instead.
 * A running total is the wrong sentence on Independence Day.
 *
 * The day's KIND picks the treatment, and nothing here decides it: a
 * `celebration` takes the flag's two colours, blue over yellow, and a
 * `remembrance` goes monochrome (`.observance` / `.observance-quiet` in
 * globals.css). Flag colours on a day of mourning would say the wrong thing.
 *
 * `initial` is computed at build time and passed down from the layout, so the
 * static HTML carries a real number (correct for crawlers and without JS) and
 * hydration has nothing to disagree about. The effect then re-checks in the
 * browser, which keeps the count right between deploys — the site is fully
 * static, so the baked-in number would otherwise freeze until the next build.
 * The observance is re-checked the same way and for the same reason: a build
 * from the 23rd would otherwise still be saying Flag Day on the 24th.
 *
 * The line links to a donation jar. Deliberately styled as nothing: it
 * inherits colour and carries no underline, no hover state and no external-link
 * marker, so the sidebar looks exactly as it did — the line is a quiet offer to
 * anyone who thinks to click it, not a call to action.
 */

/** monobank jar. Owner-editable, like the socials in lib/site-config.ts. */
const DONATE_URL = "https://send.monobank.ua/jar/2JbpBYkhMv";

export default function ResistanceDay({
  initial,
  initialObservance = null,
}: {
  initial: number;
  initialObservance?: ObservanceId | null;
}) {
  const [day, setDay] = useState(initial);
  const [today, setToday] = useState<ObservanceId | null>(initialObservance);

  useEffect(() => {
    const now = new Date();
    setDay(resistanceDay(now));
    setToday(observance(now));
  }, []);

  const n = String(day);
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`no-underline ${
        today
          ? `observance${observanceKind[today] === "remembrance" ? " observance-quiet" : ""}`
          : "text-inherit"
      }`}
    >
      {today ? (
        <T {...observanceName[today]} />
      ) : (
        <T
          en={ui.resistanceDay.en.replace("{n}", n)}
          uk={ui.resistanceDay.uk.replace("{n}", n)}
        />
      )}
    </a>
  );
}
