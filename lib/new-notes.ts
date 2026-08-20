/**
 * What has arrived since you were last here.
 *
 * The site has no idea who is reading it — everything is static — so "new" can
 * only ever mean "new to this browser". One localStorage key remembers when you
 * were last here; a note dated after that day is badged in the list until you
 * come back again. Same storage discipline as `lib/read-notes.ts` and
 * `lib/recents.ts`: ONE key holding a small object, never a key per note.
 *
 * Three decisions are worth stating, because each has an obvious-looking
 * alternative that is wrong (`docs/DECISIONS.md` #84):
 *
 * 1. The marker advances ONCE PER SESSION, not once per page load. Stamping it
 *    on every load would clear every badge the moment you opened the first
 *    page — you would only ever see them by looking at the list you landed on.
 *    A gap of more than SESSION_GAP_MS starts a new session; anything shorter
 *    is the same visit, so badges survive a reload and a browse around.
 *
 * 2. Comparison is BY DAY, not by timestamp. An entry's `date` is day-granular
 *    (`2026-08-18`), so comparing it against a millisecond clock is a coin flip
 *    across a timezone offset. Both sides become a local `YYYY-MM-DD`, which
 *    ISO dates compare correctly as plain strings.
 *
 * 3. A first-ever visit badges NOTHING. There is no previous visit to be new
 *    since, and badging the entire list on arrival tells a first-time reader
 *    the opposite of what the badge means.
 *
 * The pure half is exported and tested; only `newSince()` touches storage.
 */

const KEY = "notes-seen";

/** Longer than a reload and a wander, shorter than "came back later". */
export const SESSION_GAP_MS = 30 * 60 * 1000;

/**
 * Nothing older than this is ever badged, however long you have been away.
 * Come back after a year and every row would say New, and a list where
 * everything is new is a list where nothing is.
 */
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface Visit {
  /**
   * Local day of the visit BEFORE this one — the line notes are new since.
   * null on a first-ever visit.
   */
  prev: string | null;
  /** When we last saw you. Only used to tell one session from the next. */
  last: number;
}

/** Timestamp → local `YYYY-MM-DD`, matching an entry's `date` frontmatter. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The stored marker after arriving at `now`. Pure, so it can be tested. */
export function advance(stored: Visit | null, now: number): Visit {
  if (!stored) return { prev: null, last: now };
  // A gap means this is a fresh visit: the previous one becomes the line.
  if (now - stored.last > SESSION_GAP_MS) {
    return { prev: dayKey(stored.last), last: now };
  }
  // Same session — hold the line where it was, but keep the clock moving so
  // the session extends rather than expiring under a reader who is still here.
  return { prev: stored.prev, last: now };
}

/**
 * @param date an entry's `date` frontmatter, `YYYY-MM-DD`.
 * @param since the line from `advance()`; null means badge nothing.
 */
export function isNew(
  date: string | undefined,
  since: string | null,
  now: number,
): boolean {
  if (!date || !since) return false;
  if (date <= since) return false; // ISO dates sort as strings
  const published = Date.parse(`${date}T00:00:00`);
  if (!Number.isFinite(published)) return false;
  return now - published <= MAX_AGE_MS;
}

/**
 * Memoized for the life of the page: the marker moves on the FIRST call and
 * the answer is then frozen, so a soft navigation doesn't clear the badges
 * you are in the middle of looking at.
 */
let since: string | null | undefined;

/** The day notes are new since, advancing the stored marker on first call. */
export function newSince(): string | null {
  if (since !== undefined) return since;
  since = null;
  if (typeof localStorage === "undefined") return since;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const stored =
      parsed && typeof parsed === "object" && typeof (parsed as Visit).last === "number"
        ? (parsed as Visit)
        : null;
    const next = advance(stored, Date.now());
    since = next.prev;
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode, a full quota, or somebody else's data in our key. A badge
    // is a nicety — never a requirement.
  }
  return since;
}
