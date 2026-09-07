export type DevFieldKey =
  | "title"
  | "title_uk"
  | "description"
  | "description_uk"
  | "body"
  | "body_uk";

export interface DevFields {
  title: string;
  title_uk: string;
  description: string;
  description_uk: string;
  body: string;
  body_uk: string;
}

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

/** Must equal `EDITOR_PROTOCOL` in scripts/dev-editor-core.mjs; the server test checks. */
export const EDITOR_PROTOCOL = 2;

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
  if (words.length === 0) return -1;
  const pattern = words
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s\\S]{0,40}?");
  const match = new RegExp(pattern).exec(markdown);
  return match ? match.index : -1;
}
