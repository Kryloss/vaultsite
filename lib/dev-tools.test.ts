import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_DEV_FIELDS,
  appendParagraphRange,
  blockSourceRange,
  completeWikiLink,
  countWords,
  createDevEditorState,
  devEditorChanges,
  devEditorDirty,
  devEditorReducer,
  indentLines,
  isDevToolsAvailable,
  joinRichShape,
  splitRichShape,
  publicPageUrl,
  findFactRow,
  replaceFactValue,
  sourceForLanguage,
  sourcePositionFor,
  spliceBlock,
  toggleLinePrefix,
  wikiLinkMatches,
  wikiLinkQuery,
  wrapSelection,
  type DevFields,
} from "./dev-tools.ts";

const fields: DevFields = {
  ...EMPTY_DEV_FIELDS,
  title: "Home",
  title_uk: "Головна",
  description: "English description",
  description_uk: "Український опис",
  body: "English **Markdown** body.",
  body_uk: "Українське **Markdown** тіло.",
};

test("developer tools require development and the exact localhost hostname", () => {
  assert.equal(isDevToolsAvailable("development", "localhost"), true);
  assert.equal(isDevToolsAvailable("production", "localhost"), false);
  assert.equal(isDevToolsAvailable("development", "127.0.0.1"), false);
  assert.equal(isDevToolsAvailable("development", "::1"), false);
  assert.equal(isDevToolsAvailable("development", "kryloss.com"), false);
});

test("public URL keeps the exact path, query and hash", () => {
  assert.equal(
    publicPageUrl("https://kryloss.com", {
      pathname: "/music/voiny-sveta",
      search: "?lang=uk",
      hash: "#review",
    }),
    "https://kryloss.com/music/voiny-sveta?lang=uk#review"
  );
  assert.equal(
    publicPageUrl("https://kryloss.com", {
      pathname: "/music/voiny-sveta",
      search: "",
      hash: "",
    }, "uk"),
    "https://kryloss.com/music/voiny-sveta?lang=uk"
  );
  assert.equal(
    publicPageUrl("https://kryloss.com", {
      pathname: "/music/voiny-sveta",
      search: "?lang=uk",
      hash: "",
    }, "en"),
    "https://kryloss.com/music/voiny-sveta"
  );
});

test("Ukrainian source uses its sibling and otherwise falls back", () => {
  assert.equal(
    sourceForLanguage("uk", "vault/Home/main.md", "vault/Home/main.uk.md"),
    "vault/Home/main.uk.md"
  );
  assert.equal(sourceForLanguage("uk", "vault/Home/main.md", undefined), "vault/Home/main.md");
  assert.equal(
    sourceForLanguage("en", "vault/Home/main.md", "vault/Home/main.uk.md"),
    "vault/Home/main.md"
  );
});

test("draft edit, undo, redo and cancel never write the baseline", () => {
  let state = createDevEditorState(fields, "rev-1");
  state = devEditorReducer(state, {
    type: "edit",
    key: "description",
    value: "Changed",
    record: true,
  });
  assert.equal(devEditorDirty(state), true);
  assert.deepEqual(devEditorChanges(state), { description: "Changed" });
  state = devEditorReducer(state, { type: "undo" });
  assert.equal(state.draft.description, fields.description);
  state = devEditorReducer(state, { type: "redo" });
  assert.equal(state.draft.description, "Changed");
  state = devEditorReducer(state, { type: "cancel" });
  assert.equal(devEditorDirty(state), false);
});

test("Markdown body edits share the same draft, history and change set", () => {
  let state = createDevEditorState(fields, "rev-1");
  state = devEditorReducer(state, {
    type: "edit",
    key: "body",
    value: "Changed body with [[a wiki link]].",
    record: true,
  });
  assert.deepEqual(devEditorChanges(state), {
    body: "Changed body with [[a wiki link]].",
  });
  state = devEditorReducer(state, { type: "undo" });
  assert.equal(state.draft.body, fields.body);
  state = devEditorReducer(state, { type: "redo" });
  assert.equal(state.draft.body, "Changed body with [[a wiki link]].");
});

test("a new edit clears redo and a saved edit can be prepared for reversal", () => {
  let state = createDevEditorState(fields, "rev-1");
  state = devEditorReducer(state, {
    type: "edit",
    key: "title",
    value: "Changed",
    record: true,
  });
  state = devEditorReducer(state, { type: "undo" });
  state = devEditorReducer(state, {
    type: "edit",
    key: "title",
    value: "Another",
    record: true,
  });
  assert.equal(state.future.length, 0);

  const savedFields = { ...fields, title: "Another" };
  state = devEditorReducer(state, { type: "saved", fields: savedFields, revision: "rev-2" });
  assert.equal(devEditorDirty(state), false);
  state = devEditorReducer(state, { type: "undo" });
  assert.equal(state.draft.title, "Home");
  assert.equal(devEditorDirty(state), true);
});

test("a soft-navigation draft can be restored without changing its baseline", () => {
  let state = createDevEditorState(fields, "rev-1");
  state = devEditorReducer(state, {
    type: "edit",
    key: "description",
    value: "Draft kept between pages",
    record: true,
  });
  const restored = devEditorReducer(createDevEditorState(fields, "rev-1"), {
    type: "restored",
    state,
  });
  assert.equal(restored.draft.description, "Draft kept between pages");
  assert.equal(restored.baseline.description, fields.description);
  assert.equal(devEditorDirty(restored), true);
});

test("an external rating save updates the revision without losing a draft", () => {
  let state = createDevEditorState(fields, "rev-1");
  state = devEditorReducer(state, {
    type: "edit",
    key: "title",
    value: "Draft title",
    record: true,
  });
  state = devEditorReducer(state, { type: "revision", revision: "rev-2" });
  assert.equal(state.revision, "rev-2");
  assert.equal(state.draft.title, "Draft title");
  assert.equal(devEditorDirty(state), true);
});

test("Tab inserts two spaces at a caret and indents or outdents selected lines", () => {
  assert.deepEqual(indentLines("ab", 1, 1, false), { value: "a  b", start: 3, end: 3 });
  const indented = indentLines("one\ntwo\nthree", 1, 6, false);
  assert.equal(indented.value, "  one\n  two\nthree");
  assert.deepEqual([indented.start, indented.end], [3, 10]);
  const outdented = indentLines(indented.value, indented.start, indented.end, true);
  assert.equal(outdented.value, "one\ntwo\nthree");
  assert.deepEqual([outdented.start, outdented.end], [1, 6]);
  // Outdenting an unindented line changes nothing and never moves before it.
  assert.deepEqual(indentLines("x", 0, 0, true), { value: "x", start: 0, end: 0 });
});

test("a wiki-link query is the open [[ the caret is inside", () => {
  assert.deepEqual(wikiLinkQuery("see [[Sec", 9), { start: 4, query: "Sec" });
  assert.deepEqual(wikiLinkQuery("see [[", 6), { start: 4, query: "" });
  assert.equal(wikiLinkQuery("see [[Done]] and", 16), null);
  assert.equal(wikiLinkQuery("see [[Target|lab", 16), null);
  assert.equal(wikiLinkQuery("see [[a\nb", 9), null);
  assert.equal(wikiLinkQuery("plain", 5), null);
  assert.deepEqual(completeWikiLink("see [[Sec here", 4, 9, "Security+"), {
    value: "see [[Security+]] here",
    caret: 17,
  });
  assert.deepEqual(completeWikiLink("see [[Sec]] here", 4, 9, "Security+"), {
    value: "see [[Security+]] here",
    caret: 17,
  });
});

test("wiki-link suggestions match either title, prefixes first, pages only", () => {
  const items = [
    { title: "Arcane", titleUk: "Аркейн" },
    { title: "Security+ journey", titleUk: "Шлях Security+" },
    { title: "Heading about Arcane", lang: "en" as const },
    { title: "My arcane hobby" },
  ];
  assert.deepEqual(wikiLinkMatches(items, "arc").map((item) => item.title), [
    "Arcane",
    "My arcane hobby",
  ]);
  assert.deepEqual(wikiLinkMatches(items, "арк").map((item) => item.title), ["Arcane"]);
  assert.equal(wikiLinkMatches(items, "").length, 3);
  assert.equal(wikiLinkMatches(items, "", 1).length, 1);
});

test("wrapping toggles delimiters and a caret gets a selected placeholder", () => {
  assert.deepEqual(wrapSelection("say hi now", 4, 6, "**", "**", "bold"), {
    value: "say **hi** now",
    start: 6,
    end: 8,
  });
  assert.deepEqual(wrapSelection("say **hi** now", 6, 8, "**", "**", "bold"), {
    value: "say hi now",
    start: 4,
    end: 6,
  });
  assert.deepEqual(wrapSelection("say ", 4, 4, "*", "*", "italic"), {
    value: "say *italic*",
    start: 5,
    end: 11,
  });
});

test("a line prefix is added to every touched line and removed when all have it", () => {
  const added = toggleLinePrefix("one\ntwo\nthree", 5, 9, "> ");
  assert.equal(added.value, "one\n> two\n> three");
  assert.deepEqual([added.start, added.end], [7, 13]);
  const removed = toggleLinePrefix(added.value, added.start, added.end, "> ");
  assert.equal(removed.value, "one\ntwo\nthree");
  assert.deepEqual([removed.start, removed.end], [5, 9]);
  assert.equal(toggleLinePrefix("## Title", 3, 3, "## ").value, "Title");
  assert.equal(toggleLinePrefix("a\n> b", 0, 4, "> ").value, "> a\n> b");
});

test("word count ignores fences and punctuation; source position finds a block", () => {
  assert.equal(countWords("# Hi\n\nOne **two** [[three]]\n\n```js\nlet a = 1;\n```\n"), 4);
  const md = "## Review\n\nThe *second* season is [[Arcane|better]] than\nthe first.\n";
  assert.equal(sourcePositionFor(md, "The second season is better than the first."), 11);
  assert.equal(sourcePositionFor(md, "Review"), 3);
  assert.equal(sourcePositionFor(md, "Review #"), 3, "a heading's anchor glyph is not in the source");
  const shelf = "See [[Attack on Titan]] and a pasted thing.\n\n## At a glance\n\nRow.\n";
  assert.equal(sourcePositionFor(shelf, "At a glance#"), 48, "whole words: 'At' is not 'Attack'");
  assert.equal(sourcePositionFor("## Відгук\n\nЧернетка тут.", "Чернетка тут."), 11);
  assert.equal(sourcePositionFor(md, "not in the note"), -1);
  assert.equal(sourcePositionFor(md, "   "), -1);
});

test("a rendered block maps back to its source lines by kind", () => {
  const body = [
    "## Review",
    "",
    "First para line one",
    "continues here.",
    "",
    "- item one",
    "- item two",
    "",
    "> [!note] Title",
    "> quoted line",
    "",
    "```js",
    "let a = 1;",
    "```",
    "",
    "| Key | Value |",
    "|---|---|",
    "| Aired | 2021 |",
    "",
  ].join("\n");
  const slice = (range: { start: number; end: number } | null) =>
    range ? body.slice(range.start, range.end) : null;
  assert.equal(slice(blockSourceRange(body, "line", "Review #")), "## Review");
  assert.equal(slice(blockSourceRange(body, "paragraph", "First para line one continues here.")), "First para line one\ncontinues here.");
  assert.equal(slice(blockSourceRange(body, "line", "item two")), "- item two");
  assert.equal(slice(blockSourceRange(body, "quote", "Title quoted line")), "> [!note] Title\n> quoted line");
  assert.equal(slice(blockSourceRange(body, "fence", "let a = 1;")), "```js\nlet a = 1;\n```");
  assert.equal(slice(blockSourceRange(body, "table", "Key Value Aired 2021")), "| Key | Value |\n|---|---|\n| Aired | 2021 |");
  assert.equal(blockSourceRange(body, "paragraph", "nowhere at all"), null);
  const edited = spliceBlock(body, 12, 47, "Replaced.");
  assert.equal(edited.body.slice(12, edited.end), "Replaced.");
  assert.deepEqual(appendParagraphRange("Text.\n"), { body: "Text.\n\n\n", start: 7, end: 7 });
  assert.deepEqual(appendParagraphRange(""), { body: "\n", start: 0, end: 0 });
});

test("a fact row is found by its label and its plain value can be replaced", () => {
  const body = "## At a glance\n\n| | |\n|---|---|\n| Aired | 2021–2024 |\n| One-liner | Two sisters, [[Arcane\\|one]] war |\n| Studio | Fortiche |\n\nText.\n";
  const studio = findFactRow(body, "Studio");
  assert.ok(studio && studio.plain);
  assert.equal(body.slice(studio!.start, studio!.end), "Fortiche");
  assert.equal(findFactRow(body, "one-liner")?.plain, false, "a value with a link is not plain");
  assert.equal(findFactRow(body, "Rating"), null);
  const next = replaceFactValue(body, "Aired ", "2021 | 2024\nthree seasons");
  assert.match(next!, /^\| Aired \| 2021 \\\| 2024 three seasons \|$/m);
  assert.equal(replaceFactValue(body, "Nope", "x"), null);
});

test("a block's syntax splits off its text and joins back exactly", () => {
  const cases: Array<[Parameters<typeof splitRichShape>[0], string]> = [
    ["line", "## A heading"],
    ["line", "- an item"],
    ["line", "3. numbered"],
    ["line", "- [x] done task"],
    ["line", "  - nested item"],
    ["paragraph", "Plain **text**\nover two lines."],
    ["quote", "> quoted\n> lines"],
    ["quote", "> [!tip] Title\n> body **x**\n>\n> second"],
  ];
  for (const [kind, source] of cases) {
    const shape = splitRichShape(kind, source);
    assert.ok(shape, source);
    assert.equal(joinRichShape(shape!, shape!.body), source, source);
  }
  assert.deepEqual(splitRichShape("quote", "> [!note] T\n> b"), { kind: "quote", header: "[!note] T", body: "b" });
  assert.deepEqual(splitRichShape("paragraph", "one\n  two\n\tthree"), { kind: "paragraph", body: "one\ntwo\nthree" });
  assert.deepEqual(splitRichShape("line", "- [ ] task"), { kind: "line", prefix: "- [ ] ", body: "task" });
  assert.equal(splitRichShape("line", "no marker"), null);
  assert.equal(splitRichShape("quote", "not > quoted"), null);
  assert.equal(splitRichShape("fence", "```\nx\n```"), null);
});
