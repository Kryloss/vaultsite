/**
 * The Now page's body parser.
 *
 * This one earns tests more than most: it turns hand-written markdown into
 * structured data by matching shapes (`- [x]`, `#### Role · Org`, `*period*`),
 * so a change to the vocabulary breaks silently — the page still builds, it
 * just quietly drops a goal or a job. `npm run build` can't catch that.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNowBody } from "./now-content.ts";

test("intro is everything above the first heading", () => {
  const { intro } = parseNowBody("Hello there.\n\nStill intro.\n\n## Goals\n\n- [ ] a");
  assert.equal(intro, "Hello there.\n\nStill intro.");
});

test("Obsidian comments never reach the page", () => {
  const { intro } = parseNowBody("%% a cheatsheet\nfor the owner %%\nVisible.");
  assert.equal(intro, "Visible.");
});

test("[x] marks a goal done, [ ] does not", () => {
  const { goals } = parseNowBody("## Goals\n\n- [x] Pass the exam\n- [ ] Book it");
  assert.deepEqual(
    goals.map((g) => [g.label, g.done === true]),
    [
      ["Pass the exam", true],
      ["Book it", false],
    ]
  );
});

test("an indented bullet is the goal above it's sub-label", () => {
  const { goals } = parseNowBody("## Goals\n\n- [ ] Study\n  - two hours a day");
  assert.equal(goals.length, 1);
  assert.equal(goals[0].note, "two hours a day");
});

test("a trailing wiki link becomes the goal's link and leaves the label", () => {
  const { goals } = parseNowBody("## Goals\n\n- [ ] Ship the site → [[Vaultsite]]");
  assert.equal(goals[0].label, "Ship the site");
  assert.equal(goals[0].link, "Vaultsite");
});

test("no Goals heading means no goals, not a crash", () => {
  const { goals } = parseNowBody("Just prose, no headings at all.");
  assert.deepEqual(goals, []);
});

test("a résumé block reads its rows", () => {
  const { resume } = parseNowBody(
    [
      "## Résumé",
      "",
      "Summary line.",
      "",
      "### Experience",
      "",
      "#### Barista · Coffee Place",
      "",
      "*2025 — now* · Toronto",
      "",
      "#current",
    ].join("\n")
  );
  assert.ok(resume, "expected a résumé");
  assert.equal(resume.summary, "Summary line.");
  const rows = resume.experience ?? [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, "Barista");
  assert.equal(rows[0].org, "Coffee Place");
  assert.equal(rows[0].current, true);
});
