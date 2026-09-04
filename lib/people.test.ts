/**
 * Run with `npm test` — Node's own test runner, no dependencies to install.
 *
 * Covers the People card's paragraph (lib/people.ts). Worth testing because
 * the vault exercises exactly one shape of note: every person opens with an
 * `## At a glance` table, so the case this has to get right — walking past a
 * heading and a table to the first sentence — is the only case there is, and
 * a second person written differently would break it silently.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { personBlurb } from "./people.ts";

const NOTE = `---
title: Mykhailo Fedorov
description: The minister who put Ukraine's government in a smartphone.
---

## At a glance

|           |                                       |
| --------- | ------------------------------------- |
| Born      | January 21, 1991 — Vasylivka, Ukraine |
| Known for | Diia — the "state in a smartphone"    |

## Why him

Fedorov is the person who proved a government app doesn't have to feel like a
government app. [[Diia]] put passports into a phone.

Then the full-scale invasion redefined the job.
`;

test("skips frontmatter, headings and the fact table", () => {
  const blurb = personBlurb(NOTE);
  assert.ok(blurb.startsWith("Fedorov is the person who proved"), blurb);
  assert.ok(!blurb.includes("At a glance"));
  assert.ok(!blurb.includes("Born"));
  assert.ok(!blurb.includes("|"));
});

test("keeps the readable half of a wiki link", () => {
  assert.ok(personBlurb(NOTE).includes("Diia put passports"));
  assert.ok(
    personBlurb(`## H\n\nA [[Note|label]] and a [text](https://example.com) in a sentence long enough to count.`)
      .includes("label"),
  );
});

test("takes only the first paragraph", () => {
  assert.ok(!personBlurb(NOTE).includes("Then the full-scale invasion"));
});

test("truncates on a word boundary, with an ellipsis", () => {
  const blurb = personBlurb(NOTE, 40);
  assert.ok(blurb.length <= 41, blurb);
  assert.ok(blurb.endsWith("…"));
  assert.ok(!blurb.includes("prove…"), blurb);
});

test("a note with no prose returns nothing rather than a fragment", () => {
  assert.equal(personBlurb("## At a glance\n\n| a | b |\n| - | - |\n"), "");
  assert.equal(personBlurb(""), "");
});
