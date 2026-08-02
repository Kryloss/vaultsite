import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "./markdown";

test("image note pairs a bilingual diagram with its source photo", async () => {
  const html = await renderMarkdown(
    `![[image-note-life-timeline.svg|My path so far :: Мій шлях дотепер]]
<!-- image-note: image-note-life-timeline.jpeg -->`,
    "Posts/attachments",
    "posts",
    { idPrefix: "en-" }
  );

  assert.match(html, /<figure class="image-note">/);
  assert.match(html, /class="image-note-radio image-note-radio-diagram"/);
  assert.match(html, /class="image-note-radio image-note-radio-original"/);
  assert.match(html, /name="en-image-note-1-image-note-life-timeline-view"/);
  assert.match(html, /<svg id="d-image-note-life-timeline" class="diagram"/);
  assert.match(html, /<svg id="d-image-note-life-timeline-uk" class="diagram"/);
  assert.match(
    html,
    /src="\/vault-assets\/Posts\/attachments\/image-note-life-timeline\.jpeg"/
  );
  assert.match(html, /My path so far/);
  assert.match(html, /Мій шлях дотепер/);
  assert.doesNotMatch(html, /<!--\s*image-note:/);
  assert.equal(html.match(/<figure\b/g)?.length, 1);
  assert.equal(html.match(/<\/figure>/g)?.length, 1);
});

test("image note controls are namespaced per rendered language body", async () => {
  const source = `![[image-note-life-timeline.svg]]
<!-- image-note: image-note-life-timeline.jpeg -->`;
  const [en, uk] = await Promise.all([
    renderMarkdown(source, "Posts/attachments", "posts", { idPrefix: "en-" }),
    renderMarkdown(source, "Posts/attachments", "posts", { idPrefix: "uk-" }),
  ]);

  assert.match(en, /id="en-image-note-1-image-note-life-timeline-diagram"/);
  assert.match(uk, /id="uk-image-note-1-image-note-life-timeline-diagram"/);
});
