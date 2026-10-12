import { test } from "node:test";
import assert from "node:assert/strict";
import { readingStats, ukDescription } from "./vault.ts";

test("ukDescription reads the translated description and ignores blanks", () => {
  assert.equal(
    ukDescription({ description_uk: " Український опис " }),
    "Український опис"
  );
  assert.equal(ukDescription({ descriptionUk: "Alias" }), "Alias");
  assert.equal(ukDescription({ description_uk: "   " }), undefined);
  assert.equal(ukDescription({}), undefined);
});

test("readingStats counts prose, not raw HTML tags or link addresses", () => {
  const body =
    '<section class="mx-plate mx-black">\n\nOne [two](https://example.com/a-b) three\n\n</section>\n';
  assert.equal(readingStats(body).words, 3);
  assert.equal(readingStats("# Hi\n\nOne **two** [[three]]\n").words, 4);
});
