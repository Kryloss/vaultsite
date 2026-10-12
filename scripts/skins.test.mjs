// Note skins (lib/skins.ts, DECISIONS #234) promise that a skin belongs to the
// one note that asks for it. The page half of that promise is the `skin:`
// check in the entry route; this pins the stylesheet half: a skin's CSS sits
// in public/skins/, where only a skinned page links it, and even there no rule
// in it can match an element outside `[data-skin="<name>"]`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

/** The names in `SKINS`, read from the source so the two cannot drift. */
const skins = [...read("../lib/skins.ts").match(/export const SKINS = \[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map(
  (match) => match[1]
);

/** Every selector list in a sheet, at-rule preludes and keyframe steps excluded. */
function selectors(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let depth = 0;
  let inKeyframes = -1;
  let buffer = "";
  for (const ch of text) {
    if (ch === "{") {
      const prelude = buffer.trim();
      if (prelude.startsWith("@")) {
        if (prelude.startsWith("@keyframes")) inKeyframes = depth;
      } else if (inKeyframes === -1) {
        out.push(prelude);
      }
      depth++;
      buffer = "";
    } else if (ch === "}") {
      depth--;
      if (depth === inKeyframes) inKeyframes = -1;
      buffer = "";
    } else if (ch === ";") {
      buffer = "";
    } else {
      buffer += ch;
    }
  }
  return out;
}

/** Splits a selector list on its own commas, not the ones inside `:is(a, b)`. */
function split(list) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((selector) => selector.trim()).filter(Boolean);
}

const keyframes = (source) => [...source.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]);

test("there is a skin to check", () => {
  assert.ok(skins.length > 0);
});

for (const skin of skins) {
  const path = `../public/skins/${skin}.css`;

  test(`${skin}: the stylesheet the page links exists`, () => {
    assert.ok(existsSync(new URL(path, import.meta.url)), `public/skins/${skin}.css is missing`);
  });

  test(`${skin}: every selector names [data-skin="${skin}"]`, () => {
    const lists = selectors(read(path));
    assert.ok(lists.length > 0);
    for (const list of lists) {
      for (const selector of split(list)) {
        assert.ok(
          selector.includes(`[data-skin="${skin}"]`),
          `"${selector}" can style a page that has no skin`
        );
      }
    }
  });

  test(`${skin}: no keyframe shares a name with the site's own`, () => {
    const site = new Set([...keyframes(read("../app/globals.css")), ...keyframes(read("../app/page-ideas.css"))]);
    for (const name of keyframes(read(path))) {
      assert.ok(!site.has(name), `@keyframes ${name} would replace the site's animation of that name`);
    }
  });

  test(`${skin}: every file the stylesheet loads from /skins/ is there`, () => {
    for (const [, file] of read(path).matchAll(/url\("\/skins\/([^"]+)"\)/g)) {
      assert.ok(existsSync(new URL(`../public/skins/${file}`, import.meta.url)), `public/skins/${file} is missing`);
    }
  });
}
