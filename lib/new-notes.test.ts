import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_AGE_MS,
  SESSION_GAP_MS,
  advance,
  arrivedAt,
  dayKey,
  isNew,
  parse,
  type Visit,
} from "./new-notes.ts";

/** Local wall-clock, so nothing slides across a timezone offset. */
const at = (iso: string, time = "12:00:00") => Date.parse(`${iso}T${time}`);

test("dayKey reads the local day, not UTC's", () => {
  assert.equal(dayKey(at("2026-08-20")), "2026-08-20");
});

test("a note dated D arrives at the end of D", () => {
  assert.ok(arrivedAt("2026-08-20") > at("2026-08-20", "23:00:00"));
  assert.ok(arrivedAt("2026-08-20") < at("2026-08-21", "00:00:01"));
});

test("a first-ever visit has no line to be new since", () => {
  const first = advance(null, at("2026-08-20"));
  assert.equal(first.prevAt, null);
  assert.equal(isNew("2026-08-19", first.prevAt, at("2026-08-20")), false);
});

test("a second visit is new since the first one", () => {
  const first = advance(null, at("2026-08-10"));
  const second = advance(first, at("2026-08-20"));
  assert.equal(second.prevAt, at("2026-08-10"));
});

test("a reload inside the session holds the line", () => {
  const first = advance(null, at("2026-08-10"));
  const second = advance(first, at("2026-08-20"));
  const reload = advance(second, at("2026-08-20") + SESSION_GAP_MS - 1);
  assert.equal(reload.prevAt, at("2026-08-10"), "badges must survive a reload");
  assert.ok(reload.last > second.last, "the session extends");
});

test("a gap starts a new session", () => {
  const before: Visit = { prevAt: at("2026-08-10"), last: at("2026-08-20") };
  const later = advance(before, at("2026-08-20") + SESSION_GAP_MS + 1);
  assert.equal(later.prevAt, at("2026-08-20"));
});

/**
 * The case the first version got wrong: a note published on a day you had
 * already visited could never be new to you, so it never badged for the
 * readers who come most often.
 */
test("a note published later on a day you already visited still badges", () => {
  const morning = advance(null, at("2026-08-20", "09:00:00")); // first ever
  const evening = advance(morning, at("2026-08-20", "20:00:00"));
  assert.equal(
    isNew("2026-08-20", evening.prevAt, at("2026-08-20", "20:00:00")),
    true,
  );
});

test("and it stops badging a visit later", () => {
  const evening: Visit = {
    prevAt: at("2026-08-20", "09:00:00"),
    last: at("2026-08-20", "20:00:00"),
  };
  // Tomorrow: still badged — the bounded cost of reading a date as end-of-day.
  const tomorrow = advance(evening, at("2026-08-21"));
  assert.equal(isNew("2026-08-20", tomorrow.prevAt, at("2026-08-21")), true);
  // The day after: the line is now past the note's own day.
  const after = advance(tomorrow, at("2026-08-22"));
  assert.equal(isNew("2026-08-20", after.prevAt, at("2026-08-22")), false);
});

test("new is anything that arrived after the previous visit", () => {
  const now = at("2026-08-20");
  const since = at("2026-08-10");
  assert.equal(isNew("2026-08-11", since, now), true);
  assert.equal(isNew("2026-08-10", since, now), true, "same day, later hours");
  assert.equal(isNew("2026-08-09", since, now), false);
});

test("nothing older than the age cap is badged", () => {
  const now = at("2026-08-20");
  const old = dayKey(now - MAX_AGE_MS - 24 * 60 * 60 * 1000);
  // Away for years, so everything is unseen — but the list must not all shout.
  assert.equal(isNew(old, at("2019-01-01"), now), false);
  assert.equal(isNew("2026-08-19", at("2019-01-01"), now), true);
});

test("a missing or unparseable date is never new", () => {
  const now = at("2026-08-20");
  assert.equal(isNew(undefined, at("2026-08-10"), now), false);
  assert.equal(isNew("someday", at("2026-08-10"), now), false);
});

test("the briefly-shipped stored shape is carried over, not dropped", () => {
  const legacy = parse(JSON.stringify({ prev: "2026-08-10", last: at("2026-08-20") }));
  assert.equal(legacy?.prevAt, arrivedAt("2026-08-10"));
  assert.equal(parse(JSON.stringify({ prevAt: 5, last: 9 }))?.prevAt, 5);
  assert.equal(parse(JSON.stringify({ prev: null, last: 9 }))?.prevAt, null);
  assert.equal(parse(null), null);
  assert.equal(parse(JSON.stringify({ nonsense: true })), null);
});
