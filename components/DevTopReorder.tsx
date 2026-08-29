"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isDevToolsAvailable } from "@/lib/dev-tools";
import { devUi } from "@/lib/ui-strings";
import { useLang } from "@/components/useLang";

const SAVED_EVENT = "vault-dev-editor-saved";
const DRAG_THRESHOLD = 6;

interface ReorderDocument {
  source: string;
  revision: string;
}

interface ReorderPayload {
  documents?: ReorderDocument[];
  code?: string;
  message?: string;
}

class ReorderRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

interface Candidate {
  item: HTMLLIElement;
  list: HTMLOListElement;
  pointerId: number;
  x: number;
  y: number;
  original: string[];
  dragging: boolean;
}

function rows(list: HTMLOListElement) {
  return [...list.querySelectorAll<HTMLLIElement>("li[data-dev-top-source]")];
}

function sources(list: HTMLOListElement) {
  return rows(list)
    .map((row) => row.dataset.devTopSource)
    .filter((source): source is string => Boolean(source));
}

function updateRanks(list: HTMLOListElement) {
  rows(list).forEach((row, index) => {
    const rank = row.querySelector<HTMLElement>(".top-rank");
    if (rank) rank.textContent = String(index + 1);
  });
}

function restoreOrder(list: HTMLOListElement, order: string[]) {
  const bySource = new Map(
    rows(list)
      .map((row) => [row.dataset.devTopSource, row] as const)
      .filter((pair): pair is [string, HTMLLIElement] => Boolean(pair[0]))
  );
  for (const source of order) {
    const row = bySource.get(source);
    if (row) list.append(row);
  }
  updateRanks(list);
}

export default function DevTopReorder() {
  const { lang } = useLang();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const tokenRef = useRef<string | null>(null);
  const candidateRef = useRef<Candidate | null>(null);
  const suppressClickRef = useRef<HTMLLIElement | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const sync = () =>
      setEditing(
        isDevToolsAvailable(process.env.NODE_ENV, window.location.hostname) &&
          document.documentElement.hasAttribute("data-dev-tools")
      );
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-dev-tools"],
    });
    return () => observer.disconnect();
  }, []);

  const sessionToken = useCallback(async (fresh = false) => {
    if (!fresh && tokenRef.current) return tokenRef.current;
    const response = await fetch("/__vault-editor/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new ReorderRequestError("Editor session unavailable");
    const payload = (await response.json()) as { token?: string };
    if (!payload.token) throw new ReorderRequestError("Editor session unavailable");
    tokenRef.current = payload.token;
    return payload.token;
  }, []);

  const request = useCallback(
    async (body: object): Promise<ReorderPayload> => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const token = await sessionToken(attempt > 0);
        const response = await fetch("/__vault-editor/reorder", {
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
        const payload = (await response.json().catch(() => ({}))) as ReorderPayload;
        if (!response.ok) {
          throw new ReorderRequestError(payload.message ?? "Editor request failed", payload.code);
        }
        return payload;
      }
      throw new ReorderRequestError("Editor session unavailable");
    },
    [sessionToken]
  );

  const save = useCallback(
    async (list: HTMLOListElement, original: string[]) => {
      const order = sources(list);
      if (order.length !== original.length || order.every((source, index) => source === original[index])) {
        return;
      }
      savingRef.current = true;
      setStatus("saving");
      try {
        const payload = await request({
          items: order.map((source, index) => ({ source, order: index })),
        });
        for (const document of payload.documents ?? []) {
          window.dispatchEvent(
            new CustomEvent(SAVED_EVENT, {
              detail: { source: document.source, revision: document.revision },
            })
          );
        }
        setStatus("saved");
        router.refresh();
      } catch {
        restoreOrder(list, original);
        setStatus("failed");
      } finally {
        savingRef.current = false;
      }
    },
    [request, router]
  );

  useEffect(() => {
    if (!editing) {
      candidateRef.current = null;
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (savingRef.current || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(".dev-rating-editor,button,input,textarea,select")) return;
      const item = target.closest<HTMLLIElement>("li[data-dev-top-source]");
      const list = item?.closest<HTMLOListElement>("ol[data-dev-top-list]");
      if (!item || !list) return;
      candidateRef.current = {
        item,
        list,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        original: sources(list),
        dragging: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const candidate = candidateRef.current;
      if (!candidate || candidate.pointerId !== event.pointerId) return;
      if (!candidate.dragging) {
        const distance = Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y);
        if (distance < DRAG_THRESHOLD) return;
        candidate.dragging = true;
        candidate.item.dataset.devDragging = "true";
        candidate.list.dataset.devReordering = "true";
      }
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLLIElement>(
        "li[data-dev-top-source]"
      );
      if (!target || target === candidate.item || target.parentElement !== candidate.list) return;
      const rect = target.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      candidate.list.insertBefore(candidate.item, before ? target : target.nextSibling);
      updateRanks(candidate.list);
    };

    const onPointerUp = (event: PointerEvent) => {
      const candidate = candidateRef.current;
      if (!candidate || candidate.pointerId !== event.pointerId) return;
      candidateRef.current = null;
      if (!candidate.dragging) return;
      event.preventDefault();
      // The row is still an ordinary link. Suppress the synthetic click that
      // follows a completed drag so dropping a title never navigates away.
      suppressClickRef.current = candidate.item;
      delete candidate.item.dataset.devDragging;
      delete candidate.list.dataset.devReordering;
      void save(candidate.list, candidate.original);
    };

    const onPointerCancel = () => {
      const candidate = candidateRef.current;
      candidateRef.current = null;
      if (!candidate) return;
      if (candidate.dragging) restoreOrder(candidate.list, candidate.original);
      delete candidate.item.dataset.devDragging;
      delete candidate.list.dataset.devReordering;
    };

    const onClick = (event: MouseEvent) => {
      const item = suppressClickRef.current;
      const target = event.target instanceof Element ? event.target : null;
      if (!item || !target || !item.contains(target)) return;
      suppressClickRef.current = null;
      event.preventDefault();
      event.stopPropagation();
    };

    const blockNativeDrag = (event: DragEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("ol[data-dev-top-list]")) event.preventDefault();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    document.addEventListener("dragstart", blockNativeDrag, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.removeEventListener("dragstart", blockNativeDrag, true);
      document.removeEventListener("click", onClick, true);
      onPointerCancel();
    };
  }, [editing, save]);

  if (!editing) return null;
  const statusText =
    status === "saving"
      ? devUi.devReorderSaving[lang]
      : status === "saved"
        ? devUi.devReorderSaved[lang]
        : status === "failed"
          ? devUi.devReorderFailed[lang]
          : "";
  return (
    <span className="sr-only" aria-live="polite">
      {statusText}
    </span>
  );
}
