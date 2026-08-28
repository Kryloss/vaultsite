import assert from "node:assert/strict";
import test from "node:test";
import {
  createDevEditorState,
  devEditorChanges,
  devEditorDirty,
  devEditorReducer,
  isDevToolsAvailable,
  publicPageUrl,
  sourceForLanguage,
  type DevFields,
} from "./dev-tools.ts";

const fields: DevFields = {
  title: "Home",
  title_uk: "Головна",
  description: "English description",
  description_uk: "Український опис",
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
