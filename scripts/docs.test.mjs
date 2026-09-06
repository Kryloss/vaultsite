// The two agent entry files are indexes into docs/. This pins three things
// that used to drift silently: every file they route to exists, they route to
// the SAME set (the "keep CLAUDE.md and AGENTS.md in step" rule, made
// mechanical), and every `DECISIONS #N` reference anywhere in the repo still
// resolves to a heading — the decision log keeps a one-line tombstone for
// removed entries precisely so this holds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");

function docsRoutedFrom(file) {
  const refs = new Set();
  for (const m of read(file).matchAll(/`?(docs\/[A-Z0-9-]+\.md)`?/g)) refs.add(m[1]);
  return refs;
}

test("every docs file the entry points route to exists", () => {
  for (const file of ["CLAUDE.md", "AGENTS.md"]) {
    for (const ref of docsRoutedFrom(file)) {
      assert.ok(existsSync(join(ROOT, ref)), `${file} routes to missing ${ref}`);
    }
  }
});

test("CLAUDE.md and AGENTS.md route to the same set of docs", () => {
  const a = [...docsRoutedFrom("CLAUDE.md")].sort();
  const b = [...docsRoutedFrom("AGENTS.md")].sort();
  assert.deepEqual(a, b);
});

test("every topic file in docs/ is routed to by the entry points", () => {
  const listed = docsRoutedFrom("CLAUDE.md");
  const onDisk = readdirSync(join(ROOT, "docs"))
    .filter((f) => /^[A-Z0-9-]+\.md$/.test(f))
    .map((f) => `docs/${f}`);
  for (const f of onDisk) assert.ok(listed.has(f), `${f} is not in CLAUDE.md's routing table`);
});

test("the shared body of CLAUDE.md and AGENTS.md is byte-identical", () => {
  const marker = "<!-- shared:";
  const body = (f) => {
    const t = read(f);
    const i = t.indexOf(marker);
    assert.ok(i >= 0, `${f} has no shared-body marker`);
    return t.slice(i);
  };
  assert.equal(body("CLAUDE.md"), body("AGENTS.md"));
});

function decisionHeadings() {
  const nums = new Set();
  for (const m of read("docs/DECISIONS.md").matchAll(/^## (\d+)\. /gm)) nums.add(Number(m[1]));
  return nums;
}

function* walk(dir, skip) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(ROOT, p);
    if (skip.some((s) => rel === s || rel.startsWith(s + "/"))) continue;
    if (statSync(p).isDirectory()) yield* walk(p, skip);
    else yield rel;
  }
}

test("every DECISIONS #N reference resolves to a heading", () => {
  const headings = decisionHeadings();
  const missing = [];
  const skip = ["node_modules", ".next", ".git", "public", "_to_delete", ".obsidian", ".trash", ".claude"];
  for (const rel of walk(ROOT, skip)) {
    if (!/\.(md|ts|tsx|mjs|css|py)$/.test(rel)) continue;
    const text = readFileSync(join(ROOT, rel), "utf8");
    const bareOk = /^(docs\/[A-Z-]+\.md|CLAUDE\.md|AGENTS\.md)$/.test(rel);
    // Qualified form anywhere: "DECISIONS.md #12", "decision #12", "DECISIONS #12, #13".
    // Bare "#12" only inside the docs, where nothing else uses a hash + number.
    const re = bareOk
      ? /(?<![0-9a-fA-F&\w])#(\d{1,3})(?![0-9a-fA-F\w-])/g
      : /(?:DECISIONS(?:\.md)?|[Dd]ecisions?)[^\n#]{0,40}?#(\d{1,3})(?![0-9a-fA-F\w-])((?:,? ?(?:and )?#\d{1,3})*)/g;
    for (const m of text.matchAll(re)) {
      const nums = [Number(m[1]), ...(m[2] ? [...m[2].matchAll(/#(\d+)/g)].map((x) => Number(x[1])) : [])];
      for (const n of nums) {
        if (n === 0) continue;
        if (!headings.has(n)) missing.push(`${rel}: #${n}`);
      }
    }
  }
  assert.deepEqual(missing, [], `dangling decision references:\n${missing.join("\n")}`);
});
