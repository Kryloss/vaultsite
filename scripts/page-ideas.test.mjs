// The page ideas (lib/site-config.ts → pageIdeas, DECISIONS #179) promise that
// switching one off leaves the site as it was. The markup half of that promise
// is the switch itself; this pins the CSS half: every rule in
// app/page-ideas.css must name an `.idea-` class, so no rule there can reach
// an element that exists without an idea turned on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/page-ideas.css", import.meta.url), "utf8");

/** Every selector list in the sheet, at-rule preludes and keyframe steps excluded. */
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

test("the sheet has rules to check", () => {
  assert.ok(selectors(css).length > 10);
});

test("every selector in app/page-ideas.css names an .idea- class", () => {
  for (const list of selectors(css)) {
    for (const selector of list.split(",")) {
      assert.match(selector, /\.idea-/, `"${selector.trim()}" can style the site with every idea off`);
    }
  }
});

test("keyframes in the sheet are namespaced too", () => {
  for (const [, name] of css.matchAll(/@keyframes\s+([\w-]+)/g)) {
    assert.ok(name.startsWith("idea-"), `@keyframes ${name} could collide with globals.css`);
  }
});
