/**
 * Run with `npm test`. Covers the Posts lead (lib/post-lead.ts): which block
 * counts as the opening paragraph, and which embed counts as its picture.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAD_CHARS, firstImage, openingParagraph } from "./post-lead.ts";

test("skips headings, embeds, callouts, lists and bare links", () => {
  const md = [
    "## Heading",
    "",
    "![[cover.webp|Caption]]",
    "",
    "> [!note] A callout",
    "",
    "- a list",
    "",
    "https://music.apple.com/ca/album/x",
    "",
    "The **real** opening, with a [[Sapiens|link]] and [another](https://x.y).",
  ].join("\n");
  assert.equal(openingParagraph(md), "The real opening, with a link and another.");
});

test("a long opening is cut at a word, with an ellipsis", () => {
  const long = "word ".repeat(200).trim();
  const out = openingParagraph(long)!;
  assert.ok(out.endsWith("…"));
  assert.ok(out.length <= LEAD_CHARS + 1);
  assert.ok(!out.includes("wor…"));
});

test("a short hook takes the next paragraph, but not past a heading", () => {
  const md = "Short hook.\n\nSecond paragraph that carries on.\n\n## Next\n\nNot this.";
  assert.equal(openingParagraph(md), "Short hook. Second paragraph that carries on.");
});

test("no paragraph, no opening", () => {
  assert.equal(openingParagraph("## Only a heading\n\n![[x.png]]"), null);
});

test("the first picture, by either syntax, and never a note or a link", () => {
  assert.equal(firstImage("![[Some note]]\n![[war-newspaper-01.webp|Page 1]]"), "war-newspaper-01.webp");
  assert.equal(firstImage("![alt](attachments/My%20shot.png)"), "My shot.png");
  assert.equal(firstImage("![alt](https://example.com/x.png)"), null);
  assert.equal(firstImage("no pictures"), null);
});
