/**
 * The "At a glance" rows, read back out of a note's markdown.
 *
 * Worth testing on its own because nothing about it is visible when it goes
 * wrong: a mis-parsed table prints a caption that is merely WRONG rather than
 * missing, and the positional EN/UK merge can put the right value under the
 * wrong label without anything erroring. The vault's own tables are uniform,
 * so the cases that matter here are the ones it does not have yet.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { factRows, noteFacts } from "./music-facts.ts";

/** What every music note in the vault actually writes. */
const CLANCY = `## At a glance

| | |
|---|---|
| Released | 2024 |
| Label | Fueled by Ramen |
| Length | 47 min · 13 tracks |

*Clancy* (2024) wraps up the storyline.
`;

const CLANCY_UK = `## Коротко

| | |
|---|---|
| Випущено | 2024 |
| Лейбл | Fueled by Ramen |
| Тривалість | 47 хв · 13 треків |

«Clancy» завершує історію.
`;

test("the fact rows of a real note", () => {
  assert.deepEqual(factRows(CLANCY), [
    { label: "Released", value: "2024" },
    { label: "Label", value: "Fueled by Ramen" },
    { label: "Length", value: "47 min · 13 tracks" },
  ]);
});

test("a table with a real header is left alone", () => {
  /* Only a table whose header cells are ALL empty is a fact block — the same
     rule the renderer uses (rehypeFactTables). An ordinary table in the body
     of a note must not be mistaken for one. */
  const md = `| Track | Length |
|---|---|
| Overcompensate | 3:57 |`;
  assert.deepEqual(factRows(md), []);
});

test("the FIRST headerless table wins", () => {
  const md = `| | |
|---|---|
| Released | 2024 |

some prose

| | |
|---|---|
| Released | 1999 |`;
  assert.deepEqual(factRows(md), [{ label: "Released", value: "2024" }]);
});

test("an ordinary table before the fact block is skipped, not taken", () => {
  const md = `| Track | Length |
|---|---|
| Overcompensate | 3:57 |

| | |
|---|---|
| Released | 2024 |`;
  assert.deepEqual(factRows(md), [{ label: "Released", value: "2024" }]);
});

test("lines that only look like a table are not one", () => {
  /* No delimiter row: markdown would not render this as a table either. */
  assert.deepEqual(factRows("| | |\n| Released | 2024 |"), []);
  assert.deepEqual(factRows("no table here at all"), []);
  assert.deepEqual(factRows(""), []);
});

test("a row with no label or no value is dropped", () => {
  const md = `| | |
|---|---|
| Released | 2024 |
| | |
| Label | |`;
  assert.deepEqual(factRows(md), [{ label: "Released", value: "2024" }]);
});

test("an escaped pipe survives the split", () => {
  /* Nothing in the vault writes one today, and a value silently cut in half
     is exactly the kind of thing nobody would go looking for. */
  const md = `| | |
|---|---|
| Length | 2:44 \\| remastered |`;
  assert.deepEqual(factRows(md), [
    { label: "Length", value: "2:44 | remastered" },
  ]);
});

test("both languages are merged by position", () => {
  const facts = noteFacts(CLANCY, CLANCY_UK);
  assert.equal(facts.length, 3);
  assert.deepEqual(facts[0], {
    label: { en: "Released", uk: "Випущено" },
    value: { en: "2024", uk: "2024" },
  });
  assert.deepEqual(facts[2].label, { en: "Length", uk: "Тривалість" });
  assert.deepEqual(facts[2].value, {
    en: "47 min · 13 tracks",
    uk: "47 хв · 13 треків",
  });
});

test("a Ukrainian table of a DIFFERENT length falls back to English throughout", () => {
  /* Position is the only thing connecting "Released" to "Випущено", so a
     table that has gained or lost a row cannot be merged row by row: the
     values would slide up and print "Тривалість 2024", a wrong fact, which
     is worse than an untranslated right one. */
  const shortUk = `| | |
|---|---|
| Випущено | 2024 |`;
  const facts = noteFacts(CLANCY, shortUk);
  assert.equal(facts.length, 3);
  for (const fact of facts) {
    assert.equal(fact.label.uk, fact.label.en);
    assert.equal(fact.value.uk, fact.value.en);
  }
});

test("no Ukrainian sibling at all is English in both", () => {
  const facts = noteFacts(CLANCY);
  assert.equal(facts[0].label.uk, "Released");
  assert.equal(facts[0].value.uk, "2024");
});

test("a note with no fact table produces no rows", () => {
  assert.deepEqual(noteFacts("Just some writing.", "Просто текст."), []);
});

test("rows past the third are dropped", () => {
  /* Three is what the caption reserves height for (`.cf-facts`), and that
     reservation is what stops the page moving as you step between a two-row
     note and a three-row one. A fourth row rendering would defeat it, so the
     cap is part of that decision rather than a tidy-up. */
  const md =
    "| | |\n|---|---|\n" +
    [1, 2, 3, 4, 5, 6].map((n) => `| Row ${n} | ${n} |`).join("\n");
  assert.equal(factRows(md).length, 6);
  assert.equal(noteFacts(md).length, 3);
});
