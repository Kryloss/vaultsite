/**
 * Run with `npm test` — Node's own test runner, no dependencies to install.
 *
 * Covers lib/shortcut-key.ts. Layout bugs are invisible in a browser you're
 * testing in one layout, which is how the Cyrillic gap survived: every letter
 * shortcut on the site was dead under a Ukrainian keyboard and nothing said
 * so. These cases ARE the layouts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { shortcutKey } from "./shortcut-key.ts";

test("a Latin layout is taken at its word", () => {
  assert.equal(shortcutKey({ key: "j", code: "KeyJ" }), "j");
  assert.equal(shortcutKey({ key: "[", code: "BracketLeft" }), "[");
  assert.equal(shortcutKey({ key: "/", code: "Slash" }), "/");
  assert.equal(shortcutKey({ key: "?", code: "Slash", shiftKey: true }), "?");
  assert.equal(shortcutKey({ key: "3", code: "Digit3" }), "3");
});

test("capitals are the same shortcut", () => {
  assert.equal(shortcutKey({ key: "M", code: "KeyM", shiftKey: true }), "m");
});

test("a Cyrillic layout falls back to the physical key", () => {
  // The keys that print j/k/l/m/g/h on an English keyboard.
  assert.equal(shortcutKey({ key: "о", code: "KeyJ" }), "j");
  assert.equal(shortcutKey({ key: "л", code: "KeyK" }), "k");
  assert.equal(shortcutKey({ key: "д", code: "KeyL" }), "l");
  assert.equal(shortcutKey({ key: "ь", code: "KeyM" }), "m");
  assert.equal(shortcutKey({ key: "п", code: "KeyG" }), "g");
  assert.equal(shortcutKey({ key: "р", code: "KeyH" }), "h");
  // …and the bracket keys, which type х and ї there.
  assert.equal(shortcutKey({ key: "х", code: "BracketLeft" }), "[");
  assert.equal(shortcutKey({ key: "ї", code: "BracketRight" }), "]");
});

test("punctuation reached by another key still works", () => {
  // German: `/` is Shift+7, nowhere near the key named Slash.
  assert.equal(shortcutKey({ key: "/", code: "Digit7", shiftKey: true }), "/");
  // French: `?` is Shift+, — same story.
  assert.equal(shortcutKey({ key: "?", code: "Comma", shiftKey: true }), "?");
});

test("a digit row that needs Shift works either way", () => {
  // AZERTY types & on the physical 1; the code carries the section number.
  assert.equal(shortcutKey({ key: "&", code: "Digit1" }), "1");
  assert.equal(shortcutKey({ key: "1", code: "Digit1", shiftKey: true }), "1");
});

test("keys that aren't shortcut characters return nothing", () => {
  assert.equal(shortcutKey({ key: "Escape", code: "Escape" }), "");
  assert.equal(shortcutKey({ key: "ArrowDown", code: "ArrowDown" }), "");
  assert.equal(shortcutKey({ key: "Dead", code: "Backquote" }), "");
});
