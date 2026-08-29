"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/useLang";
import { useDevToolsExpanded } from "@/components/useDevToolsExpanded";
import { devEditorRequest, DevEditorRequestError } from "@/lib/dev-editor-client";
import { devUi } from "@/lib/ui-strings";

const SAVED_EVENT = "vault-dev-editor-saved";

interface SeriesOption {
  name: string;
  nameUk?: string;
}

interface DocumentPayload {
  revision: string;
}

function categoryList(value: string) {
  const out: string[] = [];
  for (const item of value.split(",")) {
    const category = item.trim();
    if (category && !out.some((existing) => existing.toLowerCase() === category.toLowerCase())) {
      out.push(category);
    }
  }
  return out;
}

export default function DevEntryOptions({
  source,
  sectionType,
  draft: initialDraft,
  categories: initialCategories,
  series: initialSeries,
  seriesUk: initialSeriesUk,
  part: initialPart,
  categoryOptions,
  seriesOptions,
}: {
  source: string;
  sectionType: string;
  draft: boolean;
  categories: string[];
  series?: string;
  seriesUk?: string;
  part?: number;
  categoryOptions: string[];
  seriesOptions: SeriesOption[];
}) {
  const { lang } = useLang();
  const router = useRouter();
  const expanded = useDevToolsExpanded();
  const id = useId().replace(/:/g, "");
  const [draft, setDraft] = useState(initialDraft);
  const [categories, setCategories] = useState(initialCategories.join(", "));
  const [series, setSeries] = useState(initialSeries ?? "");
  const [seriesUk, setSeriesUk] = useState(initialSeriesUk ?? "");
  const [part, setPart] = useState(initialPart ? String(initialPart) : "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "conflict" | "failed">("idle");
  const [failure, setFailure] = useState<"dirty" | "part" | "seriesUk" | null>(null);

  useEffect(() => {
    if (saving) return;
    setDraft(initialDraft);
    setCategories(initialCategories.join(", "));
    setSeries(initialSeries ?? "");
    setSeriesUk(initialSeriesUk ?? "");
    setPart(initialPart ? String(initialPart) : "");
  }, [initialCategories, initialDraft, initialPart, initialSeries, initialSeriesUk, saving]);

  if (!expanded) return null;

  const supportsCategories = ["posts", "people", "shelf"].includes(sectionType);
  const supportsSeries = sectionType === "posts";
  const existingSeries = seriesOptions.find(
    (option) => option.name.toLowerCase() === series.trim().toLowerCase()
  );
  const ownsSeriesTranslation = Boolean(
    initialSeriesUk &&
      initialSeries &&
      initialSeries.trim().toLowerCase() === series.trim().toLowerCase()
  );
  const seriesUkLocked = Boolean(existingSeries?.nameUk && !ownsSeriesTranslation);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (document.documentElement.hasAttribute("data-dev-dirty")) {
      setFailure("dirty");
      setStatus("failed");
      return;
    }
    const names = categoryList(categories);
    const partNumber = part.trim() ? Number(part) : null;
    if (
      supportsSeries &&
      partNumber !== null &&
      (!Number.isSafeInteger(partNumber) || partNumber < 1)
    ) {
      setFailure("part");
      setStatus("failed");
      return;
    }
    if (supportsSeries && series.trim() && !existingSeries?.nameUk && !seriesUk.trim()) {
      setFailure("seriesUk");
      setStatus("failed");
      return;
    }
    setSaving(true);
    setFailure(null);
    setStatus("idle");
    try {
      const opened = await devEditorRequest<DocumentPayload>("document", { source });
      const changes: Record<string, unknown> = {
        draft: draft ? true : null,
        published: null,
      };
      if (supportsSeries) {
        changes.series = series.trim() || null;
        // An established series stores its Ukrainian name on one part only.
        // Joining it here must not duplicate that value onto every new part.
        changes.series_uk =
          series.trim() && (!existingSeries?.nameUk || ownsSeriesTranslation) && seriesUk.trim()
            ? seriesUk.trim()
            : null;
        changes.part = series.trim() ? partNumber : null;
      }
      if (supportsCategories) {
        if (sectionType === "posts" && names.length <= 1) {
          changes.category = names[0] ?? null;
          changes.categories = null;
        } else {
          changes.category = null;
          changes.categories = names.length ? names : null;
        }
      }
      const saved = await devEditorRequest<DocumentPayload>("save", {
        source,
        revision: opened.revision,
        changes,
      });
      window.dispatchEvent(
        new CustomEvent(SAVED_EVENT, { detail: { source, revision: saved.revision } })
      );
      setStatus("saved");
      router.refresh();
    } catch (error) {
      setFailure(null);
      setStatus(
        error instanceof DevEditorRequestError && error.code === "revision_conflict"
          ? "conflict"
          : "failed"
      );
    } finally {
      setSaving(false);
    }
  };

  let statusText: string | null = null;
  if (status === "saved") statusText = devUi.devOptionsSaved[lang];
  else if (status === "conflict") statusText = devUi.devConflict[lang];
  else if (status === "failed") {
    if (failure === "dirty") statusText = devUi.devFinishCurrentEdit[lang];
    else if (failure === "part") statusText = devUi.devInvalidPart[lang];
    else if (failure === "seriesUk") statusText = devUi.devSeriesUkRequired[lang];
    else statusText = devUi.devOptionsFailed[lang];
  }

  return (
    <details className="dev-entry-options">
      <summary className="press">{devUi.devPageOptions[lang]}</summary>
      <form className="dev-entry-options-form" onSubmit={save}>
        <label className="dev-entry-draft">
          <input
            type="checkbox"
            checked={draft}
            onChange={(event) => {
              setDraft(event.target.checked);
              setFailure(null);
              setStatus("idle");
            }}
          />
          <span>{devUi.devDraft[lang]}</span>
        </label>

        {supportsCategories && (
          <label className="dev-entry-options-wide">
            <span>{devUi.devCategories[lang]}</span>
            <input
              value={categories}
              maxLength={1600}
              list={`dev-entry-categories-${id}`}
              placeholder={devUi.devCategoriesHint[lang]}
              onChange={(event) => {
                setCategories(event.target.value);
                setFailure(null);
                setStatus("idle");
              }}
            />
            <datalist id={`dev-entry-categories-${id}`}>
              {categoryOptions.map((category) => <option key={category} value={category} />)}
            </datalist>
            <small>{devUi.devCategoryTranslationNote[lang]}</small>
          </label>
        )}

        {supportsSeries && (
          <>
            <label className="dev-entry-options-wide">
              <span>{devUi.devSeries[lang]}</span>
              <input
                value={series}
                maxLength={200}
                list={`dev-entry-series-${id}`}
                placeholder={devUi.devSeriesHint[lang]}
                onChange={(event) => {
                  const next = event.target.value;
                  setSeries(next);
                  if (next.trim().toLowerCase() !== (initialSeries ?? "").trim().toLowerCase()) {
                    setSeriesUk("");
                  }
                  setFailure(null);
                  setStatus("idle");
                }}
              />
              <datalist id={`dev-entry-series-${id}`}>
                {seriesOptions.map((option) => <option key={option.name} value={option.name} />)}
              </datalist>
            </label>
            <label>
              <span>{devUi.devSeriesUk[lang]}</span>
              <input
                value={seriesUk}
                maxLength={200}
                lang="uk"
                disabled={!series.trim() || seriesUkLocked}
                placeholder={existingSeries?.nameUk ?? undefined}
                onChange={(event) => {
                  setSeriesUk(event.target.value);
                  setFailure(null);
                  setStatus("idle");
                }}
              />
            </label>
            <label>
              <span>{devUi.devSeriesPart[lang]}</span>
              <input
                type="number"
                min={1}
                step={1}
                value={part}
                disabled={!series.trim()}
                placeholder={devUi.devAutomatic[lang]}
                onChange={(event) => {
                  setPart(event.target.value);
                  setFailure(null);
                  setStatus("idle");
                }}
              />
            </label>
          </>
        )}

        <div className="dev-entry-options-actions">
          {statusText && <span role={status === "failed" ? "alert" : "status"}>{statusText}</span>}
          <button type="submit" className="press" disabled={saving}>
            {saving ? devUi.devSaving[lang] : devUi.devSaveOptions[lang]}
          </button>
        </div>
      </form>
    </details>
  );
}
