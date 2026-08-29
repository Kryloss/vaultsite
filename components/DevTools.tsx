"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  CloseIcon,
  ExternalLinkIcon,
  ObsidianIcon,
  PenIcon,
  RedoIcon,
  ReloadIcon,
  SaveIcon,
  UndoIcon,
} from "@/components/icons";
import { useLang } from "@/components/useLang";
import {
  createDevEditorState,
  devEditorChanges,
  devEditorDirty,
  devEditorReducer,
  isDevToolsAvailable,
  publicPageUrl,
  type DevEditorAction,
  type DevEditorState,
  type DevFieldKey,
  type DevFields,
} from "@/lib/dev-tools";
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

const SAVED_EVENT = "vault-dev-editor-saved";

type EditorMessage = "saved" | "conflict" | "unavailable" | "saveFailed";

const editorMessages = {
  saved: devUi.devSaved,
  conflict: devUi.devConflict,
  unavailable: devUi.devUnavailable,
  saveFailed: devUi.devSaveFailed,
} satisfies Record<EditorMessage, { en: string; uk: string }>;

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
  const tokenRef = useRef<string | null>(null);
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
  // route's source marker waits one frame so its Page has committed first.
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
    const frame = requestAnimationFrame(() => {
      setSource(pageSource());
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  const sessionToken = useCallback(async (fresh = false) => {
    if (!fresh && tokenRef.current) return tokenRef.current;
    const response = await fetch("/__vault-editor/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new EditorRequestError("Editor session unavailable");
    const payload = (await response.json()) as { token?: string };
    if (!payload.token) throw new EditorRequestError("Editor session unavailable");
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
          : { type: "loaded", fields: payload.fields, revision: payload.revision }
      );
    } catch {
      if (generation !== pageGeneration.current || requestId !== loadRequest.current) return;
      setDocumentInfo(null);
      setMessage("unavailable");
    } finally {
      if (generation === pageGeneration.current && requestId === loadRequest.current) {
        setLoading(false);
      }
    }
  }, [request, source.source, source.sourceUk]);

  useEffect(() => {
    if (expanded && source.source && !documentInfo && !loading && !message) void loadDocument();
  }, [documentInfo, expanded, loadDocument, loading, message, source.source]);

  useEffect(() => {
    if (!source.source || !editor || !documentInfo) return;
    if (devEditorDirty(editor)) {
      pageDrafts.set(source.source, { editor, revisionUk: documentInfo.revisionUk });
    }
    else pageDrafts.delete(source.source);
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

  // The body is Markdown, not rendered HTML. Clicking its prose swaps that
  // article for a source textarea in the same place; this preserves wiki
  // links, embeds, callouts and tables exactly instead of reverse-converting a
  // mutated DOM. Third-party controls keep their ordinary interaction until
  // the prose itself is selected.
  useEffect(() => {
    if (!expanded || !editor || !documentInfo) return;
    const hosts = [...document.querySelectorAll<HTMLElement>("[data-dev-body-field]")];
    const activate = (host: HTMLElement) => {
      const key = host.dataset.devBodyField as BodyFieldKey | undefined;
      if (key !== bodyKey) return;
      host.style.setProperty("--dev-body-min-h", `${Math.ceil(host.getBoundingClientRect().height)}px`);
      setActiveBody({ host, key });
    };

    for (const host of hosts) {
      host.dataset.devBodyReady = "true";
      host.tabIndex = 0;
      host.setAttribute("aria-label", devUi.devBody[lang]);
    }
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        !target ||
        target.closest(
          ".dev-body-editor, iframe, video, audio, button, input, select, label, .apple-music-block, .youtube-block"
        )
      )
        return;
      const host = target.closest<HTMLElement>("[data-dev-body-field]");
      if (!host) return;
      event.preventDefault();
      event.stopPropagation();
      activate(host);
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
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", keydown, true);
      for (const host of hosts) {
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

  useEffect(() => {
    const host = activeBody?.host;
    if (!host || !host.isConnected) return;
    host.dataset.devBodyEditing = "true";
    const frame = requestAnimationFrame(() => {
      const textarea = bodyEditorRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
      textarea.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      delete host.dataset.devBodyEditing;
      host.style.removeProperty("--dev-body-min-h");
    };
  }, [activeBody]);

  useEffect(() => {
    if (activeBodyValue === undefined) return;
    const frame = requestAnimationFrame(() => {
      const textarea = bodyEditorRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeBodyValue]);

  useEffect(() => {
    if (!expanded || !documentInfo || !editor || !focusEditorOnLoad.current) return;
    focusEditorOnLoad.current = false;
    document.querySelector<HTMLElement>("[data-dev-inline-editable]")?.focus();
  }, [documentInfo, editor, expanded]);

  useEffect(() => {
    if (!dirty && !saving) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.closest(".dev-dock")) return;
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        anchor.download ||
        (anchor.target && anchor.target !== "_self")
      )
        return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin || next.pathname === window.location.pathname) return;
      if (saving) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (window.confirm(devUi.devDiscardNavigation[lang])) {
        if (source.source) pageDrafts.delete(source.source);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, lang, saving, source.source]);

  const cancel = () => {
    dispatch({ type: "cancel" });
    editGroup.current = null;
    setActiveBody(null);
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
      setDocumentInfo(payload);
      dispatch({ type: "saved", fields: payload.fields, revision: payload.revision });
      editGroup.current = null;
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
  const bodyPortal =
    activeBody && editor && activeBody.host.isConnected
      ? createPortal(
          <textarea
            ref={bodyEditorRef}
            className="dev-body-editor"
            value={editor.draft[activeBody.key]}
            lang={activeBody.key === "body_uk" ? "uk" : undefined}
            aria-label={devUi.devBody[lang]}
            spellCheck
            onChange={(event) => {
              edit(activeBody.key, event.target.value);
              event.currentTarget.style.height = "auto";
              event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
            }}
            onBlur={() => {
              editGroup.current = null;
            }}
          />,
          activeBody.host
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
