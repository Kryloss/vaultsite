"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Stars from "@/components/Stars";
import { clampRating } from "@/lib/stars";
import { devUi } from "@/lib/ui-strings";
import { isDevToolsAvailable } from "@/lib/dev-tools";
import { useLang } from "@/components/useLang";

const SAVED_EVENT = "vault-dev-editor-saved";

interface DocumentPayload {
  revision: string;
  fields?: { rating?: number | null };
}

class RatingRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

function ratingFromPointer(event: PointerEvent | React.PointerEvent, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  return clampRating(fraction * 5);
}

export default function DevRatingEditor({
  source,
  rating,
  title,
  titleUk,
}: {
  source: string;
  rating?: number;
  title: string;
  titleUk?: string;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<number | null>(
    typeof rating === "number" ? clampRating(rating) : null
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "conflict" | "failed">(
    "idle"
  );
  const activePointer = useRef<number | null>(null);
  const tokenRef = useRef<string | null>(null);
  const documentRef = useRef<{ revision: string; rating: number | null } | null>(null);
  const baselineRef = useRef<number | null>(typeof rating === "number" ? clampRating(rating) : null);
  const saveQueue = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const sync = () =>
      setEditing(
        isDevToolsAvailable(process.env.NODE_ENV, window.location.hostname) &&
          document.documentElement.hasAttribute("data-dev-tools")
      );
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-dev-tools"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (documentRef.current) return;
    const next = typeof rating === "number" ? clampRating(rating) : null;
    baselineRef.current = next;
    setValue(next);
  }, [rating]);

  const sessionToken = useCallback(async (fresh = false) => {
    if (!fresh && tokenRef.current) return tokenRef.current;
    const response = await fetch("/__vault-editor/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new RatingRequestError("Editor session unavailable");
    const payload = (await response.json()) as { token?: string };
    if (!payload.token) throw new RatingRequestError("Editor session unavailable");
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
        if (!response.ok) throw new RatingRequestError(payload.message ?? "Editor request failed", payload.code);
        return payload as T;
      }
      throw new RatingRequestError("Editor session unavailable");
    },
    [sessionToken]
  );

  const ensureDocument = useCallback(async () => {
    if (documentRef.current) return documentRef.current;
    const payload = await request<DocumentPayload>("document", { source });
    documentRef.current = {
      revision: payload.revision,
      rating: typeof payload.fields?.rating === "number" ? clampRating(payload.fields.rating) : null,
    };
    baselineRef.current = documentRef.current.rating;
    setValue(documentRef.current.rating);
    return documentRef.current;
  }, [request, source]);

  const saveValue = useCallback(
    async (next: number | null) => {
      const run = async () => {
        setStatus("saving");
        try {
          const document = await ensureDocument();
          const payload = await request<DocumentPayload>("save", {
            source,
            revision: document.revision,
            changes: { rating: next },
          });
          documentRef.current = { revision: payload.revision, rating: next };
          baselineRef.current = next;
          setValue(next);
          setStatus("saved");
          window.dispatchEvent(
            new CustomEvent(SAVED_EVENT, {
              detail: { source, revision: payload.revision },
            })
          );
          router.refresh();
        } catch (error) {
          setValue(baselineRef.current);
          if (error instanceof RatingRequestError && error.code === "revision_conflict") {
            documentRef.current = null;
            setStatus("conflict");
          } else {
            setStatus("failed");
          }
        }
      };
      const previous = saveQueue.current ?? Promise.resolve();
      const nextRun = previous.then(run, run);
      saveQueue.current = nextRun.finally(() => {
        if (saveQueue.current === nextRun) saveQueue.current = null;
      });
      await nextRun;
    },
    [ensureDocument, request, router, source]
  );

  const choose = (next: number | null) => {
    setValue(next);
    void saveValue(next);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setValue(ratingFromPointer(event, event.currentTarget));
    void ensureDocument().catch(() => setStatus("failed"));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (activePointer.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    setValue(ratingFromPointer(event, event.currentTarget));
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (activePointer.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const next = ratingFromPointer(event, event.currentTarget);
    choose(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Tab") return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Delete", "Backspace"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const current = value ?? 0;
    const next =
      event.key === "Delete" || event.key === "Backspace"
        ? null
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? 5
            : clampRating(current + (event.key === "ArrowRight" ? 0.5 : -0.5));
    choose(next);
  };

  if (!editing) return typeof value === "number" ? <Stars rating={value} /> : null;

  const label = `${devUi.devRatingFor[lang]} ${lang === "uk" ? titleUk ?? title : title}`;
  const displayValue = value ?? 0;
  const statusText =
    status === "saving"
      ? devUi.devSaving[lang]
      : status === "saved"
        ? devUi.devSaved[lang]
        : status === "conflict"
          ? devUi.devConflict[lang]
          : status === "failed"
            ? devUi.devSaveFailed[lang]
            : "";

  return (
    <>
      <span
        className="dev-rating-editor"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value == null ? devUi.devUnrated[lang] : `${value} / 5`}
        title={label}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden="true">
          <Stars rating={displayValue} />
        </span>
      </span>
      <span className="sr-only" aria-live="polite">
        {statusText}
      </span>
    </>
  );
}
