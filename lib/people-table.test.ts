/**
 * Run with `npm test`. Covers the People Table view's columns
 * (lib/people-table.ts), read from the notes' own "At a glance" tables.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { personFacts, yearOf } from "./people-table.ts";

const table = (rows: [string, string][]) =>
  ["|  |  |", "| --- | --- |", ...rows.map(([l, v]) => `| ${l} | ${v} |`)].join("\n");

test("Born and Known for, by English label, in both languages by position", () => {
  const en = table([["Born", "March 9, 1985 — Yartsevo"], ["Known for", "*Mercedes S666*"]]);
  const uk = table([["Народився", "9 березня 1985 — Ярцево"], ["Чим відомий", "*Mercedes S666*"]]);
  assert.deepEqual(personFacts(en, uk), {
    born: { en: "March 9, 1985 — Yartsevo", uk: "9 березня 1985 — Ярцево" },
    knownFor: { en: "Mercedes S666", uk: "Mercedes S666" },
  });
});

test("a band is Formed, and a missing row is simply absent", () => {
  const en = table([["Formed", "2009 — Columbus, Ohio"], ["Grammy", "2017"]]);
  assert.deepEqual(personFacts(en), {
    born: { en: "2009 — Columbus, Ohio", uk: "2009 — Columbus, Ohio" },
    knownFor: undefined,
  });
});

test("tables of different lengths fall back to English", () => {
  const en = table([["Born", "1991"], ["Known for", "Diia"]]);
  const uk = table([["Народився", "1991"]]);
  assert.equal(personFacts(en, uk).knownFor?.uk, "Diia");
});

test("the year a Born value sorts by", () => {
  assert.equal(yearOf("June 14, 1946 — Queens, New York City"), 1946);
  assert.equal(yearOf("2009 — Columbus, Ohio"), 2009);
  assert.equal(yearOf("unknown"), null);
  assert.equal(yearOf(undefined), null);
});
