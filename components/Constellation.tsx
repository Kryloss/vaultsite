import ConstellationStrip, { type StripWeek } from "@/components/ConstellationStrip";
import { displayDate, displayDateUk } from "@/lib/vault";
import {
  WEEKS,
  buildConstellation,
  type ConstellationNote,
} from "@/lib/constellation";

/**
 * Six months of writing in the sidebar footer, a bar per week.
 *
 * Scattered across folders, two dozen notes read as a list. Laid out in time
 * they read as a habit — which is the true thing about them, and the one thing
 * the folder tree can't show.
 *
 * A WEEK PER BAR, and the day-by-day version is deliberately gone: see the
 * header of lib/constellation.ts for what the real vault looked like through
 * it. SIX MONTHS because the drawer is 224px wide with 24px gutters, and 25
 * bars at 6px plus a gap is 174px of the 176 available — the bar width, the
 * gap and `WEEKS` are one decision written in two files.
 *
 * Built at build time from `date:` frontmatter, so it is never stale and never
 * needs maintaining: write a note, a bar grows.
 *
 * THE SERVER HALF. It reads the vault, buckets the notes and formats the dates
 * in both languages, then hands plain data to the client component that draws
 * it — the same split as PostList → PostListClient, and the reason
 * `lib/vault.ts` never reaches the browser bundle.
 */
export default function Constellation({
  notes,
  today,
}: {
  notes: ConstellationNote[];
  /** `YYYY-MM-DD`. Passed in so the strip is deterministic — see lib/constellation.ts. */
  today: string;
}) {
  const grid = buildConstellation(notes, today, WEEKS);
  // An empty window draws a flat line whose only message is that the site is
  // quiet. Better to show nothing at all.
  if (grid.total === 0) return null;

  const weeks: StripWeek[] = grid.weeks.map((week) => ({
    start: week.start,
    fill: week.fill,
    dateEn: displayDate(week.start),
    dateUk: displayDateUk(week.start),
    // Slimmed to what the panel renders. The full entry — body, frontmatter,
    // translation — has no business crossing into the client bundle.
    notes: week.notes.map((note) => ({
      href: note.href,
      title: note.title,
      titleUk: note.titleUk,
    })),
  }));

  return <ConstellationStrip weeks={weeks} total={grid.total} />;
}
