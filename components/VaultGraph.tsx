"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import T from "@/components/T";

export interface VaultGraphNode {
  id: string;
  x: number;
  y: number;
  hub: boolean;
  title: string;
  titleUk?: string;
  section: string;
  sectionUk?: string;
}

export interface VaultGraphEdge {
  a: string;
  b: string;
  wiki: boolean;
}

/**
 * The vault as Obsidian draws it — page idea `homeGraph` (lib/site-config.ts,
 * DECISIONS #180). Every published note is a dot, clustered round its section;
 * the faint lines tie a note to its section and the firmer ones are the
 * [[links]] written between notes. Laid out at build time by lib/graph.ts, so
 * this component only answers the pointer: hovering a dot lights it, its
 * lines and its neighbours, and names it; pressing it opens the note.
 *
 * Pointer only, on purpose. Every dot is a note already reachable from the
 * sidebar, the lists and ⌘K, and ninety extra tab stops between Explore and
 * the end of the page would be a trap, not a map — so the drawing is hidden
 * from assistive tech and its links are out of the tab order.
 */
export default function VaultGraph({
  nodes,
  edges,
  width,
  height,
}: {
  nodes: VaultGraphNode[];
  edges: VaultGraphEdge[];
  width: number;
  height: number;
}) {
  const [active, setActive] = useState<string | null>(null);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const neighbours = useMemo(() => {
    if (!active) return null;
    const set = new Set([active]);
    for (const e of edges) {
      if (e.a === active) set.add(e.b);
      if (e.b === active) set.add(e.a);
    }
    return set;
  }, [active, edges]);

  const hovered = active ? byId.get(active) : undefined;

  return (
    <figure className="idea-graph" data-active={active ? "" : undefined}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="idea-graph-svg"
        aria-hidden="true"
        onPointerLeave={() => setActive(null)}
      >
        <g>
          {edges.map((e) => {
            const a = byId.get(e.a);
            const b = byId.get(e.b);
            if (!a || !b) return null;
            const lit = active !== null && (e.a === active || e.b === active);
            return (
              <line
                key={`${e.a}>${e.b}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={`idea-graph-edge${e.wiki ? " is-wiki" : ""}${lit ? " is-lit" : ""}`}
              />
            );
          })}
        </g>
        <g>
          {nodes.map((n, i) => {
            const dim = neighbours !== null && !neighbours.has(n.id);
            return (
              <Link
                key={n.id}
                href={n.id}
                tabIndex={-1}
                className={`idea-graph-node${n.hub ? " is-hub" : ""}${
                  n.id === active ? " is-active" : ""
                }${dim ? " is-dim" : ""}`}
                style={{ "--i": i % 24 } as React.CSSProperties}
                onPointerEnter={() => setActive(n.id)}
              >
                {/* A wider invisible target than the dot itself — a 3px dot
                    is a hard thing to land a pointer on. */}
                <circle cx={n.x} cy={n.y} r={n.hub ? 12 : 8} className="idea-graph-hit" />
                <circle cx={n.x} cy={n.y} r={n.hub ? 5 : 2.75} className="idea-graph-dot" />
                {n.hub && (
                  <text
                    x={n.x}
                    y={n.y + (n.y > height - 30 ? -11 : 17)}
                    textAnchor="middle"
                    className="idea-graph-label"
                  >
                    <tspan className="lang-en">{n.title}</tspan>
                    <tspan className="lang-uk">{n.titleUk ?? n.title}</tspan>
                  </text>
                )}
              </Link>
            );
          })}
        </g>
      </svg>

      {/* Named where the pointer is, in the page's own type rather than
          SVG text — it wraps, it takes both languages through <T>, and it
          never scales down with the drawing on a phone. */}
      {hovered && !hovered.hub && (
        <div
          className="idea-graph-tip"
          style={{
            left: `${(hovered.x / width) * 100}%`,
            top: `${(hovered.y / height) * 100}%`,
          }}
        >
          <span className="idea-graph-tip-title">
            <T en={hovered.title} uk={hovered.titleUk} />
          </span>
          <span className="idea-graph-tip-section">
            <T en={hovered.section} uk={hovered.sectionUk} />
          </span>
        </div>
      )}
    </figure>
  );
}
