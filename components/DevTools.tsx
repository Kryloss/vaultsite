"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
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
  revision: string;
  fields: DevFields & { rating?: number | null };
  obsidian: { en: string; uk: string };
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
const pageDrafts = new Map<string, DevEditorState>();
const EMPTY_FIELDS: DevFields = {
  title: "",
  title_uk: "",
  description: "",
  description_uk: "",
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
  const tokenRef = useRef<string | null>(null);
  const pageGeneration = useRef(0);
  const loadRequest = useRef(0);
  const editGroup = useRef<{ key: DevFieldKey; at: number } | null>(null);
  const pencilRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const focusEditorOnLoad = useRef(false);

  const dirty = editor ? devEditorDirty(editor) : false;
  const titleKey: DevFieldKey = lang === "uk" ? "title_uk" : "title";
  const descriptionKey: DevFieldKey = lang === "uk" ? "description_uk" : "description";
  const messageText = message ? editorMessages[message][lang] : null;

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
      const payload = await request<EditorDocument>("document", { source: source.source });
      if (generation !== pageGeneration.current || requestId !== loadRequest.current) return;
      setDocumentInfo(payload);
      const remembered = restoreDraft ? pageDrafts.get(payload.source) : undefined;
      dispatch(
        remembered
          ? { type: "restored", state: remembered }
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
  }, [request, source.source]);

  useEffect(() => {
    if (expanded && source.source && !documentInfo && !loading && !message) void loadDocument();
  }, [documentInfo, expanded, loadDocument, loading, message, source.source]);

  useEffect(() => {
    if (!source.source || !editor) return;
    if (devEditorDirty(editor)) pageDrafts.set(source.source, editor);
    else pageDrafts.delete(source.source);
  }, [editor, source.source]);

  // The Top-list star editor can save the same document independently. Keep
  // this panel's revision current without replacing an in-progress title or
  // description draft; the next Save then remains conflict-safe.
  useEffect(() => {
    const saved = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string; revision?: string }>).detail;
      if (
        !detail ||
        detail.source !== documentInfo?.source ||
        typeof detail.revision !== "string"
      )
        return;
      setDocumentInfo((current) =>
        current ? { ...current, revision: detail.revision! } : current
      );
      dispatch({ type: "revision", revision: detail.revision });
      setMessage(null);
      setConflict(false);
    };
    window.addEventListener(SAVED_EVENT, saved);
    return () => window.removeEventListener(SAVED_EVENT, saved);
  }, [documentInfo?.source]);

  useEffect(() => {
    if (!expanded || !documentInfo || !editor || !focusEditorOnLoad.current) return;
    focusEditorOnLoad.current = false;
    titleRef.current?.focus();
  }, [documentInfo, editor, expanded]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-dev-tools", expanded && available);
    return () => document.documentElement.removeAttribute("data-dev-tools");
  }, [available, expanded]);

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

  // Page titles/descriptions opt into this delegated click target. The values
  // themselves still come from the validated source file; textContent would
  // concatenate both language spans rendered by <T>.
  useEffect(() => {
    if (!expanded || !editor) return;
    const focusField = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>(
        "[data-dev-field-en]"
      );
      if (!target || target.closest(".dev-dock")) return;
      const key = (lang === "uk" ? target.dataset.devFieldUk : target.dataset.devFieldEn) as
        | DevFieldKey
        | undefined;
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      const control = key.startsWith("title") ? titleRef.current : descriptionRef.current;
      control?.focus();
      control?.select();
    };
    document.addEventListener("click", focusField, true);
    return () => document.removeEventListener("click", focusField, true);
  }, [editor, expanded, lang]);

  const edit = (key: DevFieldKey, value: string) => {
    const now = performance.now();
    const previous = editGroup.current;
    const record = !previous || previous.key !== key || now - previous.at > 700;
    editGroup.current = { key, at: now };
    dispatch({ type: "edit", key, value, record });
    setMessage(null);
    setConflict(false);
  };

  const cancel = () => {
    dispatch({ type: "cancel" });
    editGroup.current = null;
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
      const payload = await request<EditorDocument>("save", {
        source: documentInfo.source,
        revision: editor.revision,
        changes: devEditorChanges(editor),
      });
      if (generation !== pageGeneration.current) return;
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

  return (
    <div className="dev-dock" data-expanded={expanded || undefined}>
      {expanded && (
        <section
          id="dev-editor-panel"
          className="dev-editor-panel"
          aria-label={devUi.devPageFields[lang]}
        >
          <div className="dev-editor-heading">
            <span className="truncate">{source.source?.replace(/^vault\//, "")}</span>
            {dirty && (
              <>
                <span className="dev-dirty" aria-hidden />
                <span className="sr-only">{devUi.devUnsaved[lang]}</span>
              </>
            )}
          </div>

          {loading ? (
            <p className="dev-editor-note" role="status">
              {devUi.devLoading[lang]}
            </p>
          ) : editor && documentInfo ? (
            <div className="dev-editor-fields">
              <label>
                <span>{devUi.devTitle[lang]}</span>
                <input
                  ref={titleRef}
                  value={editor.draft[titleKey]}
                  placeholder={lang === "uk" ? editor.draft.title : undefined}
                  required={lang === "en"}
                  maxLength={300}
                  lang={lang === "uk" ? "uk" : undefined}
                  onChange={(event) => edit(titleKey, event.target.value)}
                  onBlur={() => (editGroup.current = null)}
                />
              </label>
              <label>
                <span>{devUi.devDescription[lang]}</span>
                <textarea
                  ref={descriptionRef}
                  value={editor.draft[descriptionKey]}
                  placeholder={lang === "uk" ? editor.draft.description : undefined}
                  maxLength={4000}
                  rows={3}
                  lang={lang === "uk" ? "uk" : undefined}
                  onChange={(event) => edit(descriptionKey, event.target.value)}
                  onBlur={() => (editGroup.current = null)}
                />
              </label>
            </div>
          ) : source.source ? null : (
            <p className="dev-editor-note">{devUi.devNoSource[lang]}</p>
          )}

          {message && (
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
              ) : !documentInfo && source.source ? (
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
          )}
        </section>
      )}

      <div className="dev-dock-bar" role="group" aria-label={devUi.devToolsGroup[lang]}>
        <button
          ref={pencilRef}
          type="button"
          aria-expanded={expanded}
          aria-controls={expanded ? "dev-editor-panel" : undefined}
          aria-label={(expanded ? devUi.devToolsClose : devUi.devToolsOpen)[lang]}
          title={(expanded ? devUi.devToolsClose : devUi.devToolsOpen)[lang]}
          onClick={(event) => {
            if (!expanded && event.detail === 0) focusEditorOnLoad.current = true;
            setExpanded((value) => !value);
          }}
          className="press dev-tool-button"
        >
          <PenIcon className="h-[17px] w-[17px]" />
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
  );
}
