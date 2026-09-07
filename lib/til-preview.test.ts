/**
 * The projects feed's preview cut.
 *
 * The vault exercises the happy path on every build, but not the thing that
 * went wrong: two bodies of the SAME note, one of them a translation whose
 * characters run longer, drifting apart at the cut. Nothing about a green
 * build would say the Ukrainian preview had started stopping a block early.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PREVIEW_LIMIT,
  applyPreviewCut,
  previewBodies,
  previewCut,
} from "./til-preview.ts";

/** A body of `n` blocks, each `size` chars, joined the way markdown joins them. */
function body(n: number, size: number, fill = "a"): string {
  return Array.from({ length: n }, (_, i) =>
    (i + 1).toString().padEnd(size, fill)
  ).join("\n\n");
}

test("a body under the limit needs no preview", () => {
  assert.equal(previewCut(body(3, 100), 1000), null);
  assert.deepEqual(previewBodies(body(3, 100), body(3, 130), 1000), {
    en: null,
    uk: null,
  });
});

test("the cut falls on a block boundary", () => {
  const md = body(5, 300);
  const cut = previewCut(md, 1000);
  assert.deepEqual(cut, { blocks: 3, capFirst: false });
  assert.equal(applyPreviewCut(md, cut!, 1000), body(3, 300));
});

test("a first block over the limit is cut at a word boundary", () => {
  const md = "word ".repeat(40) + "\n\nsecond block";
  const cut = previewCut(md, 100);
  assert.deepEqual(cut, { blocks: 1, capFirst: true });
  const preview = applyPreviewCut(md, cut!, 100)!;
  assert.ok(preview.endsWith("…"));
  assert.ok(preview.length <= 101);
  assert.ok(!preview.includes("wor…"));
});

test("both languages cut at the same block, not the same character count", () => {
  // The regression: same five blocks, the Ukrainian ones ~15% longer, so a
  // per-language budget kept four blocks in English and three in Ukrainian.
  const en = body(5, 240);
  const uk = body(5, 276);
  assert.equal(previewCut(en, 1000)!.blocks, 4);
  assert.equal(previewCut(uk, 1000)!.blocks, 3);

  const pair = previewBodies(en, uk, 1000);
  assert.equal(pair.en!.split(/\n\s*\n/).length, 4);
  assert.equal(pair.uk!.split(/\n\s*\n/).length, 4);
});

test("a translation with fewer blocks than the cut shows whole", () => {
  const pair = previewBodies(body(6, 200), body(3, 200), 1000);
  assert.equal(pair.en!.split(/\n\s*\n/).length, 5);
  assert.equal(pair.uk, null);
});

test("a translation that outgrew the shared cut still truncates", () => {
  // Two blocks against the English six: the shared cut covers all of it, so
  // without a fallback the whole 3000-char body would land on the list page.
  const pair = previewBodies(body(6, 200), body(2, 1500), 1000);
  assert.notEqual(pair.uk, null);
  assert.equal(pair.uk!.split(/\n\s*\n/).length, 1);
});

test("an entry with no translation still previews", () => {
  const pair = previewBodies(body(6, 200), null, 1000);
  assert.notEqual(pair.en, null);
  assert.equal(pair.uk, null);
});

test("the shipped limit keeps this website's list of decisions in both", () => {
  // The real note's block sizes, the case that was reported.
  const en = [360, 83, 31, 504, 143].map((n) => "e".repeat(n)).join("\n\n");
  const uk = [375, 83, 35, 570, 147].map((n) => "u".repeat(n)).join("\n\n");
  const pair = previewBodies(en, uk, PREVIEW_LIMIT);
  assert.equal(pair.en!.split(/\n\s*\n/).length, 4);
  assert.equal(pair.uk!.split(/\n\s*\n/).length, 4);
});
