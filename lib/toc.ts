/**
 * Heading ids, anchor links, and the table-of-contents index.
 *
 * One rehype step does three jobs, because all three need the same pass over
 * the heading nodes (and must run AFTER rehype-slug, which is what puts the
 * ids there in the first place):
 *
 * 1. Optionally prefix every heading id. The Ukrainian body of an entry is
 *    rendered as a second <article> in the SAME document (see components/T.tsx
 *    — both languages ship, CSS shows one), so two independent rehype-slug
 *    runs can mint the same id twice. A heading that reads "Setup" in both
 *    languages would collide, and `#setup` would jump to whichever copy is
 *    currently hidden — i.e. nowhere. Prefixing the UK pass ("uk-") keeps the
 *    two id namespaces apart.
 * 2. Collect h2/h3 into a flat list for components/Toc.tsx.
 * 3. Append the "#" anchor revealed on heading hover.
 */

export interface Heading {
  id: string;
  text: string;
  /** 2 or 3 — deeper levels get anchors but stay out of the rail. */
  level: number;
}

export interface HeadingOptions {
  /** Prefixed onto every heading id. Used to namespace the Ukrainian body. */
  idPrefix?: string;
  /** Heading list to append to (h2/h3 only), in document order. */
  collect?: Heading[];
  /** Localized accessible name for the "#" link. */
  anchorLabel?: string;
  /** Set false where an in-page link makes no sense — the RSS feed. */
  anchors?: boolean;
}

/** Headings that get an id + anchor. h1 is skipped — it reads as a title. */
const ANCHORED = new Set(["h2", "h3", "h4"]);
/** Headings deep enough to structure a page but shallow enough to list. */
const LISTED = new Set(["h2", "h3"]);

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Visible text of a node, ignoring markup (used for the TOC label). */
function textOf(node: any): string {
  if (node.type === "text") return String(node.value ?? "");
  if (!node.children) return "";
  return node.children.map(textOf).join("");
}

function anchorNode(id: string, label: string): any {
  return {
    type: "element",
    tagName: "a",
    properties: {
      className: ["heading-anchor"],
      href: `#${id}`,
      "aria-label": label,
    },
    children: [{ type: "text", value: "#" }],
  };
}

export function rehypeHeadings(options: HeadingOptions = {}) {
  const {
    idPrefix,
    collect,
    anchorLabel = "Link to this heading",
    anchors = true,
  } = options;

  return (tree: any) => {
    const walk = (node: any) => {
      if (!node.children) return;
      // The footnote list carries a screen-reader-only <h2>Footnotes</h2>
      // that remark-gfm generates and owns (its id is what every reference's
      // aria-describedby points at). It is not part of the note's outline:
      // anchoring it would put "Footnotes" in the table of contents and in
      // Cmd+K, and re-prefixing its id would break those references.
      if (
        node.type === "element" &&
        node.tagName === "section" &&
        (node.properties?.dataFootnotes !== undefined ||
          node.properties?.["data-footnotes"] !== undefined)
      ) {
        return;
      }
      for (const child of node.children) {
        if (child.type !== "element") continue;
        if (!ANCHORED.has(child.tagName)) {
          // Headings can sit inside callouts and blockquotes — keep descending.
          walk(child);
          continue;
        }

        const raw = child.properties?.id;
        // No id means rehype-slug skipped it (empty heading) — nothing to link.
        if (typeof raw !== "string" || !raw) continue;

        const id = idPrefix ? `${idPrefix}${raw}` : raw;
        child.properties.id = id;

        // Read the text BEFORE appending the anchor, so the "#" stays out of it.
        const text = textOf(child).replace(/\s+/g, " ").trim();
        if (collect && LISTED.has(child.tagName) && text) {
          collect.push({ id, text, level: Number(child.tagName.slice(1)) });
        }

        if (anchors) child.children.push(anchorNode(id, anchorLabel));
      }
    };
    walk(tree);
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
