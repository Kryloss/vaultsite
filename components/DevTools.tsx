"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
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
  completeWikiLink,
  countWords,
  createDevEditorState,
  devEditorChanges,
  devEditorDirty,
  devEditorReducer,
  indentLines,
  insertText,
  isDevToolsAvailable,
  publicPageUrl,
  sourcePositionFor,
  toggleLinePrefix,
  wikiLinkMatches,
  wikiLinkQuery,
  wrapSelection,
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

interface ActiveBodyEditor {
  host: HTMLElement;
  key: BodyFieldKey;
}

type FormatKind = "bold" | "italic" | "link" | "heading" | "quote" | "list" | "callout" | "code";

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
const PREVIEW_DELAY = 250;
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
const EMPTY_FIELDS: DevFields = {
  title: "",
  title_uk: "",
  description: "",
  description_uk: "",
  body: "",
  body_uk: "",
};

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
  if (key === "title_uk" && !fields.title_uk) return fields.title;
  if (key === "description_uk" && !fields.description_uk) return fields.description;
  return fields[key];
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
  const searchItems = useSearchIndex(Boolean(activeBody));
  const pageGeneration = useRef(0);
  const loadRequest = useRef(0);
  const editGroup = useRef<{ key: DevFieldKey; at: number } | null>(null);
  const pencilRef = useRef<HTMLButtonElement>(null);
  const bodyEditorRef = useRef<HTMLTextAreaElement>(null);
  const focusEditorOnLoad = useRef(false);

  const dirty = editor ? devEditorDirty(editor) : false;
  const bodyKey: BodyFieldKey = lang === "uk" && source.sourceUk ? "body_uk" : "body";
  const messageText = message ? editorMessages[message][lang] : null;
  const activeBodyValue = activeBody && editor ? editor.draft[activeBody.key] : undefined;
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
        }>
      ).detail;
      if (
        !detail ||
        detail.source !== documentInfo?.source ||
        typeof detail.revision !== "string"
      )
        return;
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
  }, [dirty, documentInfo?.source]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-dev-tools", expanded && available);
    return () => document.documentElement.removeAttribute("data-dev-tools");
  }, [available, expanded]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-dev-dirty", dirty || saving);
    return () => document.documentElement.removeAttribute("data-dev-dirty");
  }, [dirty, saving]);

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
      const label = key.startsWith("title") ? devUi.devTitle[lang] : devUi.devDescription[lang];
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
        const limit = key.startsWith("title") ? 300 : 4000;
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
      target.addEventListener("input", input);
      target.addEventListener("beforeinput", beforeInput);
      target.addEventListener("paste", paste);
      target.addEventListener("blur", blur);
      cleanups.push(() => {
        target.removeEventListener("input", input);
        target.removeEventListener("beforeinput", beforeInput);
        target.removeEventListener("paste", paste);
        target.removeEventListener("blur", blur);
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

  // The body is Markdown, not rendered HTML. Clicking its prose opens the
  // exact source in a drawer under the page while the article stays where it
  // is and re-renders as you type (the sidecar runs the real pipeline). A
  // press on a paragraph while the drawer is open jumps the caret to its
  // source line. Third-party controls keep their ordinary interaction.
  useEffect(() => {
    if (!expanded || !editor || !documentInfo) return;
    // Marked on arrival, not once: a Ukrainian article that appears after
    // `router.refresh()` (a translation just created) is editable at once.
    const mark = () => {
      for (const host of document.querySelectorAll<HTMLElement>(
        "[data-dev-body-field]:not([data-dev-body-ready])"
      )) {
        host.dataset.devBodyReady = "true";
        host.tabIndex = 0;
        host.setAttribute("aria-label", devUi.devBody[lang]);
      }
    };
    const blockText = (host: HTMLElement, target: Element) => {
      const block = target.closest(
        "p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th, figcaption, dt, dd"
      );
      return block && host.contains(block) ? (block.textContent ?? "") : "";
    };
    const activate = (host: HTMLElement, target?: Element) => {
      const key = host.dataset.devBodyField as BodyFieldKey | undefined;
      if (key !== bodyKey) return;
      const text = target ? blockText(host, target) : "";
      const textarea = bodyEditorRef.current;
      if (activeBodyRef.current?.host === host && textarea) {
        const position = sourcePositionFor(textarea.value, text);
        textarea.focus();
        if (position >= 0) {
          textarea.setSelectionRange(position, position);
          scrollTextareaTo(textarea, position);
        }
        return;
      }
      pendingJump.current = text;
      setActiveBody({ host, key });
      setLinkMenu(null);
    };

    mark();
    const observer = new MutationObserver(mark);
    observer.observe(document.body, { childList: true, subtree: true });
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        !target ||
        target.closest(
          ".dev-editor-drawer, iframe, video, audio, button, input, select, label, .apple-music-block, .youtube-block"
        )
      )
        return;
      const host = target.closest<HTMLElement>("[data-dev-body-field]");
      if (!host) return;
      event.preventDefault();
      event.stopPropagation();
      activate(host, target);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.target instanceof HTMLTextAreaElement) return;
      const target = event.target instanceof Element ? event.target : null;
      const host = target?.closest<HTMLElement>("[data-dev-body-field]");
      if (!host) return;
      event.preventDefault();
      activate(host);
    };
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", keydown, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", keydown, true);
      for (const host of document.querySelectorAll<HTMLElement>("[data-dev-body-ready]")) {
        delete host.dataset.devBodyReady;
        host.removeAttribute("tabindex");
        host.removeAttribute("aria-label");
      }
    };
  }, [bodyKey, documentInfo?.source, expanded, lang]);

  useEffect(() => {
    if (expanded) return;
    setActiveBody(null);
  }, [expanded]);

  useEffect(() => {
    setActiveBody(null);
  }, [lang, pathname]);

  // The article being edited is marked (an outline, nothing more), the page
  // gets room under it for the drawer, and the caret lands on the paragraph
  // that was pressed. Focus is `autoFocus` on the textarea (applied by React
  // at commit), not a focus() here: the press has already focused the
  // article, and a frame later the browser keeps the article.
  useEffect(() => {
    activeBodyRef.current = activeBody;
    if (!activeBody) return;
    const { host } = activeBody;
    host.dataset.devBodyLive = "true";
    document.documentElement.setAttribute("data-dev-editing", "");
    const jump = pendingJump.current;
    pendingJump.current = null;
    const timer = window.setTimeout(() => {
      const textarea = bodyEditorRef.current;
      if (!textarea || !jump) return;
      const position = sourcePositionFor(textarea.value, jump);
      if (position < 0) return;
      textarea.setSelectionRange(position, position);
      scrollTextareaTo(textarea, position);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      delete host.dataset.devBodyLive;
      document.documentElement.removeAttribute("data-dev-editing");
    };
  }, [activeBody]);

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
        if (original && original.host === host) {
          host.innerHTML = original.html;
          if (original.facts) original.facts.innerHTML = original.factsHtml ?? "";
        }
        continue;
      }
      if (previewUnavailable) continue;
      if (!original || original.host !== host) {
        const facts =
          document.querySelector<HTMLElement>(`[data-dev-facts-field="${key}"]`) ?? undefined;
        originalHtml.current.set(key, { host, html: host.innerHTML, facts, factsHtml: facts?.innerHTML });
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
            host.innerHTML = rendered.html;
            const facts = originalHtml.current.get(key)?.facts;
            if (facts) facts.innerHTML = rendered.factsHtml ?? "";
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
      }, PREVIEW_DELAY);
    }
  }, [documentInfo, editor, expanded, previewUnavailable, request]);

  useEffect(() => {
    if (!expanded || !documentInfo || !editor || !focusEditorOnLoad.current) return;
    focusEditorOnLoad.current = false;
    document.querySelector<HTMLElement>("[data-dev-inline-editable]")?.focus();
  }, [documentInfo, editor, expanded]);


  const applyBodyChange = useCallback(
    (key: BodyFieldKey, value: string, start: number, end: number) => {
      pendingSelection.current = { start, end };
      edit(key, value);
    },
    [edit]
  );

  const syncLinkMenu = (textarea: HTMLTextAreaElement) => {
    const query = wikiLinkQuery(textarea.value, textarea.selectionStart);
    setLinkMenu((current) =>
      query ? { ...query, index: current?.start === query.start ? current.index : 0 } : null
    );
  };

  const chooseLink = (title: string) => {
    const textarea = bodyEditorRef.current;
    if (!textarea || !linkMenu || !activeBody) return;
    const next = completeWikiLink(textarea.value, linkMenu.start, textarea.selectionStart, title);
    applyBodyChange(activeBody.key, next.value, next.caret, next.caret);
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
    const key = activeBody.key;
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
      applyBodyChange(key, inserted.value, inserted.caret, inserted.caret);
      setMessage("uploaded");
    } catch {
      if (generation === pageGeneration.current) setMessage("uploadFailed");
    } finally {
      if (generation === pageGeneration.current) setUploading(false);
    }
  };

  const closeEditor = () => {
    const host = activeBody?.host;
    setActiveBody(null);
    setLinkMenu(null);
    requestAnimationFrame(() => host?.focus());
  };

  // Toolbar and shortcuts write Markdown the way Obsidian's do: wrap or
  // unwrap the selection, prefix or unprefix the touched lines, and leave a
  // selected placeholder where there was only a caret.
  const format = (kind: FormatKind) => {
    const textarea = bodyEditorRef.current;
    if (!textarea || !activeBody) return;
    const { value, selectionStart: start, selectionEnd: end } = textarea;
    let next: { value: string; start: number; end: number };
    let menu = false;
    switch (kind) {
      case "bold":
        next = wrapSelection(value, start, end, "**", "**", devUi.devBold[lang].toLowerCase());
        break;
      case "italic":
        next = wrapSelection(value, start, end, "*", "*", devUi.devItalic[lang].toLowerCase());
        break;
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
      case "code":
        next = wrapSelection(value, start, end, "```\n", "\n```", devUi.devCodeBlock[lang].toLowerCase());
        break;
      case "callout": {
        const inner = value.slice(start, end);
        const head = "> [!note] ";
        const title = devUi.devCallout[lang];
        const block = `${head}${title}\n> ${inner.split("\n").join("\n> ")}`;
        next = {
          value: value.slice(0, start) + block + value.slice(end),
          start: start + head.length,
          end: start + head.length + title.length,
        };
        break;
      }
    }
    pendingSelection.current = { start: next.start, end: next.end, menu };
    edit(activeBody.key, next.value);
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
    if (event.key === "Tab" && activeBody) {
      event.preventDefault();
      const next = indentLines(
        textarea.value,
        textarea.selectionStart,
        textarea.selectionEnd,
        event.shiftKey
      );
      applyBodyChange(activeBody.key, next.value, next.start, next.end);
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
        setExpanded(false);
        requestAnimationFrame(() => pencilRef.current?.focus());
        return;
      }
      if ((event.metaKey || event.ctrlKey) && shortcutKey(event) === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [expanded, save]);

  if (!available) return null;

  const publicHref = publicPageUrl(siteUrl, window.location, lang);
  const obsidianHref = documentInfo?.obsidian[lang];
  const canSave = Boolean(editor && dirty && editor.draft.title.trim() && !saving);
  const feedbackVisible = expanded && (loading || Boolean(message) || !source.source);
  const linkMenuOpen = Boolean(linkMenu && linkMatches.length > 0);
  const toolbar: Array<{ kind: FormatKind; label: string; glyph: React.ReactNode }> = [
    { kind: "bold", label: devUi.devBold[lang], glyph: <b>B</b> },
    { kind: "italic", label: devUi.devItalic[lang], glyph: <i>I</i> },
    { kind: "link", label: devUi.devLink[lang], glyph: "[[ ]]" },
    { kind: "heading", label: devUi.devHeading[lang], glyph: "H2" },
    { kind: "quote", label: devUi.devQuote[lang], glyph: "”" },
    { kind: "list", label: devUi.devListItem[lang], glyph: "•" },
    { kind: "callout", label: devUi.devCallout[lang], glyph: "[!]" },
    { kind: "code", label: devUi.devCodeBlock[lang], glyph: "</>" },
  ];
  const bodyPortal =
    activeBody && editor && activeBody.host.isConnected
      ? createPortal(
          <section
            className="dev-editor-drawer"
            style={{ height: drawerHeight }}
            role="region"
            aria-label={devUi.devEditorDrawer[lang]}
          >
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
            <div className="dev-editor-drawer-inner">
              <div className="dev-editor-toolbar" role="toolbar" aria-label={devUi.devEditorDrawer[lang]}>
                {toolbar.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    className="press"
                    title={item.label}
                    aria-label={item.label}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => format(item.kind)}
                  >
                    {item.glyph}
                  </button>
                ))}
                <button
                  type="button"
                  className="press"
                  disabled={uploading}
                  title={devUi.devInsertImage[lang]}
                  aria-label={devUi.devInsertImage[lang]}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </button>
                <span className="dev-editor-meta">
                  <span>{activeBody.key === "body_uk" ? "UK" : "EN"}</span>
                  <span aria-hidden>·</span>
                  <span>{wordCount(countWords(editor.draft[activeBody.key]))[lang]}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {(previewUnavailable ? devUi.devPreviewUnavailable : devUi.devLivePreview)[lang]}
                  </span>
                </span>
                <button
                  type="button"
                  className="press dev-editor-close"
                  title={devUi.devCloseEditor[lang]}
                  aria-label={devUi.devCloseEditor[lang]}
                  onClick={closeEditor}
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="dev-editor-drawer-body">
                <textarea
                  ref={bodyEditorRef}
                  className="dev-body-editor"
                  value={editor.draft[activeBody.key]}
                  lang={activeBody.key === "body_uk" ? "uk" : undefined}
                  aria-label={devUi.devBody[lang]}
                  autoFocus
                  aria-autocomplete="list"
                  aria-controls={linkMenuOpen ? "dev-link-menu" : undefined}
                  spellCheck
                  onChange={(event) => {
                    edit(activeBody.key, event.target.value);
                    syncLinkMenu(event.currentTarget);
                  }}
                  onSelect={(event) => {
                    if (linkMenu) syncLinkMenu(event.currentTarget);
                  }}
                  onKeyDown={bodyKeyDown}
                  onPaste={(event) => {
                    const files = [...event.clipboardData.files];
                    if (!files.some(isImage)) return;
                    event.preventDefault();
                    void attachImages(files);
                  }}
                  onDragOver={(event) => {
                    if ([...event.dataTransfer.items].some((item) => item.kind === "file")) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={(event) => {
                    const files = [...event.dataTransfer.files];
                    if (!files.some(isImage)) return;
                    event.preventDefault();
                    void attachImages(files);
                  }}
                  onBlur={() => {
                    editGroup.current = null;
                    setLinkMenu(null);
                  }}
                />
                {linkMenuOpen && (
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
                )}
              </div>
            </div>
          </section>,
          document.body
        )
      : null;

  return (
    <>
      {bodyPortal}
      <div className="dev-dock" data-expanded={expanded || undefined}>
        {feedbackVisible && (
          <section
            id="dev-editor-feedback"
            className="dev-editor-panel dev-editor-feedback"
            aria-label={devUi.devPageFields[lang]}
          >
            {loading ? (
              <p className="dev-editor-note" role="status">
                {devUi.devLoading[lang]}
              </p>
            ) : !source.source ? (
              <p className="dev-editor-note">{devUi.devNoSource[lang]}</p>
            ) : message ? (
              <div className="dev-editor-status" aria-live="polite">
                <span>{messageText}</span>
                {documentInfo && conflict ? (
                  <button
                    type="button"
                    className="press dev-reload"
                    onClick={() => void loadDocument(false)}
                  >
                    <ReloadIcon className="h-3.5 w-3.5" />
                    {devUi.devReload[lang]}
                  </button>
                ) : !documentInfo ? (
                  <button
                    type="button"
                    className="press dev-reload"
                    onClick={() => void loadDocument()}
                  >
                    <ReloadIcon className="h-3.5 w-3.5" />
                    {devUi.devRetry[lang]}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        )}

        <div className="dev-dock-bar" role="group" aria-label={devUi.devToolsGroup[lang]}>
        <button
          ref={pencilRef}
          type="button"
          aria-expanded={expanded}
          aria-controls={feedbackVisible ? "dev-editor-feedback" : undefined}
          aria-label={(expanded ? devUi.devToolsClose : devUi.devToolsOpen)[lang]}
          title={(expanded ? devUi.devToolsClose : devUi.devToolsOpen)[lang]}
          onClick={(event) => {
            if (!expanded && event.detail === 0) focusEditorOnLoad.current = true;
            setExpanded((value) => !value);
          }}
          className="press dev-tool-button"
        >
          <PenIcon className="h-[17px] w-[17px]" />
          {dirty && (
            <>
              <span className="dev-tool-dirty" aria-hidden />
              <span className="sr-only">{devUi.devUnsaved[lang]}</span>
            </>
          )}
        </button>

        {expanded && (
          <>
            <span className="dev-tool-divider" aria-hidden />
            <a
              href={publicHref}
              aria-label={devUi.openPublicPage[lang]}
              title={devUi.openPublicPage[lang]}
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
                title={devUi.devOpenObsidian[lang]}
                className="press dev-tool-button"
              >
                <ObsidianIcon className="h-[17px] w-[17px]" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-label={devUi.devOpenObsidian[lang]}
                title={devUi.devOpenObsidian[lang]}
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
                title={devUi.devCreateTranslation[lang]}
                onClick={() => void createTranslation()}
                className="press dev-tool-button"
              >
                <TranslateIcon className="h-4 w-4" />
              </button>
            )}
            {activeBody && (
              <>
                <button
                  type="button"
                  disabled={uploading}
                  aria-label={devUi.devInsertImage[lang]}
                  title={devUi.devInsertImage[lang]}
                  onClick={() => imageInputRef.current?.click()}
                  className="press dev-tool-button"
                >
                  <ImageIcon className="h-4 w-4" />
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
              </>
            )}
            <span className="dev-tool-divider" aria-hidden />
            <button
              type="button"
              disabled={!editor?.past.length}
              aria-label={devUi.devUndo[lang]}
              title={devUi.devUndo[lang]}
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
              title={devUi.devRedo[lang]}
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
              title={ui.actionToggleLang[lang]}
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
              title={devUi.devCancel[lang]}
              onClick={cancel}
              className="press dev-tool-button"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canSave}
              aria-label={devUi.devSave[lang]}
              title={devUi.devSave[lang]}
              onClick={() => void save()}
              className="press dev-tool-button dev-save"
            >
              <SaveIcon className="h-4 w-4" />
            </button>
          </>
        )}
        </div>
      </div>
    </>
  );
}
