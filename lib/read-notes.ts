/**
 * Which notes have actually been READ to the end.
 *
 * Deliberately not the same question as components/ReadingPosition.tsx, which
 * remembers *where you stopped* so it can offer to take you back. That store
 * can't answer this one: it holds a scroll offset and nothing about the page's
 * length, so "y = 4300" is a finished short note and an abandoned long one at
 * the same time.
 *
 * The reading bar already computes the answer — it knows what fraction of the
 * article is behind you, media discounted and furniture excluded — so the
 * writer is components/ReadingProgress.tsx and the only threshold is READ_AT.
 * Nothing else measures anything.
 *
 * One localStorage key holding path → timestamp, same shape and the same
 * reasoning as the positions map: a key per note would leave a growing pile in
 * the reader's browser that nothing ever cleans up.
 *
 * Read by components/Series.tsx, which marks the parts of a series you've
 * finished. It's a client-only signal: the server has no idea who's reading,
 * so anything built on this must be filled in after hydration or it will
 * mismatch.
 */

const KEY = "notes-read";

/**
 * How much of an article counts as having read it. Not 1: the last few
 * percent are the closing line and whatever follows it, and a reader who has
 * got that far has read the note whether or not they scroll the final inch.
 */
export const READ_AT = 0.92;

/** Notes remembered at once. Oldest are dropped first. */
const KEEP = 300;
/** Forget after a year — long enough that a series read last term still counts. */
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Fired on `window` when a note is first marked read, so anything already on
 * screen can update without a navigation — the series badge fills in as you
 * finish the part you're reading. Same custom-event approach as `langchange`
 * and TIME_LEFT_EVENT, for the same reason: one integer doesn't justify a
 * context provider around the whole tree.
 */
export const READ_EVENT = "noteread";

export type ReadNotes = Record<string, number>;

export function readNotes(): ReadNotes {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReadNotes) : {};
  } catch {
    return {}; // private mode, quota, or somebody else's data in our key
  }
}

/**
 * Record a path as read. Idempotent and cheap to call more than once — the
 * bar crosses the threshold on one frame and stays past it for the rest of
 * the visit, so the guard here is what keeps that from being a write per
 * scroll frame.
 */
export function markRead(path: string): void {
  const notes = readNotes();
  if (notes[path]) return;

  notes[path] = Date.now();
  save(notes);
  window.dispatchEvent(new CustomEvent(READ_EVENT, { detail: path }));
}

/**
 * Take a note back off the list.
 *
 * The automatic signal is a guess — a good one, but a reader who skimmed to
 * the bottom looking for one line has "finished" the note by the bar's
 * reckoning and knows perfectly well that they haven't. The tick in the series
 * panel is a checkbox for exactly that reason: the measurement is a default,
 * not a verdict.
 */
export function unmarkRead(path: string): void {
  const notes = readNotes();
  if (!notes[path]) return;

  delete notes[path];
  save(notes);
  window.dispatchEvent(new CustomEvent(READ_EVENT, { detail: path }));
}

function save(notes: ReadNotes): void {
  try {
    const fresh = Date.now() - MAX_AGE_MS;
    const kept = Object.entries(notes)
      .filter(([, t]) => t > fresh)
      .sort((a, b) => b[1] - a[1])
      .slice(0, KEEP);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    /* storage full or blocked — the feature simply doesn't remember */
  }
}
