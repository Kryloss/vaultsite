/**
 * The vault graph on Home (page idea `homeGraph`, lib/site-config.ts) — the
 * Obsidian graph view of this vault, laid out once at build time.
 *
 * Pure: no `fs`, no randomness, no clock. The same vault always draws the same
 * picture, so a rebuild with no new notes doesn't reshuffle the map, and the
 * layout can be tested. The caller (app/page.tsx) supplies the notes and their
 * resolved links from lib/vault.ts.
 */

export interface GraphNode {
  id: string;
  /** Which cluster it belongs to — the section slug. */
  group: string;
  /** Section hubs are drawn larger and labelled at rest. */
  hub?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  /** "wiki" = a [[link]] written in a note; "home" = a note to its section. */
  kind: "wiki" | "home";
}

export interface Placed {
  x: number;
  y: number;
}

/**
 * The note names a body links to: `[[Name]]`, `[[Name|label]]`,
 * `[[Name#Heading]]`. Image and note EMBEDS (`![[…]]`) are not links and are
 * skipped, and so is anything inside a code span or fence, where `[[` is
 * text being shown, not a link being made.
 */
export function wikiTargets(md: string): string[] {
  const text = md.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  const out: string[] = [];
  for (const m of text.matchAll(/(!?)\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g)) {
    if (m[1] === "!") continue;
    const name = m[2].trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The layout: each section is a sunflower (phyllotaxis) spiral of its notes
 * around its own hub, the hubs spaced on an ellipse, and then a short
 * relaxation in which the written [[links]] tug their two ends towards each
 * other while every note is held near its place in its own spiral and no two
 * dots may overlap. Sections stay legible as neighbourhoods; the links are
 * what bend them.
 *
 * An earlier pure force simulation pushed the biggest section into the
 * canvas walls — a spiral cannot, because its size is its note count.
 * Positions are still clamped inside `width` × `height` less `pad`.
 */
export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  { width, height, pad = 24, iterations = 160 }: {
    width: number;
    height: number;
    pad?: number;
    iterations?: number;
  }
): Map<string, Placed> {
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const SPACING = 9;
  const MIN_GAP = 10;

  const groups: string[] = [];
  const members = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    if (!members.has(n.group)) {
      members.set(n.group, []);
      groups.push(n.group);
    }
    if (!n.hub) members.get(n.group)!.push(n);
  }

  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2 - pad - 40;
  const ry = height / 2 - pad - 34;
  const home = new Map<string, Placed>();
  const hubs = new Set(nodes.filter((n) => n.hub).map((n) => n.id));

  groups.forEach((g, gi) => {
    const angle = (gi / Math.max(groups.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const anchor = { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
    // Pull a large cluster in towards the middle so its spiral stays on canvas.
    const list = members.get(g)!;
    const reach = SPACING * Math.sqrt(list.length + 1) + 6;
    const inward = Math.min(1, reach / Math.max(Math.min(rx, ry), 1));
    const a = {
      x: anchor.x + (cx - anchor.x) * inward * 0.35,
      y: anchor.y + (cy - anchor.y) * inward * 0.35,
    };
    for (const n of nodes) if (n.hub && n.group === g) home.set(n.id, a);
    list.forEach((n, i) => {
      const r = 14 + SPACING * Math.sqrt(i + 1);
      const t = i * GOLDEN + hash(g) / 4294967296 * Math.PI * 2;
      home.set(n.id, { x: a.x + Math.cos(t) * r, y: a.y + Math.sin(t) * r });
    });
  });

  const pos = new Map<string, Placed>();
  for (const n of nodes) pos.set(n.id, { ...home.get(n.id)! });
  const wiki = edges.filter((e) => e.kind === "wiki" && pos.has(e.source) && pos.has(e.target));
  const ids = [...pos.keys()];

  for (let step = 0; step < iterations; step++) {
    for (const e of wiki) {
      const a = pos.get(e.source)!;
      const b = pos.get(e.target)!;
      const dx = (b.x - a.x) * 0.012;
      const dy = (b.y - a.y) * 0.012;
      if (!hubs.has(e.source)) { a.x += dx; a.y += dy; }
      if (!hubs.has(e.target)) { b.x -= dx; b.y -= dy; }
    }
    for (const id of ids) {
      if (hubs.has(id)) continue;
      const p = pos.get(id)!;
      const h = home.get(id)!;
      p.x += (h.x - p.x) * 0.08;
      p.y += (h.y - p.y) * 0.08;
    }
    for (let i = 0; i < ids.length; i++) {
      const a = pos.get(ids[i])!;
      for (let j = i + 1; j < ids.length; j++) {
        const b = pos.get(ids[j])!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= MIN_GAP) continue;
        const push = (MIN_GAP - (d || 0.01)) / 2;
        const ux = d ? dx / d : 1;
        const uy = d ? dy / d : 0;
        if (!hubs.has(ids[i])) { a.x -= ux * push; a.y -= uy * push; }
        if (!hubs.has(ids[j])) { b.x += ux * push; b.y += uy * push; }
      }
    }
  }

  /* Fit the drawing to the canvas: one uniform scale (never above 1.6, so a
     tiny vault doesn't balloon) and a centring shift. A ring of anchors is
     rarely balanced — one big section on one side left half the box empty. */
  const all = [...pos.values()];
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));
  const scale = Math.min(
    1.6,
    (width - pad * 2) / Math.max(maxX - minX, 1),
    (height - pad * 2) / Math.max(maxY - minY, 1)
  );
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;

  const out = new Map<string, Placed>();
  for (const [id, p] of pos) {
    const x = Math.max(pad, Math.min(width - pad, offX + (p.x - minX) * scale));
    const y = Math.max(pad, Math.min(height - pad, offY + (p.y - minY) * scale));
    out.set(id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }
  return out;
}
