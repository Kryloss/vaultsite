/**
 * Run with `npm test` — Node's own test runner, no dependencies to install.
 *
 * Covers counted nouns (lib/plural.ts). Worth testing because the bug it fixes
 * shipped: the sidebar read "13 липня 2026 р. · 11" for a while, a number with
 * no noun on it, and nobody reading English would have noticed. The teens are
 * the case a hand-written rule gets wrong.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { en, noteCount, uk, ukForm } from "./plural.ts";

const NOTE = ["нотатка", "нотатки", "нотаток"] as const;
const form = (n: number) => uk(n, ...NOTE);

test("Ukrainian: one, for numbers ending in 1", () => {
  assert.equal(ukForm(1), "one");
  assert.equal(ukForm(21), "one");
  assert.equal(ukForm(101), "one");
  assert.equal(form(1), "1 нотатка");
  assert.equal(form(21), "21 нотатка");
});

test("Ukrainian: few, for numbers ending in 2 to 4", () => {
  for (const n of [2, 3, 4, 22, 23, 24]) assert.equal(ukForm(n), "few", `${n}`);
  assert.equal(form(3), "3 нотатки");
  assert.equal(form(22), "22 нотатки");
});

test("Ukrainian: many, for 5 to 9, and for zero", () => {
  for (const n of [0, 5, 6, 9, 25, 30]) assert.equal(ukForm(n), "many", `${n}`);
  assert.equal(form(25), "25 нотаток");
});

test("Ukrainian: the teens are many, whatever their last digit says", () => {
  // The case the sidebar actually hit — 11 notes in one week.
  for (const n of [11, 12, 13, 14, 111, 112]) {
    assert.equal(ukForm(n), "many", `${n} should not follow its last digit`);
  }
  assert.equal(form(11), "11 нотаток");
  assert.equal(form(14), "14 нотаток");
  // ...and 21 to 24 do follow theirs, which is what makes the teens a trap.
  assert.equal(ukForm(21), "one");
  assert.equal(ukForm(24), "few");
});

test("English: singular only at exactly one", () => {
  assert.equal(en(1, "note", "notes"), "1 note");
  assert.equal(en(0, "note", "notes"), "0 notes");
  assert.equal(en(2, "note", "notes"), "2 notes");
  assert.equal(en(21, "note", "notes"), "21 notes");
});

test("noteCount pairs the two languages", () => {
  assert.deepEqual(noteCount(1), { en: "1 note", uk: "1 нотатка" });
  assert.deepEqual(noteCount(11), { en: "11 notes", uk: "11 нотаток" });
  assert.deepEqual(noteCount(14), { en: "14 notes", uk: "14 нотаток" });
  assert.deepEqual(noteCount(22), { en: "22 notes", uk: "22 нотатки" });
});

test("every count carries a noun", () => {
  // The original bug in one line: a number on its own is never acceptable.
  for (let n = 0; n <= 130; n++) {
    const { en: e, uk: u } = noteCount(n);
    assert.match(e, /^\d+ notes?$/, `en ${n}`);
    assert.match(u, /^\d+ (нотатка|нотатки|нотаток)$/, `uk ${n}`);
  }
});
