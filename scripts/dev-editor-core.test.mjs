import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import matter from "gray-matter";
import {
  DevEditorError,
  patchFrontmatter,
  readDocument,
  reorderDocuments,
  resolveVaultMarkdown,
  saveDocument,
} from "./dev-editor-core.mjs";

const sample = `---
title: Original
title_uk: Оригінал
# Keep this comment exactly here.
date: 2026-08-28
description: One line.
artists:
  - name: Example
    bio: >-
      Nested YAML must not move.
---
Body with [[Wiki links]] and *formatting*.
`;

test("patches supported scalars without rewriting unrelated YAML or Markdown", () => {
  const next = patchFrontmatter(sample, {
    title: "Changed: safely",
    description_uk: "Опис",
  });
  assert.match(next, /^title: "Changed: safely"$/m);
  assert.match(next, /^description_uk: Опис$/m);
  assert.match(next, /# Keep this comment exactly here\.\ndate:/);
  assert.match(next, /artists:\n  - name: Example\n    bio: >-\n      Nested YAML must not move\./);
  assert.match(next, /Body with \[\[Wiki links\]\] and \*formatting\*\./);
});

test("replaces a block scalar without swallowing the next comment or key", () => {
  const source = `---
title: Note
description: >-
  First line.
  Second line.
# cover credit stays
cover: note.jpg
---
Body
`;
  const next = patchFrontmatter(source, { description: "Replacement" });
  assert.match(next, /description: Replacement\n# cover credit stays\ncover: note\.jpg/);
  assert.doesNotMatch(next, /First line/);
});

test("preserves an editable field's trailing YAML comment", () => {
  const source = sample.replace("description: One line.", "description: One line. # keep me");
  const next = patchFrontmatter(source, { description: "Changed # safely" });
  assert.match(next, /^description: "Changed # safely" # keep me$/m);
});

test("preserves multiline text exactly and can remove optional fields", () => {
  const multiline = patchFrontmatter(sample, { description: "Line one\nLine two" });
  assert.match(multiline, /description: "Line one\\nLine two"/);
  assert.equal(matter(multiline).data.description, "Line one\nLine two");
  const removed = patchFrontmatter(multiline, { description: "" });
  assert.doesNotMatch(removed, /^description:/m);
});

test("rejects unsupported fields and an empty English title", () => {
  assert.throws(
    () => patchFrontmatter(sample, { slug: "changed" }),
    (error) => error instanceof DevEditorError && error.code === "unsupported_field"
  );
  assert.throws(
    () => patchFrontmatter(sample, { title: " " }),
    (error) => error instanceof DevEditorError && error.code === "empty_title"
  );
  assert.throws(
    () => patchFrontmatter(sample, { title: "Two\nlines" }),
    (error) => error instanceof DevEditorError && error.code === "multiline_title"
  );
  assert.throws(
    () => patchFrontmatter(sample, { title_uk: "Два\nрядки" }),
    (error) => error instanceof DevEditorError && error.code === "multiline_title"
  );
  assert.throws(
    () => patchFrontmatter(sample, { rating: 4.3 }),
    (error) => error instanceof DevEditorError && error.code === "invalid_rating"
  );
  assert.throws(
    () => patchFrontmatter(sample, { rating: 5.5 }),
    (error) => error instanceof DevEditorError && error.code === "invalid_rating"
  );
  assert.throws(
    () => patchFrontmatter(sample, { top_order: 1.5 }),
    (error) => error instanceof DevEditorError && error.code === "invalid_top_order"
  );
});

test("patches a half-star rating without rewriting the body", () => {
  const next = patchFrontmatter(sample, { rating: 4.5 });
  assert.match(next, /^rating: 4\.5$/m);
  assert.match(next, /Body with \[\[Wiki links\]\] and \*formatting\*\./);
  assert.equal(matter(next).data.rating, 4.5);
});

test("preserves BOM, CRLF, nested keys, and rejects duplicate editable keys", () => {
  const source =
    "\uFEFF---\r\n" +
    "title: Original\r\n" +
    "description: Before.\r\n" +
    "artists:\r\n" +
    "  - title: Nested title\r\n" +
    "---\r\n" +
    "Body\r\n";
  const next = patchFrontmatter(source, { title: "Змінено: safely #1" });
  assert.equal(next.startsWith("\uFEFF---\r\n"), true);
  assert.equal(next.replaceAll("\r\n", "").includes("\n"), false);
  assert.match(next, /  - title: Nested title\r\n/);
  assert.equal(matter(next).data.title, "Змінено: safely #1");

  assert.throws(
    () => patchFrontmatter(sample.replace("title_uk: Оригінал", "title: Duplicate"), {
      title: "Changed",
    }),
    (error) => error instanceof DevEditorError && error.code === "duplicate_field"
  );
});

async function fixture() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vault-editor-"));
  await fs.promises.mkdir(path.join(root, "vault", "Posts"), { recursive: true });
  const file = path.join(root, "vault", "Posts", "Note.md");
  await fs.promises.writeFile(file, sample);
  return { root, file, source: "vault/Posts/Note.md" };
}

test("resolves only existing Markdown files inside vault", async (t) => {
  const { root, file, source } = await fixture();
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  assert.equal(resolveVaultMarkdown(root, source), fs.realpathSync(file));
  assert.throws(() => resolveVaultMarkdown(root, "vault/../package.json"));
  assert.throws(() => resolveVaultMarkdown(root, "vault/Posts/../Posts/Note.md"));
  assert.throws(() => resolveVaultMarkdown(root, "/etc/passwd"));

  const outside = path.join(root, "outside.md");
  await fs.promises.writeFile(outside, sample);
  await fs.promises.symlink(outside, path.join(root, "vault", "Posts", "Escape.md"));
  assert.throws(() => resolveVaultMarkdown(root, "vault/Posts/Escape.md"));
});

test("saves atomically and refuses to overwrite a newer Obsidian edit", async (t) => {
  const { root, file, source } = await fixture();
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const opened = readDocument(root, source);
  assert.match(opened.obsidian.en, /^obsidian:\/\/open\?path=/);
  assert.equal(opened.obsidian.uk, opened.obsidian.en);
  const saved = await saveDocument(root, {
    source,
    revision: opened.revision,
    changes: { description: "Edited locally.", rating: 4.5 },
  });
  assert.equal(saved.fields.description, "Edited locally.");
  assert.equal(saved.fields.rating, 4.5);
  assert.match(await fs.promises.readFile(file, "utf8"), /description: Edited locally\./);

  await fs.promises.appendFile(file, "\nObsidian changed this.\n");
  await assert.rejects(
    saveDocument(root, {
      source,
      revision: saved.revision,
      changes: { description: "Stale overwrite" },
    }),
    (error) => error instanceof DevEditorError && error.code === "revision_conflict"
  );
});

test("reorders several notes with one conflict-checked operation", async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vault-editor-order-"));
  const dir = path.join(root, "vault", "Shelf", "Movies");
  await fs.promises.mkdir(dir, { recursive: true });
  const a = path.join(dir, "A.md");
  const b = path.join(dir, "B.md");
  const sourceA = "vault/Shelf/Movies/A.md";
  const sourceB = "vault/Shelf/Movies/B.md";
  await fs.promises.writeFile(a, sample.replace("Original", "A"));
  await fs.promises.writeFile(b, sample.replace("Original", "B"));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const saved = await reorderDocuments(root, {
    items: [
      { source: sourceA, order: 1 },
      { source: sourceB, order: 0 },
    ],
  });
  assert.deepEqual(
    saved.documents.map((document) => [document.source, document.fields.top_order]),
    [
      [sourceA, 1],
      [sourceB, 0],
    ]
  );
  assert.match(await fs.promises.readFile(a, "utf8"), /^top_order: 1$/m);
  assert.match(await fs.promises.readFile(b, "utf8"), /^top_order: 0$/m);

  await fs.promises.appendFile(a, "\nObsidian changed this.\n");
  const repeated = await reorderDocuments(root, {
    items: [
      { source: sourceA, order: 0 },
      { source: sourceB, order: 1 },
    ],
  });
  assert.equal(repeated.documents[0].fields.top_order, 0);
  assert.match(await fs.promises.readFile(a, "utf8"), /Obsidian changed this\./);
  assert.match(await fs.promises.readFile(b, "utf8"), /^top_order: 1$/m);
});

test("a semantic no-op preserves bytes and opens an existing Ukrainian sibling", async (t) => {
  const { root, file, source } = await fixture();
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const quoted = sample.replace("description: One line.", "description: 'One line.'");
  await fs.promises.writeFile(file, quoted);
  await fs.promises.writeFile(file.replace(/\.md$/, ".uk.md"), "Українське тіло.\n");
  const opened = readDocument(root, source);
  assert.notEqual(opened.obsidian.uk, opened.obsidian.en);
  assert.match(opened.obsidian.uk, /Note\.uk\.md$/);

  const saved = await saveDocument(root, {
    source,
    revision: opened.revision,
    changes: { description: "One line." },
  });
  assert.equal(saved.revision, opened.revision);
  assert.equal(await fs.promises.readFile(file, "utf8"), quoted);
  await assert.rejects(
    saveDocument(root, {
      source,
      revision: saved.revision,
      changes: { slug: "not-allowed" },
    }),
    (error) => error instanceof DevEditorError && error.code === "unsupported_field"
  );
});
