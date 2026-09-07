"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  CloseIcon,
  ExternalLinkIcon,
  ImageIcon,
  ObsidianIcon,
  PenIcon,
  RedoIcon,
  ReloadIcon,
  SaveIcon,
  TranslateIcon,
  UndoIcon,
} from "@/components/icons";
import { useLang } from "@/components/useLang";
import { useSearchIndex } from "@/components/useSearchIndex";
import { fileToBase64 } from "@/lib/dev-editor-client";
import {
  EDITOR_PROTOCOL,
  EMPTY_DEV_FIELDS,
  appendParagraphRange,
  blockSourceRange,
  completeWikiLink,
  countWords,
  createDevEditorState,
  devEditorChanges,
  devEditorDirty,
  devEditorReducer,
  indentLines,
  insertText,
  isDevToolsAvailable,
  joinRichShape,
  publicPageUrl,
  splitRichShape,
  replaceFactValue,
  findFactRow,
  sourcePositionFor,
  spliceBlock,
  toggleLinePrefix,
  wikiLinkMatches,
  wikiLinkQuery,
  wrapSelection,
  type BlockKind,
  type RichShape,
  type DevEditorAction,
  type DevEditorState,
  type DevFieldKey,
  type DevFields,
} from "@/lib/dev-tools";
import { wordCount } from "@/lib/plural";
import { siteUrl } from "@/lib/site-config";
import { devUi, ui } from "@/lib/ui-strings";
import { shortcutKey } from "@/lib/shortcut-key";

interface PageSource {
  source?: string;
  sourceUk?: string;
}

interface EditorDocument {
  source: string;
  sourceUk?: string;
  revision: string;
  revisionUk?: string;
  fields: DevFields;
  obsidian: { en: string; uk: string };
}

type BodyFieldKey = "body" | "body_uk";

/**
 * What is being edited. `block`: one paragraph, heading, list item, quote,
 * table or code fence, as its own Markdown, in a textarea standing in the
 * block's place inside the article (the mount is a plain node the article's
 * HTML does not own, so React may portal into it). `source`: the whole body
 * in the bar under the page. Either way the article itself stays rendered
 * and updates live.
 */
interface ActiveBodyEditor {
  host: HTMLElement;
  key: BodyFieldKey;
  /**
   * `rich`: the rendered block itself is contentEditable and its DOM is
   * serialised back to Markdown on every input — only for blocks whose
   * render round-trips exactly. `block`: that block's Markdown in a textarea
   * standing in its place, for everything else. `source`: the whole body.
   */
  mode: "rich" | "block" | "source";
  /** Rich mode: the element being edited, and the syntax around its text. */
  element?: HTMLElement;
  shape?: RichShape;
  /** Block mode: where the textarea mounts, inserted before the block. */
  mount: HTMLElement | null;
  /**
   * Block mode: the block's position among the article's children (and the
   * list item's index within it), so it can be found again after the article
   * re-renders under a live preview. Null for a paragraph added at the end.
   */
  path: [number, number] | null;
}

const BLOCK_CONTAINERS = "pre, table, .callout, blockquote, figure";
const BLOCK_LEAVES = "li, h1, h2, h3, h4, h5, h6, p, dt, dd";

/** The block a press landed in, its kind for the source lookup, and its text. */
function blockAt(host: HTMLElement, target: Element) {
  const container = target.closest<HTMLElement>(BLOCK_CONTAINERS);
  const leaf = target.closest<HTMLElement>(BLOCK_LEAVES);
  const element =
    container && host.contains(container) && container !== host
      ? container
      : leaf && host.contains(leaf) && leaf !== host
        ? leaf
        : null;
  if (!element) return null;
  const tag = element.tagName.toLowerCase();
  let kind: BlockKind = "paragraph";
  let text = element.textContent ?? "";
  if (tag === "pre") {
    kind = "fence";
    text = (element.querySelector("code")?.textContent ?? text).split("\n").find((line) => line.trim()) ?? "";
  } else if (tag === "table") {
    kind = "table";
    text = element.querySelector("th, td")?.textContent ?? text;
  } else if (tag === "blockquote" || element.classList.contains("callout")) {
    kind = "quote";
  } else if (tag === "li") {
    kind = "line";
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("ul, ol").forEach((list) => list.remove());
    text = clone.textContent ?? "";
  } else if (/^h[1-6]$/.test(tag)) {
    kind = "line";
  } else if (tag === "figure") {
    kind = "line";
    const img = element.querySelector("img");
    const src = img?.getAttribute("src") ?? "";
    text = element.querySelector("figcaption")?.textContent?.trim() || img?.alt || decodeURIComponent(src.split("/").pop() ?? "");
  }
  return { element, kind, text };
}

function blockPath(host: HTMLElement, element: HTMLElement): [number, number] {
  let top: HTMLElement = element;
  while (top.parentElement && top.parentElement !== host) top = top.parentElement;
  const index = [...host.children].indexOf(top);
  const item = element === top ? -1 : [...top.querySelectorAll("li")].indexOf(element as HTMLLIElement);
  return [index, item];
}

/**
 * Put a block-level construct (callout, fence, table, rule) on lines of its
 * own: a blank line before it unless the caret already starts a line, and
 * one after unless the text already goes on with one. Returns where the
 * block starts and where the caret lands after it.
 */
function placeBlock(value: string, start: number, end: number, block: string) {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail = after.length === 0 || after.startsWith("\n\n") ? "\n" : after.startsWith("\n") ? "\n" : "\n\n";
  const at = before.length + lead.length;
  return { value: `${before}${lead}${block}${trail}${after}`, at, after: at + block.length + trail.length };
}

/**
 * The Markdown a rendered block's DOM stands for: the inverse of the
 * pipeline on the inline subset the site actually uses — emphasis, strike,
 * code, wiki links (by the page's own href → title index), plain links,
 * footnote marks, line breaks. Anything the pipeline added that is not in
 * the source (a heading's anchor, a sidenote's copy, a task's checkbox, a
 * nested list under a list item) is skipped. Whether the result IS the
 * source is checked before a block is edited this way.
 */
function richMarkdown(root: Node, titleFor: (href: string) => string | undefined): string {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/ /g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    const inner = () => [...element.childNodes].map(walk).join("");
    if (tag === "br") {
      // One break is a hard break (`  ⏎`); a run of them is a paragraph
      // boundary, which is what two Enters mean in the rendered text.
      let run = 1;
      let next = element.nextSibling;
      while (next && next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).tagName === "BR") {
        run += 1;
        next = next.nextSibling;
      }
      if (run > 1) {
        // Only the first of the run emits; the rest emit nothing.
        const previous = element.previousSibling;
        if (previous && previous.nodeType === Node.ELEMENT_NODE && (previous as HTMLElement).tagName === "BR") return "";
        return "\n\n";
      }
      const previous = element.previousSibling;
      if (previous && previous.nodeType === Node.ELEMENT_NODE && (previous as HTMLElement).tagName === "BR") return "";
      return "  \n";
    }
    if (tag === "img") {
      const src = element.getAttribute("src") ?? "";
      const alt = element.getAttribute("alt") ?? "";
      if (src.startsWith("/vault-assets/")) {
        const name = decodeURIComponent(src.split("/").pop() ?? "");
        return alt && alt !== name ? `![[${name}|${alt}]]` : `![[${name}]]`;
      }
      return `![${alt}](${src})`;
    }
    if (tag === "strong" || tag === "b") return `**${inner()}**`;
    if (tag === "em" || tag === "i") return `*${inner()}*`;
    if (tag === "del" || tag === "s" || tag === "strike") return `~~${inner()}~~`;
    if (tag === "code") return `\`${element.textContent ?? ""}\``;
    if (tag === "input" || tag === "ul" || tag === "ol") return "";
    if (element.classList.contains("sidenote") || element.classList.contains("heading-anchor")) return "";
    if (tag === "a") {
      const href = element.getAttribute("href") ?? "";
      if (element.hasAttribute("data-footnote-ref")) return `[^${element.textContent ?? ""}]`;
      const label = inner();
      if (href.startsWith("/")) {
        const title = titleFor(href.split("#")[0].split("?")[0]);
        if (title) return label === title ? `[[${title}]]` : `[[${title}|${label}]]`;
      }
      // A bare URL the pipeline autolinked reads back as the bare URL.
      if (label === href) return href;
      return `[${label}](${href})`;
    }
    if (tag === "p" || tag === "div") {
      // Around BLOCK children the pretty-printed HTML's own newlines are not
      // text and are dropped; inside a paragraph a newline text node is a
      // soft line break from the source and is kept.
      const hasBlocks = [...element.children].some((child) =>
        /^(P|DIV|UL|OL|BLOCKQUOTE|PRE|TABLE|FIGURE|H[1-6])$/.test(child.tagName)
      );
      const parts = [...element.childNodes]
        .filter((child) => !(hasBlocks && child.nodeType === Node.TEXT_NODE && !(child.textContent ?? "").trim()))
        .map(walk);
      return parts.join("");
    }
    return inner();
  };
  const element = root as HTMLElement;
  if (element.classList?.contains("callout") || element.tagName === "BLOCKQUOTE") {
    const paragraphs = [...element.children].filter(
      (child) => !(child.classList.contains("callout-title"))
    );
    return paragraphs.map(walk).join("\n\n");
  }
  return walk(root).replace(/^\n+|\n+$/g, "");
}

/** Where a press landed as a caret, for a block that just became editable. */
function caretAt(x: number, y: number) {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    if (!position) return null;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }
  return document.caretRangeFromPoint?.(x, y) ?? null;
}

/** The text node the caret is in and its offset, for `[[` suggestions. */
function caretText() {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || !selection.anchorNode) return null;
  if (selection.anchorNode.nodeType !== Node.TEXT_NODE) return null;
  return { node: selection.anchorNode as Text, offset: selection.anchorOffset };
}

/**
 * A container's HTML as the server rendered it, with everything the dock
 * adds stripped: a block's mount and hidden mark, a fact cell's editing
 * attributes. Restoring a snapshot that still carried them re-created a
 * textarea React no longer knew about — a ghost you could type into.
 */
function snapshotHtml(container: HTMLElement) {
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".dev-block-mount").forEach((mount) => mount.remove());
  clone.querySelectorAll("[data-dev-block-hidden]").forEach((block) => {
    block.removeAttribute("data-dev-block-hidden");
  });
  clone.querySelectorAll("[data-dev-fact], [data-dev-rich], [contenteditable]").forEach((cell) => {
    for (const name of ["data-dev-fact", "data-dev-rich", "contenteditable", "spellcheck", "role", "aria-label"]) {
      cell.removeAttribute(name);
    }
  });
  return clone.innerHTML;
}


type FormatKind =
  | "bold"
  | "italic"
  | "strike"
  | "inlineCode"
  | "link"
  | "heading"
  | "quote"
  | "list"
  | "callout"
  | "code"
  | "rule"
  | "table"
  | "h3"
  | "numbered"
  | "task"
  | "footnote"
  | "player";

/** Every callout kind the stylesheet knows, plus the two the pipeline treats specially. */
const CALLOUT_KINDS = [
  "note",
  "tip",
  "info",
  "warning",
  "caution",
  "danger",
  "question",
  "abstract",
  "todo",
  "done",
  "check",
  "success",
  "bug",
  "error",
  "failure",
  "spoiler",
  "pull",
];

interface PreviewOriginal {
  host: HTMLElement;
  html: string;
  facts?: HTMLElement;
  factsHtml?: string;
}

interface StoredDraft {
  baseline: DevFields;
  draft: DevFields;
  revision: string;
  revisionUk?: string;
}

const DRAFT_STORAGE_PREFIX = "vault-dev-draft:";
const DRAWER_HEIGHT_KEY = "vault-dev-drawer-height";
const DRAWER_MIN = 180;
const PREVIEW_DELAY = 180;
const PREVIEW_KEYS: BodyFieldKey[] = ["body", "body_uk"];

function readStoredDraft(source: string): StoredDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_PREFIX + source);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

function writeStoredDraft(source: string, value: StoredDraft | null) {
  try {
    if (value) sessionStorage.setItem(DRAFT_STORAGE_PREFIX + source, JSON.stringify(value));
    else sessionStorage.removeItem(DRAFT_STORAGE_PREFIX + source);
  } catch {
    /* private mode or a full store: the in-memory draft still stands */
  }
}

function clampDrawerHeight(height: number) {
  const max = typeof window === "undefined" ? 600 : Math.round(window.innerHeight * 0.8);
  return Math.min(Math.max(Math.round(height), DRAWER_MIN), Math.max(DRAWER_MIN, max));
}

function initialDrawerHeight() {
  if (typeof window === "undefined") return 360;
  try {
    const stored = Number(localStorage.getItem(DRAWER_HEIGHT_KEY));
    return clampDrawerHeight(stored || 360);
  } catch {
    return 360;
  }
}

/** Bring a source position into view; lines are estimated, wrapping ignored. */
function scrollTextareaTo(textarea: HTMLTextAreaElement, position: number) {
  const line = textarea.value.slice(0, position).split("\n").length;
  const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 22;
  textarea.scrollTop = Math.max(0, (line - 3) * lineHeight);
}

const SAVED_EVENT = "vault-dev-editor-saved";

type EditorMessage =
  | "saved"
  | "conflict"
  | "unavailable"
  | "saveFailed"
  | "uploading"
  | "uploaded"
  | "uploadFailed"
  | "translationCreated"
  | "translationFailed"
  | "outdated"
  | "draftRestored"
  | "draftDropped";

const editorMessages = {
  saved: devUi.devSaved,
  conflict: devUi.devConflict,
  unavailable: devUi.devUnavailable,
  saveFailed: devUi.devSaveFailed,
  uploading: devUi.devUploading,
  uploaded: devUi.devUploaded,
  uploadFailed: devUi.devUploadFailed,
  translationCreated: devUi.devTranslationCreated,
  translationFailed: devUi.devTranslationFailed,
  outdated: devUi.devSidecarOutdated,
  draftRestored: devUi.devDraftRestored,
  draftDropped: devUi.devDraftDropped,
} satisfies Record<EditorMessage, { en: string; uk: string }>;

/** What to do about a message, shown on hover; the done ones need nothing. */
const editorHelp = {
  saved: devUi.devHelpDone,
  conflict: devUi.devHelpConflict,
  unavailable: devUi.devHelpUnavailable,
  saveFailed: devUi.devHelpSaveFailed,
  uploading: devUi.devHelpDone,
  uploaded: devUi.devHelpDone,
  uploadFailed: devUi.devHelpUploadFailed,
  translationCreated: devUi.devHelpDone,
  translationFailed: devUi.devHelpTranslationFailed,
  outdated: devUi.devHelpOutdated,
  draftRestored: devUi.devHelpDone,
  draftDropped: devUi.devHelpDraftDropped,
} satisfies Record<EditorMessage, { en: string; uk: string }>;

/** Good news goes on its own; problems stay until dismissed. */
const TRANSIENT_MESSAGES = new Set<EditorMessage>(["saved", "uploaded", "translationCreated", "draftRestored"]);
const MESSAGE_TTL = 4000;

interface LinkMenu {
  start: number;
  query: string;
  index: number;
}

interface AttachedAsset {
  embed: string;
}

function isImage(file: File) {
  return file.type.startsWith("image/");
}

// A soft Next.js navigation keeps this module alive. Preserve a draft by its
// source file so opening search, following a shortcut, and coming back cannot
// silently throw work away. Hard reloads still use the browser's unload guard.
interface PageDraft {
  editor: DevEditorState;
  revisionUk?: string;
}

const pageDrafts = new Map<string, PageDraft>();
const EMPTY_FIELDS: DevFields = EMPTY_DEV_FIELDS;

class EditorRequestError extends Error {
  code: string;

  constructor(message: string, code = "request_failed") {
    super(message);
    this.code = code;
  }
}

function nullableReducer(
  state: DevEditorState | null,
  action: DevEditorAction
): DevEditorState | null {
  if (action.type === "loaded") return createDevEditorState(action.fields, action.revision);
  return state ? devEditorReducer(state, action) : null;
}

function pageSource(): PageSource {
  const page = document.querySelector<HTMLElement>("[data-dev-vault-source]");
  return {
    source: page?.dataset.devVaultSource,
    sourceUk: page?.dataset.devVaultSourceUk,
  };
}

function localizedValue(fields: DevFields, key: DevFieldKey) {
  if (key.endsWith("_uk") && !fields[key]) {
    return fields[key.slice(0, -3) as DevFieldKey];
  }
  return fields[key];
}

/** What an inline field is called, for its accessible name. */
function inlineFieldLabel(key: DevFieldKey, lang: "en" | "uk") {
  const base = key.replace(/_uk$/, "");
  if (base === "title") return devUi.devTitle[lang];
  if (base === "description") return devUi.devDescription[lang];
  if (base === "author_bio") return devUi.devCreatorBio[lang];
  if (base === "artist_bio") return devUi.devArtistBio[lang];
  return devUi.devCreatorName[lang];
}

function inlineFieldLimit(key: DevFieldKey) {
  return key.startsWith("title") || /^(author|artist)(_uk)?$/.test(key) ? 300 : 4000;
}

function fieldTarget(marker: HTMLElement, lang: "en" | "uk") {
  return (
    marker.querySelector<HTMLElement>(lang === "uk" ? ".lang-uk" : ".lang-en") ?? marker
  );
}

export default function DevTools() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, toggle: toggleLang } = useLang();
  const [available, setAvailable] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [source, setSource] = useState<PageSource>({});
  const [editor, dispatch] = useReducer(nullableReducer, null);
  const [documentInfo, setDocumentInfo] = useState<EditorDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<EditorMessage | null>(null);
  const [conflict, setConflict] = useState(false);
  const [activeBody, setActiveBody] = useState<ActiveBodyEditor | null>(null);
  const [hasBody, setHasBody] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [hasOptions, setHasOptions] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const editorRef = useRef<DevEditorState | null>(null);
  const factEditing = useRef<HTMLElement | null>(null);
  const richLinkAnchor = useRef<{ node: Text; offset: number } | null>(null);
  const richInputRef = useRef<(() => void) | null>(null);
  const richKeyDownRef = useRef<((event: KeyboardEvent) => void) | null>(null);
  const richBlurRef = useRef<(() => void) | null>(null);
  const pendingCaret = useRef<{ x: number; y: number } | null>(null);
  // Set when a block closes: the article's catch-up render goes at once.
  const repaintNow = useRef(false);
  // Block mode: the block's current `[start, end)` in the draft; every
  // keystroke moves the end, and the textarea's value is derived from it.
  const [blockRange, setBlockRange] = useState({ start: 0, end: 0 });
  const lastCommitted = useRef<string | null>(null);
  const [linkMenu, setLinkMenu] = useState<LinkMenu | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creatingTranslation, setCreatingTranslation] = useState(false);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(initialDrawerHeight);
  const tokenRef = useRef<string | null>(null);
  const pendingSelection = useRef<{ start: number; end: number; menu?: boolean } | null>(null);
  const pendingJump = useRef<string | null>(null);
  const activeBodyRef = useRef<ActiveBodyEditor | null>(null);
  const drawerHeightRef = useRef(drawerHeight);
  const originalHtml = useRef(new Map<BodyFieldKey, PreviewOriginal>());
  const previewTimers = useRef<Partial<Record<BodyFieldKey, number>>>({});
  const previewSerial = useRef<Partial<Record<BodyFieldKey, number>>>({});
  const storeTimer = useRef<number | undefined>(undefined);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // The public search index doubles as the wiki-link target list: every page
  // that can be linked is in it, under both of its titles.
  // Loaded as soon as the dock opens: the round-trip test on the FIRST press
  // already needs every wiki link's title, or every paragraph with a link
  // would open as source once.
  const searchItems = useSearchIndex(expanded);
  const pageGeneration = useRef(0);
  const loadRequest = useRef(0);
  const editGroup = useRef<{ key: DevFieldKey; at: number } | null>(null);
  const pencilRef = useRef<HTMLButtonElement>(null);
  const refocusPencil = useRef(false);
  const bodyEditorRef = useRef<HTMLTextAreaElement>(null);
  const focusEditorOnLoad = useRef(false);

  const dirty = editor ? devEditorDirty(editor) : false;
  const bodyKey: BodyFieldKey = lang === "uk" && source.sourceUk ? "body_uk" : "body";
  const messageText = message ? editorMessages[message][lang] : null;
  const barVisible = expanded && available;
  const toolsVisible = Boolean(documentInfo && editor && hasBody && source.source);
  const activeBodyValue = activeBody && editor ? editor.draft[activeBody.key] : undefined;
  const editorText =
    activeBodyValue === undefined
      ? ""
      : activeBody?.mode === "block"
        ? activeBodyValue.slice(blockRange.start, blockRange.end)
        : activeBodyValue;
  const words = useMemo(() => countWords(activeBodyValue ?? ""), [activeBodyValue]);
  const linkMatches = linkMenu ? wikiLinkMatches(searchItems, linkMenu.query) : [];
  const linkIndex = linkMenu ? Math.min(linkMenu.index, Math.max(0, linkMatches.length - 1)) : 0;

  const edit = useCallback((key: DevFieldKey, value: string) => {
    const now = performance.now();
    const previous = editGroup.current;
    const record = !previous || previous.key !== key || now - previous.at > 700;
    editGroup.current = { key, at: now };
    dispatch({ type: "edit", key, value, record });
    setMessage(null);
    setConflict(false);
  }, []);

  useEffect(() => {
    setAvailable(isDevToolsAvailable(process.env.NODE_ENV, window.location.hostname));
  }, []);

  useEffect(() => {
    if (!message || !TRANSIENT_MESSAGES.has(message)) return;
    const timer = window.setTimeout(() => setMessage(null), MESSAGE_TTL);
    return () => window.clearTimeout(timer);
  }, [message]);

  // Fact cells and other imperative listeners read the draft at event time.
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);


  // Clear the writable model immediately on navigation. Reading the new
  // route's source marker waits a tick so its Page has committed first — a
  // timer, not an animation frame, because a background tab paints nothing
  // and an editor opened there would sit at "no source" until it was looked at.
  useEffect(() => {
    pageGeneration.current += 1;
    loadRequest.current += 1;
    setSource({});
    setDocumentInfo(null);
    dispatch({ type: "loaded", fields: EMPTY_FIELDS, revision: "" });
    setMessage(null);
    setConflict(false);
    setActiveBody(null);
    setOptionsOpen(false);
    setLoading(false);
    setSaving(false);
    originalHtml.current.clear();
    const timer = window.setTimeout(() => {
      setSource(pageSource());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const sessionToken = useCallback(async (fresh = false) => {
    if (!fresh && tokenRef.current) return tokenRef.current;
    const response = await fetch("/__vault-editor/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new EditorRequestError("Editor session unavailable");
    const payload = (await response.json()) as { token?: string; protocol?: number };
    if (!payload.token) throw new EditorRequestError("Editor session unavailable");
    // An older sidecar is the one failure a restart always fixes; say so
    // instead of letting every later request fail in its own words.
    if (payload.protocol !== EDITOR_PROTOCOL) {
      throw new EditorRequestError("The editor sidecar is out of date", "sidecar_outdated");
    }
    tokenRef.current = payload.token;
    return payload.token;
  }, []);

  const request = useCallback(
    async <T,>(endpoint: string, body: object): Promise<T> => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const token = await sessionToken(attempt > 0);
        const response = await fetch(`/__vault-editor/${endpoint}`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-Vault-Editor-Token": token,
          },
          body: JSON.stringify(body),
        });
        if (response.status === 403 && attempt === 0) {
          tokenRef.current = null;
          continue;
        }
        const payload = (await response.json().catch(() => ({}))) as {
          code?: string;
          message?: string;
        };
        if (response.status === 404 && payload.code === "not_found") {
          throw new EditorRequestError("The editor sidecar is out of date", "sidecar_outdated");
        }
        if (!response.ok) {
          throw new EditorRequestError(payload.message ?? "Editor request failed", payload.code);
        }
        return payload as T;
      }
      throw new EditorRequestError("Editor session unavailable");
    },
    [sessionToken]
  );

  const loadDocument = useCallback(async (restoreDraft = true) => {
    if (!source.source) return;
    const generation = pageGeneration.current;
    const requestId = ++loadRequest.current;
    setLoading(true);
    setMessage(null);
    setConflict(false);
    try {
      const payload = await request<EditorDocument>("page-document", {
        source: source.source,
        sourceUk: source.sourceUk,
      });
      if (generation !== pageGeneration.current || requestId !== loadRequest.current) return;
      const remembered = restoreDraft ? pageDrafts.get(payload.source) : undefined;
      // A draft that outlived a reload comes back only against the exact
      // files it was written over; if Obsidian changed either since, it is
      // dropped and said so — a silent overwrite is the one thing this
      // editor never does.
      const stored = !remembered && restoreDraft ? readStoredDraft(payload.source) : null;
      let restored: DevEditorState | null = null;
      let storedMessage: EditorMessage | null = null;
      if (stored) {
        if (stored.revision === payload.revision && stored.revisionUk === payload.revisionUk) {
          restored = {
            baseline: stored.baseline,
            draft: stored.draft,
            past: [stored.baseline],
            future: [],
            revision: stored.revision,
          };
          storedMessage = "draftRestored";
        } else {
          writeStoredDraft(payload.source, null);
          storedMessage = "draftDropped";
        }
      }
      // A remembered draft must retain the complete revision snapshot it was
      // based on. Using the freshly loaded UK revision here would let an old
      // translated draft overwrite a newer Obsidian edit when English stayed
      // unchanged.
      setDocumentInfo(
        remembered ? { ...payload, revisionUk: remembered.revisionUk } : payload
      );
      dispatch(
        remembered
          ? { type: "restored", state: remembered.editor }
          : restored
            ? { type: "restored", state: restored }
            : { type: "loaded", fields: payload.fields, revision: payload.revision }
      );
      if (storedMessage) setMessage(storedMessage);
    } catch (error) {
      if (generation !== pageGeneration.current || requestId !== loadRequest.current) return;
      setDocumentInfo(null);
      setMessage(
        error instanceof EditorRequestError && error.code === "sidecar_outdated"
          ? "outdated"
          : "unavailable"
      );
    } finally {
      if (generation === pageGeneration.current && requestId === loadRequest.current) {
        setLoading(false);
      }
    }
  }, [request, source.source, source.sourceUk]);

  useEffect(() => {
    if (expanded && source.source && !documentInfo && !loading && !message) void loadDocument();
  }, [documentInfo, expanded, loadDocument, loading, message, source.source]);

  // Drafts live in two places: this module (with undo history, for soft
  // navigation) and sessionStorage (without it, for a reload). The storage
  // copy is written a beat after the last keystroke, since it carries the
  // whole body.
  useEffect(() => {
    if (!source.source || !editor || !documentInfo) return;
    const key = source.source;
    window.clearTimeout(storeTimer.current);
    if (devEditorDirty(editor)) {
      pageDrafts.set(key, { editor, revisionUk: documentInfo.revisionUk });
      const snapshot: StoredDraft = {
        baseline: editor.baseline,
        draft: editor.draft,
        revision: editor.revision,
        revisionUk: documentInfo.revisionUk,
      };
      storeTimer.current = window.setTimeout(() => writeStoredDraft(key, snapshot), 400);
    } else {
      pageDrafts.delete(key);
      writeStoredDraft(key, null);
    }
  }, [documentInfo, editor, source.source]);

  // The Top-list star editor can save the same document independently. Keep
  // this page draft's revision current without replacing in-progress text;
  // the next Save then remains conflict-safe.
  useEffect(() => {
    const saved = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          source?: string;
          revision?: string;
          revisionUk?: string;
          fields?: DevFields;
          reload?: boolean;
        }>
      ).detail;
      if (
        !detail ||
        detail.source !== documentInfo?.source ||
        typeof detail.revision !== "string"
      )
        return;
      // Page options can change the title or description, which are also
      // inline fields here: re-read the page so the markers and the draft's
      // baseline follow. Only when nothing is in progress — the islands
      // refuse to save under a dirty draft, so this is the ordinary case.
      if (detail.reload && !dirty) {
        void loadDocument(false);
        return;
      }
      if (detail.fields && dirty) {
        // A specialised page control should refuse while this draft is dirty.
        // If a race still lets it save, retaining the old revisions makes the
        // next page Save conflict instead of overwriting that external change.
        setConflict(true);
        setMessage("conflict");
        return;
      }
      setDocumentInfo((current) =>
        current
          ? {
              ...current,
              revision: detail.revision!,
              revisionUk: detail.revisionUk ?? current.revisionUk,
              fields: detail.fields ?? current.fields,
            }
          : current
      );
      dispatch(
        detail.fields
          ? { type: "saved", fields: detail.fields, revision: detail.revision }
          : { type: "revision", revision: detail.revision }
      );
      setMessage(null);
      setConflict(false);
    };
    window.addEventListener(SAVED_EVENT, saved);
    return () => window.removeEventListener(SAVED_EVENT, saved);
  }, [dirty, documentInfo?.source, loadDocument]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-dev-tools", expanded && available);
    return () => document.documentElement.removeAttribute("data-dev-tools");
  }, [available, expanded]);

  useEffect(() => {
    document.documentElement.toggleAttribute(
      "data-dev-dirty",
      dirty || saving || activeBody?.mode === "block" || activeBody?.mode === "rich"
    );
    return () => document.documentElement.removeAttribute("data-dev-dirty");
  }, [activeBody, dirty, saving]);

  // Keep the visible text in sync with Undo/Redo/Cancel without replacing a
  // focused node on every keystroke (which would move the caret).
  useEffect(() => {
    if (!editor || !documentInfo) return;
    const model = expanded ? editor.draft : editor.baseline;
    const markers = document.querySelectorAll<HTMLElement>("[data-dev-field-en]");
    for (const marker of markers) {
      const enKey = marker.dataset.devFieldEn as DevFieldKey | undefined;
      const ukKey = marker.dataset.devFieldUk as DevFieldKey | undefined;
      if (!enKey || !ukKey || enKey === "body" || enKey === "body_uk") continue;

      const enSpan = marker.querySelector<HTMLElement>(".lang-en");
      const ukSpan = marker.querySelector<HTMLElement>(".lang-uk");
      if (enSpan && ukSpan) {
        const enValue = expanded && lang === "en" ? model[enKey] : localizedValue(model, enKey);
        const ukValue = expanded && lang === "uk" ? model[ukKey] : localizedValue(model, ukKey);
        if (enSpan.textContent !== enValue) enSpan.textContent = enValue;
        if (ukSpan.textContent !== ukValue) ukSpan.textContent = ukValue;
      } else {
        const key = lang === "uk" ? ukKey : enKey;
        const value = expanded ? model[key] : localizedValue(model, key);
        if (marker.textContent !== value) marker.textContent = value;
      }
    }
  }, [documentInfo, editor, expanded, lang]);

  // Title and description stay where the public page renders them. While the
  // dock is open, only the active language span becomes a plain-text editing
  // surface. These listeners stay mounted through ordinary input so focus and
  // selection remain native.
  useEffect(() => {
    if (!expanded || !editor || !documentInfo) return;
    const cleanups: Array<() => void> = [];
    const markers = document.querySelectorAll<HTMLElement>("[data-dev-field-en]");
    for (const marker of markers) {
      const enKey = marker.dataset.devFieldEn as DevFieldKey | undefined;
      const ukKey = marker.dataset.devFieldUk as DevFieldKey | undefined;
      if (!enKey || !ukKey || enKey === "body" || enKey === "body_uk") continue;
      const key = lang === "uk" ? ukKey : enKey;
      const target = fieldTarget(marker, lang);
      const label = inlineFieldLabel(key, lang);
      target.contentEditable = "plaintext-only";
      target.spellcheck = true;
      target.dataset.devInlineEditable = key;
      target.setAttribute("role", "textbox");
      target.setAttribute("aria-label", label);
      target.setAttribute("aria-multiline", "false");
      if (key.endsWith("_uk")) {
        target.dataset.devInlinePlaceholder = localizedValue(editor.draft, enKey);
      }

      const input = () => {
        const limit = inlineFieldLimit(key);
        const value = (target.textContent ?? "").slice(0, limit);
        if (target.textContent !== value) target.textContent = value;
        edit(key, value);
      };
      const beforeInput = (event: InputEvent) => {
        if (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak") {
          event.preventDefault();
        }
      };
      const paste = (event: ClipboardEvent) => {
        event.preventDefault();
        const text = (event.clipboardData?.getData("text/plain") ?? "")
          .replace(/\s*\r?\n+\s*/g, " ");
        document.execCommand("insertText", false, text);
      };
      const blur = () => {
        editGroup.current = null;
      };
      // A creator's name can be a link to their studio page; while the dock
      // is open a press on it edits the name instead of leaving.
      const link = marker.closest("a");
      const keepPress = (event: MouseEvent) => {
        if (link?.contains(event.target as Node)) event.preventDefault();
      };
      target.addEventListener("input", input);
      target.addEventListener("beforeinput", beforeInput);
      target.addEventListener("paste", paste);
      target.addEventListener("blur", blur);
      link?.addEventListener("click", keepPress);
      cleanups.push(() => {
        target.removeEventListener("input", input);
        target.removeEventListener("beforeinput", beforeInput);
        target.removeEventListener("paste", paste);
        target.removeEventListener("blur", blur);
        link?.removeEventListener("click", keepPress);
        target.removeAttribute("contenteditable");
        target.removeAttribute("spellcheck");
        target.removeAttribute("data-dev-inline-editable");
        target.removeAttribute("role");
        target.removeAttribute("aria-label");
        target.removeAttribute("aria-multiline");
        target.removeAttribute("data-dev-inline-placeholder");
      });
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [documentInfo?.source, edit, expanded, lang]);

  // A fact table's values ("One-liner", "Aired") are edited where they
  // render, as plain text, and written back into the row's cell in the body
  // — but only when the value has no Markdown of its own; a value with a
  // link is edited as source through the block editor instead.
  useEffect(() => {
    if (!expanded || !editor || !documentInfo) return;
    const cleanups: Array<() => void> = [];
    const wire = () => {
      const containers = document.querySelectorAll<HTMLElement>(
        "[data-dev-facts-field], [data-dev-body-field]"
      );
      for (const container of containers) {
        const key = (container.dataset.devFactsField ?? container.dataset.devBodyField) as
          | BodyFieldKey
          | undefined;
        if (!key) continue;
        for (const row of container.querySelectorAll<HTMLTableRowElement>("table.fact-table tr")) {
          const cells = row.querySelectorAll("td");
          if (cells.length < 2 || cells[1].querySelector(".stars") || cells[1].hasAttribute("data-dev-fact")) continue;
          const label = cells[0].textContent ?? "";
          const found = findFactRow(editorRef.current?.draft[key] ?? "", label);
          if (!found || !found.plain) continue;
          const cell = cells[1];
          cell.setAttribute("data-dev-fact", key);
          cell.contentEditable = "plaintext-only";
          cell.spellcheck = true;
          cell.setAttribute("role", "textbox");
          cell.setAttribute("aria-label", `${devUi.devFactValue[lang]}: ${label.trim()}`);
          const input = () => {
            const body = editorRef.current?.draft[key];
            if (body === undefined) return;
            const next = replaceFactValue(body, label, cell.textContent ?? "");
            if (next !== null) edit(key, next);
          };
          const keydown = (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              cell.blur();
            }
          };
          const focus = () => {
            factEditing.current = cell;
          };
          const blur = () => {
            editGroup.current = null;
            if (factEditing.current === cell) factEditing.current = null;
            setPreviewNonce((value) => value + 1);
          };
          const click = (event: MouseEvent) => event.stopPropagation();
          cell.addEventListener("input", input);
          cell.addEventListener("keydown", keydown);
          cell.addEventListener("focus", focus);
          cell.addEventListener("blur", blur);
          cell.addEventListener("click", click, true);
          cleanups.push(() => {
            cell.removeEventListener("input", input);
            cell.removeEventListener("keydown", keydown);
            cell.removeEventListener("focus", focus);
            cell.removeEventListener("blur", blur);
            cell.removeEventListener("click", click, true);
            cell.removeAttribute("data-dev-fact");
            cell.removeAttribute("contenteditable");
            cell.removeAttribute("spellcheck");
            cell.removeAttribute("role");
            cell.removeAttribute("aria-label");
          });
        }
      }
    };
    wire();
    // Re-wired after every live repaint, since a repaint replaces the cells.
    const observer = new MutationObserver(() => wire());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [documentInfo?.source, edit, expanded, lang, previewNonce]);

  // Page options live in the page (the entry's server slot knows the note)
  // and render INTO the bar through its mount; the bar only needs to know
  // whether anything arrived, to show the button.
  useEffect(() => {
    if (!expanded) return;
    const sync = () => {
      const mount = document.querySelector("[data-dev-options-mount]");
      setHasOptions(Boolean(mount && mount.childElementCount > 0));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [expanded, pathname]);

  // The bar's real height, for the page's padding and the dock's lift: the
  // toolbar wraps on a phone and source mode is taller.
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(".dev-editor-drawer");
    if (!bar) {
      document.documentElement.removeAttribute("data-dev-bar");
      document.documentElement.style.removeProperty("--dev-bar-h");
      return;
    }
    document.documentElement.setAttribute("data-dev-bar", "");
    const measure = () => {
      const height = Math.ceil(bar.getBoundingClientRect().height);
      // A tab that is not laid out (hidden, or before first paint) measures
      // zero; the stylesheet's fallback is better than a zero.
      if (height > 0) document.documentElement.style.setProperty("--dev-bar-h", `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [barVisible, activeBody?.mode, drawerHeight]);

  // The body is Markdown, not rendered HTML. A press on a paragraph opens
  // that block's own Markdown in a textarea standing where the block was;
  // the rest of the article stays rendered and keeps updating live. A press
  // below the text starts a new paragraph. Third-party controls keep their
  // ordinary interaction. The whole-body source is one toolbar press away.
  useEffect(() => {
    if (!expanded || !editor || !documentInfo) return;
    // Marked on arrival, not once: a Ukrainian article that appears after
    // `router.refresh()` (a translation just created) is editable at once.
    const mark = () => {
      const hosts = document.querySelectorAll<HTMLElement>("[data-dev-body-field]");
      setHasBody(hosts.length > 0);
      for (const host of hosts) {
        if (host.hasAttribute("data-dev-body-ready")) continue;
        host.dataset.devBodyReady = "true";
        host.tabIndex = 0;
        host.setAttribute("aria-label", devUi.devBody[lang]);
      }
    };
    mark();
    const observer = new MutationObserver(mark);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const host of document.querySelectorAll<HTMLElement>("[data-dev-body-ready]")) {
        delete host.dataset.devBodyReady;
        host.removeAttribute("tabindex");
        host.removeAttribute("aria-label");
      }
    };
  }, [documentInfo?.source, editor, expanded, lang]);

  useEffect(() => {
    if (expanded) return;
    setActiveBody(null);
    setOptionsOpen(false);
    // The corner pencil is a different node from the bar's; it mounts with
    // this render, so focus it here rather than a frame after Escape.
    if (refocusPencil.current) {
      refocusPencil.current = false;
      pencilRef.current?.focus();
    }
  }, [expanded]);

  useEffect(() => {
    setActiveBody(null);
  }, [lang, pathname]);

  // While something is being edited: the article carries a quiet outline, a
  // block's mount stands in its place (the block hides), the page gets room
  // for the source bar, and in source mode the caret lands on the pressed
  // paragraph. Focus is `autoFocus` on the textarea (applied by React at
  // commit), not a focus() here: the press has already focused the article,
  // and a frame later the browser keeps the article.
  useEffect(() => {
    activeBodyRef.current = activeBody;
    if (!activeBody) return;
    const { host, mode, mount, element } = activeBody;
    host.dataset.devBodyLive = "true";
    if (mode === "source") document.documentElement.setAttribute("data-dev-editing", "");
    let richCleanup: (() => void) | undefined;
    if (mode === "rich" && element) {
      element.setAttribute("data-dev-rich", "");
      element.contentEditable = "true";
      element.spellcheck = true;
      // What is not part of this block's text stays out of the edit.
      const frozen = [...element.querySelectorAll<HTMLElement>("ul, ol, .heading-anchor, .sidenote, input")];
      for (const part of frozen) part.contentEditable = "false";
      const caret = pendingCaret.current;
      pendingCaret.current = null;
      element.focus({ preventScroll: true });
      const range = caret ? caretAt(caret.x, caret.y) : null;
      if (range && element.contains(range.startContainer)) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      const input = () => richInputRef.current?.();
      const keydown = (event: KeyboardEvent) => richKeyDownRef.current?.(event);
      const paste = (event: ClipboardEvent) => {
        event.preventDefault();
        const text = event.clipboardData?.getData("text/plain") ?? "";
        document.execCommand("insertText", false, text);
      };
      const focusout = (event: FocusEvent) => {
        const next = event.relatedTarget as Element | null;
        if (next && (next.closest(".dev-editor-drawer") || element.contains(next))) return;
        richBlurRef.current?.();
      };
      element.addEventListener("input", input);
      element.addEventListener("keydown", keydown);
      element.addEventListener("paste", paste);
      element.addEventListener("focusout", focusout);
      richCleanup = () => {
        element.removeEventListener("input", input);
        element.removeEventListener("keydown", keydown);
        element.removeEventListener("paste", paste);
        element.removeEventListener("focusout", focusout);
        element.removeAttribute("data-dev-rich");
        element.removeAttribute("contenteditable");
        element.removeAttribute("spellcheck");
        for (const part of frozen) part.removeAttribute("contenteditable");
      };
    }
    const jump = pendingJump.current;
    pendingJump.current = null;
    const timer = window.setTimeout(() => {
      const textarea = bodyEditorRef.current;
      if (!textarea || mode !== "source" || !jump) return;
      const position = sourcePositionFor(textarea.value, jump);
      if (position < 0) return;
      textarea.setSelectionRange(position, position);
      scrollTextareaTo(textarea, position);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      richCleanup?.();
      delete host.dataset.devBodyLive;
      document.documentElement.removeAttribute("data-dev-editing");
      if (mode === "rich") {
        repaintNow.current = true;
        setPreviewNonce((value) => value + 1);
      }
      if (mount) {
        const hidden = mount.nextElementSibling;
        if (hidden?.hasAttribute("data-dev-block-hidden")) hidden.removeAttribute("data-dev-block-hidden");
        mount.remove();
        // The article held still while the block was open; catch it up.
        repaintNow.current = true;
        setPreviewNonce((value) => value + 1);
      }
    };
  }, [activeBody]);

  // An external change to the body under an open block — Undo, Redo, Cancel,
  // a restored draft — closes the block: its range no longer describes the
  // text, and the article re-renders from the draft on its own.
  useEffect(() => {
    if (!activeBody || activeBody.mode === "source" || activeBodyValue === undefined) return;
    if (lastCommitted.current !== null && lastCommitted.current !== activeBodyValue) {
      setActiveBody(null);
    }
  }, [activeBody, activeBodyValue]);

  // The block textarea grows with its text; the source textarea is sized by
  // the bar.
  useEffect(() => {
    const textarea = bodyEditorRef.current;
    if (!textarea || activeBody?.mode !== "block") return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [activeBody, editorText]);

  useEffect(() => {
    drawerHeightRef.current = drawerHeight;
    document.documentElement.style.setProperty("--dev-drawer-h", `${drawerHeight}px`);
  }, [drawerHeight]);

  // A programmatic edit (Tab, a chosen link, an attached image) says where the
  // caret goes; React has replaced the value by the time this runs.
  useEffect(() => {
    const selection = pendingSelection.current;
    const textarea = bodyEditorRef.current;
    if (!selection || !textarea) return;
    pendingSelection.current = null;
    textarea.setSelectionRange(selection.start, selection.end);
    if (selection.menu) {
      const query = wikiLinkQuery(textarea.value, textarea.selectionStart);
      setLinkMenu(query ? { ...query, index: 0 } : null);
    }
  }, [activeBodyValue]);

  // Live preview. Each body's rendered article is replaced with the draft's
  // rendering a beat after the last keystroke; when the draft equals the
  // file, the article gets its original server HTML back byte for byte. A
  // preview the sidecar cannot give (no TypeScript loader, an older process)
  // is reported once in the drawer, and the article simply waits for Save.
  useEffect(() => {
    if (!documentInfo || !editor) return;
    const timers = previewTimers.current;
    for (const key of PREVIEW_KEYS) {
      const host = document.querySelector<HTMLElement>(`[data-dev-body-field="${key}"]`);
      if (!host) continue;
      const value = expanded ? editor.draft[key] : editor.baseline[key];
      const original = originalHtml.current.get(key);
      window.clearTimeout(timers[key]);
      if (value === editor.baseline[key]) {
        // Also retire any preview still in flight, or its answer would paint
        // the abandoned draft over the article a moment after Cancel.
        previewSerial.current[key] = (previewSerial.current[key] ?? 0) + 1;
        const active = activeBodyRef.current;
        if (original && original.host === host && !(active && active.mode !== "source" && active.host === host)) {
          host.innerHTML = original.html;
          if (original.facts) original.facts.innerHTML = original.factsHtml ?? "";
        }
        continue;
      }
      if (previewUnavailable) continue;
      // Nothing outside an open block can change, and the article is not
      // repainted under it (#152): no request until the block closes.
      const activeNow = activeBodyRef.current;
      if (activeNow && activeNow.mode !== "source" && activeNow.host === host) continue;
      if (!original || original.host !== host) {
        const facts =
          document.querySelector<HTMLElement>(`[data-dev-facts-field="${key}"]`) ?? undefined;
        originalHtml.current.set(key, {
          host,
          html: snapshotHtml(host),
          facts,
          factsHtml: facts ? snapshotHtml(facts) : undefined,
        });
      }
      timers[key] = window.setTimeout(() => {
        const serial = (previewSerial.current[key] ?? 0) + 1;
        previewSerial.current[key] = serial;
        const generation = pageGeneration.current;
        request<{ html: string; factsHtml: string | null }>("preview", {
          source: documentInfo.source,
          body: value,
          lang: key === "body_uk" ? "uk" : "en",
        })
          .then((rendered) => {
            if (
              serial !== previewSerial.current[key] ||
              generation !== pageGeneration.current ||
              !host.isConnected
            )
              return;
            // The article is not repainted while one of its blocks is open:
            // nothing outside that block can change, the block itself is
            // hidden, and replacing the HTML would pull the editor out of
            // the document for an instant — long enough for the browser to
            // drop its focus mid-word. It repaints when the block closes.
            // A fact value being typed into is left alone the same way.
            const active = activeBodyRef.current;
            const blockOpenHere = active?.mode !== "source" && active?.host === host;
            const editingFact = factEditing.current;
            if (!blockOpenHere && !(editingFact && host.contains(editingFact))) {
              host.innerHTML = rendered.html;
            }
            const facts = originalHtml.current.get(key)?.facts;
            if (facts && !(editingFact && facts.contains(editingFact))) {
              facts.innerHTML = rendered.factsHtml ?? "";
            }
          })
          .catch((error) => {
            if (generation !== pageGeneration.current) return;
            if (
              error instanceof EditorRequestError &&
              (error.code === "preview_unavailable" || error.code === "sidecar_outdated")
            ) {
              setPreviewUnavailable(true);
            }
          });
      }, repaintNow.current ? 0 : PREVIEW_DELAY);
    }
    repaintNow.current = false;
  }, [documentInfo, editor, expanded, previewNonce, previewUnavailable, request]);

  useEffect(() => {
    if (!expanded || !documentInfo || !editor || !focusEditorOnLoad.current) return;
    focusEditorOnLoad.current = false;
    document.querySelector<HTMLElement>("[data-dev-inline-editable]")?.focus();
  }, [documentInfo, editor, expanded]);


  /**
   * Every edit goes through here: `text` is the active textarea's whole
   * value — one block's Markdown, or the whole body in source mode — and
   * the draft is updated accordingly. `start`/`end` name the selection to
   * restore after React re-renders the value (omitted for plain typing).
   */
  const commitText = (text: string, start?: number, end?: number, menu = false) => {
    if (!activeBody || !editor) return;
    if (start !== undefined) pendingSelection.current = { start, end: end ?? start, menu };
    if (activeBody.mode !== "source") {
      const next = spliceBlock(editor.draft[activeBody.key], blockRange.start, blockRange.end, text);
      setBlockRange({ start: blockRange.start, end: next.end });
      lastCommitted.current = next.body;
      edit(activeBody.key, next.body);
    } else {
      lastCommitted.current = text;
      edit(activeBody.key, text);
    }
  };

  // The server's HTML must be remembered before the mount goes in, or the
  // restore after Cancel would put the mount back as dead markup.
  const rememberOriginal = (host: HTMLElement, key: BodyFieldKey) => {
    const original = originalHtml.current.get(key);
    if (original && original.host === host) return;
    const facts =
      document.querySelector<HTMLElement>(`[data-dev-facts-field="${key}"]`) ?? undefined;
    originalHtml.current.set(key, {
      host,
      html: snapshotHtml(host),
      facts,
      factsHtml: facts ? snapshotHtml(facts) : undefined,
    });
  };

  const titleFor = (href: string) => searchItems.find((item) => item.href === href)?.title;


  const openBlock = (host: HTMLElement, target: Element, point?: { x: number; y: number }) => {
    const key = host.dataset.devBodyField as BodyFieldKey | undefined;
    if (key !== bodyKey || !editor) return;
    rememberOriginal(host, key);
    let body = editor.draft[key];
    // Leaving an empty block for another one drops it, as closing it would.
    if (activeBody && activeBody.mode !== "source" && activeBody.host === host && editorText.trim() === "") {
      const before = body.slice(0, blockRange.start).replace(/\n+$/, "");
      const after = body.slice(blockRange.end).replace(/^\n+/, "");
      const cleaned = before && after ? `${before}\n\n${after}` : before || after;
      body = cleaned && !cleaned.endsWith("\n") ? `${cleaned}\n` : cleaned;
      if (body !== editor.draft[key]) {
        lastCommitted.current = body;
        edit(key, body);
      }
    }
    const found = target === host ? null : blockAt(host, target);
    if (activeBody?.mode === "source") {
      // Source mode is open: a press on a paragraph moves the caret there.
      const textarea = bodyEditorRef.current;
      if (!textarea) return;
      const position = found ? sourcePositionFor(textarea.value, found.text) : -1;
      textarea.focus();
      if (position >= 0) {
        textarea.setSelectionRange(position, position);
        scrollTextareaTo(textarea, position);
      }
      return;
    }
    const mount = document.createElement("div");
    mount.className = "dev-block-mount";
    if (found) {
      const range = blockSourceRange(body, found.kind, found.text);
      if (!range) {
        // A block the source cannot be matched to (a raw HTML island, a
        // repeated paragraph): the whole source, caret at the top.
        pendingJump.current = found.text;
        setActiveBody({ host, key, mode: "source", mount: null, path: null });
        setLinkMenu(null);
        return;
      }
      setBlockRange(range);
      lastCommitted.current = body;
      // Edited in its own place when the render round-trips exactly.
      const shape = splitRichShape(found.kind, body.slice(range.start, range.end));
      if (shape && richMarkdown(found.element, titleFor) === shape.body) {
        pendingCaret.current = point ?? null;
        setActiveBody({ host, key, mode: "rich", mount: null, path: blockPath(host, found.element), element: found.element, shape });
        setLinkMenu(null);
        return;
      }
      found.element.setAttribute("data-dev-block-hidden", "");
      found.element.before(mount);
      setActiveBody({ host, key, mode: "block", mount, path: blockPath(host, found.element) });
    } else {
      // Below the text: a new paragraph at the end.
      const appended = appendParagraphRange(body);
      setBlockRange({ start: appended.start, end: appended.end });
      lastCommitted.current = appended.body;
      host.append(mount);
      edit(key, appended.body);
      setActiveBody({ host, key, mode: "block", mount, path: null });
    }
    setLinkMenu(null);
  };

  // The press listeners re-subscribe with every render while the dock is
  // open (they close over the current draft and block); cheap, and it keeps
  // the opener a plain function rather than a ref written during render.
  useEffect(() => {
    if (!expanded || !editor || !documentInfo) return;
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        !target ||
        target.closest(
          ".dev-editor-drawer, .dev-block-mount, [data-dev-fact], [data-dev-inline-editable], iframe, video, audio, button, input, select, label, .apple-music-block, .youtube-block"
        )
      )
        return;
      const host = target.closest<HTMLElement>("[data-dev-body-field]");
      if (!host) return;
      // Inside the block being edited in place, a press is the caret's.
      if (activeBody?.mode === "rich" && activeBody.element?.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      openBlock(host, target, { x: event.clientX, y: event.clientY });
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.target instanceof HTMLTextAreaElement) return;
      const target = event.target instanceof Element ? event.target : null;
      const host = target?.closest<HTMLElement>("[data-dev-body-field]");
      if (!host) return;
      event.preventDefault();
      openBlock(host, host);
    };
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", keydown, true);
    };
  });

  // Source and Page options share the bar's tall state: one at a time.
  const openSource = () => {
    const host = document.querySelector<HTMLElement>(`[data-dev-body-field="${bodyKey}"]`);
    if (!host) return;
    if (activeBody?.mode === "source") {
      setActiveBody(null);
      return;
    }
    lastCommitted.current = null;
    setOptionsOpen(false);
    setActiveBody({ host, key: bodyKey, mode: "source", mount: null, path: null });
    setLinkMenu(null);
  };

  const toggleOptions = () => {
    setOptionsOpen((value) => {
      if (!value && activeBody?.mode === "source") setActiveBody(null);
      return !value;
    });
  };

  const newParagraph = () => {
    const host = document.querySelector<HTMLElement>(`[data-dev-body-field="${bodyKey}"]`);
    if (host) openBlock(host, host);
  };

  const syncLinkMenu = (textarea: HTMLTextAreaElement) => {
    const query = wikiLinkQuery(textarea.value, textarea.selectionStart);
    setLinkMenu((current) =>
      query ? { ...query, index: current?.start === query.start ? current.index : 0 } : null
    );
  };

  const chooseLink = (title: string) => {
    if (activeBody?.mode === "rich") {
      const anchor = richLinkAnchor.current;
      if (!anchor || !linkMenu || !anchor.node.isConnected) return;
      const next = completeWikiLink(anchor.node.data, linkMenu.start, anchor.offset, title);
      anchor.node.data = next.value;
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(anchor.node, Math.min(next.caret, anchor.node.data.length));
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      setLinkMenu(null);
      commitRich();
      return;
    }
    const textarea = bodyEditorRef.current;
    if (!textarea || !linkMenu || !activeBody) return;
    const next = completeWikiLink(textarea.value, linkMenu.start, textarea.selectionStart, title);
    commitText(next.value, next.caret, next.caret);
    setLinkMenu(null);
    textarea.focus();
  };

  // Pasting or dropping an image does what pasting into Obsidian does: the
  // file lands in the vault (and the dev server's mirror) and its `![[…]]`
  // embed lands at the caret. Files upload one by one; the text is inserted
  // once, after the last one, so a failure inserts nothing.
  const attachImages = async (files: File[]) => {
    const textarea = bodyEditorRef.current;
    const images = files.filter(isImage);
    if (!textarea || !activeBody || !documentInfo || uploading || images.length === 0) return;
    const generation = pageGeneration.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setUploading(true);
    setMessage("uploading");
    try {
      const embeds: string[] = [];
      for (const file of images) {
        const attached = await request<AttachedAsset>("attach-asset", {
          source: documentInfo.source,
          name: file.name || "pasted-image.png",
          data: await fileToBase64(file),
          purpose: "embed",
        });
        embeds.push(attached.embed);
      }
      if (generation !== pageGeneration.current) return;
      const current = bodyEditorRef.current;
      if (!current) return;
      const inserted = insertText(current.value, start, end, embeds.join("\n"));
      commitText(inserted.value, inserted.caret, inserted.caret);
      setMessage("uploaded");
    } catch {
      if (generation === pageGeneration.current) setMessage("uploadFailed");
    } finally {
      if (generation === pageGeneration.current) setUploading(false);
    }
  };

  const closeEditor = () => {
    const host = activeBody?.host;
    // An empty block leaves nothing behind, not a stray blank line.
    if (activeBody?.mode === "block" && editor && editorText.trim() === "") {
      const body = editor.draft[activeBody.key];
      const before = body.slice(0, blockRange.start).replace(/\n+$/, "");
      const after = body.slice(blockRange.end).replace(/^\n+/, "");
      const next = before && after ? `${before}\n\n${after}` : before || after;
      lastCommitted.current = next;
      if (next !== body) edit(activeBody.key, next.endsWith("\n") || !next ? next : `${next}\n`);
    }
    setActiveBody(null);
    setLinkMenu(null);
    requestAnimationFrame(() => host?.focus());
  };

  // ↑ at the first line or ↓ at the last moves to the neighbouring block,
  // as in a notes app; the repaint that follows re-anchors the mount.
  const moveBlock = (direction: -1 | 1) => {
    if (!activeBody || activeBody.mode === "source") return false;
    const host = activeBody.host;
    const candidates = [...host.querySelectorAll<HTMLElement>(`${BLOCK_CONTAINERS}, ${BLOCK_LEAVES}`)]
      .filter((element) => !element.closest(".dev-block-mount"))
      .filter((element) => {
        // Leaves inside a container block are the container's business.
        const container = element.parentElement?.closest(BLOCK_CONTAINERS);
        return !container || container === element || !host.contains(container);
      })
      .filter((element) => element.tagName !== "P" || !element.closest("li"));
    const current = (activeBody.mode === "rich" ? activeBody.element : activeBody.mount?.nextElementSibling) as HTMLElement | null;
    const index = current ? candidates.indexOf(current) : direction < 0 ? candidates.length : -1;
    const next = candidates[index + direction];
    if (!next) return false;
    openBlock(host, next);
    return true;
  };

  // Toolbar and shortcuts write Markdown the way Obsidian's do: wrap or
  // unwrap the selection, prefix or unprefix the touched lines, and leave a
  // selected placeholder where there was only a caret.
  const format = (kind: FormatKind, calloutKind = "note") => {
    if (activeBody?.mode === "rich" && activeBody.element) {
      // In the rendered text: the browser's own bold/italic/strike, and the
      // Markdown for everything else typed at the caret — it renders when
      // the block closes.
      activeBody.element.focus({ preventScroll: true });
      const selected = window.getSelection()?.toString() ?? "";
      const command = kind === "bold" ? "bold" : kind === "italic" ? "italic" : kind === "strike" ? "strikeThrough" : null;
      if (command) document.execCommand(command);
      else if (kind === "inlineCode") document.execCommand("insertText", false, `\`${selected || "code"}\``);
      else if (kind === "link") document.execCommand("insertText", false, selected ? `[[${selected}]]` : "[[");
      else if (kind === "footnote") document.execCommand("insertText", false, "[^1]");
      else {
        const snippet =
          kind === "heading" ? "\n\n## " : kind === "h3" ? "\n\n### " : kind === "quote" ? "\n\n> " : kind === "list" ? "\n\n- " :
          kind === "numbered" ? "\n\n1. " : kind === "task" ? "\n\n- [ ] " : kind === "callout" ? `\n\n> [!${calloutKind}] ${devUi.devCallout[lang]}\n> ` :
          kind === "code" ? "\n\n```\n" + (selected || "code") + "\n```\n" : kind === "table" ? `\n\n| | |\n|---|---|\n| ${devUi.devFactValue[lang]} | … |\n` :
          kind === "rule" ? "\n\n---\n\n" : kind === "player" ? "\n\nhttps://music.apple.com/\n" : "";
        if (snippet) document.execCommand("insertText", false, snippet);
      }
      richInputRef.current?.();
      return;
    }
    const textarea = bodyEditorRef.current;
    if (!textarea || !activeBody || !editor) return;
    const { value, selectionStart: start, selectionEnd: end } = textarea;
    let next: { value: string; start: number; end: number };
    let menu = false;
    switch (kind) {
      case "h3":
        next = toggleLinePrefix(value, start, end, "### ");
        break;
      case "numbered":
        next = toggleLinePrefix(value, start, end, "1. ");
        break;
      case "task":
        next = toggleLinePrefix(value, start, end, "- [ ] ");
        break;
      case "footnote": {
        // Numbered after the last definition anywhere in the note, so a
        // footnote added inside one block never collides with another's.
        const body = editor.draft[activeBody.key];
        const used = [...body.matchAll(/^\[\^(\d+)\]:/gm)].map((match) => Number(match[1]));
        const n = (used.length ? Math.max(...used) : 0) + 1;
        const mark = insertText(value, start, end, `[^${n}]`);
        const label = devUi.devFootnoteText[lang];
        const trimmed = mark.value.replace(/\s+$/, "");
        const withNote = `${trimmed}\n\n[^${n}]: ${label}\n`;
        const at = withNote.length - label.length - 1;
        next = { value: withNote, start: at, end: at + label.length };
        break;
      }
      case "bold":
        next = wrapSelection(value, start, end, "**", "**", devUi.devBold[lang].toLowerCase());
        break;
      case "italic":
        next = wrapSelection(value, start, end, "*", "*", devUi.devItalic[lang].toLowerCase());
        break;
      case "strike":
        next = wrapSelection(value, start, end, "~~", "~~", devUi.devStrike[lang].toLowerCase());
        break;
      case "inlineCode":
        next = wrapSelection(value, start, end, "`", "`", "code");
        break;
      case "player": {
        const url = start === end ? "https://music.apple.com/" : value.slice(start, end);
        const placed = placeBlock(value, start, end, url);
        next = { value: placed.value, start: placed.at, end: placed.at + url.length };
        break;
      }
      case "rule": {
        const placed = placeBlock(value, start, end, "---");
        next = { value: placed.value, start: placed.after, end: placed.after };
        break;
      }
      case "table": {
        const label = devUi.devFactValue[lang];
        const placed = placeBlock(value, start, end, `| | |\n|---|---|\n| ${label} | … |`);
        const cell = placed.value.indexOf(`| ${label} |`, placed.at) + 2;
        next = { value: placed.value, start: cell, end: cell + label.length };
        break;
      }
      case "link":
        next = wrapSelection(value, start, end, "[[", "]]", "");
        menu = true;
        break;
      case "heading":
        next = toggleLinePrefix(value, start, end, "## ");
        break;
      case "quote":
        next = toggleLinePrefix(value, start, end, "> ");
        break;
      case "list":
        next = toggleLinePrefix(value, start, end, "- ");
        break;
      case "code": {
        const inner = start === end ? devUi.devCodeBlock[lang].toLowerCase() : value.slice(start, end);
        const placed = placeBlock(value, start, end, "```\n" + inner + "\n```");
        next = { value: placed.value, start: placed.at + 4, end: placed.at + 4 + inner.length };
        break;
      }
      case "callout": {
        const inner = value.slice(start, end);
        const head = `> [!${calloutKind}] `;
        const title = devUi.devCallout[lang];
        const placed = placeBlock(value, start, end, `${head}${title}\n> ${inner.split("\n").join("\n> ")}`);
        next = {
          value: placed.value,
          start: placed.at + head.length,
          end: placed.at + head.length + title.length,
        };
        break;
      }
    }
    commitText(next.value, next.start, next.end, menu);
    textarea.focus();
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const move = (moveEvent: PointerEvent) => {
      setDrawerHeight(clampDrawerHeight(window.innerHeight - moveEvent.clientY));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem(DRAWER_HEIGHT_KEY, String(drawerHeightRef.current));
      } catch {
        /* a forgotten height is only a default next time */
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Rich mode: the block's DOM is the draft. Serialised on every input,
  // spliced into the body under the block's syntax.
  const commitRich = () => {
    if (!activeBody || activeBody.mode !== "rich" || !activeBody.element || !activeBody.shape) return;
    const text = joinRichShape(activeBody.shape, richMarkdown(activeBody.element, titleFor));
    commitText(text);
  };
  const richInput = () => {
    commitRich();
    const caret = caretText();
    if (!caret) {
      setLinkMenu(null);
      return;
    }
    const query = wikiLinkQuery(caret.node.data, caret.offset);
    richLinkAnchor.current = query ? caret : null;
    setLinkMenu((current) =>
      query ? { ...query, index: current?.start === query.start ? current.index : 0 } : null
    );
  };
  const richBlur = () => {
    setActiveBody(null);
    setLinkMenu(null);
  };
  const richKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
      const key = shortcutKey(event);
      if (key === "b" || key === "i") {
        event.preventDefault();
        document.execCommand(key === "b" ? "bold" : "italic");
        commitRich();
        return;
      }
      if (key === "k") {
        event.preventDefault();
        document.execCommand("insertText", false, "[[");
        richInputRef.current?.();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        closeEditor();
        return;
      }
    }
    if (linkMenu && linkMatches.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : linkMatches.length - 1;
        setLinkMenu({ ...linkMenu, index: (linkIndex + step) % linkMatches.length });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        chooseLink(linkMatches[linkIndex].title);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setLinkMenu(null);
        return;
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeEditor();
      return;
    }
    if (event.key === "Enter") {
      // A line break in the text; two in a row split the paragraph on render.
      event.preventDefault();
      document.execCommand("insertLineBreak");
      commitRich();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      document.execCommand("insertText", false, "  ");
      commitRich();
    }
  };

  // The element's native listeners were attached once, when it became
  // editable; they reach the current render's handlers through these refs.
  useEffect(() => {
    richInputRef.current = richInput;
    richBlurRef.current = richBlur;
    richKeyDownRef.current = richKeyDown;
  });

  const bodyKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
      const key = shortcutKey(event);
      const shortcut: FormatKind | undefined =
        key === "b" ? "bold" : key === "i" ? "italic" : key === "k" ? "link" : undefined;
      if (shortcut) {
        event.preventDefault();
        format(shortcut);
        return;
      }
      if (event.key === "Enter" && activeBody?.mode === "block") {
        event.preventDefault();
        closeEditor();
        return;
      }
    }
    if (linkMenu && linkMatches.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : linkMatches.length - 1;
        setLinkMenu({ ...linkMenu, index: (linkIndex + step) % linkMatches.length });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        chooseLink(linkMatches[linkIndex].title);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setLinkMenu(null);
        return;
      }
    }
    // Escape leaves the editor, not the dock: the draft stays, the page keeps
    // showing it, and a second Escape closes the tools as before.
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeEditor();
      return;
    }
    if (activeBody?.mode === "block" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const caret = textarea.selectionStart;
      const atFirstLine = !textarea.value.slice(0, caret).includes("\n");
      const atLastLine = !textarea.value.slice(textarea.selectionEnd).includes("\n");
      if (event.key === "ArrowUp" && atFirstLine && moveBlock(-1)) {
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowDown" && atLastLine && moveBlock(1)) {
        event.preventDefault();
        return;
      }
      if (event.key === "Backspace" && textarea.value === "") {
        event.preventDefault();
        if (!moveBlock(-1)) closeEditor();
        return;
      }
    }
    if (event.key === "Tab" && activeBody) {
      event.preventDefault();
      const next = indentLines(
        textarea.value,
        textarea.selectionStart,
        textarea.selectionEnd,
        event.shiftKey
      );
      commitText(next.value, next.start, next.end);
    }
  };

  // A note without its Ukrainian body is unfinished. Starting one here copies
  // the English Markdown so the translation is written in place, in the
  // same editor, with every heading and embed already where it belongs.
  const createTranslation = async () => {
    if (!documentInfo || documentInfo.sourceUk || dirty || saving || creatingTranslation) return;
    const generation = pageGeneration.current;
    setCreatingTranslation(true);
    setMessage(null);
    try {
      const payload = await request<EditorDocument>("create-translation", {
        source: documentInfo.source,
      });
      if (generation !== pageGeneration.current) return;
      setSource({ source: payload.source, sourceUk: payload.sourceUk });
      setDocumentInfo(payload);
      dispatch({ type: "loaded", fields: payload.fields, revision: payload.revision });
      setMessage("translationCreated");
      router.refresh();
    } catch {
      if (generation === pageGeneration.current) setMessage("translationFailed");
    } finally {
      if (generation === pageGeneration.current) setCreatingTranslation(false);
    }
  };

  // Cancel resets the draft and leaves the drawer where it is: the author
  // is still editing, just from the file's text again.
  const cancel = () => {
    dispatch({ type: "cancel" });
    editGroup.current = null;
    setLinkMenu(null);
    setMessage(null);
    setConflict(false);
  };

  const save = useCallback(async () => {
    if (!editor || !documentInfo || !dirty || saving || !editor.draft.title.trim()) return;
    if (source.source !== documentInfo.source || pageSource().source !== documentInfo.source) {
      setMessage("unavailable");
      return;
    }
    const generation = pageGeneration.current;
    setSaving(true);
    setMessage(null);
    setConflict(false);
    try {
      const payload = await request<EditorDocument>("save-page", {
        source: documentInfo.source,
        sourceUk: documentInfo.sourceUk,
        revision: editor.revision,
        revisionUk: documentInfo.revisionUk,
        changes: devEditorChanges(editor),
      });
      if (generation !== pageGeneration.current) return;
      // The preview already shows the saved body; the refresh below swaps in
      // the server's own HTML. Forget the pre-save originals so the "back to
      // baseline" branch does not paint the old article in between.
      originalHtml.current.clear();
      setDocumentInfo(payload);
      dispatch({ type: "saved", fields: payload.fields, revision: payload.revision });
      editGroup.current = null;
      // The refresh below re-renders the article; a block mounted inside it
      // would go with the old HTML, so the editor closes first.
      setActiveBody(null);
      setMessage("saved");
      router.refresh();
    } catch (error) {
      if (generation !== pageGeneration.current) return;
      const isConflict = error instanceof EditorRequestError && error.code === "revision_conflict";
      setConflict(isConflict);
      setMessage(isConflict ? "conflict" : "saveFailed");
    } finally {
      if (generation === pageGeneration.current) setSaving(false);
    }
  }, [dirty, documentInfo, editor, request, router, saving, source.source]);

  useEffect(() => {
    if (!expanded) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (optionsOpen) {
          setOptionsOpen(false);
          return;
        }
        setExpanded(false);
        refocusPencil.current = true;
        return;
      }
      if ((event.metaKey || event.ctrlKey) && shortcutKey(event) === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [expanded, optionsOpen, save]);

  if (!available) return null;

  const publicHref = publicPageUrl(siteUrl, window.location, lang);
  const obsidianHref = documentInfo?.obsidian[lang];
  const canSave = Boolean(editor && dirty && editor.draft.title.trim() && !saving);
  const linkMenuOpen = Boolean(linkMenu && linkMatches.length > 0);
  const editing = Boolean(activeBody && editor);
  const sourceMode = activeBody?.mode === "source";
  const toolbar: Array<{ kind: FormatKind; label: string; tip: string; glyph: React.ReactNode }> = [
    { kind: "bold", label: devUi.devBold[lang], tip: devUi.devTipBold[lang], glyph: <b>B</b> },
    { kind: "italic", label: devUi.devItalic[lang], tip: devUi.devTipItalic[lang], glyph: <i>I</i> },
    { kind: "strike", label: devUi.devStrike[lang], tip: devUi.devTipStrike[lang], glyph: <s>S</s> },
    { kind: "inlineCode", label: devUi.devInlineCode[lang], tip: devUi.devTipInlineCode[lang], glyph: "`" },
    { kind: "link", label: devUi.devLink[lang], tip: devUi.devTipLink[lang], glyph: "[[ ]]" },
    { kind: "heading", label: devUi.devHeading[lang], tip: devUi.devTipHeading[lang], glyph: "H2" },
    { kind: "h3", label: devUi.devSubheading[lang], tip: devUi.devTipSubheading[lang], glyph: "H3" },
    { kind: "quote", label: devUi.devQuote[lang], tip: devUi.devTipQuote[lang], glyph: "”" },
    { kind: "list", label: devUi.devListItem[lang], tip: devUi.devTipList[lang], glyph: "•" },
    { kind: "numbered", label: devUi.devNumbered[lang], tip: devUi.devTipNumbered[lang], glyph: "1." },
    { kind: "task", label: devUi.devTask[lang], tip: devUi.devTipTask[lang], glyph: "☐" },
    { kind: "footnote", label: devUi.devFootnote[lang], tip: devUi.devTipFootnote[lang], glyph: "[^]" },
    { kind: "code", label: devUi.devCodeBlock[lang], tip: devUi.devTipCode[lang], glyph: "</>" },
    { kind: "table", label: devUi.devTable[lang], tip: devUi.devTipTable[lang], glyph: "⊞" },
    { kind: "rule", label: devUi.devRule[lang], tip: devUi.devTipRule[lang], glyph: "—" },
    { kind: "player", label: devUi.devPlayerLink[lang], tip: devUi.devTipPlayer[lang], glyph: "♪" },
  ];
  const textareaProps = activeBody && editor
    ? {
        ref: bodyEditorRef,
        value: editorText,
        lang: activeBody.key === "body_uk" ? "uk" : undefined,
        "aria-label": devUi.devBody[lang],
        autoFocus: true,
        "aria-autocomplete": "list" as const,
        "aria-controls": linkMenuOpen ? "dev-link-menu" : undefined,
        spellCheck: true,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
          commitText(event.target.value);
          syncLinkMenu(event.currentTarget);
        },
        onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
          if (linkMenu) syncLinkMenu(event.currentTarget);
        },
        onKeyDown: bodyKeyDown,
        onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
          const files = [...event.clipboardData.files];
          if (!files.some(isImage)) return;
          event.preventDefault();
          void attachImages(files);
        },
        onDragOver: (event: React.DragEvent<HTMLTextAreaElement>) => {
          if ([...event.dataTransfer.items].some((item) => item.kind === "file")) {
            event.preventDefault();
          }
        },
        onDrop: (event: React.DragEvent<HTMLTextAreaElement>) => {
          const files = [...event.dataTransfer.files];
          if (!files.some(isImage)) return;
          event.preventDefault();
          void attachImages(files);
        },
        onBlur: () => {
          editGroup.current = null;
          setLinkMenu(null);
        },
      }
    : null;
  const linkMenuList = linkMenuOpen ? (
    <ul
      id="dev-link-menu"
      className="dev-link-menu"
      role="listbox"
      aria-label={devUi.devLinkSuggestions[lang]}
    >
      {linkMatches.map((item, index) => (
        <li key={item.href} role="option" aria-selected={index === linkIndex}>
          <button
            type="button"
            className="press"
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => chooseLink(item.title)}
          >
            <span>{item.title}</span>
            {item.titleUk && item.titleUk !== item.title && (
              <span className="dev-link-menu-uk" lang="uk">{item.titleUk}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  ) : null;
  // The block editor, in the article, where the block was.
  const blockPortal =
    textareaProps && activeBody?.mode === "block" && activeBody.mount?.isConnected
      ? createPortal(
          <>
            <textarea
              {...textareaProps}
              className="dev-block-editor"
              placeholder={devUi.devBlockPlaceholder[lang]}
            />
            {linkMenuList}
          </>,
          activeBody.mount
        )
      : null;
  const pencil = (
        <button
          ref={pencilRef}
          type="button"
          aria-expanded={expanded}
          aria-label={(expanded ? devUi.devToolsClose : devUi.devToolsOpen)[lang]}
          data-tip={expanded ? devUi.devToolsClose[lang] : undefined}
          onClick={(event) => {
            if (!expanded && event.detail === 0) focusEditorOnLoad.current = true;
            setExpanded((value) => !value);
          }}
          className="press dev-tool-button"
        >
          <PenIcon className="h-[14px] w-[14px]" />
          {dirty && (
            <>
              <span className="dev-tool-dirty" aria-hidden />
              <span className="sr-only">{devUi.devUnsaved[lang]}</span>
            </>
          )}
        </button>
  );

  // Messages: a toast at the bar's right end, above it. Problems carry what
  // to do on hover and stay until dismissed; good news leaves on its own.
  const toastKind: "loading" | "noSource" | "message" | null = !expanded
    ? null
    : loading
      ? "loading"
      : !source.source
        ? "noSource"
        : message
          ? "message"
          : null;
  const toastPortal =
    toastKind
      ? createPortal(
          <div
            className="dev-toast"
            role={message && (message.endsWith("Failed") || message === "conflict" || message === "outdated" || message === "draftDropped") ? "alert" : "status"}
            data-tip={
              toastKind === "message" && message
                ? editorHelp[message][lang]
                : toastKind === "noSource"
                  ? devUi.devHelpNoSource[lang]
                  : undefined
            }
            data-tip-align="end"
          >
            <span className="dev-toast-text">
              {toastKind === "loading"
                ? devUi.devLoading[lang]
                : toastKind === "noSource"
                  ? devUi.devNoSource[lang]
                  : messageText}
            </span>
            {toastKind === "message" && documentInfo && conflict && (
              <button type="button" className="press dev-reload" onClick={() => void loadDocument(false)}>
                <ReloadIcon className="h-3.5 w-3.5" />
                {devUi.devReload[lang]}
              </button>
            )}
            {toastKind === "message" && !documentInfo && (
              <button type="button" className="press dev-reload" onClick={() => void loadDocument()}>
                <ReloadIcon className="h-3.5 w-3.5" />
                {devUi.devRetry[lang]}
              </button>
            )}
            {toastKind === "message" && (
              <button
                type="button"
                className="press dev-toast-close"
                aria-label={devUi.devDismiss[lang]}
                onClick={() => setMessage(null)}
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            )}
          </div>,
          document.body
        )
      : null;

  // The bar under the page: tools always, the whole source on request.
  const barPortal =
    barVisible
      ? createPortal(
          <section
            className="dev-editor-drawer"
            data-mode={sourceMode ? "source" : "tools"}
            style={sourceMode ? { height: drawerHeight } : undefined}
            role="region"
            aria-label={devUi.devEditorDrawer[lang]}
          >
            {sourceMode && (
              <div
                className="dev-editor-drawer-handle"
                role="separator"
                aria-orientation="horizontal"
                aria-label={devUi.devResizeEditor[lang]}
                tabIndex={0}
                onPointerDown={startResize}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                  event.preventDefault();
                  const delta = event.key === "ArrowUp" ? 40 : -40;
                  setDrawerHeight((height) => clampDrawerHeight(height + delta));
                }}
              />
            )}
            <div className="dev-editor-drawer-inner">
              <div className="dev-bar-panel" hidden={!optionsOpen} aria-label={devUi.devPageOptions[lang]}>
                <div data-dev-options-mount />
              </div>
              <div className="dev-editor-toolbar dev-bar-row" role="toolbar" aria-label={devUi.devToolsGroup[lang]}>
                <button
                  type="button"
                  className="press dev-bar-help"
                  aria-label={devUi.devEditHint[lang]}
                  data-tip={devUi.devTipHelp[lang]}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  ?
                </button>
                {toolsVisible && (
                  <>
                {toolbar.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    className="press"
                    disabled={!editing}
                    aria-label={item.label}
                    data-tip={item.tip}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => format(item.kind)}
                  >
                    {item.glyph}
                  </button>
                ))}
                <span className="dev-callout-menu" data-tip={devUi.devTipCalloutMenu[lang]}>
                  <select
                    aria-label={devUi.devCalloutKind[lang]}
                    disabled={!editing}
                    value=""
                    onChange={(event) => {
                      const kind = event.target.value;
                      if (kind) format("callout", kind);
                    }}
                  >
                    <option value="">[!]</option>
                    {CALLOUT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>{`[!${kind}]`}</option>
                    ))}
                  </select>
                </span>
                <button
                  type="button"
                  className="press"
                  disabled={!editing || uploading}
                  aria-label={devUi.devInsertImage[lang]}
                  data-tip={devUi.devTipImage[lang]}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(event) => {
                    const files = [...(event.target.files ?? [])];
                    event.target.value = "";
                    void attachImages(files);
                  }}
                />
                <span className="dev-tool-divider" aria-hidden />
                <button
                  type="button"
                  className="press"
                  aria-label={devUi.devNewParagraph[lang]}
                  data-tip={devUi.devTipNewParagraph[lang]}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={newParagraph}
                >
                  ¶+
                </button>
                <button
                  type="button"
                  className="press"
                  aria-pressed={sourceMode}
                  aria-label={devUi.devSourceMode[lang]}
                  data-tip={devUi.devTipSource[lang]}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={openSource}
                >
                  {devUi.devSourceMode[lang]}
                </button>
                    <button
                      type="button"
                      className="press dev-editor-close"
                      hidden={!editing}
                      aria-label={sourceMode ? devUi.devCloseEditor[lang] : devUi.devDoneBlock[lang]}
                      data-tip={sourceMode ? devUi.devTipClose[lang] : devUi.devTipDone[lang]}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={closeEditor}
                    >
                      {sourceMode ? <CloseIcon className="h-3.5 w-3.5" /> : devUi.devDoneBlock[lang]}
                    </button>
                    <span className="dev-tool-divider" aria-hidden />
                  </>
                )}
                {hasOptions && (
                  <button
                    type="button"
                    className="press dev-bar-options"
                    aria-expanded={optionsOpen}
                    data-tip={devUi.devTipOptions[lang]}
                    onClick={toggleOptions}
                  >
                    {devUi.devPageOptions[lang]}
                  </button>
                )}
                {editing && activeBody && (
                  <span className="dev-bar-status">
                    <span>{activeBody.key === "body_uk" ? "UK" : "EN"}</span>
                    <span aria-hidden>·</span>
                    <span>{wordCount(words)[lang]}</span>
                  </span>
                )}
                <span className="dev-tool-divider" aria-hidden />
            <a
              href={publicHref}
              aria-label={devUi.openPublicPage[lang]}
              data-tip={devUi.openPublicPage[lang]}
              onClick={(event) => {
                event.currentTarget.href = publicPageUrl(siteUrl, window.location, lang);
              }}
              className="press dev-tool-button"
            >
              <ExternalLinkIcon className="h-4 w-4" />
            </a>
            {obsidianHref ? (
              <a
                href={obsidianHref}
                aria-label={devUi.devOpenObsidian[lang]}
                data-tip={devUi.devOpenObsidian[lang]}
                className="press dev-tool-button"
              >
                <ObsidianIcon className="h-[17px] w-[17px]" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-label={devUi.devOpenObsidian[lang]}
                data-tip={devUi.devOpenObsidian[lang]}
                className="dev-tool-button"
              >
                <ObsidianIcon className="h-[17px] w-[17px]" />
              </button>
            )}
            {documentInfo && !documentInfo.sourceUk && (
              <button
                type="button"
                disabled={dirty || saving || creatingTranslation}
                aria-label={devUi.devCreateTranslation[lang]}
                data-tip={devUi.devCreateTranslation[lang]}
                onClick={() => void createTranslation()}
                className="press dev-tool-button"
              >
                <TranslateIcon className="h-4 w-4" />
              </button>
            )}
            <span className="dev-tool-divider" aria-hidden />
            <button
              type="button"
              disabled={!editor?.past.length}
              aria-label={devUi.devUndo[lang]}
              data-tip={devUi.devUndo[lang]}
              onClick={() => {
                editGroup.current = null;
                dispatch({ type: "undo" });
              }}
              className="press dev-tool-button"
            >
              <UndoIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!editor?.future.length}
              aria-label={devUi.devRedo[lang]}
              data-tip={devUi.devRedo[lang]}
              onClick={() => {
                editGroup.current = null;
                dispatch({ type: "redo" });
              }}
              className="press dev-tool-button"
            >
              <RedoIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={ui.actionToggleLang[lang]}
              data-tip={ui.actionToggleLang[lang]}
              onClick={() => {
                editGroup.current = null;
                toggleLang();
              }}
              className="press dev-tool-button text-[15px]"
            >
              {lang === "en" ? "🇨🇦" : "🇺🇦"}
            </button>
            <span className="dev-tool-divider" aria-hidden />
            <button
              type="button"
              disabled={!dirty || saving}
              aria-label={devUi.devCancel[lang]}
              data-tip={devUi.devCancel[lang]}
              onClick={cancel}
              className="press dev-tool-button"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canSave}
              aria-label={devUi.devSave[lang]}
              data-tip={devUi.devSave[lang]}
              onClick={() => void save()}
              className="press dev-tool-button dev-save"
            >
              <SaveIcon className="h-4 w-4" />
            </button>
                <span className="dev-tool-divider" aria-hidden />
                {pencil}
              </div>
              {sourceMode && textareaProps && (
                <div className="dev-editor-drawer-body">
                  <textarea {...textareaProps} className="dev-body-editor" />
                  {linkMenuList}
                </div>
              )}
            </div>
          </section>,
          document.body
        )
      : null;


  return (
    <>
      {blockPortal}
      {barPortal}
      {toastPortal}
      {!expanded && (
        <div className="dev-dock">
          <div className="dev-dock-bar" role="group" aria-label={devUi.devToolsGroup[lang]}>
            {pencil}
          </div>
        </div>
      )}
    </>
  );
}
