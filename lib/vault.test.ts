import { test } from "node:test";
import assert from "node:assert/strict";
import { ukDescription } from "./vault.ts";

test("ukDescription reads the translated description and ignores blanks", () => {
  assert.equal(
    ukDescription({ description_uk: " Український опис " }),
    "Український опис"
  );
  assert.equal(ukDescription({ descriptionUk: "Alias" }), "Alias");
  assert.equal(ukDescription({ description_uk: "   " }), undefined);
  assert.equal(ukDescription({}), undefined);
});
