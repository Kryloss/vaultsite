import { test } from "node:test";
import assert from "node:assert/strict";
import { entrySkin, skinBeats, MAX_BEATS, SKINS } from "./skins";

test("a note with no skin has none", () => {
  assert.equal(entrySkin({}), undefined);
  assert.equal(entrySkin({ skin: "" }), undefined);
  assert.equal(entrySkin({ skin: 3 }), undefined);
});

test("a known skin is matched whatever its case and spacing", () => {
  assert.equal(entrySkin({ skin: "monster" }), "monster");
  assert.equal(entrySkin({ skin: " Monster " }), "monster");
});

test("an unknown skin is no skin, so a typo renders the plain page", () => {
  assert.equal(entrySkin({ skin: "monstre" }), undefined);
});

test("beats come from a list or a comma-separated string", () => {
  assert.deepEqual(skinBeats({ skin_beats: ["Unleash", "the", "Beast"] }), ["Unleash", "the", "Beast"]);
  assert.deepEqual(skinBeats({ skin_beats: "Unleash, the , Beast" }), ["Unleash", "the", "Beast"]);
  assert.deepEqual(skinBeats({}), []);
});

test("the opening is capped", () => {
  const many = Array.from({ length: MAX_BEATS + 3 }, (_, i) => `w${i}`);
  assert.equal(skinBeats({ skin_beats: many }).length, MAX_BEATS);
});

test("every skin has a name a file can carry", () => {
  for (const skin of SKINS) assert.match(skin, /^[a-z][a-z0-9-]*$/);
});
