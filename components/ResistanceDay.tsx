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
 */
export default function ResistanceDay({ initial }: { initial: number }) {
  const [day, setDay] = useState(initial);

  useEffect(() => {
    setDay(resistanceDay());
  }, []);

  const n = String(day);
  return (
    <T
      en={ui.resistanceDay.en.replace("{n}", n)}
      uk={ui.resistanceDay.uk.replace("{n}", n)}
    />
  );
}
