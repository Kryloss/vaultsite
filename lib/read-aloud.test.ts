/**
 * Run with `npm test`. Covers the pure half of "Listen" (lib/read-aloud.ts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { factSentence, isSourcesHeading, pickVoice } from "./read-aloud.ts";

const voices = [
  { name: "Albert", lang: "en-US" },
  { name: "Samantha", lang: "en-US", default: true },
  { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US" },
  { name: "Google UK English Female", lang: "en-GB" },
  { name: "Lesya", lang: "uk-UA" },
  { name: "Milena", lang: "ru-RU" },
];

test("a natural/neural voice beats the default", () => {
  assert.match(pickVoice(voices, "en")!.name, /Natural/);
});

test("Ukrainian gets a Ukrainian voice, never a Russian one", () => {
  assert.equal(pickVoice(voices, "uk")!.name, "Lesya");
  assert.equal(pickVoice(voices.filter((v) => v.lang !== "uk-UA"), "uk"), undefined);
});

test("novelty voices are never chosen", () => {
  assert.equal(pickVoice([{ name: "Albert", lang: "en-US" }], "en"), undefined);
});

test("the reader's own locale breaks a tie", () => {
  const plain = [
    { name: "Karen", lang: "en-AU" },
    { name: "Daniel", lang: "en-GB" },
  ];
  assert.equal(pickVoice(plain, "en", "en-GB")!.name, "Daniel");
});

test("fact rows read as sentences", () => {
  assert.equal(factSentence("Born", "March 9, 1985"), "Born: March 9, 1985.");
  assert.equal(factSentence("Rating", "5 out of 5 stars."), "Rating: 5 out of 5 stars.");
  assert.equal(factSentence("Empty", "  "), "");
});

test("reading stops at Sources, in either language", () => {
  assert.ok(isSourcesHeading("Sources#"));
  assert.ok(isSourcesHeading("Джерела"));
  assert.ok(!isSourcesHeading("Why him"));
});
