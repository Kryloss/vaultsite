import assert from "node:assert/strict";
import test from "node:test";
import {
  completeWikiLink,
  createDevEditorState,
  devEditorChanges,
  devEditorDirty,
  devEditorReducer,
  indentLines,
  isDevToolsAvailable,
  publicPageUrl,
  sourceForLanguage,
  wikiLinkMatches,
  wikiLinkQuery,
  type DevFields,
} from "./dev-tools.ts";

const fields: DevFields = {
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
