"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Routes that render with none of the site's chrome — no sidebar, breadcrumb
 * bar, Cmd+K or shortcuts. Today that is /resume alone: a sheet of paper and a
 * download button (DECISIONS #200).
 *
 * A client component because a layout has no pathname, and a wrapper rather
 * than a check inside Chrome because Chrome is all hooks: it cannot return
 * early. The alternative, a second root layout in a route group, would move
 * every route in `app/` for the sake of one page.
 *
 * A bare page brings its own `<main id="main">`, since Chrome's is not there.
 */
const BARE = new Set(["/resume"]);

export default function BareRoute({
  page,
  children,
}: {
  /** The page alone, shown on a bare route. */
  page: ReactNode;
  /** The page inside the chrome, shown everywhere else. */
  children: ReactNode;
}) {
  return BARE.has(usePathname()) ? page : children;
}
