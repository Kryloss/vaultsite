import { test } from "node:test";
import assert from "node:assert/strict";
import { tidyCut } from "./tidy-cut";

test("tidyCut leaves text that fits alone", () => {
  assert.equal(tidyCut("Short one.", 40), "Short one.");
  assert.equal(tidyCut("Exact", 5), "Exact");
});

test("tidyCut puts the ellipsis before a comma, not after it", () => {
  const text = "I forget what I read, so I keep it here";
  assert.equal(tidyCut(text, 21), "I forget what I read…");
  assert.equal(tidyCut(text, 22), "I forget what I read…");
});

test("tidyCut steps back to a whole word", () => {
  assert.equal(tidyCut("Notes on networking basics", 14), "Notes on…");
  assert.equal(tidyCut("Notes on networking basics", 19), "Notes on networking…");
});

test("tidyCut drops dashes, colons and an opened bracket or quote", () => {
  assert.equal(tidyCut("A plan: do the thing", 8), "A plan…");
  assert.equal(tidyCut("One thing – and another", 12), "One thing…");
  assert.equal(tidyCut("The book (2011) is long", 11), "The book…");
  assert.equal(tidyCut("Він сказав «так» і пішов", 13), "Він сказав…");
});

test("tidyCut keeps a sentence's own full stop", () => {
  assert.equal(tidyCut("It works. Mostly it does", 10), "It works.…");
});

test("tidyCut breaks a single long word rather than returning nothing", () => {
  assert.equal(tidyCut("Supercalifragilistic", 6), "Superc…");
  assert.equal(tidyCut("anything", 0), "…");
});
