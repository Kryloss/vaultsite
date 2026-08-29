import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import matter from "gray-matter";
import {
  createEntry,
  createdEntrySlug,
  DevEditorError,
  patchFrontmatter,
  patchMarkdownBody,
  patchNowGoalBody,
  readDocument,
  readPageDocument,
  reorderDocuments,
  resolveVaultMarkdown,
  saveDocument,
  savePageDocument,
  toggleNowGoal,
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

test("patches contextual Draft, Series, part, and category options", () => {
  const next = patchFrontmatter(sample, {
    draft: true,
    categories: ["Cybersecurity", "New Type"],
    series: "Road to Security+",
    series_uk: "Шлях до Security+",
    part: 2,
  });
  const data = matter(next).data;
  assert.equal(data.draft, true);
  assert.deepEqual(data.categories, ["Cybersecurity", "New Type"]);
  assert.equal(data.series, "Road to Security+");
  assert.equal(data.series_uk, "Шлях до Security+");
  assert.equal(data.part, 2);
  assert.throws(
    () => patchFrontmatter(sample, { part: 0 }),
    (error) => error instanceof DevEditorError && error.code === "invalid_part"
  );
});

test("patches Markdown body without rewriting frontmatter bytes", () => {
  const next = patchMarkdownBody(sample, "# Direct edit\n\nKept as [[Markdown]].\n");
  const frontmatterEnd = sample.lastIndexOf("---\n") + 4;
  assert.equal(next.slice(0, frontmatterEnd), sample.slice(0, frontmatterEnd));
  assert.match(next, /# Direct edit\n\nKept as \[\[Markdown\]\]\.\n$/);
  assert.doesNotMatch(next, /Body with/);
  assert.throws(
    () => patchMarkdownBody(sample, "bad\0body"),
    (error) => error instanceof DevEditorError && error.code === "invalid_body"
  );

  const crlf = sample.replaceAll("\n", "\r\n");
  const crlfNext = patchMarkdownBody(crlf, "First\nSecond\n");
  assert.equal(crlfNext.replaceAll("\r\n", "").includes("\n"), false);
  assert.match(crlfNext, /First\r\nSecond\r\n$/);
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

test("option saves preserve a legacy Draft and normalize a singular category safely", async (t) => {
  const { root, file, source } = await fixture();
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const legacy = sample.replace(
    "description: One line.",
    "description: One line.\npublished: false\ncategory: Meta"
  );
  await fs.promises.writeFile(file, legacy);
  const opened = readDocument(root, source);
  assert.equal(opened.fields.draft, true);
  assert.deepEqual(opened.fields.categories, ["Meta"]);

  await saveDocument(root, {
    source,
    revision: opened.revision,
    changes: {
      draft: true,
      published: null,
      category: null,
      categories: ["Meta"],
    },
  });
  const saved = matter(await fs.promises.readFile(file, "utf8")).data;
  assert.equal(saved.draft, true);
  assert.equal(Object.hasOwn(saved, "published"), false);
  assert.equal(Object.hasOwn(saved, "category"), false);
  assert.deepEqual(saved.categories, ["Meta"]);
});

test("reads and atomically saves page metadata plus both Markdown bodies", async (t) => {
  const { root, file, source } = await fixture();
  const sourceUk = source.replace(/\.md$/, ".uk.md");
  const fileUk = file.replace(/\.md$/, ".uk.md");
  await fs.promises.writeFile(fileUk, "# Початок\n\nУкраїнське тіло.\n");
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const opened = await readPageDocument(root, source, sourceUk);
  assert.equal(opened.fields.body, "Body with [[Wiki links]] and *formatting*.\n");
  assert.equal(opened.fields.body_uk, "# Початок\n\nУкраїнське тіло.\n");
  assert.match(opened.revisionUk, /^[a-f0-9]{64}$/);

  const saved = await savePageDocument(root, {
    source,
    sourceUk,
    revision: opened.revision,
    revisionUk: opened.revisionUk,
    changes: {
      title: "Directly edited",
      body: "# New body\n\nA [[safe link]].\n",
      body_uk: "# Нове тіло\n\nБезпечний [[зв’язок]].\n",
    },
  });
  assert.equal(saved.fields.title, "Directly edited");
  assert.equal(saved.fields.body, "# New body\n\nA [[safe link]].\n");
  assert.equal(saved.fields.body_uk, "# Нове тіло\n\nБезпечний [[зв’язок]].\n");
  assert.match(await fs.promises.readFile(file, "utf8"), /^title: Directly edited$/m);
  assert.match(await fs.promises.readFile(file, "utf8"), /# New body\n\nA \[\[safe link\]\]\.\n$/);
  assert.equal(await fs.promises.readFile(fileUk, "utf8"), "# Нове тіло\n\nБезпечний [[зв’язок]].\n");
});

test("page saves reject a stale translation and unrelated translated source", async (t) => {
  const { root, file, source } = await fixture();
  const sourceUk = source.replace(/\.md$/, ".uk.md");
  const fileUk = file.replace(/\.md$/, ".uk.md");
  await fs.promises.writeFile(fileUk, "Українське тіло.\n");
  await fs.promises.writeFile(path.join(path.dirname(file), "Other.uk.md"), "Інше.\n");
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  await assert.rejects(
    readPageDocument(root, source, "vault/Posts/Other.uk.md"),
    (error) => error instanceof DevEditorError && error.code === "bad_translation"
  );

  const opened = await readPageDocument(root, source, sourceUk);
  await fs.promises.appendFile(fileUk, "Obsidian changed this.\n");
  await assert.rejects(
    savePageDocument(root, {
      source,
      sourceUk,
      revision: opened.revision,
      revisionUk: opened.revisionUk,
      changes: { body: "A stale edit.\n" },
    }),
    (error) => error instanceof DevEditorError && error.code === "revision_conflict"
  );
  assert.equal(await fs.promises.readFile(file, "utf8"), sample);
});

test("creates bilingual draft scaffolds for every supported section type", async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vault-editor-create-"));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const sections = [
    ["Posts", "posts"],
    ["Music", "music"],
    ["People", "people"],
    ["Shelf", "shelf"],
    ["Projects", "projects"],
  ];
  for (const [dir, type] of sections) {
    await fs.promises.mkdir(path.join(root, "vault", dir), { recursive: true });
    await fs.promises.writeFile(
      path.join(root, "vault", dir, "main.md"),
      `---\ntitle: ${dir}\ntype: ${type}\n---\n`
    );
  }
  for (const folder of ["Books", "Movies", "Shows", "Videos"]) {
    await fs.promises.mkdir(path.join(root, "vault", "Shelf", folder));
  }

  const common = {
    titleUk: "Українська назва",
    description: "A concise description.",
    descriptionUk: "Стислий опис.",
  };
  const cases = [
    { section: "Posts", title: "New Post", categories: ["Meta"] },
    {
      section: "Music",
      title: "New Record",
      creator: "Example Artist",
      format: "album",
      lang: "uk",
      genres: ["Alternative"],
    },
    { section: "People", title: "New Person", categories: ["Ukraine"] },
    { section: "Shelf", title: "New Film", creator: "Example Director", medium: "movie" },
    { section: "Projects", title: "New Project" },
  ];
  for (const entry of cases) {
    const created = await createEntry(root, {
      sectionSource: `vault/${entry.section}/main.md`,
      ...common,
      ...entry,
    });
    assert.equal(created.pathname, `/${entry.section.toLowerCase()}/${createdEntrySlug(entry.title)}`);
    assert.equal(created.fields.title, entry.title);
    assert.equal(created.fields.title_uk, common.titleUk);
    assert.match(created.fields.body, /To be written/);
    assert.match(created.fields.body_uk, /Треба написати/);
    const raw = await fs.promises.readFile(path.join(root, created.source), "utf8");
    assert.equal(matter(raw).data.draft, true);
    assert.equal(fs.existsSync(path.join(root, created.sourceUk)), true);
  }
  assert.equal(fs.existsSync(path.join(root, "vault", "Shelf", "Movies", "New Film.md")), true);
  const music = matter(
    await fs.promises.readFile(path.join(root, "vault", "Music", "New Record.md"), "utf8")
  ).data;
  assert.equal(music.lang, "uk");
  assert.deepEqual(music.genres, ["Alternative"]);

  await assert.rejects(
    createEntry(root, {
      sectionSource: "vault/Posts/main.md",
      ...common,
      title: "New Post",
    }),
    (error) => error instanceof DevEditorError && error.code === "entry_exists"
  );
  await assert.rejects(
    createEntry(root, {
      sectionSource: "vault/Music/main.md",
      ...common,
      title: "Wrong Music Shelf",
      creator: "Example Artist",
      format: "album",
      lang: "fr",
    }),
    (error) => error instanceof DevEditorError && error.code === "invalid_music_lang"
  );
});

test("toggles one Now goal in both languages and rejects a stale rendered label", async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vault-editor-now-"));
  const dir = path.join(root, "vault", "Now");
  await fs.promises.mkdir(dir, { recursive: true });
  const source = "vault/Now/main.md";
  const sourceUk = "vault/Now/main.uk.md";
  const file = path.join(root, source);
  const fileUk = path.join(root, sourceUk);
  await fs.promises.writeFile(
    file,
    "---\ntitle: Now\ntype: now\n---\n## Goals\n\n- [ ] First goal\n- [x] Second goal → [[Post]]\n\n## Résumé\n"
  );
  await fs.promises.writeFile(
    fileUk,
    "## Цілі\n\n- [ ] Перша ціль\n- [x] Друга ціль → [[Post]]\n\n## Резюме\n"
  );
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  assert.match(patchNowGoalBody("## Goals\n- [ ] One\n", 0, true, "One"), /- \[x\] One/);
  const saved = await toggleNowGoal(root, {
    source,
    sourceUk,
    index: 1,
    done: false,
    expectedLabel: "Second goal",
  });
  assert.match(await fs.promises.readFile(file, "utf8"), /- \[ \] Second goal/);
  assert.match(await fs.promises.readFile(fileUk, "utf8"), /- \[ \] Друга ціль/);
  assert.equal(saved.fields.body.includes("[ ] Second goal"), true);

  await assert.rejects(
    toggleNowGoal(root, {
      source,
      sourceUk,
      index: 1,
      done: true,
      expectedLabel: "A different goal",
    }),
    (error) => error instanceof DevEditorError && error.code === "revision_conflict"
  );
  await assert.rejects(
    toggleNowGoal(root, { source, sourceUk, index: 0, done: true }),
    (error) => error instanceof DevEditorError && error.code === "invalid_goal"
  );
});
