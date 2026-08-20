import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_AGE_MS,
  SESSION_GAP_MS,
  advance,
  dayKey,
  isNew,
  type Visit,
} from "./new-notes.ts";

/** Local noon, so the day never slides across a timezone offset. */
const at = (iso: string) => Date.parse(`${iso}T12:00:00`);

test("dayKey reads the local day, not UTC's", () => {
  assert.equal(dayKey(at("2026-08-20")), "2026-08-20");
});

test("a first-ever visit has no line to be new since", () => {
  const first = advance(null, at("2026-08-20"));
  assert.equal(first.prev, null);
  assert.equal(isNew("2026-08-19", first.prev, at("2026-08-20")), false);
});

test("a second visit is new since the first one's day", () => {
  const first = advance(null, at("2026-08-10"));
  const second = advance(first, at("2026-08-20"));
  assert.equal(second.prev, "2026-08-10");
});

test("a reload inside the session holds the line", () => {
  const first = advance(null, at("2026-08-10"));
  const second = advance(first, at("2026-08-20"));
  const reload = advance(second, at("2026-08-20") + SESSION_GAP_MS - 1);
  assert.equal(reload.prev, "2026-08-10", "badges must survive a reload");
  assert.ok(reload.last > second.last, "the session extends");
});

test("a gap starts a new session", () => {
  const before: Visit = { prev: "2026-08-10", last: at("2026-08-20") };
  const later = advance(before, at("2026-08-20") + SESSION_GAP_MS + 1);
  assert.equal(later.prev, "2026-08-20");
});

test("new is strictly after the previous visit's day", () => {
  const now = at("2026-08-20");
  assert.equal(isNew("2026-08-11", "2026-08-10", now), true);
  assert.equal(isNew("2026-08-10", "2026-08-10", now), false);
  assert.equal(isNew("2026-08-09", "2026-08-10", now), false);
});

test("nothing older than the age cap is badged", () => {
  const now = at("2026-08-20");
  const old = dayKey(now - MAX_AGE_MS - 24 * 60 * 60 * 1000);
  // Away for years, so everything is unseen — but the list must not all shout.
  assert.equal(isNew(old, "2019-01-01", now), false);
  assert.equal(isNew("2026-08-19", "2019-01-01", now), true);
});

test("a missing or unparseable date is never new", () => {
  const now = at("2026-08-20");
  assert.equal(isNew(undefined, "2026-08-10", now), false);
  assert.equal(isNew("someday", "2026-08-10", now), false);
});
