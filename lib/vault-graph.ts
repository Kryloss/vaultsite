/**
 * Builds the Home page's vault graph from the vault (page idea `homeGraph`,
 * DECISIONS #180). Server-only — it reads lib/vault.ts — and hands the client
 * component plain, positioned data; the layout itself is lib/graph.ts.
 */
import { getEntries, getSections, getWikiIndex } from "@/lib/vault";
import { layoutGraph, wikiTargets, type GraphEdge, type GraphNode } from "@/lib/graph";
import type { VaultGraphEdge, VaultGraphNode } from "@/components/VaultGraph";

export const GRAPH_WIDTH = 640;
export const GRAPH_HEIGHT = 420;

export function vaultGraph(): { nodes: VaultGraphNode[]; edges: VaultGraphEdge[] } {
  const wiki = getWikiIndex();
  const meta = new Map<string, Omit<VaultGraphNode, "x" | "y">>();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const bodies: { id: string; md: string }[] = [];

  for (const section of getSections()) {
    if (section.slug === "home") continue;
    const hub = `/${section.slug}`;
    const label = { section: section.title, sectionUk: section.titleUk };
    nodes.push({ id: hub, group: section.slug, hub: true });
    meta.set(hub, { id: hub, hub: true, title: section.title, titleUk: section.titleUk, ...label });
    bodies.push({ id: hub, md: section.content });
    for (const entry of getEntries(section)) {
      if (entry.draft) continue;
      const id = `${hub}/${entry.slug}`;
      nodes.push({ id, group: section.slug });
      meta.set(id, { id, hub: false, title: entry.title, titleUk: entry.titleUk, ...label });
      edges.push({ source: id, target: hub, kind: "home" });
      bodies.push({ id, md: entry.content });
    }
  }

  const seen = new Set(edges.map((e) => `${e.source}>${e.target}`));
  for (const { id, md } of bodies) {
    for (const name of wikiTargets(md)) {
      const target = wiki.get(name.trim().toLowerCase());
      if (!target || target === id || !meta.has(target)) continue;
      const key = `${id}>${target}`;
      const back = `${target}>${id}`;
      if (seen.has(key) || seen.has(back)) continue;
      seen.add(key);
      edges.push({ source: id, target, kind: "wiki" });
    }
  }

  const placed = layoutGraph(nodes, edges, { width: GRAPH_WIDTH, height: GRAPH_HEIGHT, pad: 28 });
  return {
    nodes: nodes.map((n) => ({ ...meta.get(n.id)!, ...placed.get(n.id)! })),
    edges: edges.map((e) => ({ a: e.source, b: e.target, wiki: e.kind === "wiki" })),
  };
}
