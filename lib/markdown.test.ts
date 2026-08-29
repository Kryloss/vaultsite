import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, renderWithHeadings } from "./markdown";

/*
 * The image-note tests below render against REAL vault assets, because
 * `renderMarkdown` resolves embeds through the vault-wide asset index and reads
 * dimensions from the build's image manifest — there is no tmpdir to point it at.
 *
 * The pair used here is deliberately mismatched: `rendering-pipeline.svg` is
 * 760x540 and `me.jpeg` is square, so it is NOT a shape the validator would
 * accept (`compareGeometry` allows 2%). No pair in the vault would be — every
 * diagram is landscape, every photo is square or portrait — and inventing one
 * would mean adding a file to the owner's vault, which publishes.
 *
 * That split is the point, and it is load-bearing rather than a compromise:
 *   - what a VALID image note is  → scripts/validate-image-notes.test.mjs,
 *     which builds matched fixtures in a tmpdir and owns every geometry,
 *     privacy, safety and bilingual rule.
 *   - what the renderer EMITS for one → here.
 * The renderer deliberately does not check geometry, so a mismatched pair is a
 * legitimate input to it. Do not "fix" this by relaxing the validator.
 */

test("renderer pairs a bilingual diagram with its source photo", async () => {
  const html = await renderMarkdown(
    `![[rendering-pipeline.svg|Rendering pipeline :: Конвеєр рендерингу]]
<!-- image-note: me.jpeg -->`,
    "Posts/attachments",
    "posts",
    { idPrefix: "en-" }
  );

  assert.match(html, /<figure class="image-note">/);
  assert.match(html, /class="image-note-radio image-note-radio-diagram"/);
  assert.match(html, /class="image-note-radio image-note-radio-original"/);
  assert.match(html, /name="en-image-note-1-rendering-pipeline-view"/);
  assert.match(html, /<svg id="d-rendering-pipeline" class="diagram"/);
  assert.match(html, /<svg id="d-rendering-pipeline-uk" class="diagram"/);
  assert.match(html, /src="\/vault-assets\/Home\/me\.jpeg"/);
  // The stage is reserved from the PHOTO's dimensions, never the diagram's, so
  // that flipping the switch cannot reflow the article. The 760x540 diagram
  // above proves the diagram's own viewBox gets no say here.
  assert.match(html, /--image-note-aspect: 1218 \/ 1218/);
  assert.match(html, /width="1218" height="1218"/);
  assert.doesNotMatch(html, /--image-note-aspect: 760 \/ 540/);
  assert.match(html, /Rendering pipeline/);
  assert.match(html, /Конвеєр рендерингу/);
  assert.doesNotMatch(html, /<!--\s*image-note:/);
  assert.equal(html.match(/<figure\b/g)?.length, 1);
  assert.equal(html.match(/<\/figure>/g)?.length, 1);
});

test("the source photo is served at the size it is actually painted", async () => {
  const html = await renderMarkdown(
    `![[rendering-pipeline.svg|Rendering pipeline :: Конвеєр рендерингу]]
<!-- image-note: me.jpeg -->`,
    "Posts/attachments",
    "posts",
    { idPrefix: "en-" }
  );

  // The intrinsic width/height reserve the stage; they are NOT the painted box.
  // Reading them as one handed the browser sizes="1218px" and it fetched the
  // largest source every time the reader switched to the original.
  assert.match(html, /srcset="[^"]*me-672w\.webp 672w/);
  assert.match(html, /sizes="\(max-width: 42rem\) 100vw, 672px"/);
  assert.doesNotMatch(html, /sizes="1218px"/);
});

test("image note controls are namespaced per rendered language body", async () => {
  const source = `![[rendering-pipeline.svg]]
<!-- image-note: me.jpeg -->`;
  const [en, uk] = await Promise.all([
    renderMarkdown(source, "Posts/attachments", "posts", { idPrefix: "en-" }),
    renderMarkdown(source, "Posts/attachments", "posts", { idPrefix: "uk-" }),
  ]);

  assert.match(en, /id="en-image-note-1-rendering-pipeline-diagram"/);
  assert.match(uk, /id="uk-image-note-1-rendering-pipeline-diagram"/);
});

test("[!pull] becomes a margin pull-quote, not a callout", async () => {
  const html = await renderMarkdown(
    "> [!pull] Kramatorsk, 2007\n> The plan from here: Cyber Science at TMU.",
    "Posts",
    "posts"
  );

  assert.match(html, /<aside class="pullquote">/);
  // The body is still markdown, so it comes through as a paragraph.
  assert.match(html, /<p>The plan from here: Cyber Science at TMU\.<\/p>/);
  // The callout's title becomes the attribution — and ONLY when one is given.
  assert.match(html, /<p class="pullquote-cite">Kramatorsk, 2007<\/p>/);
  // Not a callout: no `.callout` wrapper, and no generated "Pull" title.
  assert.doesNotMatch(html, /class="callout"/);
  assert.doesNotMatch(html, /callout-title/);
});

test("a pull-quote with no title has no attribution line", async () => {
  const html = await renderMarkdown("> [!pull]\n> Just the line.", "Posts", "posts");
  assert.match(html, /<aside class="pullquote">/);
  assert.doesNotMatch(html, /pullquote-cite/);
  // Specifically not the callout fallback, which would title this "Pull".
  assert.doesNotMatch(html, /Pull/);
});

test("ordinary callouts and blockquotes are untouched by the pull-quote pass", async () => {
  const html = await renderMarkdown(
    "> [!note] A note\n> Body.\n\n> An ordinary quote.",
    "Posts",
    "posts"
  );
  assert.match(html, /<div class="callout" data-callout="note">/);
  assert.match(html, /<p class="callout-title">A note<\/p>/);
  assert.match(html, /<blockquote>\s*<p>An ordinary quote\.<\/p>\s*<\/blockquote>/);
  assert.doesNotMatch(html, /pullquote/);
});

test("a spoiler can be hidden again: its title labels the same checkbox", async () => {
  const html = await renderMarkdown(
    "> [!spoiler] How the film ends\n> He was dead the whole time.",
    "Posts",
    "posts"
  );
  const id = html.match(/<input type="checkbox" id="([^"]+)" class="spoiler-toggle"/)?.[1];
  assert.ok(id, "spoiler emits a toggle");
  // Two labels for one checkbox: the cover reveals, the title puts it back —
  // the cover is gone once revealed, so without the title there is no way out.
  assert.match(html, new RegExp(`<label for="${id}" class="callout-title spoiler-title"`));
  assert.match(html, new RegExp(`<label for="${id}" class="spoiler-cover"`));
});

test("the spoiler title carries a localised hide affordance", async () => {
  const en = await renderMarkdown("> [!spoiler] Ending\n> Text.", "Posts", "posts");
  assert.match(en, /class="callout-title spoiler-title" data-hide="Hide"/);
});

/*
 * Fact tables. Obsidian can't write a headerless table, so this vault leaves
 * the header cells empty — and that shape is the "At a glance" block on a
 * shelf note. Two things have to hold: it is told apart from a real data
 * table (which keeps the card treatment), and it is OPT-IN, because only
 * shelf entry pages ask for it. A People note writes the same `| | |` shape
 * and must be unaffected.
 */

const FACTS = `| | |
|---|---|
| Published | 2011 |
| Read | July 2026 |`;

test("a headerless table is tagged as a fact list and loses its empty thead", async () => {
  const html = await renderMarkdown(FACTS, "Shelf/Books", "shelf", {
    factTables: true,
  });
  assert.match(html, /<table class="fact-table">/);
  assert.doesNotMatch(html, /<thead>/);
  assert.match(html, /<td>Published<\/td>/);
});

test("without the flag the same table is untouched — People keeps its card", async () => {
  const html = await renderMarkdown(FACTS, "People", "people");
  assert.doesNotMatch(html, /fact-table/);
  // The empty header row is still in the HTML; CSS hides it, as it always did.
  assert.match(html, /<thead>/);
});

test("a table with real headers is left alone even on a shelf note", async () => {
  const html = await renderMarkdown(
    `| Syntax | Result |
|---|---|
| \`code\` | code |`,
    "Shelf/Books",
    "shelf",
    { factTables: true }
  );
  assert.doesNotMatch(html, /fact-table/);
  assert.match(html, /<thead>/);
});

test("one filled header cell is enough to keep the header", async () => {
  const html = await renderMarkdown(
    `| | Result |
|---|---|
| a | b |`,
    "Shelf/Books",
    "shelf",
    { factTables: true }
  );
  assert.doesNotMatch(html, /fact-table/);
  assert.match(html, /<thead>/);
});

test("a rating becomes a row of the fact list, labelled and last", async () => {
  const html = await renderMarkdown(FACTS, "Shelf/Books", "shelf", {
    factTables: true,
    rating: 4.5,
    ratingLabel: "Оцінка",
  });
  assert.match(html, /<td>Оцінка<\/td>/);
  // Last row: nothing from the note's own table follows it.
  assert.ok(html.indexOf("Оцінка") > html.indexOf("Read"));
  // Half star = a 90% clip on the nested svg — see lib/stars.ts.
  assert.match(html, /width="90%"/);
});

test("no rating means no extra row", async () => {
  const html = await renderMarkdown(FACTS, "Shelf/Books", "shelf", {
    factTables: true,
  });
  assert.doesNotMatch(html, /Rating|Оцінка/);
  assert.doesNotMatch(html, /<svg/);
});

/*
 * The heading over a fact block is hidden but NOT removed — it is what the
 * table of contents lists and what `#at-a-glance` scrolls to. Deleting it
 * from the markdown is what shipped first, and it took the row out of the
 * outline too. This half runs on every section, shelf or not.
 */

const HEADED = `## At a glance\n\n${FACTS}`;

test("the heading over a fact block is tagged for hiding, not deleted", async () => {
  const html = await renderMarkdown(HEADED, "Shelf/Books", "shelf", {
    factTables: true,
  });
  assert.match(html, /<h2[^>]*class="[^"]*fact-heading/);
  assert.match(html, /At a glance/);
  assert.match(html, /id="at-a-glance"/);
});

test("the heading is hidden on non-shelf sections too, card and all", async () => {
  const html = await renderMarkdown(HEADED, "People", "people");
  assert.match(html, /<h2[^>]*class="[^"]*fact-heading/);
  // ...but the table itself keeps the card treatment (DECISIONS #87).
  assert.doesNotMatch(html, /fact-table/);
  assert.match(html, /<thead>/);
});

test("a heading over a REAL data table is left visible", async () => {
  const html = await renderMarkdown(
    `## Results\n\n| Syntax | Result |\n|---|---|\n| a | b |`,
    "Posts",
    "posts"
  );
  assert.doesNotMatch(html, /fact-heading/);
});

/*
 * Lifting the fact list out of the body (DECISIONS #120). The page needs it as
 * a sibling of the poster and the creator, and gets it back as its own string;
 * what stays behind is the article WITHOUT it — heading and anchor included,
 * since those belong to the outline.
 */

test("liftFacts hands the fact table back separately and takes it out of the body", async () => {
  const { html, factsHtml } = await renderWithHeadings(
    HEADED,
    "Shelf/Books",
    "shelf",
    { factTables: true, liftFacts: true, rating: 5, ratingLabel: "Rating" }
  );
  assert.doesNotMatch(html, /fact-table/);
  assert.doesNotMatch(html, /<td>Published<\/td>/);
  assert.match(factsHtml ?? "", /^<table class="fact-table">/);
  assert.match(factsHtml ?? "", /<td>Published<\/td>/);
  // The rating row rides with it — it is appended before the lift runs.
  assert.match(factsHtml ?? "", /Rating/);
  // The heading stays in the article: it holds the ToC row and the anchor.
  assert.match(html, /<h2[^>]*class="[^"]*fact-heading/);
  assert.match(html, /id="at-a-glance"/);
});

test("without liftFacts the table stays in the body and nothing is returned", async () => {
  const { html, factsHtml } = await renderWithHeadings(
    HEADED,
    "Shelf/Books",
    "shelf",
    { factTables: true }
  );
  assert.match(html, /<table class="fact-table">/);
  assert.equal(factsHtml, undefined);
});

test("liftFacts leaves a real data table alone — there is nothing to lift", async () => {
  const { html, factsHtml } = await renderWithHeadings(
    `## Results\n\n| Syntax | Result |\n|---|---|\n| a | b |`,
    "Shelf/Books",
    "shelf",
    { factTables: true, liftFacts: true }
  );
  assert.match(html, /<table>/);
  assert.equal(factsHtml, undefined);
});

test("liftFacts works on a People note too — card kept, block still travels", async () => {
  const { html, factsHtml } = await renderWithHeadings(HEADED, "People", "people", {
    liftFacts: true,
  });
  // Not the shelf's plain list: no `fact-table` class, header row intact —
  // the card is what a People note keeps (DECISIONS #87).
  assert.doesNotMatch(factsHtml ?? "", /fact-table/);
  assert.match(factsHtml ?? "", /<thead>/);
  assert.match(factsHtml ?? "", /<td>Published<\/td>/);
  // ...and it has left the body, heading and anchor behind.
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /id="at-a-glance"/);
});
