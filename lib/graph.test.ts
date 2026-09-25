/**
 * Run with `npm test`. Covers the Home page's vault graph (lib/graph.ts): which
 * [[links]] count, and that the layout is deterministic and stays on canvas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutGraph, wikiTargets, type GraphEdge, type GraphNode } from "./graph.ts";

test("links count; embeds, headings, labels and code do not", () => {
  const md = [
    "See [[Sapiens]] and [[Dispatch|my planner]] and [[Noize MC#Why him]].",
    "![[cover.jpg]] is an embed, and so is ![[Other note]].",
    "`[[Not a link]]` and",
    "```",
    "[[Also not]]",
    "```",
    "[[Sapiens]] again.",
  ].join("\n");
  assert.deepEqual(wikiTargets(md), ["Sapiens", "Dispatch", "Noize MC"]);
});

const nodes: GraphNode[] = [
  { id: "/posts", group: "posts", hub: true },
  { id: "/posts/a", group: "posts" },
  { id: "/posts/b", group: "posts" },
  { id: "/shelf", group: "shelf", hub: true },
  { id: "/shelf/c", group: "shelf" },
];
const edges: GraphEdge[] = [
  { source: "/posts/a", target: "/posts", kind: "home" },
  { source: "/posts/b", target: "/posts", kind: "home" },
  { source: "/shelf/c", target: "/shelf", kind: "home" },
  { source: "/posts/a", target: "/shelf/c", kind: "wiki" },
];

test("the same vault draws the same map", () => {
  const a = layoutGraph(nodes, edges, { width: 600, height: 400 });
  const b = layoutGraph(nodes, edges, { width: 600, height: 400 });
  assert.deepEqual([...a], [...b]);
});

test("every node lands inside the padded canvas", () => {
  const placed = layoutGraph(nodes, edges, { width: 600, height: 400, pad: 20 });
  assert.equal(placed.size, nodes.length);
  for (const { x, y } of placed.values()) {
    assert.ok(x >= 20 && x <= 580, `x ${x}`);
    assert.ok(y >= 20 && y <= 380, `y ${y}`);
  }
});

test("no two nodes are stacked on each other", () => {
  const placed = [...layoutGraph(nodes, edges, { width: 600, height: 400 }).values()];
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) {
      const d = Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y);
      assert.ok(d > 8, `nodes ${i} and ${j} are ${d.toFixed(1)} apart`);
    }
});
