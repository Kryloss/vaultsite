/**
 * Run with `npm test`.
 *
 * Covers lib/letter-shape.ts: the chevron after a heading is centred on the
 * heading's last letter, and which letter that is has to be right in both
 * alphabets, past trailing punctuation.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chevronFitClass, lastLetterShape } from "./letter-shape.ts";

test("x-height letters", () => {
  for (const s of ["Videos", "Movies", "Music", "Shows", "Книжки", "Музика"]) {
    assert.equal(lastLetterShape(s), "x", s);
  }
});

test("ascenders, capitals and digits are tall", () => {
  for (const s of ["Shelf", "TIL", "Top 10", "Posted", "Люді", "Герой"]) {
    assert.equal(lastLetterShape(s), "tall", s);
  }
});

test("descenders are deep", () => {
  for (const s of ["Listening", "Today", "Відео у", "Вибір"]) {
    assert.equal(lastLetterShape(s), "deep", s);
  }
});

test("trailing punctuation and spaces are skipped", () => {
  assert.equal(lastLetterShape("Shelf… "), "tall");
  assert.equal(lastLetterShape("(games)"), "x");
  assert.equal(lastLetterShape(""), "x");
});

test("a class per language, English standing in for a missing translation", () => {
  assert.equal(chevronFitClass("Shelf", "Полиця"), "chev-fit chev-en-tall chev-uk-x");
  assert.equal(chevronFitClass("Videos"), "chev-fit chev-en-x chev-uk-x");
});
