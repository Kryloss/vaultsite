"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@/components/icons";
import { useDevToolsExpanded } from "@/components/useDevToolsExpanded";
import { useLang } from "@/components/useLang";
import { devEditorRequest, DevEditorRequestError } from "@/lib/dev-editor-client";
import type { DevFields } from "@/lib/dev-tools";
import { devUi } from "@/lib/ui-strings";

const SAVED_EVENT = "vault-dev-editor-saved";

interface GoalPayload {
  source: string;
  revision: string;
  revisionUk?: string;
  fields: DevFields;
}

function goalToggleClass(done: boolean) {
  return `now-goal-check flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
    done
      ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]"
      : "border-[var(--border)] text-transparent"
  }`;
}

export default function DevNowGoalToggle({
  source,
  sourceUk,
  index,
  label,
  done,
}: {
  source: string;
  sourceUk?: string;
  index: number;
  label: string;
  done: boolean;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const expanded = useDevToolsExpanded();
  const [value, setValue] = useState(done);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "conflict" | "failed">("idle");

  useEffect(() => {
    if (!saving) setValue(done);
  }, [done, saving]);

  const toggle = async () => {
    if (!expanded || saving) return;
    if (document.documentElement.hasAttribute("data-dev-dirty")) {
      setStatus("failed");
      return;
    }
    const next = !value;
    setValue(next);
    setSaving(true);
    setStatus("idle");
    try {
      const payload = await devEditorRequest<GoalPayload>("toggle-now-goal", {
        source,
        sourceUk,
        index,
        done: next,
        expectedLabel: label,
      });
      window.dispatchEvent(
        new CustomEvent(SAVED_EVENT, {
          detail: {
            source: payload.source,
            revision: payload.revision,
            revisionUk: payload.revisionUk,
            fields: payload.fields,
          },
        })
      );
      setStatus("saved");
      router.refresh();
    } catch (error) {
      setValue(!next);
      setStatus(
        error instanceof DevEditorRequestError && error.code === "revision_conflict"
          ? "conflict"
          : "failed"
      );
    } finally {
      setSaving(false);
    }
  };

  const statusText =
    status === "saved"
      ? devUi.devGoalSaved[lang]
      : status === "conflict"
        ? devUi.devConflict[lang]
        : status === "failed"
          ? document.documentElement.hasAttribute("data-dev-dirty")
            ? devUi.devFinishCurrentEdit[lang]
            : devUi.devGoalFailed[lang]
          : undefined;

  if (!expanded) {
    return (
      <span className={goalToggleClass(value)} aria-hidden>
        <CheckIcon className="h-[17px] w-[17px]" />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${goalToggleClass(value)} press dev-now-goal-toggle`}
      role="checkbox"
      aria-checked={value}
      aria-label={`${devUi.devGoal[lang]}: ${label}`}
      aria-busy={saving ? true : undefined}
      disabled={saving}
      title={statusText}
      onClick={() => void toggle()}
    >
      <CheckIcon className="h-[17px] w-[17px]" />
      {statusText && <span className="sr-only" role="status">{statusText}</span>}
    </button>
  );
}
