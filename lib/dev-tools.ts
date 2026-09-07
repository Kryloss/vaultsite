/**
 * Everything a page save can carry: the header, both bodies, and the creator
 * block (`author*` on the shelf, `artist*` on music — a note writes one
 * family; the other stays empty and is never written).
 */
export const DEV_FIELD_KEYS = [
  "title",
  "title_uk",
  "description",
  "description_uk",
  "body",
  "body_uk",
  "author",
  "author_uk",
  "author_bio",
  "author_bio_uk",
  "artist",
  "artist_uk",
  "artist_bio",
  "artist_bio_uk",
] as const;
export type DevFieldKey = (typeof DEV_FIELD_KEYS)[number];
export type DevFields = Record<DevFieldKey, string>;

export const EMPTY_DEV_FIELDS: DevFields = Object.fromEntries(
  DEV_FIELD_KEYS.map((key) => [key, ""])
) as DevFields;

export interface DevEditorState {
  baseline: DevFields;
  draft: DevFields;
  past: DevFields[];
  future: DevFields[];
  revision: string;
}

export type DevEditorAction =
  | { type: "edit"; key: DevFieldKey; value: string; record: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "cancel" }
  | { type: "saved"; fields: DevFields; revision: string }
  | { type: "loaded"; fields: DevFields; revision: string }
  | { type: "revision"; revision: string }
  | { type: "restored"; state: DevEditorState };

/** The "More fields" keys, per section type; the sidecar validates each (scripts/dev-editor-core.mjs). */
export const DEV_EXTRA_FIELDS = [
  "aliases",
  "slug",
  "maturity",
  "medium",
  "author",
  "author_uk",
  "author_bio",
  "author_bio_uk",
  "imdb_id",
  "video",
  "uploaded",
  "artist",
  "artist_uk",
  "artist_bio",
  "artist_bio_uk",
  "format",
  "lang",
  "genres",
] as const;
export type DevExtraField = (typeof DEV_EXTRA_FIELDS)[number];

/** Must equal `EDITOR_PROTOCOL` in scripts/dev-editor-core.mjs; the server test checks. */
export const EDITOR_PROTOCOL = 4;

export function isDevToolsAvailable(environment: string | undefined, hostname: string) {
  return environment === "development" && hostname === "localhost";
}

export function publicPageUrl(
  publicOrigin: string,
  location: Pick<Location, "pathname" | "search" | "hash">,
  lang?: "en" | "uk"
) {
  const url = new URL(`${location.pathname}${location.search}${location.hash}`, publicOrigin);
  if (lang) {
    url.searchParams.delete("lang");
    if (lang === "uk") url.searchParams.set("lang", "uk");
  }
  return url.href;
}

export function sourceForLanguage(
  lang: "en" | "uk",
  source: string | undefined,
  sourceUk: string | undefined
) {
  return lang === "uk" && sourceUk ? sourceUk : source;
}

export function createDevEditorState(fields: DevFields, revision: string): DevEditorState {
  return { baseline: fields, draft: fields, past: [], future: [], revision };
}

export function devEditorReducer(
  state: DevEditorState,
  action: DevEditorAction
): DevEditorState {
  switch (action.type) {
    case "restored":
      return action.state;
    case "loaded":
      return createDevEditorState(action.fields, action.revision);
    case "revision":
      return { ...state, revision: action.revision };
    case "edit": {
      if (state.draft[action.key] === action.value) return state;
      return {
        ...state,
        draft: { ...state.draft, [action.key]: action.value },
        past: action.record ? [...state.past, state.draft].slice(-100) : state.past,
        future: [],
      };
    }
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        draft: previous,
        past: state.past.slice(0, -1),
        future: [state.draft, ...state.future].slice(0, 100),
      };
    }
    case "redo": {
      const [next, ...future] = state.future;
      if (!next) return state;
      return {
        ...state,
        draft: next,
        past: [...state.past, state.draft].slice(-100),
        future,
      };
    }
    case "cancel":
      return { ...state, draft: state.baseline, past: [], future: [] };
    case "saved":
      return {
        baseline: action.fields,
        draft: action.fields,
        // Undo after Save prepares the previous on-disk version as a new
        // DRAFT; it never writes a reversal without another explicit Save.
        past: [state.baseline],
        future: [],
        revision: action.revision,
      };
  }
}

export function devEditorDirty(state: DevEditorState) {
  return (Object.keys(state.draft) as DevFieldKey[]).some(
    (key) => state.draft[key] !== state.baseline[key]
  );
}

export function devEditorChanges(state: DevEditorState): Partial<DevFields> {
  const changes: Partial<DevFields> = {};
  for (const key of Object.keys(state.draft) as DevFieldKey[]) {
    if (state.draft[key] !== state.baseline[key]) changes[key] = state.draft[key];
  }
  return changes;
}

/** Replace the selection with `text`; the caret lands after it. */
export function insertText(value: string, start: number, end: number, text: string) {
  return { value: value.slice(0, start) + text + value.slice(end), caret: start + text.length };
}

/**
 * Tab in the body editor. A collapsed caret gets two spaces; a selection
 * indents (or, with Shift, outdents) every line it touches, and the selection
 * grows or shrinks with the text so a second Tab does the same lines again.
 */
export function indentLines(value: string, start: number, end: number, outdent: boolean) {
  if (start === end && !outdent) {
    const inserted = insertText(value, start, end, "  ");
    return { value: inserted.value, start: inserted.caret, end: inserted.caret };
  }
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIndex = value.indexOf("\n", end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const block = value.slice(lineStart, lineEnd);
  let firstDelta = 0;
  const next = block
    .split("\n")
    .map((line, index) => {
      if (outdent) {
        const removed = /^ {1,2}/.exec(line)?.[0].length ?? 0;
        if (index === 0) firstDelta = -removed;
        return line.slice(removed);
      }
      if (index === 0) firstDelta = 2;
      return `  ${line}`;
    })
    .join("\n");
  return {
    value: value.slice(0, lineStart) + next + value.slice(lineEnd),
    start: Math.max(lineStart, start + firstDelta),
    end: Math.max(lineStart, end + next.length - block.length),
  };
}

/**
 * The open `[[` the caret is inside, if any: nothing typed since it closes,
 * breaks the line, or names a display label (`[[Target|label`), so the
 * suggestion list shows only while the TARGET is being written.
 */
export function wikiLinkQuery(value: string, caret: number) {
  const before = value.slice(0, caret);
  const open = before.lastIndexOf("[[");
  if (open === -1) return null;
  const query = before.slice(open + 2);
  if (/[\n[\]|]/.test(query)) return null;
  return { start: open, query };
}

/** Finish `[[query` as `[[Title]]`, absorbing a `]]` already typed after the caret. */
export function completeWikiLink(value: string, start: number, caret: number, title: string) {
  const text = `[[${title}]]`;
  const after = value.slice(caret);
  const rest = after.startsWith("]]") ? after.slice(2) : after;
  return { value: value.slice(0, start) + text + rest, caret: start + text.length };
}

export interface WikiLinkCandidate {
  title: string;
  titleUk?: string;
  lang?: "en" | "uk";
}

/**
 * Pages whose title (either language) matches; prefix matches first, then
 * the rest, in the index's own order. Heading results carry `lang` and are
 * skipped: a wiki link targets a note, not an anchor.
 */
export function wikiLinkMatches<T extends WikiLinkCandidate>(items: T[], query: string, limit = 8) {
  const needle = query.trim().toLowerCase();
  const pages = items.filter((item) => !item.lang);
  if (!needle) return pages.slice(0, limit);
  const starts: T[] = [];
  const contains: T[] = [];
  for (const item of pages) {
    const en = item.title.toLowerCase();
    const uk = item.titleUk?.toLowerCase() ?? "";
    if (en.startsWith(needle) || uk.startsWith(needle)) starts.push(item);
    else if (en.includes(needle) || uk.includes(needle)) contains.push(item);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/**
 * Wrap the selection in Markdown delimiters, or unwrap it when it already
 * is; a collapsed caret gets the placeholder, selected so typing replaces it.
 */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string
) {
  if (
    value.slice(Math.max(0, start - before.length), start) === before &&
    value.slice(end, end + after.length) === after
  ) {
    return {
      value: value.slice(0, start - before.length) + value.slice(start, end) + value.slice(end + after.length),
      start: start - before.length,
      end: end - before.length,
    };
  }
  const inner = start === end ? placeholder : value.slice(start, end);
  return {
    value: value.slice(0, start) + before + inner + after + value.slice(end),
    start: start + before.length,
    end: start + before.length + inner.length,
  };
}

/**
 * Add a line prefix (`## `, `> `, `- `) to every line the selection touches,
 * or remove it when every one of them already has it.
 */
export function toggleLinePrefix(value: string, start: number, end: number, prefix: string) {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIndex = value.indexOf("\n", end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const remove = lines.every((line) => line.startsWith(prefix));
  const next = lines
    .map((line) => (remove ? line.slice(prefix.length) : line.startsWith(prefix) ? line : prefix + line))
    .join("\n");
  const firstDelta = remove ? -prefix.length : lines[0].startsWith(prefix) ? 0 : prefix.length;
  return {
    value: value.slice(0, lineStart) + next + value.slice(lineEnd),
    start: Math.max(lineStart, start + firstDelta),
    end: Math.max(lineStart, end + next.length - (lineEnd - lineStart)),
  };
}

/** Words in a Markdown body — the same count lib/vault.ts::readingStats() reports. */
export function countWords(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|\[\]()!-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Where a rendered block's text starts in the Markdown source, or -1. The
 * first few words are matched with any whitespace between them, so a
 * paragraph that Markdown wrapped, linked or emphasised still finds its line.
 */
export function sourcePositionFor(markdown: string, renderedText: string) {
  const words = renderedText.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  // Fewer words each time: a heading carries its anchor's "#", a list item
  // its nested list, and the source has neither.
  // Whole words only, in any script: "At" must not settle for "Attack".
  const edge = (word: string, after: boolean) =>
    (after ? /[\p{L}\p{N}]$/u : /^[\p{L}\p{N}]/u).test(word)
      ? after
        ? "(?![\\p{L}\\p{N}])"
        : "(?<![\\p{L}\\p{N}])"
      : "";
  // Plain whitespace between the words first (the common case, and the one
  // that cannot skip into a neighbouring block), then room for Markdown
  // marks and link syntax between them.
  for (let count = words.length; count > 0; count -= 1) {
    for (const gap of ["\\s+", "[\\s\\S]{0,40}?"]) {
      const pattern = words
        .slice(0, count)
        .map(
          (word) =>
            edge(word, false) + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + edge(word, true)
        )
        .join(gap);
      const match = new RegExp(pattern, "u").exec(markdown);
      if (match) return match.index;
    }
  }
  return -1;
}

export type BlockKind = "line" | "paragraph" | "fence" | "table" | "quote";

/**
 * The source lines a rendered block came from: `[start, end)` offsets into
 * the body, or null when the block cannot be found. `text` is the block's
 * rendered text (its first words locate the block); `kind` says how far the
 * block reaches from that line — one line (a heading, a list item), a
 * paragraph (to the next blank line), a fenced code block (to the closing
 * fence), a table (contiguous `|` lines) or a quote (contiguous `>` lines).
 */
export function blockSourceRange(body: string, kind: BlockKind, text: string) {
  const position = sourcePositionFor(body, text);
  if (position < 0) return null;
  const lineStart = body.lastIndexOf("\n", position - 1) + 1;
  const lines = body.split("\n");
  let lineIndex = 0;
  let offset = 0;
  while (offset + lines[lineIndex].length + 1 <= lineStart && lineIndex < lines.length - 1) {
    offset += lines[lineIndex].length + 1;
    lineIndex += 1;
  }
  // The match may sit inside a fence or quote whose first line is above it.
  let first = lineIndex;
  let last = lineIndex;
  const isFence = (line: string) => /^\s{0,3}(`{3,}|~{3,})/.test(line);
  if (kind === "fence") {
    while (first > 0 && !isFence(lines[first])) first -= 1;
    last = first + 1;
    while (last < lines.length && !isFence(lines[last])) last += 1;
    if (last >= lines.length) last = lines.length - 1;
  } else if (kind === "table") {
    while (first > 0 && lines[first - 1].includes("|")) first -= 1;
    while (last < lines.length - 1 && lines[last + 1].includes("|")) last += 1;
  } else if (kind === "quote") {
    while (first > 0 && /^\s*>/.test(lines[first - 1])) first -= 1;
    while (last < lines.length - 1 && /^\s*>/.test(lines[last + 1])) last += 1;
  } else if (kind === "paragraph") {
    while (last < lines.length - 1 && lines[last + 1].trim() !== "" && !/^\s*(#{1,6}\s|```|~~~|>|[-*+]\s|\d+[.)]\s|\|)/.test(lines[last + 1])) {
      last += 1;
    }
  }
  const start = lines.slice(0, first).reduce((sum, line) => sum + line.length + 1, 0);
  const end = lines.slice(0, last + 1).reduce((sum, line) => sum + line.length + 1, 0) - 1;
  return { start, end: Math.min(end, body.length) };
}

/** Put `text` in `[start, end)` of `body`; the block's new end follows. */
export function spliceBlock(body: string, start: number, end: number, text: string) {
  return { body: body.slice(0, start) + text + body.slice(end), end: start + text.length };
}

/**
 * Where a new paragraph goes at the end of a body: after a blank line, with
 * the trailing newline the file already had kept for after it.
 */
export function appendParagraphRange(body: string) {
  const trimmed = body.replace(/\s+$/, "");
  const prefix = trimmed.length ? `${trimmed}\n\n` : "";
  return { body: `${prefix}\n`, start: prefix.length, end: prefix.length };
}

/**
 * A fact table row in a Markdown body — `| Label | Value |` — found by its
 * rendered label. `plain` says the value carries no Markdown of its own
 * (links, emphasis, code), so its rendered text IS its source and can be
 * edited as plain text; anything else should be edited as source.
 */
export function findFactRow(body: string, label: string) {
  const wanted = label.trim().replace(/\s+/g, " ").toLowerCase();
  if (!wanted) return null;
  let offset = 0;
  for (const line of body.split("\n")) {
    const match = /^(\s*\|\s*)([^|]*?)(\s*\|\s*)(.*?)(\s*\|\s*)$/.exec(line);
    if (match && match[2].trim().replace(/\s+/g, " ").toLowerCase() === wanted) {
      const start = offset + match[1].length + match[2].length + match[3].length;
      const value = match[4];
      return {
        start,
        end: start + value.length,
        value,
        plain: !/[\[\]*_`<>\\]|!\[/.test(value),
      };
    }
    offset += line.length + 1;
  }
  return null;
}

/** Write a new plain value into a fact row; `|` in the text is escaped. */
export function replaceFactValue(body: string, label: string, value: string) {
  const row = findFactRow(body, label);
  if (!row) return null;
  const text = value.replace(/\s*\n+\s*/g, " ").replace(/\|/g, "\\|").trim();
  return body.slice(0, row.start) + text + body.slice(row.end);
}

export type RichShape =
  | { kind: "paragraph"; body: string }
  | { kind: "line"; prefix: string; body: string }
  | { kind: "quote"; header: string | null; body: string };

/**
 * Split a block's source into the part that is written INTO it (the text
 * the rendered element shows) and the syntax around it: a heading's `## `,
 * a list item's `- ` or `1. ` or `- [ ] `, a quote's `> ` on every line and,
 * for a callout, its `> [!kind] Title` header. `joinRichShape` is the exact
 * inverse; a block is edited in place only when rendering-then-serialising
 * gives back the body byte for byte.
 */
export function splitRichShape(kind: BlockKind, source: string): RichShape | null {
  // A paragraph's continuation lines may be indented in the source; the
  // parser drops that indent, so the render cannot give it back. It means
  // nothing to Markdown, so the comparison and the write-back go without it.
  if (kind === "paragraph") return { kind: "paragraph", body: source.replace(/\n[ \t]+/g, "\n") };
  if (kind === "line") {
    const match = /^(\s*(?:#{1,6}\s+|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?))(.*)$/s.exec(source);
    return match ? { kind: "line", prefix: match[1], body: match[2] } : null;
  }
  if (kind === "quote") {
    const lines = source.split("\n");
    if (!lines.every((line) => /^\s*>/.test(line))) return null;
    const stripped = lines.map((line) => line.replace(/^\s*> ?/, ""));
    const header = /^\[!\w[\w-]*\]/.test(stripped[0]) ? stripped[0] : null;
    const body = (header === null ? stripped : stripped.slice(1)).join("\n");
    return { kind: "quote", header, body };
  }
  return null;
}

export function joinRichShape(shape: RichShape, body: string) {
  if (shape.kind === "paragraph") return body;
  if (shape.kind === "line") return shape.prefix + body;
  const lines = [...(shape.header === null ? [] : [shape.header]), ...body.split("\n")];
  return lines.map((line) => (line === "" ? ">" : `> ${line}`)).join("\n");
}
