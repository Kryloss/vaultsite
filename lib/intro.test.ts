/**
 * Run with `npm test` — Node's own test runner, no dependencies to install.
 *
 * Covers the first-visit intro's cues and timing (lib/intro.ts). The intro
 * plays once per browser, which makes it exactly the kind of thing that is
 * easy to ship broken: by the time you notice the photo appeared on the wrong
 * word, you've already used up your one chance to see it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BEAT,
  COMMA,
  KEY,
  LEAD_IN,
  LINE_DUR,
  LINE_STEP,
  WOBBLE,
  keyDelay,
  photoCue,
  sweepDuration,
} from "./intro.ts";

const EN = "Hey, I'm Kyrylo Leshchenko.";
const UK = "Привіт, я Кирило Лещенко.";

test("the photo is cued by the first name, in either language", () => {
  // "Hey, I'm Kyrylo" — 15 characters, the photo lands on the o.
  assert.equal(photoCue(EN, "Kyrylo"), 15);
  assert.equal(EN.slice(0, photoCue(EN, "Kyrylo")), "Hey, I'm Kyrylo");

  // Cyrillic sits at a different offset and is a different length. This is the
  // case a hard-coded character count would silently get wrong.
  assert.equal(UK.slice(0, photoCue(UK, "Кирило")), "Привіт, я Кирило");
});

test("the cue fires before the surname, not after the sentence", () => {
  const cue = photoCue(EN, "Kyrylo");
  assert.ok(cue < EN.length, "photo must arrive mid-sentence");
  assert.equal(EN[cue], " ");
});

test("a greeting without the name never fires the cue", () => {
  // Infinity, not -1 and not 0: an index that no keystroke count can reach, so
  // the photo simply arrives with the rest of the page.
  assert.equal(photoCue("Hello there.", "Kyrylo"), Infinity);
  assert.equal(photoCue(EN, ""), Infinity);
});

test("the name is counted in characters, not UTF-16 units", () => {
  assert.equal(photoCue("Hi 🙂 there", "🙂"), 4);
});

test("a comma is held longer than a letter", () => {
  assert.equal(keyDelay(","), COMMA);
  assert.ok(COMMA > KEY + WOBBLE, "the breath must outlast any wobble");
});

test("keystrokes wobble around the base speed, and stay positive", () => {
  assert.equal(keyDelay("a", 0.5), KEY);
  assert.equal(keyDelay("a", 0), KEY - WOBBLE);
  assert.equal(keyDelay("a", 1), KEY + WOBBLE);
  for (const r of [0, 0.25, 0.5, 0.75, 1]) {
    assert.ok(keyDelay("a", r) > 0);
  }
});

test("the sweep outlasts its own last line", () => {
  // One line has nothing to stagger against.
  assert.ok(sweepDuration(1) > LINE_DUR);
  // Ten lines: the last one starts at 9 steps in and still gets its full run.
  assert.ok(sweepDuration(10) >= 9 * LINE_STEP + LINE_DUR);
  assert.equal(sweepDuration(0), sweepDuration(1));
});

test("the whole intro stays in the seconds, not the tens of seconds", () => {
  // The gate in app/layout.tsx drops the attribute after 8s no matter what.
  // If the intro itself ever grew past that, the failsafe would start cutting
  // off the real sequence instead of catching a broken one.
  const typing = LEAD_IN + Array.from(EN).length * (KEY + WOBBLE) + BEAT;
  const total = typing + sweepDuration(8);
  assert.ok(total < 8000, `intro runs ${total}ms, failsafe fires at 8000ms`);
});
