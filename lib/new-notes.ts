/**
 * What has arrived since you were last here.
 *
 * The site has no idea who is reading it — everything is static — so "new" can
 * only ever mean "new to this browser". One localStorage key remembers when you
 * were last here; a note that arrived after that moment is badged in the list
 * until you come back again. Same storage discipline as `lib/read-notes.ts` and
 * `lib/recents.ts`: ONE key holding a small object, never a key per note.
 *
 * Four decisions are worth stating, because each has an obvious-looking
 * alternative that is wrong (`docs/DECISIONS.md` #84):
 *
 * 1. The marker advances ONCE PER SESSION, not once per page load. Stamping it
 *    on every load would clear every badge the moment you opened the first
 *    page — you would only ever see them by looking at the list you landed on.
 *    A gap of more than SESSION_GAP_MS starts a new session; anything shorter
 *    is the same visit, so badges survive a reload and a browse around.
 *
 * 2. A note dated D is treated as having ARRIVED AT THE END of day D, and that
 *    is compared against the previous visit's TIMESTAMP. The first version
 *    compared two local `YYYY-MM-DD` strings, which is tidy and has one fatal
 *    consequence: a note published on a day you had already visited could never
 *    be new to you. Here at 09:00, note goes up at 14:00, back at 20:00 — the
 *    line reads 2026-08-20 and so does the note, `>` is false, and tomorrow the
 *    line moves past it for good. It never badged for the readers who come most
 *    often, which is exactly backwards. End-of-day is the generous reading of a
 *    day-granular date and it fixes that case; the cost is bounded and stated
 *    in point 3.
 *
 * 3. The cost of point 2: a note dated on the day of your PREVIOUS visit stays
 *    badged one visit longer than it strictly should. Seen on Tuesday evening,
 *    still badged when you return Wednesday, gone by Thursday. Showing a badge
 *    one visit too long is a much better failure than never showing it at all.
 *
 * 4. A first-ever visit badges NOTHING. There is no previous visit to be new
 *    since, and badging the entire list on arrival tells a first-time reader
 *    the opposite of what the badge means. Every reader spends exactly one
 *    visit in this state, including the day this shipped.
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
   * When the visit BEFORE this one happened — the line notes are new since.
   * null on a first-ever visit.
   */
  prevAt: number | null;
  /** When we last saw you. Only used to tell one session from the next. */
  last: number;
}

/** Timestamp → local `YYYY-MM-DD`, matching an entry's `date` frontmatter. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * A day-granular date, read as the moment it stopped being possible for that
 * note to appear: the end of its own day, in the reader's timezone.
 */
export function arrivedAt(date: string): number {
  return Date.parse(`${date}T23:59:59.999`);
}

/** The stored marker after arriving at `now`. Pure, so it can be tested. */
export function advance(stored: Visit | null, now: number): Visit {
  if (!stored) return { prevAt: null, last: now };
  // A gap means this is a fresh visit: the previous one becomes the line.
  if (now - stored.last > SESSION_GAP_MS) {
    return { prevAt: stored.last, last: now };
  }
  // Same session — hold the line where it was, but keep the clock moving so
  // the session extends rather than expiring under a reader who is still here.
  return { prevAt: stored.prevAt, last: now };
}

/**
 * @param date an entry's `date` frontmatter, `YYYY-MM-DD`.
 * @param since the line from `advance()`; null means badge nothing.
 */
export function isNew(
  date: string | undefined,
  since: number | null,
  now: number,
): boolean {
  if (!date || since == null) return false;
  const arrived = arrivedAt(date);
  if (!Number.isFinite(arrived)) return false;
  if (arrived <= since) return false;
  // The cap is measured from the note's own day, not from its end, so
  // "30 days" means the same thing to a reader as it does on the calendar.
  const published = Date.parse(`${date}T00:00:00`);
  return now - published <= MAX_AGE_MS;
}

/**
 * Memoized for the life of the page: the marker moves on the FIRST call and
 * the answer is then frozen, so a soft navigation doesn't clear the badges
 * you are in the middle of looking at.
 */
let since: number | null | undefined;

/** The moment notes are new since, advancing the stored marker on first call. */
export function newSince(): number | null {
  if (since !== undefined) return since;
  since = null;
  if (typeof localStorage === "undefined") return since;
  try {
    const raw = localStorage.getItem(KEY);
    const stored = parse(raw);
    const next = advance(stored, Date.now());
    since = next.prevAt;
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode, a full quota, or somebody else's data in our key. A badge
    // is a nicety — never a requirement.
  }
  return since;
}

/**
 * Reads the stored marker, including the SHIPPED-BRIEFLY shape that held
 * `prev` as a `YYYY-MM-DD` string. That day is read as its end, which is the
 * same reading `arrivedAt()` gives a note — so a browser that saw the first
 * version carries on from where it was instead of losing a cycle.
 */
export function parse(raw: string | null): Visit | null {
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") return null;
  const v = value as { prevAt?: unknown; prev?: unknown; last?: unknown };
  if (typeof v.last !== "number") return null;
  if (typeof v.prevAt === "number") return { prevAt: v.prevAt, last: v.last };
  if (typeof v.prev === "string") {
    const legacy = arrivedAt(v.prev);
    return { prevAt: Number.isFinite(legacy) ? legacy : null, last: v.last };
  }
  return { prevAt: null, last: v.last };
}
