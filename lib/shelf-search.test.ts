/**
 * Run with `npm test`. Covers the shelf search's matching rule
 * (lib/shelf-search.ts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { shelfHaystack, shelfMatches } from "./shelf-search.ts";

const sapiens = shelfHaystack(["Sapiens", "Сапієнс", "Yuval Noah Harari", "Ювал Ной Харарі"]);

test("every word must begin a word of the title or creator", () => {
  assert.ok(shelfMatches(sapiens, "harar"));
  assert.ok(shelfMatches(sapiens, "yuval sap"));
  assert.ok(!shelfMatches(sapiens, "arari"));
  assert.ok(!shelfMatches(sapiens, "sapiens dune"));
});

test("either language, any case, diacritics folded", () => {
  assert.ok(shelfMatches(sapiens, "САПІ"));
  assert.ok(shelfMatches(shelfHaystack(["Måneskin"]), "manes"));
});

test("an empty query finds everything", () => {
  assert.ok(shelfMatches(sapiens, "   "));
});
